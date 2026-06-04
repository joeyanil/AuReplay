import React, {
  useEffect, useRef, useImperativeHandle,
  forwardRef, useState, useCallback
} from 'react'
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts'
import { FIB_LEVELS, C, WEAK_MAGNET_THRESHOLD } from '../constants.js'

// ─── Magnet snap ──────────────────────────────────────────────────────────────
function snapPrice(raw, nearbyCandles, magnet) {
  if (magnet === 'off' || !nearbyCandles.length) return raw
  let best = raw
  let bestDist = magnet === 'strong' ? Infinity : WEAK_MAGNET_THRESHOLD
  for (const c of nearbyCandles) {
    for (const v of [c.open, c.high, c.low, c.close]) {
      const d = Math.abs(v - raw)
      if (d < bestDist) { bestDist = d; best = v }
    }
  }
  return best
}

// ─── SVG Drawing Overlay ──────────────────────────────────────────────────────
// Option B: chart scroll is DISABLED when a tool is active so touch reaches SVG
function DrawingOverlay({ drawings, activeTool, getChart, onComplete, onUpdate, magnet, nearbyCandles }) {
  const svgRef = useRef(null)
  const [prog, setProg]   = useState(null)  // { tool, points:[{price,x}], preview }
  const [sel,  setSel]    = useState(null)  // selected index
  const [drag, setDrag]   = useState(null)  // { di, pi }
  const [, tick] = useState(0)

  // Re-render whenever chart pans/zooms so price→y stays correct
  useEffect(() => {
    const chart = getChart()
    if (!chart) return
    let u1, u2
    try {
      u1 = chart.timeScale().subscribeVisibleTimeRangeChange(() => tick(n => n + 1))
    } catch {}
    try {
      u2 = chart.priceScale('right').subscribeVisiblePriceRangeChange?.(() => tick(n => n + 1))
    } catch {}
    return () => { try { u1?.() } catch {} try { u2?.() } catch {} }
  })

  const toY = useCallback((price) => {
    try { return getChart()?.priceScale('right').priceToCoordinate(price) ?? null }
    catch { return null }
  }, [getChart])

  const toPrice = useCallback((y) => {
    try { return getChart()?.priceScale('right').coordinateToPrice(y) ?? null }
    catch { return null }
  }, [getChart])

  const getCoords = useCallback((e) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect  = svg.getBoundingClientRect()
    const touch = e.touches?.[0] ?? e
    const x   = touch.clientX - rect.left
    const y   = touch.clientY - rect.top
    let price = toPrice(y)
    if (price == null) return null
    if (magnet !== 'off') price = snapPrice(price, nearbyCandles, magnet)
    const sy = toY(price) ?? y
    return { x, y: sy, price }
  }, [toPrice, toY, magnet, nearbyCandles])

  const onStart = useCallback((e) => {
    if (!activeTool || activeTool === 'none') return
    e.preventDefault()
    const c = getCoords(e)
    if (!c) return
    // Check tap near existing handle → drag
    for (let di = drawings.length - 1; di >= 0; di--) {
      for (let pi = 0; pi < drawings[di].points.length; pi++) {
        const p  = drawings[di].points[pi]
        const py = toY(p.price)
        if (py == null) continue
        if (Math.hypot((p.x ?? c.x) - c.x, py - c.y) < 24) {
          setDrag({ di, pi }); setSel(di); return
        }
      }
    }
    setSel(null)
    setProg({ tool: activeTool, points: [{ price: c.price, x: c.x }] })
  }, [activeTool, drawings, getCoords, toY])

  const onMove = useCallback((e) => {
    e.preventDefault()
    const c = getCoords(e)
    if (!c) return
    if (drag) {
      onUpdate(drawings.map((d, di) =>
        di !== drag.di ? d : {
          ...d,
          points: d.points.map((p, pi) =>
            pi !== drag.pi ? p : { price: c.price, x: c.x }
          )
        }
      ))
    } else if (prog) {
      setProg(p => ({ ...p, preview: { price: c.price, x: c.x } }))
    }
  }, [drag, prog, drawings, getCoords, onUpdate])

  const onEnd = useCallback((e) => {
    e.preventDefault()
    if (drag) { setDrag(null); return }
    if (!prog) return
    const { tool, points, preview } = prog
    if (tool === 'horizontal') {
      onComplete({ tool, points }); setProg(null); return
    }
    if (points.length === 1 && preview) {
      onComplete({ tool, points: [points[0], preview] }); setProg(null)
    }
  }, [drag, prog, onComplete])

  const deleteSel = useCallback(() => {
    if (sel == null) return
    onUpdate(drawings.filter((_, i) => i !== sel))
    setSel(null)
  }, [sel, drawings, onUpdate])

  // ── Render each drawing ───────────────────────────────────────────────────
  const W     = 9999
  const clr   = i => sel === i ? C.gold : '#7b8cb8'
  const sw    = i => sel === i ? 2.5 : 1.5
  const click = i => () => setSel(sel === i ? null : i)

  const renderDrawing = (d, i) => {
    const [p1, p2] = d.points
    if (!p1) return null
    const y1 = toY(p1.price)
    if (y1 == null) return null
    const x1    = p1.x ?? 80
    const y2    = p2 ? toY(p2.price) : null
    const x2    = p2?.x ?? 200
    const color = clr(i)
    const strokeW = sw(i)

    switch (d.tool) {
      case 'horizontal':
        return (
          <g key={i} onClick={click(i)} style={{ cursor: 'pointer' }}>
            <line x1={0} y1={y1} x2={W} y2={y1} stroke="transparent" strokeWidth={14} />
            <line x1={0} y1={y1} x2={W} y2={y1} stroke={color} strokeWidth={strokeW} strokeDasharray="6 3" />
            <text x={8} y={y1 - 5} fill={color} fontSize={10} fontFamily="monospace">
              {p1.price?.toFixed(2)}
            </text>
            <circle cx={x1} cy={y1} r={7} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1} />
          </g>
        )

      case 'trendline': {
        if (y2 == null) return null
        const slope = (x2 - x1) !== 0 ? (y2 - y1) / (x2 - x1) : 0
        const ly0   = y1 - x1 * slope
        const lyW   = y1 + (W - x1) * slope
        return (
          <g key={i} onClick={click(i)} style={{ cursor: 'pointer' }}>
            <line x1={0} y1={ly0} x2={W} y2={lyW} stroke="transparent" strokeWidth={14} />
            <line x1={0} y1={ly0} x2={W} y2={lyW} stroke={color} strokeWidth={strokeW} />
            <circle cx={x1} cy={y1} r={7} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1} />
            <circle cx={x2} cy={y2} r={7} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1} />
          </g>
        )
      }

      case 'pricerange': {
        if (y2 == null) return null
        const dist = Math.abs(p2.price - p1.price)
        const top  = Math.min(y1, y2), bot = Math.max(y1, y2)
        const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2
        return (
          <g key={i} onClick={click(i)} style={{ cursor: 'pointer' }}>
            <rect x={Math.min(x1, x2)} y={top} width={Math.abs(x2 - x1)} height={bot - top}
                  fill={color} fillOpacity={0.08} />
            <line x1={x1} y1={y1} x2={x2} y2={y1} stroke={color} strokeWidth={strokeW} />
            <line x1={x1} y1={y2} x2={x2} y2={y2} stroke={color} strokeWidth={strokeW} />
            <line x1={midX} y1={y1} x2={midX} y2={y2} stroke={color} strokeWidth={1} strokeDasharray="4 3" />
            <text x={midX + 4} y={midY + 4} fill={color} fontSize={10} fontFamily="monospace">
              {dist.toFixed(2)} pts
            </text>
            <circle cx={x1} cy={y1} r={6} fill={color} fillOpacity={0.25} />
            <circle cx={x2} cy={y2} r={6} fill={color} fillOpacity={0.25} />
          </g>
        )
      }

      case 'rectangle': {
        if (y2 == null) return null
        return (
          <g key={i} onClick={click(i)} style={{ cursor: 'pointer' }}>
            <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)}
                  width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)}
                  stroke={color} strokeWidth={strokeW} fill={color} fillOpacity={0.08} />
            <circle cx={x1} cy={y1} r={6} fill={color} fillOpacity={0.25} />
            <circle cx={x2} cy={y2} r={6} fill={color} fillOpacity={0.25} />
          </g>
        )
      }

      case 'fib': {
        if (y2 == null) return null
        const pDiff = p2.price - p1.price
        const yDiff = y2 - y1
        return (
          <g key={i} onClick={click(i)} style={{ cursor: 'pointer' }}>
            {FIB_LEVELS.map((lvl, li) => {
              const ly = y1 + yDiff * lvl.ratio
              const lp = (p1.price + pDiff * lvl.ratio).toFixed(2)
              return (
                <g key={li}>
                  <line x1={0} y1={ly} x2={W} y2={ly}
                        stroke={lvl.color} strokeWidth={1} strokeOpacity={0.85} strokeDasharray="6 3" />
                  <text x={x1 + 4} y={ly - 3} fill={lvl.color} fontSize={9} fontFamily="monospace">
                    {lvl.label}  {lp}
                  </text>
                </g>
              )
            })}
            <circle cx={x1} cy={y1} r={5} fill={C.gold} fillOpacity={0.3} />
            <circle cx={x2} cy={y2} r={5} fill={C.gold} fillOpacity={0.3} />
          </g>
        )
      }

      case 'long':
      case 'short': {
        if (y2 == null) return null
        const isLong  = d.tool === 'long'
        const entry   = p1.price
        const tp      = p2.price
        const slPrice = entry - (tp - entry)
        const slY     = toY(slPrice)
        const tpClr   = isLong ? C.green : C.red
        const slClr   = isLong ? C.red   : C.green
        const rr      = entry !== slPrice ? Math.abs((tp - entry) / (entry - slPrice)) : 0
        const tpTop   = Math.min(y1, y2), tpH = Math.abs(y2 - y1)
        const slTop   = slY != null ? Math.min(y1, slY) : y1
        const slH     = slY != null ? Math.abs(slY - y1) : 0
        return (
          <g key={i} onClick={click(i)} style={{ cursor: 'pointer' }}>
            <rect x={0} y={tpTop} width={W} height={tpH} fill={tpClr} fillOpacity={0.13} />
            <line x1={0} y1={y2} x2={W} y2={y2} stroke={tpClr} strokeWidth={1.5} />
            <text x={8} y={y2 - 4} fill={tpClr} fontSize={10} fontFamily="monospace">TP {tp.toFixed(2)}</text>
            <line x1={0} y1={y1} x2={W} y2={y1} stroke="#fff" strokeWidth={2} />
            <text x={8} y={y1 - 4} fill="#fff" fontSize={10} fontFamily="monospace">Entry {entry.toFixed(2)}</text>
            {slY != null && (
              <>
                <rect x={0} y={slTop} width={W} height={slH} fill={slClr} fillOpacity={0.13} />
                <line x1={0} y1={slY} x2={W} y2={slY} stroke={slClr} strokeWidth={1.5} />
                <text x={8} y={slY + 12} fill={slClr} fontSize={10} fontFamily="monospace">
                  SL {slPrice.toFixed(2)}
                </text>
              </>
            )}
            <text x={8} y={y1 + (isLong ? -tpH / 2 : tpH / 2)} fill="#fff" fontSize={12} fontWeight="bold">
              RR {isFinite(rr) ? rr.toFixed(2) : '—'}
            </text>
            <circle cx={x1} cy={y1} r={7} fill="#fff" fillOpacity={0.2} />
          </g>
        )
      }

      default: return null
    }
  }

  const renderPreview = () => {
    if (!prog?.preview) return null
    const p1 = prog.points[0], p2 = prog.preview
    const y1 = toY(p1.price), y2 = toY(p2.price)
    if (y1 == null) return null
    if (prog.tool === 'horizontal') {
      return (
        <g opacity={0.65}>
          <line x1={0} y1={y1} x2={W} y2={y1} stroke={C.gold} strokeWidth={1.5} strokeDasharray="5 3" />
          <text x={8} y={y1 - 5} fill={C.gold} fontSize={10} fontFamily="monospace">
            {p1.price?.toFixed(2)}
          </text>
        </g>
      )
    }
    return (
      <g opacity={0.65}>
        <line x1={p1.x} y1={y1} x2={p2.x} y2={y2 ?? y1}
              stroke={C.gold} strokeWidth={1.5} strokeDasharray="5 3" />
        <circle cx={p1.x} cy={y1} r={5} fill={C.gold} fillOpacity={0.5} />
        <circle cx={p2.x} cy={y2 ?? y1} r={5} fill={C.gold} fillOpacity={0.5} />
      </g>
    )
  }

  const isActive = activeTool && activeTool !== 'none'

  return (
    <>
      {sel != null && (
        <button
          onClick={deleteSel}
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 30,
            background: C.red, color: '#fff', border: 'none',
            borderRadius: 5, padding: '7px 14px', fontSize: 13,
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
          zIndex: 10, overflow: 'visible', touchAction: 'none',
          cursor: isActive ? 'crosshair' : 'default',
          pointerEvents: isActive || sel != null ? 'all' : 'none',
        }}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
      >
        {drawings.map((d, i) => renderDrawing(d, i))}
        {renderPreview()}
      </svg>
    </>
  )
}

