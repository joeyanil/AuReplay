import { useState, useCallback } from 'react'
import { LS } from '../constants.js'

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch { return fallback }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) }
  catch (e) { console.warn('localStorage write failed:', e.message) }
}

function usePersisted(key, initial) {
  const [val, setVal] = useState(() => lsGet(key, initial))
  const set = useCallback(v => {
    setVal(v)
    lsSet(key, v)
  }, [key])
  return [val, set]
}

export function useSession() {
  const [interval,         setInterval]         = usePersisted(LS.INTERVAL,       '1H')
  const [startDate,        setStartDate]        = usePersisted(LS.START_DATE,     '2023-01-01')
  const [candles,          setCandles]          = usePersisted(LS.CANDLES,        [])
  const [visibleIndex,     setVisibleIndex]     = usePersisted(LS.VISIBLE_INDEX,  0)
  const [replayStartIndex, setReplayStartIndex] = usePersisted(LS.REPLAY_START,   0)
  const [drawings,         setDrawings]         = usePersisted(LS.DRAWINGS,       [])
  const [openPositions,    setOpenPositions]    = usePersisted(LS.OPEN_POSITIONS, [])
  const [closedTrades,     setClosedTrades]     = usePersisted(LS.CLOSED_TRADES,  [])
  const [startingBalance,  setStartingBalance]  = usePersisted(LS.STARTING_BAL,  10000)
  const [balance,          setBalance]          = usePersisted(LS.BALANCE,        10000)
  const [magnet,           setMagnet]           = usePersisted(LS.MAGNET,         'weak')

  const resetSession = useCallback((newBal) => {
    const b = newBal ?? startingBalance
    setOpenPositions([])
    setClosedTrades([])
    setBalance(b)
    setStartingBalance(b)
    setDrawings([])
    setVisibleIndex(replayStartIndex)
  }, [startingBalance, replayStartIndex,
      setOpenPositions, setClosedTrades, setBalance,
      setStartingBalance, setDrawings, setVisibleIndex])

  return {
    interval, setInterval,
    startDate, setStartDate,
    candles, setCandles,
    visibleIndex, setVisibleIndex,
    replayStartIndex, setReplayStartIndex,
    drawings, setDrawings,
    openPositions, setOpenPositions,
    closedTrades, setClosedTrades,
    startingBalance, setStartingBalance,
    balance, setBalance,
    magnet, setMagnet,
    resetSession,
  }
}
