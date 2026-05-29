import React, { useState, useEffect, useRef, useCallback } from 'react'
import Chart from './components/Chart.jsx'
import ReplayControls from './components/ReplayControls.jsx'
import DrawingToolbar from './components/DrawingToolbar.jsx'
import AccountPanel from './components/AccountPanel.jsx'
import StatsPanel from './components/StatsPanel.jsx'
import { fetchCandles } from './api/twelvedata.js'
import {
  supabase,
  saveTrade,
  loadTrades,
  saveSession,
  loadSession,
  saveStats,
} from './lib/supabase.js'
import { computeStats } from './components/StatsPanel.jsx'

const SPEED_MS = { 1: 1000, 2: 500, 5: 200, 10: 100 }

export default function App() {
  // ── Replay state ─────────────────────────────────────────────────────────────
  const [candles, setCandles] = useState([])
  const [visibleIndex, setVisibleIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [interval, setInterval] = useState('1H')
  const [startDate, setStartDate] = useState('2023-01-01')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const playTimerRef = useRef(null)

  // ── Drawing state ─────────────────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState('none')
  const [drawings, setDrawings] = useState([])
  const chartRef = useRef(null)

  // ── Account state ─────────────────────────────────────────────────────────────
  const [startingBalance, setStartingBalance] = useState(10000)
  const [balance, setBalance] = useState(10000)
  const [openPositions, setOpenPositions] = useState([])
  const [closedTrades, setClosedTrades] = useState([])

  // ── Current price (last visible candle close) ─────────────────────────────────
  const currentPrice = candles[visibleIndex]?.close ?? null

  // ── Load session + trades from Supabase on mount ──────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const session = await loadSession()
        if (session) {
          setInterval(session.last_interval || '1H')
          setStartDate(session.last_date || '2023-01-01')
          setStartingBalance(session.starting_balance || 10000)
          setBalance(session.starting_balance || 10000)
        }
        const trades = await loadTrades()
        if (trades.length) {
          setClosedTrades(trades.map(t => ({
            direction: t.direction,
            entryPrice: parseFloat(t.entry_price),
            exitPrice: parseFloat(t.exit_price),
            size: parseFloat(t.size),
            pnl: parseFloat(t.pnl),
            rr: t.rr ? parseFloat(t.rr) : null,
          })))
        }
      } catch (e) {
        console.warn('Session load error:', e.message)
      }
    }
    init()
  }, [])

  // ── Replay timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setVisibleIndex(prev => {
          if (prev >= candles.length - 1) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, SPEED_MS[speed])
    }
    return () => clearInterval(playTimerRef.current)
  }, [isPlaying, speed, candles.length])

  // ── Load candles ──────────────────────────────────────────────────────────────
  const handleLoad = useCallback(async () => {
    setLoading(true)
    setError(null)
    setIsPlaying(false)
    clearInterval(playTimerRef.current)
    setCandles([])
    setVisibleIndex(0)
    try {
      const data = await fetchCandles(interval, startDate, 500)
      if (!data.length) throw new Error('No candle data returned for this date/interval.')
      setCandles(data)
      setVisibleIndex(0)
      // Persist session
      await saveSession({ last_interval: interval, last_date: startDate, starting_balance: startingBalance })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [interval, startDate, startingBalance])

  // ── Playback controls ─────────────────────────────────────────────────────────
  const handlePlay = () => {
    if (visibleIndex >= candles.length - 1) return
    setIsPlaying(true)
  }

  const handlePause = () => setIsPlaying(false)

  const handleStepForward = () => {
    setIsPlaying(false)
    setVisibleIndex(prev => Math.min(prev + 1, candles.length - 1))
  }

  const handleStepBack = () => {
    setIsPlaying(false)
    setVisibleIndex(prev => Math.max(prev - 1, 0))
  }

  // ── Starting balance ─────────────────────────────────────────────────────────
  const handleSetStartingBalance = (b) => {
    setStartingBalance(b)
    setBalance(b)
    setOpenPositions([])
    setClosedTrades([])
  }

  // ── Trade execution ──────────────────────────────────────────────────────────
  const openTrade = useCallback((direction, size) => {
    if (!currentPrice) return
    const trade = {
      direction,
      entryPrice: currentPrice,
      size,
      openedAt: new Date().toISOString(),
    }
    setOpenPositions(prev => [...prev, trade])
  }, [currentPrice])

  const closeTrade = useCallback(async (index) => {
    if (!currentPrice) return
    const pos = openPositions[index]
    const pnl = pos.direction === 'long'
      ? (currentPrice - pos.entryPrice) * pos.size * 100
      : (pos.entryPrice - currentPrice) * pos.size * 100

    const closed = {
      direction: pos.direction,
      entryPrice: pos.entryPrice,
      exitPrice: currentPrice,
      size: pos.size,
      pnl,
      rr: null,
      openedAt: pos.openedAt,
      closedAt: new Date().toISOString(),
    }

    setOpenPositions(prev => prev.filter((_, i) => i !== index))
    setClosedTrades(prev => {
      const updated = [...prev, closed]
      // Save to Supabase async
      saveTrade({
        direction: closed.direction,
        entry_price: closed.entryPrice,
        exit_price: closed.exitPrice,
        size: closed.size,
        pnl: closed.pnl,
        rr: closed.rr,
        opened_at: closed.openedAt,
        closed_at: closed.closedAt,
        interval,
      }).catch(e => console.warn('saveTrade error:', e.message))

      // Save stats snapshot
      const stats = computeStats(updated, startingBalance)
      if (stats) {
        saveStats({
          win_rate: stats.winRate,
          avg_rr: stats.avgRR,
          biggest_win: stats.biggestWin,
          biggest_loss: stats.biggestLoss,
          max_drawdown: stats.maxDrawdown,
          profit_factor: stats.profitFactor,
          starting_balance: startingBalance,
        }).catch(e => console.warn('saveStats error:', e.message))
      }

      return updated
    })

    setBalance(prev => prev + pnl)
  }, [currentPrice, openPositions, interval, startingBalance])

  // ── Drawing handlers ──────────────────────────────────────────────────────────
  const handleDrawingComplete = (drawing) => {
    setDrawings(prev => [...prev, drawing])
    setActiveTool('none')
  }

  return (
    <div style={styles.root}>
      {/* Top controls */}
      <ReplayControls
        isPlaying={isPlaying}
        speed={speed}
        interval={interval}
        startDate={startDate}
        visibleIndex={visibleIndex}
        totalCandles={candles.length}
        onPlay={handlePlay}
        onPause={handlePause}
        onStepForward={handleStepForward}
        onStepBack={handleStepBack}
        onSpeedChange={setSpeed}
        onIntervalChange={setInterval}
        onStartDateChange={setStartDate}
        onLoad={handleLoad}
        loading={loading}
      />

      {/* Error banner */}
      {error && (
        <div style={styles.error}>{error}</div>
      )}

      {/* Main area */}
      <div style={styles.main}>
        {/* Drawing toolbar (left) */}
        <DrawingToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onClearAll={() => setDrawings([])}
        />

        {/* Chart (center) */}
        <div style={styles.chartWrap}>
          {loading && (
            <div style={styles.loadingOverlay}>Loading candles…</div>
          )}
          {!loading && candles.length === 0 && (
            <div style={styles.emptyOverlay}>
              Pick a date and interval, then tap <strong>Load</strong> to begin.
            </div>
          )}
          <Chart
            ref={chartRef}
            candles={candles}
            visibleIndex={visibleIndex}
            activeTool={activeTool}
            drawings={drawings}
            onDrawingComplete={handleDrawingComplete}
            onDrawingsChange={setDrawings}
          />
        </div>

        {/* Account panel (right) */}
        <AccountPanel
          balance={balance}
          startingBalance={startingBalance}
          openPositions={openPositions}
          closedTrades={closedTrades}
          currentPrice={currentPrice}
          onSetStartingBalance={handleSetStartingBalance}
          onBuy={(size) => openTrade('long', size)}
          onSell={(size) => openTrade('short', size)}
          onClosePosition={closeTrade}
        />
      </div>

      {/* Stats panel (bottom) */}
      <StatsPanel trades={closedTrades} startingBalance={startingBalance} />
    </div>
  )
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    background: '#131722',
    color: '#d1d4dc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    overflow: 'hidden',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  chartWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(19,23,34,0.85)',
    fontSize: 16,
    color: '#758696',
    zIndex: 20,
  },
  emptyOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    color: '#758696',
    textAlign: 'center',
    padding: 24,
    zIndex: 5,
  },
  error: {
    background: '#2d1515',
    color: '#ef5350',
    padding: '8px 14px',
    fontSize: 13,
    borderBottom: '1px solid #ef5350',
  },
}
