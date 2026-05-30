import React, { useState, useRef, useCallback } from 'react'
import Chart from './components/Chart.jsx'
import Toolbar from './components/Toolbar.jsx'
import DrawingToolbar from './components/DrawingToolbar.jsx'
import AccountDrawer from './components/AccountDrawer.jsx'
import StatsDrawer from './components/StatsDrawer.jsx'
import { useSession } from './hooks/useSession.js'
import { useReplay } from './hooks/useReplay.js'
import { useTrades } from './hooks/useTrades.js'

export default function App() {
  const session = useSession()
  const replay  = useReplay(session)
  const trades  = useTrades(session, session.interval)

  const chartRef = useRef(null)

  const [activeTool,    setActiveTool]    = useState('none')
  const [accountOpen,   setAccountOpen]   = useState(false)
  const [statsOpen,     setStatsOpen]     = useState(false)

  const currentCandle = session.candles[session.visibleIndex] ?? null
  const currentPrice  = currentCandle?.close ?? null

  // ── Drawing handlers ────────────────────────────────────────────────────────
  const handleDrawingComplete = useCallback((drawing) => {
    session.setDrawings(prev => [...prev, drawing])
    setActiveTool('none')
  }, [session])

  // ── Reset session ───────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (window.confirm('Reset session? This will wipe all trades and reset your balance.')) {
      session.resetSession()
    }
  }, [session])

  // ── Interval switch: keep same timestamp ────────────────────────────────────
  const handleIntervalChange = useCallback((newInterval) => {
    replay.switchInterval(newInterval)
  }, [replay])

  // ── Load: fresh date ────────────────────────────────────────────────────────
  const handleLoad = useCallback((interval, date) => {
    replay.load(interval, date)
  }, [replay])

  return (
    <div style={s.root}>
      {/* Top toolbar */}
      <Toolbar
        interval={session.interval}
        onIntervalChange={handleIntervalChange}
        startDate={session.startDate}
        onStartDateChange={session.setStartDate}
        onLoad={handleLoad}
        loading={replay.loading}
        isPlaying={replay.isPlaying}
        onPlay={replay.play}
        onPause={replay.pause}
        onStepBack={replay.stepBack}
        onStepForward={replay.stepForward}
        speed={replay.speed}
        onSpeedChange={replay.setSpeed}
        visibleIndex={session.visibleIndex}
        totalCandles={session.candles.length}
        onResetSession={handleReset}
      />

      {/* Error banner */}
      {replay.error && (
        <div style={s.errorBanner}>
          {replay.error}
          <button onClick={() => replay.setError(null)} style={s.errorClose}>✕</button>
        </div>
      )}

      {/* Main area: drawing toolbar + chart */}
      <div style={s.main}>
        <DrawingToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onClearAll={() => session.setDrawings([])}
        />

        <div style={s.chartWrap}>
          {/* Loading overlay */}
          {replay.loading && (
            <div style={s.overlay}>
              <div style={s.spinner}>Loading candles…</div>
            </div>
          )}

          {/* Empty state */}
          {!replay.loading && !session.candles.length && (
            <div style={s.overlay}>
              <div style={s.emptyMsg}>
                Pick a timeframe and date above,{'\n'}then tap <strong style={{ color: COLORS_GOLD }}>Load</strong>.
              </div>
            </div>
          )}

          <Chart
            ref={chartRef}
            candles={session.candles}
            visibleIndex={session.visibleIndex}
            openPositions={session.openPositions}
            activeTool={activeTool}
            drawings={session.drawings}
            onDrawingComplete={handleDrawingComplete}
            onDrawingsChange={session.setDrawings}
          />
        </div>
      </div>

      {/* Bottom drawers */}
      <div style={s.drawers}>
        {/* Only one drawer open at a time */}
        <StatsDrawer
          open={statsOpen && !accountOpen}
          onToggle={() => { setStatsOpen(p => !p); setAccountOpen(false) }}
          closedTrades={session.closedTrades}
          startingBalance={session.startingBalance}
        />

        <AccountDrawer
          open={accountOpen}
          onToggle={() => { setAccountOpen(p => !p); setStatsOpen(false) }}
          balance={session.balance}
          startingBalance={session.startingBalance}
          onSetStartingBalance={(b) => {
            session.setStartingBalance(b)
            session.setBalance(b)
          }}
          openPositions={session.openPositions}
          closedTrades={session.closedTrades}
          currentPrice={currentPrice}
          currentCandle={currentCandle}
          onBuy={(size, tp, sl) => trades.openTrade('long', size, tp, sl)}
          onSell={(size, tp, sl) => trades.openTrade('short', size, tp, sl)}
          onClosePosition={trades.closeTrade}
          onResetSession={handleReset}
        />
      </div>
    </div>
  )
}

const COLORS_GOLD = '#F0B90B'

const s = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    width: '100vw',
    background: '#131722',
    color: '#d1d4dc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden',
    userSelect: 'none',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  chartWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  drawers: {
    display: 'flex',
    flexDirection: 'column-reverse',
    flexShrink: 0,
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(19,23,34,0.80)',
    zIndex: 20,
  },
  spinner: {
    fontSize: 15,
    color: '#758696',
  },
  emptyMsg: {
    fontSize: 14,
    color: '#758696',
    textAlign: 'center',
    whiteSpace: 'pre-line',
    lineHeight: 1.7,
  },
  errorBanner: {
    background: '#2d1515',
    color: '#ef5350',
    padding: '8px 14px',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    borderBottom: '1px solid #ef5350',
  },
  errorClose: {
    background: 'transparent',
    color: '#ef5350',
    border: 'none',
    fontSize: 16,
    cursor: 'pointer',
    padding: '4px 6px',
  },
}
