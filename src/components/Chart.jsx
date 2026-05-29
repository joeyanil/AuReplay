import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react'
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts'

// ── helpers ────────────────────────────────────────────────────────────────────

function priceToY(price, priceScale, chartHeight) {
  // priceScale is the chart's price scale API — we use coordinateForPrice
  return priceScale ? priceScale.coordinateForPrice(price) : null
}

// ── Drawing overlay (SVG) ─────────────────────────────────────────────────────

function DrawingOverlay({ drawings, activeTool, chartRef, onDrawingComplete, onDrawingsChange }) {
  const svgRef = useRef(null)
  const [inProgress, setInProgress] = useState(null) // { tool, points: [{x,y,price,time}] }
  const [dragging, setDragging] = useState(null)      // { drawingIndex, pointIndex }

  // Convert SVG-relative coords to chart price via the chart API
  const coordsFromEvent = useCallback((e) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const touch = e.touches ? e.touches[0] : e
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top
    const chart = chartRef.current?.chart
    if (!chart) return null
    // Use lightweight-charts coordinate conversion
    const price = chart.priceScale('right').coordinateToPrice(y)
    // Approximate time from x — use the visible logical range
    return { x, y, price }
  }, [chartRef])

  const handleStart = useCallback((e) => {
    if (!activeTool || activeTool === 'none') return
    e.preventDefault()
    const coords = coordsFromEvent(e)
    if (!coords) return

    // Check if tapping near an existing drawing point for dragging
    for (let di = 0; di < drawings.length; di++) {
      const d = drawings[di]
      for (let pi = 0; pi < d.points.length; pi++) {
        const p = d.points[pi]
        if (Math.hypot(p.x - coords.x, p.y - coords.y) < 18) {
          setDragging({ drawingIndex: di, pointIndex: pi })
          return
        }
      }
    }

    // Start a new drawing
    setInProgress({ tool: activeTool, points: [coords] })
  }, [activeTool, coordsFromEvent, drawings])

  const handleMove = useCallback((e) => {
    e.preventDefault()
    const coords = coordsFromEvent(e)
    if (!coords) return

    if (dragging !== null) {
      const updated = drawings.map((d, di) => {
        if (di !== dragging.drawingIndex) return d
        const pts = d.points.map((p, pi) =>
          pi === dragging.pointIndex ? coords : p
        )
        return { ...d, points: pts }
      })
      onDrawingsChange(updated)
      return
    }

    if (inProgress) {
      setInProgress(prev => ({ ...prev, preview: coords }))
    }
  }, [dragging, inProgress, coordsFromEvent, drawings, onDrawingsChange])

  const handleEnd = useCallback((e) => {
    e.preventDefault()
    if (dragging !== null) {
      setDragging(null)
      return
    }
    if (!inProgress) return

    const tool = inProgress.tool
    const points = inProgress.points

    // Single-point tools: horizontal line
    if (tool === 'horizontal') {
      onDrawingComplete({ tool, points })
      setInProgress(null)
      return
    }

    // Two-point tools: need second tap
    if (points.length === 1 && inProgress.preview) {
      const second = inProgress.preview
      onDrawingComplete({ tool, points: [points[0], second] })
      setInProgress(null)
    }
  }, [dragging, inProgress, onDrawingComplete])

  // Render each drawing as SVG elements
  const renderDrawing = (d, i) => {
    const { tool, points } = d
    const color = d.color || '#F0B90B'
    const strokeW = 1.5

    if (tool === 'horizontal' && points[0]) {
      const y = points[0].y
      return (
        <g key={i}>
          <line x1={0} y1={y} x2={10000} y2={y} stroke={color} strokeWidth={strokeW} strokeDasharray="4 3" />
          <text x={6} y={y - 4} fill={color} fontSize={10}>{points[0].price?.toFixed(2)}</text>
          <circle cx={points[0].x} cy={y} r={6} fill={color} fillOpacity={0.3} />
        </g>
      )
    }

    if ((tool === 'trendline' || tool === 'pricerange' || tool === 'rectangle' || tool === 'fib') && points.length >= 2) {
      const [p1, p2] = points

      if (tool === 'trendline') {
        return (
          <g key={i}>
            <line x1={0} y1={p1.y + (0 - p1.x) * (p2.y - p1.y) / (p2.x - p1.x)}
                  x2={10000} y2={p1.y + (10000 - p1.x) * (p2.y - p1.y) / (p2.x - p1.x)}
                  stroke={color} strokeWidth={strokeW} />
            <circle cx={p1.x} cy={p1.y} r={5} fill={color} fillOpacity={0.4} />
            <circle cx={p2.x} cy={p2.y} r={5} fill={color} fillOpacity={0.4} />
          </g>
        )
      }

      if (tool === 'pricerange') {
        const dist = Math.abs((p2.price || 0) - (p1.price || 0))
        const midY = (p1.y + p2.y) / 2
        return (
          <g key={i}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p1.y} stroke={color} strokeWidth={strokeW} />
            <line x1={p1.x} y1={p2.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={strokeW} />
            <line x1={(p1.x + p2.x) / 2} y1={p1.y} x2={(p1.x + p2.x) / 2} y2={p2.y} stroke={color} strokeWidth={strokeW} strokeDasharray="3 3" />
            <rect x={p1.x} y={Math.min(p1.y, p2.y)} width={Math.abs(p2.x - p1.x)} height={Math.abs(p2.y - p1.y)} fill={color} fillOpacity={0.07} />
            <text x={(p1.x + p2.x) / 2 + 4} y={midY} fill={color} fontSize={10}>{dist.toFixed(2)} pts</text>
          </g>
        )
      }

      if (tool === 'rectangle') {
        const x = Math.min(p1.x, p2.x)
        const y = Math.min(p1.y, p2.y)
        const w = Math.abs(p2.x - p1.x)
        const h = Math.abs(p2.y - p1.y)
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} stroke={color} strokeWidth={strokeW} fill={color} fillOpacity={0.08} />
            <circle cx={p1.x} cy={p1.y} r={5} fill={color} fillOpacity={0.4} />
            <circle cx={p2.x} cy={p2.y} r={5} fill={color} fillOpacity={0.4} />
          </g>
        )
      }

      if (tool === 'fib') {
        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
        const labels = ['0%', '23.6%', '38.2%', '50%', '61.8%', '78.6%', '100%']
        const colors = ['#999', '#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0', '#999']
        const priceDiff = (p2.price || 0) - (p1.price || 0)
        const yDiff = p2.y - p1.y
        return (
          <g key={i}>
            {levels.map((lvl, li) => {
              const ly = p1.y + yDiff * lvl
              const lp = (p1.price || 0) + priceDiff * lvl
              return (
                <g key={li}>
                  <line x1={0} y1={ly} x2={10000} y2={ly} stroke={colors[li]} strokeWidth={1} strokeOpacity={0.7} strokeDasharray="5 3" />
                  <text x={p1.x + 4} y={ly - 3} fill={colors[li]} fontSize={9}>{labels[li]} — {lp.toFixed(2)}</text>
                </g>
              )
            })}
          </g>
        )
      }
    }

    if ((tool === 'long' || tool === 'short') && points.length >= 2) {
      const [entry, tp] = points
      const slY = entry.y + (entry.y - tp.y) // mirror SL on other side of entry
      const slPrice = entry.price - (tp.price - entry.price)
      const rr = tp.price && entry.price && slPrice
        ? Math.abs((tp.price - entry.price) / (entry.price - slPrice))
        : null

      const isLong = tool === 'long'
      const tpColor = isLong ? '#26a69a' : '#ef5350'
      const slColor = isLong ? '#ef5350' : '#26a69a'

      const tpTop = Math.min(entry.y, tp.y)
      const tpH = Math.abs(entry.y - tp.y)
      const slTop = entry.y
      const slH = Math.abs(slY - entry.y)

      return (
        <g key={i}>
          {/* TP zone */}
          <rect x={0} y={tpTop} width={10000} height={tpH} fill={tpColor} fillOpacity={0.15} />
          <line x1={0} y1={tp.y} x2={10000} y2={tp.y} stroke={tpColor} strokeWidth={1.5} />
          <text x={8} y={tp.y - 4} fill={tpColor} fontSize={10}>TP {tp.price?.toFixed(2)}</text>

          {/* Entry line */}
          <line x1={0} y1={entry.y} x2={10000} y2={entry.y} stroke="#ffffff" strokeWidth={2} />
          <text x={8} y={entry.y - 4} fill="#ffffff" fontSize={10}>Entry {entry.price?.toFixed(2)}</text>

          {/* SL zone */}
          <rect x={0} y={slTop} width={10000} height={slH} fill={slColor} fillOpacity={0.15} />
          <line x1={0} y1={slY} x2={10000} y2={slY} stroke={slColor} strokeWidth={1.5} />
          <text x={8} y={slY + 12} fill={slColor} fontSize={10}>SL {slPrice?.toFixed(2)}</text>

          {rr && (
            <text x={8} y={entry.y + (isLong ? tpH / 2 : -tpH / 2)} fill="#ffffff" fontSize={11} fontWeight="bold">
              RR {rr.toFixed(2)}
            </text>
          )}

          <circle cx={entry.x} cy={entry.y} r={6} fill="#ffffff" fillOpacity={0.4} />
          <circle cx={tp.x} cy={tp.y} r={6} fill={tpColor} fillOpacity={0.5} />
        </g>
      )
    }

    return null
  }

  // Render in-progress preview line
  const renderPreview = () => {
    if (!inProgress || !inProgress.preview) return null
    const p1 = inProgress.points[0]
    const p2 = inProgress.preview
    const tool = inProgress.tool
    const color = '#F0B90B'

    if (tool === 'horizontal') {
      return <line x1={0} y1={p1.y} x2={10000} y2={p1.y} stroke={color} strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.6} />
    }
    if (tool === 'trendline') {
      return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={1.5} strokeOpacity={0.6} />
    }
    if (tool === 'rectangle') {
      const x = Math.min(p1.x, p2.x), y = Math.min(p1.y, p2.y)
      const w = Math.abs(p2.x - p1.x), h = Math.abs(p2.y - p1.y)
      return <rect x={x} y={y} width={w} height={h} stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.06} strokeOpacity={0.6} />
    }
    return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={1.5} strokeOpacity={0.6} strokeDasharray="5 3" />
  }

  return (
    <svg
      ref={svgRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, cursor: activeTool && activeTool !== 'none' ? 'crosshair' : 'default', touchAction: 'none', pointerEvents: activeTool && activeTool !== 'none' ? 'all' : 'none' }}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    >
      {drawings.map(renderDrawing)}
      {renderPreview()}
    </svg>
  )
}

