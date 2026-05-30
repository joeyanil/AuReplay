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
  catch (e) { console.warn('localStorage:', e.message) }
}

function makePersisted(key, initial) {
  return [
    () => lsGet(key, initial),
    (v) => lsSet(key, v),
  ]
}

export function useSession() {
  const [interval,        _setInterval]    = useState(() => lsGet(LS.INTERVAL,       '1H'))
  const [startDate,       _setStartDate]   = useState(() => lsGet(LS.START_DATE,     '2023-01-01'))
  const [candles,         _setCandles]     = useState(() => lsGet(LS.CANDLES,        []))
  const [visibleIndex,    _setVisible]     = useState(() => lsGet(LS.VISIBLE_INDEX,  0))
  const [replayStartIndex,_setRSI]         = useState(() => lsGet(LS.REPLAY_START,   0))
  const [drawings,        _setDrawings]    = useState(() => lsGet(LS.DRAWINGS,       []))
  const [openPositions,   _setOpen]        = useState(() => lsGet(LS.OPEN_POSITIONS, []))
  const [closedTrades,    _setClosed]      = useState(() => lsGet(LS.CLOSED_TRADES,  []))
  const [startingBalance, _setStartBal]    = useState(() => lsGet(LS.STARTING_BAL,  10000))
  const [balance,         _setBalance]     = useState(() => lsGet(LS.BALANCE,        10000))
  const [magnet,          _setMagnet]      = useState(() => lsGet(LS.MAGNET,         'weak'))


  const setInterval        = useCallback(v => { _setInterval(v);    lsSet(LS.INTERVAL,       v) }, [])
  const setStartDate       = useCallback(v => { _setStartDate(v);   lsSet(LS.START_DATE,     v) }, [])
  const setCandles         = useCallback(v => { _setCandles(v);     lsSet(LS.CANDLES,        v) }, [])
  const setVisibleIndex    = useCallback(v => { _setVisible(v);     lsSet(LS.VISIBLE_INDEX,  v) }, [])
  const setReplayStartIndex= useCallback(v => { _setRSI(v);         lsSet(LS.REPLAY_START,   v) }, [])
  const setDrawings        = useCallback(v => { _setDrawings(v);    lsSet(LS.DRAWINGS,       v) }, [])
  const setOpenPositions   = useCallback(v => { _setOpen(v);        lsSet(LS.OPEN_POSITIONS, v) }, [])
  const setClosedTrades    = useCallback(v => { _setClosed(v);      lsSet(LS.CLOSED_TRADES,  v) }, [])
  const setStartingBalance = useCallback(v => { _setStartBal(v);    lsSet(LS.STARTING_BAL,  v) }, [])
  const setBalance         = useCallback(v => { _setBalance(v);     lsSet(LS.BALANCE,        v) }, [])
  const setMagnet          = useCallback(v => { _setMagnet(v);      lsSet(LS.MAGNET,         v) }, [])

  const resetSession = useCallback((newBal) => {
    const b = newBal ?? startingBalance
    _setOpen([]);        lsSet(LS.OPEN_POSITIONS, [])
    _setClosed([]);      lsSet(LS.CLOSED_TRADES,  [])
    _setBalance(b);      lsSet(LS.BALANCE,        b)
    _setStartBal(b);     lsSet(LS.STARTING_BAL,  b)
    _setDrawings([]);    lsSet(LS.DRAWINGS,       [])
    _setVisible(replayStartIndex); lsSet(LS.VISIBLE_INDEX, replayStartIndex)
  }, [startingBalance, replayStartIndex])

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
