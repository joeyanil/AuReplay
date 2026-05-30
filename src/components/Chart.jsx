import React, {
  useEffect, useRef, useImperativeHandle,
  forwardRef, useState, useCallback
} from 'react'
import { createChart, CrosshairMode } from 'lightweight-charts'
import { FIB_LEVELS, COLORS } from '../constants.js'

// ─── Price-anchor helpers ─────────────────────────────────────────────────────
// Drawings store price values. We convert price→y on every render using the
// chart's priceScale so drawings stay glued to the correct price level.

function useChartCoords(chartRef) {
  const toY = useCallback((price) => {
    const chart = chartRef.current?.chart
    if (!chart) return null
    try { return chart.priceScale('right').priceToCoordinate(price) }
    catch { return null }
  }, [chartRef])

  const toPrice = useCallback((y) => {
    const chart = chartRef.current?.chart
    if (!chart) return null
    try { return chart.priceScale('right').coordinateToPrice(y) }
    catch { return null }
  }, [chartRef])

  const toX = useCallback((svgRect) => {
    // We don't need time→x for the drawing types we have;
    // drawings are placed by tapping and stored with price only.
    return null
  }, [])

  return { toY, toPrice }
}

// ─── SVG Drawing Overlay ──────────────────────────────────────────────────────
function DrawingOverlay({ drawings, activeTool, chartRef, onDrawingComplete, onDrawingsChange }) {
  const svgRef  = useRef(null)
  const [inProgress, setInProgress] = useState(null)
  const [selected,   setSelected]   = useState(null) // index of selected drawing
  const [dragState,  setDragState]  = useState(null) // { drawingIndex, pointIndex, startY, startPrice }
  const { toY, toPrice } = useChartCoords(chartRef)
  const [, forceUpdate] = useState(0)

  // Re-render overlay whenever chart scrolls/zooms (price→y changes)
  useEffect(() => {
    const chart = chartRef.current?.chart
    if (!chart) return
    const unsub1 = chart.timeScale().subscribeVisibleTimeRangeChange(() => forceUpdate(n => n + 1))
    const unsub2 = chart.priceScale('right').applyOptions // watch resize via ResizeObserver on container
    return () => { try { unsub1() } catch {} }
  }, [chartRef])

  // ── Event helpers ───────────────────────────────────────────────────────────
  const getEventCoords = useCallback((e) => {
    const svg  = svgRef.current
    if (!svg) return null
    const rect  = svg.getBoundingClientRect()
    const touch = e.touches?.[0] ?? e
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top
    const price = toPrice(y)
    return { x, y, price }
  }, [toPrice])

  // ── Touch/mouse handlers ────────────────────────────────────────────────────
  const onStart = useCallback((e) => {
    if (!activeTool || activeTool === 'none') return
    e.preventDefault()
    const coords = getEventCoords(e)
    if (!coords || coords.price == null) return

    // Check tap on existing drawing point → drag
    for (let di = 0; di < drawings.length; di++) {
      for (let pi = 0; pi < drawings[di].points.length; pi++) {
        const p   = drawings[di].points[pi]
        const py  = toY(p.price)
        if (py == null) continue
        const px  = p.x ?? coords.x
        if (Math.hypot(px - coords.x, py - coords.y) < 20) {
          setDragState({ drawingIndex: di, pointIndex: pi })
          setSelected(di)
          return
        }
      }
    }

    setSelected(null)
    setInProgress({ tool: activeTool, points: [{ x: coords.x, price: coords.price }] })
  }, [activeTool, drawings, getEventCoords, toY])

  const onMove = useCallback((e) => {
    e.preventDefault()
    const coords = getEventCoords(e)
    if (!coords || coords.price == null) return

    if (dragState) {
      const updated = drawings.map((d, di) => {
        if (di !== dragState.drawingIndex) return d
        const pts = d.points.map((p, pi) =>
          pi === dragState.pointIndex
            ? { ...p, price: coords.price, x: coords.x }
            : p
        )
        return { ...d, points: pts }
      })
      onDrawingsChange(updated)
      return
    }

    if (inProgress) {
      setInProgress(prev => ({ ...prev, preview: { x: coords.x, price: coords.price } }))
    }
  }, [dragState, inProgress, drawings, getEventCoords, onDrawingsChange])

  const onEnd = useCallback((e) => {
    e.preventDefault()
    if (dragState) { setDragState(null); return }
    if (!inProgress) return

    const { tool, points, preview } = inProgress

    if (tool === 'horizontal') {
      onDrawingComplete({ tool, points })
      setInProgress(null)
      return
    }

    // Two-point tools: first tap sets p1, second tap (via preview) sets p2
    if (points.length === 1 && preview) {
      onDrawingComplete({ tool, points: [points[0], preview] })
      setInProgress(null)
    }
  }, [dragState, inProgress, onDrawingComplete])

  // ── Delete selected drawing ─────────────────────────────────────────────────
  const deleteSelected = useCallback(() => {
    if (selected == null) return
    onDrawingsChange(drawings.filter((_, i) => i !== selected))
    setSelected(null)
  }, [selected, drawings, onDrawingsChange])

  // ── Render helpers ──────────────────────────────────────────────────────────
  const W = 9999 // SVG is wide; lines extend edge to edge

  const renderDrawing = (d, i) => {
    const isSelected = selected === i
    const color = isSelected ? COLORS.gold : (d.color || '#7B8CB8')
    const sw = isSelected ? 2 : 1.5

    const [p1, p2] = d.points
    const y1 = toY(p1?.price)
    const y2 = p2 ? toY(p2.price) : null

    if (y1 == null) return null

    switch (d.tool) {
      case 'horizontal': {
        return (
          <g key={i} onClick={() => setSelected(i)} style={{ cursor: 'pointer' }}>
            <line x1={0} y1={y1} x2={W} y2={y1} stroke={color} strokeWidth={sw} strokeDasharray="5 3" />
            <text x={6} y={y1 - 4} fill={color} fontSize={10} fontFamily="monospace">
              {p1.price?.toFixed(2)}
            </text>
            <circle cx={p1.x ?? 60} cy={y1} r={7} fill={color} fillOpacity={0.25} />
          </g>
        )
      }

      case 'trendline': {
        if (y2 == null) return null
        const dx = (p2.x ?? 200) - (p1.x ?? 60)
        const dy = y2 - y1
        const slope = dx !== 0 ? dy / dx : 0
        const leftY  = y1 - (p1.x ?? 60) * slope
        const rightY = y1 + (W - (p1.x ?? 60)) * slope
        return (
          <g key={i} onClick={() => setSelected(i)} style={{ cursor: 'pointer' }}>
            <line x1={0} y1={leftY} x2={W} y2={rightY} stroke={color} strokeWidth={sw} />
            <circle cx={p1.x ?? 60} cy={y1} r={6} fill={color} fillOpacity={0.3} />
            <circle cx={p2.x ?? 200} cy={y2} r={6} fill={color} fillOpacity={0.3} />
          </g>
        )
      }

      case 'pricerange': {
        if (y2 == null) return null
        const dist = Math.abs(p2.price - p1.price)
        const top  = Math.min(y1, y2)
        const bot  = Math.max(y1, y2)
        const midY = (y1 + y2) / 2
        const midX = ((p1.x ?? 60) + (p2.x ?? 200)) / 2
        return (
          <g key={i} onClick={() => setSelected(i)} style={{ cursor: 'pointer' }}>
            <rect x={Math.min(p1.x ?? 60, p2.x ?? 200)} y={top}
                  width={Math.abs((p2.x ?? 200) - (p1.x ?? 60))} height={bot - top}
                  fill={color} fillOpacity={0.08} />
            <line x1={p1.x ?? 60} y1={y1} x2={p2.x ?? 200} y2={y1} stroke={color} strokeWidth={sw} />
            <line x1={p1.x ?? 60} y1={y2} x2={p2.x ?? 200} y2={y2} stroke={color} strokeWidth={sw} />
            <line x1={midX} y1={y1} x2={midX} y2={y2} stroke={color} strokeWidth={1} strokeDasharray="3 3" />
            <text x={midX + 4} y={midY + 4} fill={color} fontSize={10} fontFamily="monospace">
              {dist.toFixed(2)}
            </text>
          </g>
        )
      }

      case 'rectangle': {
        if (y2 == null) return null
        const rx = Math.min(p1.x ?? 60, p2.x ?? 200)
        const ry = Math.min(y1, y2)
        const rw = Math.abs((p2.x ?? 200) - (p1.x ?? 60))
        const rh = Math.abs(y2 - y1)
        return (
          <g key={i} onClick={() => setSelected(i)} style={{ cursor: 'pointer' }}>
            <rect x={rx} y={ry} width={rw} height={rh}
                  stroke={color} strokeWidth={sw} fill={color} fillOpacity={0.07} />
            <circle cx={p1.x ?? 60} cy={y1} r={5} fill={color} fillOpacity={0.4} />
            <circle cx={p2.x ?? 200} cy={y2} r={5} fill={color} fillOpacity={0.4} />
          </g>
        )
      }

      case 'fib': {
        if (y2 == null) return null
        const priceDiff = p2.price - p1.price
        const yDiff = y2 - y1
        return (
          <g key={i} onClick={() => setSelected(i)} style={{ cursor: 'pointer' }}>
            {FIB_LEVELS.map((lvl, li) => {
              const ly = y1 + yDiff * lvl.ratio
              const lp = p1.price + priceDiff * lvl.ratio
              return (
                <g key={li}>
                  <line x1={0} y1={ly} x2={W} y2={ly}
                        stroke={lvl.color} strokeWidth={1} strokeOpacity={0.75} strokeDasharray="6 3" />
                  <text x={(p1.x ?? 60) + 4} y={ly - 3} fill={lvl.color} fontSize={9} fontFamily="monospace">
                    {lvl.label} {lp.toFixed(2)}
                  </text>
                </g>
              )
            })}
          </g>
        )
      }

      case 'long':
      case 'short': {
        if (y2 == null) return null
        const isLong   = d.tool === 'long'
        const entry    = p1.price
        const tp       = p2.price
        const slPrice  = entry - (tp - entry)
        const slY      = toY(slPrice)
        const tpColor  = isLong ? COLORS.green : COLORS.red
        const slColor  = isLong ? COLORS.red   : COLORS.green
        const rr       = Math.abs((tp - entry) / (entry - slPrice))

        const tpTop = Math.min(y1, y2)
        const tpH   = Math.abs(y2 - y1)
        const slTop = slY != null ? Math.min(y1, slY) : y1
        const slH   = slY != null ? Math.abs(slY - y1) : 0

        return (
          <g key={i} onClick={() => setSelected(i)} style={{ cursor: 'pointer' }}>
            <rect x={0} y={tpTop} width={W} height={tpH} fill={tpColor} fillOpacity={0.12} />
            <line x1={0} y1={y2} x2={W} y2={y2} stroke={tpColor} strokeWidth={1.5} />
            <text x={8} y={y2 - 4} fill={tpColor} fontSize={10} fontFamily="monospace">
              TP {tp.toFixed(2)}
            </text>

            <line x1={0} y1={y1} x2={W} y2={y1} stroke="#ffffff" strokeWidth={2} />
            <text x={8} y={y1 - 4} fill="#ffffff" fontSize={10} fontFamily="monospace">
              Entry {entry.toFixed(2)}
            </text>

            {slY != null && (
              <>
                <rect x={0} y={slTop} width={W} height={slH} fill={slColor} fillOpacity={0.12} />
                <line x1={0} y1={slY} x2={W} y2={slY} stroke={slColor} strokeWidth={1.5} />
                <text x={8} y={slY + 12} fill={slColor} fontSize={10} fontFamily="monospace">
                  SL {slPrice.toFixed(2)}
                </text>
              </>
            )}

            <text x={8} y={y1 + (isLong ? -tpH / 2 : tpH / 2)} fill="#ffffff" fontSize={11} fontWeight="bold">
              RR {isFinite(rr) ? rr.toFixed(2) : '—'}
            </text>
          </g>
        )
      }

      default: return null
    }
  }

  const renderPreview = () => {
    if (!inProgress?.preview) return null
    const p1 = inProgress.points[0]
    const p2 = inProgress.preview
    const y1 = toY(p1.price)
    const y2 = toY(p2.price)
    if (y1 == null) return null
    return (
      <g opacity={0.5}>
        <line x1={p1.x} y1={y1} x2={p2.x} y2={y2 ?? y1}
              stroke={COLORS.gold} strokeWidth={1.5} strokeDasharray="5 3" />
      </g>
    )
  }

  const isDrawing = activeTool && activeTool !== 'none'

  return (
    <>
      {/* Delete button when a drawing is selected */}
      {selected != null && (
        <button
          onClick={deleteSelected}
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 30,
            background: COLORS.red, color: '#fff', border: 'none',
            borderRadius: 5, padding: '6px 12px', fontSize: 13,
            fontWeight: 700, cursor: 'pointer',
          }}
        >
          Delete
        </button>
      )}

      <svg
        ref={svgRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          zIndex: 10,
          cursor: isDrawing ? 'crosshair' : 'default',
          touchAction: 'none',
          pointerEvents: isDrawing || selected != null ? 'all' : 'none',
          overflow: 'visible',
        }}
        onMouseDown={onStart}
        onMouseMove={onMove}
        onMouseUp={onEnd}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
      >
        {drawings.map((d, i) => renderDrawing(d, i))}
        {renderPreview()}
      </svg>
    </>
  )
}