// ── Main Chart component ───────────────────────────────────────────────────────

const Chart = forwardRef(function Chart({ candles, visibleIndex, activeTool, drawings, onDrawingComplete, onDrawingsChange }, ref) {
  const containerRef = useRef(null)
  const chartInstanceRef = useRef(null)
  const seriesRef = useRef(null)

  // Expose chart ref to parent
  useImperativeHandle(ref, () => ({
    get chart() { return chartInstanceRef.current },
    get series() { return seriesRef.current },
  }))

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#1e2130' },
        horzLines: { color: '#1e2130' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#758696', labelBackgroundColor: '#131722' },
        horzLine: { color: '#758696', labelBackgroundColor: '#131722' },
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })

    const series = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    })

    chartInstanceRef.current = chart
    seriesRef.current = series

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [])

  // Update candle data when visibleIndex changes
  useEffect(() => {
    if (!seriesRef.current || !candles.length) return
    const visible = candles.slice(0, visibleIndex + 1)
    seriesRef.current.setData(visible)
    // Scroll to latest candle
    if (chartInstanceRef.current) {
      chartInstanceRef.current.timeScale().scrollToPosition(5, false)
    }
  }, [candles, visibleIndex])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <DrawingOverlay
        drawings={drawings}
        activeTool={activeTool}
        chartRef={{ current: { chart: chartInstanceRef.current } }}
        onDrawingComplete={onDrawingComplete}
        onDrawingsChange={onDrawingsChange}
      />
    </div>
  )
})

export default Chart
