import { useCallback, useEffect, useRef, useState } from 'react'
import { dbSaveTrade, dbSaveStats } from '../lib/supabase.js'

export function computeStats(trades, startingBalance) {
  if (!trades.length) return null
  const wins   = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl <= 0)
  const winRate = (wins.length / trades.length) * 100
  const rrVals  = trades.filter(t => t.rr != null).map(t => t.rr)
  const avgRR   = rrVals.length ? rrVals.reduce((s,v) => s+v, 0) / rrVals.length : null
  const biggestWin  = wins.length   ? Math.max(...wins.map(t=>t.pnl))   : 0
  const biggestLoss = losses.length ? Math.min(...losses.map(t=>t.pnl)) : 0
  let peak = startingBalance, maxDrawdown = 0, running = startingBalance
  for (const t of trades) {
    running += t.pnl
    if (running > peak) peak = running
    const dd = peak - running
    if (dd > maxDrawdown) maxDrawdown = dd
  }
  const grossWins   = wins.reduce((s,t) => s+t.pnl, 0)
  const grossLosses = Math.abs(losses.reduce((s,t) => s+t.pnl, 0))
  const profitFactor = grossLosses > 0 ? grossWins/grossLosses : grossWins > 0 ? Infinity : 0
  return { winRate, avgRR, biggestWin, biggestLoss, maxDrawdown, profitFactor }
}

function calcPnl(pos, exitPrice) {
  const diff = pos.direction === 'long'
    ? exitPrice - pos.entryPrice
    : pos.entryPrice - exitPrice
  return diff * pos.size * 100
}

export function useTrades(session, interval) {
  const {
    openPositions, setOpenPositions,
    closedTrades,  setClosedTrades,
    balance,       setBalance,
    startingBalance,
    candles, visibleIndex,
  } = session

  const lastCheckedRef = useRef(-1)
  // Flash notifications: [{ id, message, color }]
  const [notifications, setNotifications] = useState([])

  const addNotification = useCallback((msg, color) => {
    const id = Date.now() + Math.random()
    setNotifications(prev => [...prev, { id, message: msg, color }])
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 3000)
  }, [])

  // ── Intra-candle unrealised P&L (uses candle high/low for worst-case) ──────
  const getUnrealisedPnl = useCallback((positions, candle) => {
    if (!candle || !positions.length) return 0
    return positions.reduce((sum, pos) => {
      // Use the current close for the floating P&L display
      // But also check if high/low would have hit SL mid-candle
      const price = candle.close
      const diff  = pos.direction === 'long'
        ? price - pos.entryPrice
        : pos.entryPrice - price
      return sum + diff * pos.size * 100
    }, 0)
  }, [])

  // ── Auto SL/TP check every new candle ─────────────────────────────────────
  useEffect(() => {
    if (!openPositions.length || !candles.length) return
    if (visibleIndex <= lastCheckedRef.current) return
    lastCheckedRef.current = visibleIndex

    const candle = candles[visibleIndex]
    if (!candle) return

    let updatedOpen = [...openPositions]
    let balDelta    = 0
    const newlyClosed = []

    updatedOpen = updatedOpen.filter(pos => {
      if (pos.tp == null && pos.sl == null) return true

      const hitSL = pos.direction === 'long'
        ? pos.sl != null && candle.low  <= pos.sl
        : pos.sl != null && candle.high >= pos.sl

      const hitTP = pos.direction === 'long'
        ? pos.tp != null && candle.high >= pos.tp
        : pos.tp != null && candle.low  <= pos.tp

      if (!hitSL && !hitTP) return true

      // SL priority if both hit same candle
      const exitPrice  = hitSL ? pos.sl : pos.tp
      const pnl        = calcPnl(pos, exitPrice)
      const rr         = pos.sl != null && pos.tp != null
        ? Math.abs((pos.tp - pos.entryPrice) / (pos.entryPrice - pos.sl))
        : null

      newlyClosed.push({
        ...pos, exitPrice, pnl, rr,
        closedAt:  new Date().toISOString(),
        closeType: hitSL ? 'sl' : 'tp',
      })
      balDelta += pnl

      // Flash notification
      if (hitSL) {
        addNotification(`🔴 SL Hit — ${pos.direction.toUpperCase()} closed at ${pos.sl?.toFixed(2)} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, '#ef5350')
      } else {
        addNotification(`✅ TP Hit — ${pos.direction.toUpperCase()} closed at ${pos.tp?.toFixed(2)} | P&L: +$${pnl.toFixed(2)}`, '#26a69a')
      }
      return false
    })

    if (!newlyClosed.length) return

    const updatedClosed = [...closedTrades, ...newlyClosed]
    setOpenPositions(updatedOpen)
    setClosedTrades(updatedClosed)
    setBalance(prev => prev + balDelta)

    newlyClosed.forEach(t => dbSaveTrade({ ...t, interval }).catch(() => {}))
    const stats = computeStats(updatedClosed, startingBalance)
    if (stats) dbSaveStats(stats, startingBalance).catch(() => {})
  }, [visibleIndex]) // eslint-disable-line

  // ── Open trade ─────────────────────────────────────────────────────────────
  const openTrade = useCallback((direction, size, tp, sl) => {
    const candle = candles[visibleIndex]
    if (!candle) return
    const entryPrice = candle.close
    const pos = {
      direction, entryPrice,
      size:     parseFloat(size) || 0.1,
      tp:       tp ? parseFloat(tp) : null,
      sl:       sl ? parseFloat(sl) : null,
      openedAt: new Date().toISOString(),
      openedAtIndex: visibleIndex,
      id:       Date.now(),
    }
    setOpenPositions(prev => [...prev, pos])
    addNotification(
      `${direction === 'long' ? '▲ LONG' : '▼ SHORT'} opened @ ${entryPrice.toFixed(2)}`,
      direction === 'long' ? '#26a69a' : '#ef5350'
    )
  }, [candles, visibleIndex, setOpenPositions, addNotification])

  // ── Manual close ───────────────────────────────────────────────────────────
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
    addNotification(
      `Closed @ ${exitPrice.toFixed(2)} | P&L: ${closed.pnl >= 0 ? '+' : ''}$${closed.pnl.toFixed(2)}`,
      closed.pnl >= 0 ? '#26a69a' : '#ef5350'
    )
    dbSaveTrade({ ...closed, interval }).catch(() => {})
    const stats = computeStats(updatedClosed, startingBalance)
    if (stats) dbSaveStats(stats, startingBalance).catch(() => {})
  }, [candles, visibleIndex, openPositions, closedTrades, setOpenPositions, setClosedTrades, setBalance, startingBalance, interval, addNotification])

  return { openTrade, closeTrade, notifications, getUnrealisedPnl }
}
