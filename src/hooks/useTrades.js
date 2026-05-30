import { useCallback, useEffect, useRef } from 'react'
import { dbSaveTrade, dbSaveStats } from '../lib/supabase.js'

export function computeStats(trades, startingBalance) {
  if (!trades.length) return null
  const wins   = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl <= 0)

  const winRate     = (wins.length / trades.length) * 100
  const rrValues    = trades.filter(t => t.rr != null).map(t => t.rr)
  const avgRR       = rrValues.length ? rrValues.reduce((s, v) => s + v, 0) / rrValues.length : null
  const biggestWin  = wins.length   ? Math.max(...wins.map(t => t.pnl))   : 0
  const biggestLoss = losses.length ? Math.min(...losses.map(t => t.pnl)) : 0

  let peak = startingBalance, maxDrawdown = 0, running = startingBalance
  for (const t of trades) {
    running += t.pnl
    if (running > peak) peak = running
    const dd = peak - running
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  const grossWins   = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0

  return { winRate, avgRR, biggestWin, biggestLoss, maxDrawdown, profitFactor }
}

export function useTrades(session, interval) {
  const {
    openPositions, setOpenPositions,
    closedTrades,  setClosedTrades,
    balance,       setBalance,
    startingBalance,
    candles, visibleIndex,
  } = session

  // Track last processed index to avoid re-checking candles
  const lastCheckedRef = useRef(visibleIndex)

  // ── Auto SL/TP check on every new candle ─────────────────────────────────
  useEffect(() => {
    if (!openPositions.length || !candles.length) return
    if (visibleIndex <= lastCheckedRef.current) return
    lastCheckedRef.current = visibleIndex

    const candle = candles[visibleIndex]
    if (!candle) return

    let updatedPositions = [...openPositions]
    let balanceDelta = 0
    const newlyClosed = []

    updatedPositions = updatedPositions.filter(pos => {
      if (pos.tp == null && pos.sl == null) return true // no auto-close set

      const hitSL = pos.direction === 'long'
        ? (pos.sl != null && candle.low  <= pos.sl)
        : (pos.sl != null && candle.high >= pos.sl)

      const hitTP = pos.direction === 'long'
        ? (pos.tp != null && candle.high >= pos.tp)
        : (pos.tp != null && candle.low  <= pos.tp)

      if (!hitSL && !hitTP) return true

      // SL takes priority if both hit same candle
      const exitPrice = hitSL ? pos.sl : pos.tp
      const pnl = calcPnl(pos, exitPrice)
      const rr  = pos.sl != null && pos.tp != null
        ? Math.abs((pos.tp - pos.entryPrice) / (pos.entryPrice - pos.sl))
        : null

      const closed = {
        ...pos,
        exitPrice,
        pnl,
        rr,
        closedAt:  new Date().toISOString(),
        closeType: hitSL ? 'sl' : 'tp',
      }
      newlyClosed.push(closed)
      balanceDelta += pnl
      return false
    })

    if (!newlyClosed.length) return

    const updatedClosed = [...closedTrades, ...newlyClosed]
    setOpenPositions(updatedPositions)
    setClosedTrades(updatedClosed)
    setBalance(prev => prev + balanceDelta)

    // Persist to Supabase
    newlyClosed.forEach(t => {
      dbSaveTrade({ ...t, interval }).catch(() => {})
    })
    const stats = computeStats(updatedClosed, startingBalance)
    if (stats) dbSaveStats(stats, startingBalance).catch(() => {})

  }, [visibleIndex]) // eslint-disable-line

  // ── Open a trade ──────────────────────────────────────────────────────────
  const openTrade = useCallback((direction, size, tp, sl) => {
    const candle = candles[visibleIndex]
    if (!candle) return
    const entryPrice = candle.close
    const pos = {
      direction,
      entryPrice,
      size:     parseFloat(size) || 0.1,
      tp:       tp ? parseFloat(tp) : null,
      sl:       sl ? parseFloat(sl) : null,
      openedAt: new Date().toISOString(),
      id:       Date.now(),
    }
    setOpenPositions(prev => [...prev, pos])
  }, [candles, visibleIndex, setOpenPositions])

  // ── Manually close a trade ────────────────────────────────────────────────
  const closeTrade = useCallback((posId) => {
    const candle = candles[visibleIndex]
    if (!candle) return
    const exitPrice = candle.close

    let closed = null
    const updated = openPositions.filter(pos => {
      if (pos.id !== posId) return true
      const pnl = calcPnl(pos, exitPrice)
      const rr  = pos.sl != null && pos.tp != null
        ? Math.abs((pos.tp - pos.entryPrice) / (pos.entryPrice - pos.sl))
        : null
      closed = { ...pos, exitPrice, pnl, rr, closedAt: new Date().toISOString(), closeType: 'manual' }
      return false
    })

    if (!closed) return
    const updatedClosed = [...closedTrades, closed]
    setOpenPositions(updated)
    setClosedTrades(updatedClosed)
    setBalance(prev => prev + closed.pnl)

    dbSaveTrade({ ...closed, interval }).catch(() => {})
    const stats = computeStats(updatedClosed, startingBalance)
    if (stats) dbSaveStats(stats, startingBalance).catch(() => {})
  }, [candles, visibleIndex, openPositions, closedTrades, setOpenPositions, setClosedTrades, setBalance, startingBalance, interval])

  return { openTrade, closeTrade }
}

function calcPnl(pos, exitPrice) {
  const diff = pos.direction === 'long'
    ? exitPrice - pos.entryPrice
    : pos.entryPrice - exitPrice
  // 1 lot of XAU/USD ≈ 100 oz. P&L = diff * size * 100
  return diff * pos.size * 100
}
