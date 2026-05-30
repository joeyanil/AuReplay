import React, { useState, useRef, useCallback } from 'react'
import Chart from './components/Chart.jsx'
import Toolbar from './components/Toolbar.jsx'
import DrawingToolbar from './components/DrawingToolbar.jsx'
import AccountDrawer from './components/AccountDrawer.jsx'
import StatsDrawer from './components/StatsDrawer.jsx'
import Notifications from './components/Notifications.jsx'
import { useSession } from './hooks/useSession.js'
import { useReplay } from './hooks/useReplay.js'
import { useTrades } from './hooks/useTrades.js'

export default function App() {
  const session = useSession()
  const replay  = useReplay(session)
  const trades  = useTrades(session, session.interval)

  const chartRef = useRef(null)

  const [activeTool,  setActiveTool]  = useState('none')
  const [accountOpen, setAccountOpen] = useState(false)
  const [statsOpen,   setStatsOpen]   = useState(false)
  const [ohlc,        setOhlc]        = useState(null)

  const currentCandle = session.candles[session.visibleIndex] ?? null
  const currentPrice  = currentCandle?.close ?? null

  // ── Drawing handlers ────────────────────────────────────────────────────────
  const handleDrawingComplete = useCallback((drawing) => {
    session.setDrawings(prev => [...prev, drawing])
    // Keep tool active for rapid drawing (like TradingView)
    // Only deactivate pointer tool
  }, [session])

  const handleUndo = useCallback(() => {
    session.setDrawings(prev => prev.slice(0, -1))
  }, [session])

  // ── Reset session ───────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (window.confirm('Reset session? This wipes all trades and resets your balance.')) {
      session.resetSession()
    }
  }, [session])

  // ── Interval switch ─────────────────────────────────────────────────────────
  const handleIntervalChange = useCallback((newInterval) => {
    replay.switchInterval(newInterval)
  }, [replay])

  return (
    <div style={s.root}>

      {/* Top toolbar */}
      <Toolbar
        interval={session.interval}
        onIntervalChange={handleIntervalChange}
        startDate={session.startDate}
        onStartDateChange={session.setStartDate}
        onLoad={replay.load}
        loading={replay.loading}
        isPlaying={replay.isPlaying}
        onPlay={replay.play}
        onPause={replay.pause}
        onStepBack={replay.stepBack}
        onStepForward={replay.stepForward}
        onJumpStart={replay.jumpToStart}
        onJumpEnd={replay.jumpToEnd}
        speed={replay.speed}
        onSpeedChange={replay.setSpeed}
        visibleIndex={session.visibleIndex}
        totalCandles={session.candles.length}
        ohlc={ohlc || (currentCandle ? { open: currentCandle.open, high: currentCandle.high, low: currentCandle.low, close: currentCandle.close } : null)}
        currentPrice={currentPrice}
      />

      {/* Error banner */}
      {replay.error && (
        <div style={s.errorBanner}>
          <span>{replay.error}</span>
          <button onClick={() => replay.setError(null)} style={s.errClose}>✕</button>
        </div>
      )}

      {/* Main area */}
      <div style={s.main}>
        <DrawingToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onClearAll={() => session.setDrawings([])}
          onUndo={handleUndo}
          magnet={session.magnet}
          onMagnetChange={session.setMagnet}
        />

        <div style={s.chartWrap}>
          {/* Loading overlay */}
          {replay.loading && (
            <div style={s.overlay}>
              <div style={s.overlayText}>Loading candles…</div>
            </div>
          )}

          {/* Empty state */}
          {!replay.loading && !session.candles.length && (
            <div style={s.overlay}>
              <div style={s.overlayText}>
                {'Pick a timeframe and date,\nthen tap '}
                <strong style={{ color: '#F0B90B' }}>Load</strong>
              </div>
            </div>
          )}

          <Chart
            ref={chartRef}
            candles={session.candles}
            visibleIndex={session.visibleIndex}
            replayStartIndex={session.replayStartIndex}
            openPositions={session.openPositions}
            closedTrades={session.closedTrades}
            partialCandle={replay.partialCandle}
            activeTool={activeTool}
            drawings={session.drawings}
            onDrawingComplete={handleDrawingComplete}
            onDrawingsChange={session.setDrawings}
            magnet={session.magnet}
            startingBalance={session.startingBalance}
            onOHLCHover={setOhlc}
          />

          {/* Toast notifications */}
          <Notifications notifications={trades.notifications} />
        </div>
      </div>

      {/* Bottom drawers — stats below, account above (account on top) */}
      <div style={s.drawers}>
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
          onSetStartingBalance={(b) => { session.setStartingBalance(b); session.setBalance(b) }}
          openPositions={session.openPositions}
          closedTrades={session.closedTrades}
          currentPrice={currentPrice}
          currentCandle={currentCandle}
          getUnrealisedPnl={trades.getUnrealisedPnl}
          onBuy={(size, tp, sl) => trades.openTrade('long',  size, tp, sl)}
          onSell={(size, tp, sl) => trades.openTrade('short', size, tp, sl)}
          onClosePosition={trades.closeTrade}
          onResetSession={handleReset}
        />
      </div>
    </div>
  )
}

const s = {
  root: {
    display:       'flex',
    flexDirection: 'column',
    height:        '100dvh',
    width:         '100vw',
    background:    '#131722',
    color:         '#d1d4dc',
    fontFamily:    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow:      'hidden',
    userSelect:    'none',
  },
  main: {
    display:    'flex',
    flex:       1,
    overflow:   'hidden',
    minHeight:  0,
  },
  chartWrap: {
    flex:       1,
    position:   'relative',
    overflow:   'hidden',
  },
  drawers: {
    display:       'flex',
    flexDirection: 'column-reverse',
    flexShrink:    0,
  },
  overlay: {
    position:       'absolute',
    inset:          0,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'rgba(19,23,34,0.82)',
    zIndex:         20,
  },
  overlayText: {
    fontSize:   14,
    color:      '#758696',
    textAlign:  'center',
    whiteSpace: 'pre-line',
    lineHeight: 1.7,
  },
  errorBanner: {
    background:    '#2d1515',
    color:         '#ef5350',
    padding:       '7px 14px',
    fontSize:      13,
    display:       'flex',
    alignItems:    'center',
    justifyContent:'space-between',
    flexShrink:    0,
    borderBottom:  '1px solid #ef5350',
  },
  errClose: {
    background: 'transparent',
    color:      '#ef5350',
    border:     'none',
    fontSize:   16,
    cursor:     'pointer',
    padding:    '4px 6px',
  },
}
