import React, {
  useEffect, useRef, useImperativeHandle,
  forwardRef, useState, useCallback
} from 'react'
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts'
import { FIB_LEVELS, C, WEAK_MAGNET_PX } from '../constants.js'

// ─── Magnet snap ──────────────────────────────────────────────────────────────
// Given a raw price, snap it to the nearest OHLC value from nearby candles.
function snapPrice(rawPrice, nearbyCandles, magnet) {
  if (magnet === 'off' || !nearbyCandles.length) return rawPrice
  let bestPrice = rawPrice
  let bestDist  = magnet === 'strong' ? Infinity : WEAK_MAGNET_PX
  // For weak magnet, bestDist is in price units — approximate: 0.5 points for gold
  const threshold = magnet === 'strong' ? Infinity : 0.5

  for (const c of nearbyCandles) {
    for (const val of [c.open, c.high, c.low, c.close]) {
      const dist = Math.abs(val - rawPrice)
      if (dist < bestDist) { bestDist = dist; bestPrice = val }
    }
  }
  return bestPrice
}

// ─── Drawing Overlay ──────────────────────────────────────────────────────────
// Drawings store: { tool, points: [{ price, x }] }
// - price: the chart price (y anchor) — survives TF switch
// - x: pixel x at time of drawing — used for initial render
// On every render, toY(price) recomputes pixel Y from current chart scale.
// X position is stored as-is (approximate) since drawings don't need precise time anchor
// for horizontal/fib/long/short, and trendline x is cosmetic.

