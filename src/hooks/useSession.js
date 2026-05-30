import { useState, useEffect, useCallback } from 'react'
import { LS } from '../constants.js'

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('localStorage write failed:', e.message)
  }
}

export function useSession() {
  const [interval, setIntervalState]       = useState(() => lsGet(LS.INTERVAL, '1H'))
  const [startDate, setStartDateState]     = useState(() => lsGet(LS.START_DATE, '2023-01-01'))
  const [candles, setCandlesState]         = useState(() => lsGet(LS.CANDLES, []))
  const [visibleIndex, setVisibleIndexState] = useState(() => lsGet(LS.VISIBLE_INDEX, 0))
  const [drawings, setDrawingsState]       = useState(() => lsGet(LS.DRAWINGS, []))
  const [openPositions, setOpenPositionsState] = useState(() => lsGet(LS.OPEN_POSITIONS, []))
  const [closedTrades, setClosedTradesState]   = useState(() => lsGet(LS.CLOSED_TRADES, []))
  const [startingBalance, setStartingBalanceState] = useState(() => lsGet(LS.STARTING_BAL, 10000))
  const [balance, setBalanceState]         = useState(() => lsGet(LS.BALANCE, 10000))

  // Wrapped setters that also persist to localStorage
  const setInterval = useCallback(v => { setIntervalState(v); lsSet(LS.INTERVAL, v) }, [])
  const setStartDate = useCallback(v => { setStartDateState(v); lsSet(LS.START_DATE, v) }, [])

  const setCandles = useCallback(v => {
    setCandlesState(v)
    lsSet(LS.CANDLES, v)
  }, [])

  const setVisibleIndex = useCallback(v => {
    setVisibleIndexState(v)
    lsSet(LS.VISIBLE_INDEX, v)
  }, [])

  const setDrawings = useCallback(v => {
    setDrawingsState(v)
    lsSet(LS.DRAWINGS, v)
  }, [])

  const setOpenPositions = useCallback(v => {
    setOpenPositionsState(v)
    lsSet(LS.OPEN_POSITIONS, v)
  }, [])

  const setClosedTrades = useCallback(v => {
    setClosedTradesState(v)
    lsSet(LS.CLOSED_TRADES, v)
  }, [])

  const setStartingBalance = useCallback(v => {
    setStartingBalanceState(v)
    lsSet(LS.STARTING_BAL, v)
  }, [])

  const setBalance = useCallback(v => {
    setBalanceState(v)
    lsSet(LS.BALANCE, v)
  }, [])

  const resetSession = useCallback((newStartingBalance) => {
    const bal = newStartingBalance ?? startingBalance
    setOpenPositions([])
    setClosedTrades([])
    setBalance(bal)
    setStartingBalance(bal)
    setDrawings([])
    setVisibleIndex(0)
  }, [startingBalance, setOpenPositions, setClosedTrades, setBalance, setStartingBalance, setDrawings, setVisibleIndex])

  return {
    interval, setInterval,
    startDate, setStartDate,
    candles, setCandles,
    visibleIndex, setVisibleIndex,
    drawings, setDrawings,
    openPositions, setOpenPositions,
    closedTrades, setClosedTrades,
    startingBalance, setStartingBalance,
    balance, setBalance,
    resetSession,
  }
}