// ─── Main Chart component ─────────────────────────────────────────────────────
const Chart = forwardRef(function Chart(
  {
    candles, visibleIndex, replayStartIndex,
    openPositions, closedTrades,
    activeTool, drawings, onDrawingComplete, onDrawingsChange,
    magnet, startingBalance, onOHLCHover,
  },
  ref
) {
  const containerRef    = useRef(null)
  const chartRef        = useRef(null)
  const mainSeriesRef   = useRef(null)
  const equitySeriesRef = useRef(null)
  const priceLineRefs   = useRef([])
  const [chartReady, setChartReady] = useState(false)
  const [cursorX,    setCursorX]    = useState(null)

  const getChart = useCallback(() => chartRef.current, [])

  useImperativeHandle(ref, () => ({
    get chart()  { return chartRef.current },
    get series() { return mainSeriesRef.current },
  }))

  // ── Option B: lock/unlock chart scroll when drawing tool active ────────────
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const drawing = activeTool && activeTool !== 'none'
    if (drawing) {
      chart.applyOptions({
        handleScroll: { mouseWheel: false, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
        handleScale:  { mouseWheel: false, pinch: false, axisPressedMouseMove: false },
      })
    } else {
      chart.applyOptions({
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
        handleScale:  { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      })
    }
  }, [activeTool])

  // ── Init chart once ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: C.bg },
        textColor:  C.text,
        fontSize:   12,
      },
      grid: {
        vertLines: { color: '#1e2130' },
        horzLines: { color: '#1e2130' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#758696', width: 1, style: LineStyle.Solid, labelBackgroundColor: '#2a2e39' },
        horzLine: { color: '#758696', width: 1, style: LineStyle.Solid, labelBackgroundColor: '#2a2e39' },
      },
      rightPriceScale: {
        borderColor:  C.border,
        scaleMargins: { top: 0.08, bottom: 0.12 },
        textColor:    C.muted,
      },
      timeScale: {
        borderColor:    C.border,
        timeVisible:    true,
        secondsVisible: false,
        rightOffset:    12,
        barSpacing:     8,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale:  { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })

    // Main candle series — ONLY revealed candles, future is blank
    const mainSeries = chart.addCandlestickSeries({
      upColor:          C.green,
      downColor:        C.red,
      borderUpColor:    C.green,
      borderDownColor:  C.red,
      wickUpColor:      C.green,
      wickDownColor:    C.red,
      priceLineVisible: true,
      priceLineColor:   C.muted,
      priceLineStyle:   LineStyle.Dashed,
      lastValueVisible: true,
    })

    // Equity curve — bottom 18% of chart height
    const equitySeries = chart.addLineSeries({
      color:                  'rgba(240,185,11,0.5)',
      lineWidth:              1,
      priceScaleId:           'equity',
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: false,
    })
    chart.priceScale('equity').applyOptions({
      scaleMargins:  { top: 0.82, bottom: 0 },
      drawTicks:     false,
      borderVisible: false,
    })

    chartRef.current        = chart
    mainSeriesRef.current   = mainSeries
    equitySeriesRef.current = equitySeries

    // OHLC crosshair subscribe
    chart.subscribeCrosshairMove(param => {
      if (!param?.seriesData) return
      const d = param.seriesData.get(mainSeries)
      if (d && onOHLCHover) onOHLCHover({ open: d.open, high: d.high, low: d.low, close: d.close })
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current)
        chart.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
    })
    ro.observe(containerRef.current)
    setChartReady(true)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      setChartReady(false)
    }
  }, []) // eslint-disable-line

  // ── Update candle data — future is completely hidden ───────────────────────
  useEffect(() => {
    if (!mainSeriesRef.current || !candles.length) return

    // Only revealed candles — nothing after visibleIndex
    const revealed = candles.slice(0, visibleIndex + 1)
    mainSeriesRef.current.setData(revealed)

    // Smart scroll: only move chart if current candle goes off right edge
    const chart = chartRef.current
    if (chart) {
      const ts           = chart.timeScale()
      const visibleRange = ts.getVisibleRange()
      const currentTime  = candles[visibleIndex]?.time
      if (currentTime) {
        if (!visibleRange || currentTime > visibleRange.to) {
          ts.scrollToPosition(5, false)
        }
      }
      // Update cursor line position
      const x = ts.timeToCoordinate(currentTime)
      setCursorX(typeof x === 'number' ? x : null)
    }
  }, [candles, visibleIndex])

  // ── Trade markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mainSeriesRef.current || !candles.length) return
    const currentTime = candles[visibleIndex]?.time
    const markers = []

    // Replay START flag
    if (replayStartIndex < candles.length) {
      markers.push({
        time: candles[replayStartIndex].time,
        position: 'belowBar', color: C.gold,
        shape: 'arrowUp', text: 'START', size: 1,
      })
    }

    // Entry/exit markers — only for candles already revealed
    for (const t of closedTrades) {
      const openTs  = Math.floor(new Date(t.openedAt).getTime() / 1000)
      const closeTs = Math.floor(new Date(t.closedAt).getTime() / 1000)
      const entryC  = candles.find(c => c.time >= openTs)
      const exitC   = candles.find(c => c.time >= closeTs)
      if (entryC && entryC.time <= currentTime) {
        markers.push({
          time: entryC.time,
          position: t.direction === 'long' ? 'belowBar' : 'aboveBar',
          color: t.direction === 'long' ? C.green : C.red,
          shape: t.direction === 'long' ? 'arrowUp' : 'arrowDown',
          text: '', size: 1,
        })
      }
      if (exitC && exitC.time <= currentTime) {
        markers.push({
          time: exitC.time,
          position: t.direction === 'long' ? 'aboveBar' : 'belowBar',
          color: t.pnl >= 0 ? C.green : C.red,
          shape: 'circle', text: '', size: 0.7,
        })
      }
    }

    markers.sort((a, b) => a.time - b.time)
    mainSeriesRef.current.setMarkers(markers)
  }, [closedTrades, candles, visibleIndex, replayStartIndex])

  // ── Equity curve ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!equitySeriesRef.current) return
    if (!closedTrades.length) { equitySeriesRef.current.setData([]); return }
    let running = startingBalance
    const raw = [...closedTrades]
      .sort((a, b) => new Date(a.closedAt) - new Date(b.closedAt))
      .map(t => {
        running += t.pnl
        const ts = Math.floor(new Date(t.closedAt).getTime() / 1000)
        const c  = candles.find(c => c.time >= ts)
        return c ? { time: c.time, value: running } : null
      }).filter(Boolean)
    const seen = new Set(), deduped = []
    for (const p of raw) {
      if (!seen.has(p.time)) { seen.add(p.time); deduped.push(p) }
    }
    if (deduped.length) equitySeriesRef.current.setData(deduped)
  }, [closedTrades, candles, startingBalance])

  // ── Open position price lines ──────────────────────────────────────────────
  useEffect(() => {
    if (!mainSeriesRef.current) return
    priceLineRefs.current.forEach(pl => {
      try { mainSeriesRef.current.removePriceLine(pl) } catch {}
    })
    priceLineRefs.current = []
    openPositions.forEach(pos => {
      [
        { price: pos.entryPrice, color: '#cccccc', title: `${pos.direction.toUpperCase()} @ ${pos.entryPrice.toFixed(2)}` },
        pos.tp != null && { price: pos.tp, color: pos.direction === 'long' ? C.green : C.red, title: 'TP' },
        pos.sl != null && { price: pos.sl, color: pos.direction === 'long' ? C.red : C.green, title: 'SL' },
      ].filter(Boolean).forEach(def => {
        const pl = mainSeriesRef.current.createPriceLine({
          price: def.price, color: def.color, lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: def.title,
        })
        priceLineRefs.current.push(pl)
      })
    })
  }, [openPositions])

  const nearbyCandles = candles.slice(Math.max(0, visibleIndex - 30), visibleIndex + 1)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Replay cursor — gold vertical dashed line */}
      {cursorX != null && (
        <svg style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 5, overflow: 'visible',
        }}>
          <line x1={cursorX} y1={0} x2={cursorX} y2="100%"
                stroke={C.gold} strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
          <polygon points={`${cursorX - 5},2 ${cursorX + 5},2 ${cursorX},10`}
                   fill={C.gold} opacity={0.85} />
        </svg>
      )}

      {/* Drawing overlay — only mount after chart is ready */}
      {chartReady && (
        <DrawingOverlay
          drawings={drawings}
          activeTool={activeTool}
          getChart={getChart}
          onComplete={onDrawingComplete}
          onUpdate={onDrawingsChange}
          magnet={magnet}
          nearbyCandles={nearbyCandles}
        />
      )}
    </div>
  )
})

export default Chart