// ─── Main Chart ───────────────────────────────────────────────────────────────
const Chart = forwardRef(function Chart(
  { candles, visibleIndex, openPositions, activeTool, drawings, onDrawingComplete, onDrawingsChange },
  ref
) {
  const containerRef = useRef(null)
  const chartRef     = useRef(null)
  const seriesRef    = useRef(null)

  useImperativeHandle(ref, () => ({
    get chart()  { return chartRef.current },
    get series() { return seriesRef.current },
  }))

  // ── Init chart once ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: COLORS.bg },
        textColor:  COLORS.text,
      },
      grid: {
        vertLines: { color: '#1a1e2e' },
        horzLines: { color: '#1a1e2e' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#758696', labelBackgroundColor: COLORS.panel },
        horzLine: { color: '#758696', labelBackgroundColor: COLORS.panel },
      },
      rightPriceScale: {
        borderColor: COLORS.border,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
      },
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })

    const series = chart.addCandlestickSeries({
      upColor:        COLORS.green,
      downColor:      COLORS.red,
      borderUpColor:  COLORS.green,
      borderDownColor:COLORS.red,
      wickUpColor:    COLORS.green,
      wickDownColor:  COLORS.red,
    })

    chartRef.current  = chart
    seriesRef.current = series

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove() }
  }, [])

  // ── Update candles when visibleIndex changes ────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || !candles.length) return
    seriesRef.current.setData(candles.slice(0, visibleIndex + 1))
    // Keep latest candle in view, but don't jump if user has scrolled back
    chartRef.current?.timeScale().scrollToRealTime()
  }, [candles, visibleIndex])

  // ── Draw TP/SL lines for open positions ─────────────────────────────────────
  // We use priceLine API from Lightweight Charts for clean price lines
  const priceLineRefs = useRef([])
  useEffect(() => {
    if (!seriesRef.current) return
    // Remove old lines
    priceLineRefs.current.forEach(pl => {
      try { seriesRef.current.removePriceLine(pl) } catch (e) { /* line already removed */ }
    })
    priceLineRefs.current = []

    // Add lines for each open position
    openPositions.forEach(pos => {
      const entryLine = seriesRef.current.createPriceLine({
        price: pos.entryPrice,
        color: '#ffffff',
        lineWidth: 1,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: `${pos.direction.toUpperCase()} entry`,
      })
      priceLineRefs.current.push(entryLine)

      if (pos.tp != null) {
        const tpLine = seriesRef.current.createPriceLine({
          price: pos.tp,
          color: pos.direction === 'long' ? COLORS.green : COLORS.red,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'TP',
        })
        priceLineRefs.current.push(tpLine)
      }

      if (pos.sl != null) {
        const slLine = seriesRef.current.createPriceLine({
          price: pos.sl,
          color: pos.direction === 'long' ? COLORS.red : COLORS.green,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'SL',
        })
        priceLineRefs.current.push(slLine)
      }
    })
  }, [openPositions])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <DrawingOverlay
        drawings={drawings}
        activeTool={activeTool}
        chartRef={{ current: { chart: chartRef.current } }}
        onDrawingComplete={onDrawingComplete}
        onDrawingsChange={onDrawingsChange}
      />
    </div>
  )
})

export default Chart