function DrawingOverlay({
  drawings, activeTool, getChart,
  onDrawingComplete, onDrawingsChange,
  magnet, visibleCandles,
}) {
  const svgRef   = useRef(null)
  const [inProg, setInProg]   = useState(null)   // in-progress drawing
  const [sel,    setSel]      = useState(null)   // selected drawing index
  const [drag,   setDrag]     = useState(null)   // { di, pi }
  const [, tick] = useState(0)  // force re-render on chart scroll

  // Subscribe to chart scroll/zoom to keep drawings in sync
  useEffect(() => {
    const chart = getChart()
    if (!chart) return
    let unsub
    try { unsub = chart.timeScale().subscribeVisibleTimeRangeChange(() => tick(n => n + 1)) }
    catch {}
    return () => { try { unsub?.() } catch {} }
  }) // no deps — re-subscribe after every render to always have latest chart

  // ── Coordinate helpers ────────────────────────────────────────────────────
  const toY = useCallback((price) => {
    try { return getChart()?.priceScale('right').priceToCoordinate(price) ?? null }
    catch { return null }
  }, [getChart])

  const toPrice = useCallback((y) => {
    try { return getChart()?.priceScale('right').coordinateToPrice(y) ?? null }
    catch { return null }
  }, [getChart])

  // ── Build event coords with magnet snapping ───────────────────────────────
  const getCoords = useCallback((e) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect  = svg.getBoundingClientRect()
    const touch = e.touches?.[0] ?? e
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top
    let price = toPrice(y)
    if (price == null) return null

    // Magnet: snap to nearest OHLC in visible candles
    if (magnet !== 'off' && visibleCandles.length) {
      price = snapPrice(price, visibleCandles, magnet)
    }

    const snappedY = toY(price) ?? y
    return { x, y: snappedY, price }
  }, [toPrice, toY, magnet, visibleCandles])

  // ── Touch/mouse handlers ──────────────────────────────────────────────────
  const onStart = useCallback((e) => {
    if (!activeTool || activeTool === 'none') return
    e.preventDefault()
    const coords = getCoords(e)
    if (!coords) return

    // Check if tapping near an existing drawing handle → drag
    for (let di = drawings.length - 1; di >= 0; di--) {
      for (let pi = 0; pi < drawings[di].points.length; pi++) {
        const p  = drawings[di].points[pi]
        const py = toY(p.price)
        if (py == null) continue
        const px = p.x ?? coords.x
        if (Math.hypot(px - coords.x, py - coords.y) < 24) {
          setDrag({ di, pi }); setSel(di); return
        }
      }
    }

    setSel(null)
    setInProg({ tool: activeTool, points: [{ price: coords.price, x: coords.x }] })
  }, [activeTool, drawings, getCoords, toY])

  const onMove = useCallback((e) => {
    e.preventDefault()
    const coords = getCoords(e)
    if (!coords) return

    if (drag) {
      const updated = drawings.map((d, di) => {
        if (di !== drag.di) return d
        const pts = d.points.map((p, pi) =>
          pi === drag.pi ? { price: coords.price, x: coords.x } : p
        )
        return { ...d, points: pts }
      })
      onDrawingsChange(updated)
    } else if (inProg) {
      setInProg(prev => ({ ...prev, preview: { price: coords.price, x: coords.x } }))
    }
  }, [drag, inProg, drawings, getCoords, onDrawingsChange])

  const onEnd = useCallback((e) => {
    e.preventDefault()
    if (drag) { setDrag(null); return }
    if (!inProg) return

    const { tool, points, preview } = inProg

    if (tool === 'horizontal') {
      onDrawingComplete({ tool, points }); setInProg(null); return
    }

    // Two-point tools: first tap = p1, second tap (preview) = p2
    if (points.length === 1 && preview) {
      onDrawingComplete({ tool, points: [points[0], preview] })
      setInProg(null)
    }
  }, [drag, inProg, onDrawingComplete])

  const deleteSel = useCallback(() => {
    if (sel == null) return
    onDrawingsChange(drawings.filter((_, i) => i !== sel))
    setSel(null)
  }, [sel, drawings, onDrawingsChange])

  // ── SVG render helpers ────────────────────────────────────────────────────
  const W     = 9999
  const color = (i) => sel === i ? C.gold : '#7B8CB8'
  const sw    = (i) => sel === i ? 2.5 : 1.5
  const click = (i) => () => setSel(sel === i ? null : i)

  const renderDrawing = (d, i) => {
    const [p1, p2] = d.points
    if (!p1) return null
    const y1 = toY(p1.price)
    if (y1 == null) return null
    const x1 = p1.x ?? 80
    const y2 = p2 ? toY(p2.price) : null
    const x2 = p2?.x ?? 200
    const clr = color(i), strokeW = sw(i)

    switch (d.tool) {

      case 'horizontal':
        return (
          <g key={i} onClick={click(i)} style={{ cursor: 'pointer' }}>
            {/* Wide invisible hit area */}
            <line x1={0} y1={y1} x2={W} y2={y1} stroke="transparent" strokeWidth={12} />
            <line x1={0} y1={y1} x2={W} y2={y1} stroke={clr} strokeWidth={strokeW} strokeDasharray="6 3" />
            <text x={8} y={y1 - 5} fill={clr} fontSize={10} fontFamily="monospace">{p1.price?.toFixed(2)}</text>
            <circle cx={x1} cy={y1} r={7} fill={clr} fillOpacity={0.22} stroke={clr} strokeWidth={1} />
          </g>
        )

      case 'trendline': {
        if (y2 == null) return null
        const dx = x2 - x1, dy = y2 - y1
        const slope = dx !== 0 ? dy / dx : 0
        const ly0 = y1 - x1 * slope
        const lyW = y1 + (W - x1) * slope
        return (
          <g key={i} onClick={click(i)} style={{ cursor: 'pointer' }}>
            <line x1={0} y1={ly0} x2={W} y2={lyW} stroke="transparent" strokeWidth={12} />
            <line x1={0} y1={ly0} x2={W} y2={lyW} stroke={clr} strokeWidth={strokeW} />
            <circle cx={x1} cy={y1} r={7} fill={clr} fillOpacity={0.25} stroke={clr} strokeWidth={1} />
            <circle cx={x2} cy={y2} r={7} fill={clr} fillOpacity={0.25} stroke={clr} strokeWidth={1} />
          </g>
        )
      }

      case 'pricerange': {
        if (y2 == null) return null
        const dist = Math.abs(p2.price - p1.price)
        const top  = Math.min(y1, y2), bot = Math.max(y1, y2)
        const lx   = Math.min(x1, x2), rx = Math.max(x1, x2)
        const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2
        return (
          <g key={i} onClick={click(i)} style={{ cursor: 'pointer' }}>
            <rect x={lx} y={top} width={rx - lx} height={bot - top} fill={clr} fillOpacity={0.08} />
            <line x1={lx} y1={y1} x2={rx} y2={y1} stroke={clr} strokeWidth={strokeW} />
            <line x1={lx} y1={y2} x2={rx} y2={y2} stroke={clr} strokeWidth={strokeW} />
            <line x1={midX} y1={y1} x2={midX} y2={y2} stroke={clr} strokeWidth={1} strokeDasharray="4 3" />
            <text x={midX + 4} y={midY + 4} fill={clr} fontSize={10} fontFamily="monospace">
              {dist.toFixed(2)} pts
            </text>
            <circle cx={x1} cy={y1} r={6} fill={clr} fillOpacity={0.25} />
            <circle cx={x2} cy={y2} r={6} fill={clr} fillOpacity={0.25} />
          </g>
        )
      }

      case 'rectangle': {
        if (y2 == null) return null
        const rx = Math.min(x1, x2), ry = Math.min(y1, y2)
        const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1)
        return (
          <g key={i} onClick={click(i)} style={{ cursor: 'pointer' }}>
            <rect x={rx} y={ry} width={rw} height={rh} stroke={clr} strokeWidth={strokeW} fill={clr} fillOpacity={0.08} />
            <circle cx={x1} cy={y1} r={6} fill={clr} fillOpacity={0.3} />
            <circle cx={x2} cy={y2} r={6} fill={clr} fillOpacity={0.3} />
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
            <circle cx={x1} cy={y1} r={6} fill={C.gold} fillOpacity={0.3} />
            <circle cx={x2} cy={y2} r={6} fill={C.gold} fillOpacity={0.3} />
          </g>
        )
      }

      case 'long':
      case 'short': {
        if (y2 == null) return null
        const isLong  = d.tool === 'long'
        const entry   = p1.price
        const tp      = p2.price
        const slPrice = entry - (tp - entry)   // mirror SL on other side of entry
        const slY     = toY(slPrice)
        const tpClr   = isLong ? C.green : C.red
        const slClr   = isLong ? C.red   : C.green
        const rr      = entry !== slPrice ? Math.abs((tp - entry) / (entry - slPrice)) : 0
        const tpTop   = Math.min(y1, y2), tpH = Math.abs(y2 - y1)
        const slTop   = slY != null ? Math.min(y1, slY) : y1
        const slH     = slY != null ? Math.abs(slY - y1) : 0
        return (
          <g key={i} onClick={click(i)} style={{ cursor: 'pointer' }}>
            {/* TP zone */}
            <rect x={0} y={tpTop} width={W} height={tpH} fill={tpClr} fillOpacity={0.13} />
            <line x1={0} y1={y2} x2={W} y2={y2} stroke={tpClr} strokeWidth={1.5} />
            <text x={8} y={y2 - 4} fill={tpClr} fontSize={10} fontFamily="monospace">TP {tp.toFixed(2)}</text>
            {/* Entry */}
            <line x1={0} y1={y1} x2={W} y2={y1} stroke="#ffffff" strokeWidth={2} />
            <text x={8} y={y1 - 4} fill="#ffffff" fontSize={10} fontFamily="monospace">Entry {entry.toFixed(2)}</text>
            {/* SL zone */}
            {slY != null && (
              <>
                <rect x={0} y={slTop} width={W} height={slH} fill={slClr} fillOpacity={0.13} />
                <line x1={0} y1={slY} x2={W} y2={slY} stroke={slClr} strokeWidth={1.5} />
                <text x={8} y={slY + 12} fill={slClr} fontSize={10} fontFamily="monospace">SL {slPrice.toFixed(2)}</text>
              </>
            )}
            {/* RR label */}
            <text x={8} y={y1 + (isLong ? -tpH / 2 : tpH / 2)} fill="#ffffff" fontSize={12} fontWeight="bold">
              RR {isFinite(rr) ? rr.toFixed(2) : '—'}
            </text>
            <circle cx={x1} cy={y1} r={7} fill="#ffffff" fillOpacity={0.2} />
          </g>
        )
      }

      default: return null
    }
  }

  const renderPreview = () => {
    if (!inProg?.preview) return null
    const p1 = inProg.points[0]
    const p2 = inProg.preview
    const y1 = toY(p1.price), y2 = toY(p2.price)
    if (y1 == null) return null

    // For horizontal: show full-width line immediately
    if (inProg.tool === 'horizontal') {
      return (
        <g opacity={0.6}>
          <line x1={0} y1={y1} x2={W} y2={y1} stroke={C.gold} strokeWidth={1.5} strokeDasharray="5 3" />
          <text x={8} y={y1 - 5} fill={C.gold} fontSize={10} fontFamily="monospace">{p1.price?.toFixed(2)}</text>
        </g>
      )
    }

    return (
      <g opacity={0.6}>
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
          zIndex: 10, overflow: 'visible',
          touchAction: 'none',
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
    partialCandle, activeTool,
    drawings, onDrawingComplete, onDrawingsChange,
    magnet, startingBalance, onOHLCHover,
  },
  ref
) {
  const containerRef    = useRef(null)
  const chartRef        = useRef(null)   // the LW Charts instance
  const mainSeriesRef   = useRef(null)
  const ghostSeriesRef  = useRef(null)
  const equitySeriesRef = useRef(null)
  const priceLineRefs   = useRef([])
  const [cursorX, setCursorX] = useState(null)
  const [chartReady, setChartReady] = useState(false)

  // Stable getter — always returns current chart instance
  const getChart = useCallback(() => chartRef.current, [])

  useImperativeHandle(ref, () => ({
    get chart()  { return chartRef.current },
    get series() { return mainSeriesRef.current },
  }))

  // ── Init chart once ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: { background: { color: C.bg }, textColor: C.text },
      grid:   { vertLines: { color: '#1a1e2e' }, horzLines: { color: '#1a1e2e' } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#758696', labelBackgroundColor: C.panel },
        horzLine: { color: '#758696', labelBackgroundColor: C.panel },
      },
      rightPriceScale: {
        borderColor: C.border,
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
      timeScale: {
        borderColor: C.border, timeVisible: true,
        secondsVisible: false, rightOffset: 10,
      },
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })

    // Main candle series
    const mainSeries = chart.addCandlestickSeries({
      upColor: C.green, downColor: C.red,
      borderUpColor: C.green, borderDownColor: C.red,
      wickUpColor: C.green, wickDownColor: C.red,
    })

    // Ghost future candles
    const ghostSeries = chart.addCandlestickSeries({
      upColor:         'rgba(100,100,100,0.15)',
      downColor:       'rgba(100,100,100,0.15)',
      borderUpColor:   'rgba(100,100,100,0.20)',
      borderDownColor: 'rgba(100,100,100,0.20)',
      wickUpColor:     'rgba(100,100,100,0.20)',
      wickDownColor:   'rgba(100,100,100,0.20)',
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // Equity curve
    const equitySeries = chart.addLineSeries({
      color:                  'rgba(240,185,11,0.55)',
      lineWidth:              1,
      priceScaleId:           'equity',
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: false,
    })
    chart.priceScale('equity').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      drawTicks:    false,
      borderVisible: false,
    })

    chartRef.current       = chart
    mainSeriesRef.current  = mainSeries
    ghostSeriesRef.current = ghostSeries
    equitySeriesRef.current= equitySeries

    // OHLC crosshair hover
    chart.subscribeCrosshairMove(param => {
      if (!param?.seriesData) return
      const d = param.seriesData.get(mainSeries)
      if (d && onOHLCHover) onOHLCHover({ open: d.open, high: d.high, low: d.low, close: d.close })
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    ro.observe(containerRef.current)
    setChartReady(true)

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; setChartReady(false) }
  }, []) // eslint-disable-line

  // ── Update candle data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mainSeriesRef.current || !ghostSeriesRef.current || !candles.length) return

    // Revealed candles (history + replay up to visibleIndex)
    const revealed = candles.slice(0, visibleIndex + 1)

    // Append partial (building) candle — replace last if same time
    let displayData = [...revealed]
    if (partialCandle) {
      const last = displayData[displayData.length - 1]
      if (last && partialCandle.time === last.time) {
        displayData[displayData.length - 1] = partialCandle
      } else {
        displayData.push(partialCandle)
      }
    }

    mainSeriesRef.current.setData(displayData)

    // Future ghost candles
    ghostSeriesRef.current.setData(candles.slice(visibleIndex + 1))

    // Keep current candle in view
    chartRef.current?.timeScale().scrollToRealTime()

    // Update replay cursor x position
    const c = candles[visibleIndex]
    if (c) {
      const x = chartRef.current?.timeScale().timeToCoordinate(c.time)
      setCursorX(x ?? null)
    }
  }, [candles, visibleIndex, partialCandle])

  // ── Trade markers ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mainSeriesRef.current || !candles.length) return

    const markers = []

    // Replay start flag
    if (replayStartIndex < candles.length) {
      markers.push({
        time:     candles[replayStartIndex].time,
        position: 'belowBar',
        color:    C.gold,
        shape:    'arrowUp',
        text:     'START',
        size:     1,
      })
    }

    // Entry + exit markers for each closed trade
    for (const t of closedTrades) {
      const openTs  = Math.floor(new Date(t.openedAt).getTime() / 1000)
      const closeTs = Math.floor(new Date(t.closedAt).getTime() / 1000)

      // Find nearest candle at or after the timestamp
      const entryC = candles.find(c => c.time >= openTs)
      const exitC  = candles.find(c => c.time >= closeTs)

      if (entryC) markers.push({
        time:     entryC.time,
        position: t.direction === 'long' ? 'belowBar' : 'aboveBar',
        color:    t.direction === 'long' ? C.green : C.red,
        shape:    t.direction === 'long' ? 'arrowUp' : 'arrowDown',
        text:     '',
        size:     1,
      })

      if (exitC) markers.push({
        time:     exitC.time,
        position: t.direction === 'long' ? 'aboveBar' : 'belowBar',
        color:    t.pnl >= 0 ? C.green : C.red,
        shape:    'circle',
        text:     '',
        size:     0.7,
      })
    }

    // Sort by time — required by Lightweight Charts
    markers.sort((a, b) => a.time - b.time)
    mainSeriesRef.current.setMarkers(markers)
  }, [closedTrades, candles, replayStartIndex])

  // ── Equity curve ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!equitySeriesRef.current) return
    if (!closedTrades.length) { equitySeriesRef.current.setData([]); return }

    let running = startingBalance
    const raw = []
    for (const t of [...closedTrades].sort((a,b) =>
      new Date(a.closedAt) - new Date(b.closedAt)
    )) {
      running += t.pnl
      const ts = Math.floor(new Date(t.closedAt).getTime() / 1000)
      const c  = candles.find(c => c.time >= ts)
      if (c) raw.push({ time: c.time, value: running })
    }

    // Deduplicate by time
    const seen = new Set(), deduped = []
    for (const p of raw) {
      if (!seen.has(p.time)) { seen.add(p.time); deduped.push(p) }
    }
    if (deduped.length) equitySeriesRef.current.setData(deduped)
  }, [closedTrades, candles, startingBalance])

  // ── Open position price lines ─────────────────────────────────────────────
  useEffect(() => {
    if (!mainSeriesRef.current) return
    priceLineRefs.current.forEach(pl => {
      try { mainSeriesRef.current.removePriceLine(pl) } catch {}
    })
    priceLineRefs.current = []

    openPositions.forEach(pos => {
      const defs = [
        { price: pos.entryPrice, color: '#cccccc', title: `${pos.direction.toUpperCase()} @ ${pos.entryPrice.toFixed(2)}` },
        pos.tp != null && { price: pos.tp, color: pos.direction==='long' ? C.green : C.red, title: 'TP' },
        pos.sl != null && { price: pos.sl, color: pos.direction==='long' ? C.red : C.green, title: 'SL' },
      ].filter(Boolean)

      defs.forEach(def => {
        const pl = mainSeriesRef.current.createPriceLine({
          price: def.price, color: def.color, lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: def.title,
        })
        priceLineRefs.current.push(pl)
      })
    })
  }, [openPositions])

  // Visible candles for magnet snapping (last 50 revealed candles)
  const visibleCandles = candles.slice(Math.max(0, visibleIndex - 50), visibleIndex + 1)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Replay cursor — vertical dashed line at current candle */}
      {cursorX != null && (
        <svg
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 5, overflow: 'visible',
          }}
        >
          <line
            x1={cursorX} y1={0} x2={cursorX} y2="100%"
            stroke={C.gold} strokeWidth={1}
            strokeDasharray="4 3" opacity={0.65}
          />
          {/* Gold triangle marker at top of cursor */}
          <polygon
            points={`${cursorX-5},2 ${cursorX+5},2 ${cursorX},10`}
            fill={C.gold} opacity={0.8}
          />
        </svg>
      )}

      {/* Drawing overlay — only mount after chart is ready */}
      {chartReady && (
        <DrawingOverlay
          drawings={drawings}
          activeTool={activeTool}
          getChart={getChart}
          onDrawingComplete={onDrawingComplete}
          onDrawingsChange={onDrawingsChange}
          magnet={magnet}
          visibleCandles={visibleCandles}
        />
      )}
    </div>
  )
})

export default Chart
