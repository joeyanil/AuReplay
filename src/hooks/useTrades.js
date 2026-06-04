import { useCallback, useEffect, useRef, useState } from 'react'
import { dbSaveTrade, dbSaveStats } from '../lib/supabase.js'

export function computeStats(trades, startingBalance) {
  if (!trades.length) return null
  const wins   = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl <= 0)
  const winRate = (wins.length / trades.length) * 100
  const rrVals  = trades.filter(t => t.rr != null).map(t => t.rr)
  const avgRR   = rrVals.length ? rrVals.reduce((s,v)=>s+v,0)/rrVals.length : null
  const biggestWin  = wins.length   ? Math.max(...wins.map(t=>t.pnl))   : 0
  const biggestLoss = losses.length ? Math.min(...losses.map(t=>t.pnl)) : 0
  let peak = startingBalance, maxDrawdown = 0, running = startingBalance
  for (const t of trades) {
    running += t.pnl
    if (running > peak) peak = running
    const dd = peak - running
    if (dd > maxDrawdown) maxDrawdown = dd
  }
  const grossWins   = wins.reduce((s,t)=>s+t.pnl,0)
  const grossLosses = Math.abs(losses.reduce((s,t)=>s+t.pnl,0))
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

  const lastChecked = useRef(-1)
  const [notifications, setNotifications] = useState([])

  const toast = useCallback((msg, color) => {
    const id = Date.now() + Math.random()
    setNotifications(p => [...p, { id, msg, color }])
    setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), 3500)
  }, [])

  // ── Auto SL/TP — check on every new candle ───────────────────────────────
  useEffect(() => {
    if (!openPositions.length || !candles.length) return
    if (visibleIndex <= lastChecked.current)       return
    lastChecked.current = visibleIndex

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

      // SL takes priority if both hit on same candle
      const exitPrice = hitSL ? pos.sl : pos.tp
      const pnl       = calcPnl(pos, exitPrice)
      const rr        = (pos.sl != null && pos.tp != null && pos.entryPrice !== pos.sl)
        ? Math.abs((pos.tp - pos.entryPrice) / (pos.entryPrice - pos.sl))
        : null

      newlyClosed.push({
        ...pos, exitPrice, pnl, rr,
        closedAt:  new Date().toISOString(),
        closeType: hitSL ? 'sl' : 'tp',
      })
      balDelta += pnl

      if (hitSL) toast(`✗ SL Hit  ${pos.direction.toUpperCase()} @ ${pos.sl?.toFixed(2)}   ${pnl>=0?'+':''}$${pnl.toFixed(2)}`, '#ef5350')
      else       toast(`✓ TP Hit  ${pos.direction.toUpperCase()} @ ${pos.tp?.toFixed(2)}   +$${pnl.toFixed(2)}`, '#26a69a')
      return false
    })

    if (!newlyClosed.length) return
    const updatedClosed = [...closedTrades, ...newlyClosed]
    setOpenPositions(updatedOpen)
    setClosedTrades(updatedClosed)
    setBalance(p => p + balDelta)
    newlyClosed.forEach(t => dbSaveTrade({...t, interval}).catch(()=>{}))
    const stats = computeStats(updatedClosed, startingBalance)
    if (stats) dbSaveStats(stats, startingBalance).catch(()=>{})
  }, [visibleIndex]) // eslint-disable-line

  // ── Open trade ─────────────────────────────────────────────────────────────
  const openTrade = useCallback((direction, size, tp, sl) => {
    const candle = candles[visibleIndex]
    if (!candle) return
    const entryPrice = candle.close
    const pos = {
      direction,
      entryPrice,
      size:          parseFloat(size) || 0.1,
      tp:            tp ? parseFloat(tp) : null,
      sl:            sl ? parseFloat(sl) : null,
      openedAt:      new Date().toISOString(),
      openedAtIndex: visibleIndex,
      id:            Date.now(),
    }
    setOpenPositions(p => [...p, pos])
    toast(
      `${direction==='long'?'▲ LONG':'▼ SHORT'} opened @ ${entryPrice.toFixed(2)}`,
      direction==='long' ? '#26a69a' : '#ef5350'
    )
  }, [candles, visibleIndex, setOpenPositions, toast])

  // ── Manual close ──────────────────────────────────────────────────────────
  const closeTrade = useCallback((posId) => {
    const candle = candles[visibleIndex]
    if (!candle) return
    const exitPrice = candle.close
    let closed = null

    const updated = openPositions.filter(pos => {
      if (pos.id !== posId) return true
      const pnl = calcPnl(pos, exitPrice)
      const rr  = (pos.sl != null && pos.tp != null && pos.entryPrice !== pos.sl)
        ? Math.abs((pos.tp - pos.entryPrice) / (pos.entryPrice - pos.sl))
        : null
      closed = { ...pos, exitPrice, pnl, rr, closedAt: new Date().toISOString(), closeType: 'manual' }
      return false
    })

    if (!closed) return
    const updatedClosed = [...closedTrades, closed]
    setOpenPositions(updated)
    setClosedTrades(updatedClosed)
    setBalance(p => p + closed.pnl)
    toast(
      `Closed @ ${exitPrice.toFixed(2)}   ${closed.pnl>=0?'+':''}$${closed.pnl.toFixed(2)}`,
      closed.pnl >= 0 ? '#26a69a' : '#ef5350'
    )
    dbSaveTrade({...closed, interval}).catch(()=>{})
    const stats = computeStats(updatedClosed, startingBalance)
    if (stats) dbSaveStats(stats, startingBalance).catch(()=>{})
  }, [candles, visibleIndex, openPositions, closedTrades,
      setOpenPositions, setClosedTrades, setBalance,
      startingBalance, interval, toast])

  // ── Unrealised P&L — uses current candle close price ──────────────────────
  const getUnrealisedPnl = useCallback((positions, candle) => {
    if (!candle || !positions.length) return 0
    return positions.reduce((sum, pos) => {
      const diff = pos.direction === 'long'
        ? candle.close - pos.entryPrice
        : pos.entryPrice - candle.close
      return sum + diff * pos.size * 100
    }, 0)
  }, [])

  return { openTrade, closeTrade, notifications, getUnrealisedPnl }
}
