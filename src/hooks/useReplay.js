import { useState, useRef, useCallback, useEffect } from 'react'
import { SPEED_MS } from '../constants.js'
import { loadSession, switchTimeframe, fetchMoreForward } from '../api/twelvedata.js'

export function useReplay(session) {
  const {
    candles, setCandles,
    visibleIndex, setVisibleIndex,
    replayStartIndex, setReplayStartIndex,
    interval, setInterval,
    startDate, setStartDate,
  } = session

  const [isPlaying, setIsPlaying] = useState(false)
  const [speed,     setSpeed]     = useState(1)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [fetching,  setFetching]  = useState(false) // background fetch more

  // Refs for stable timer closure
  const viRef       = useRef(visibleIndex)
  const lenRef      = useRef(candles.length)
  const candlesRef  = useRef(candles)
  const intervalRef = useRef(interval)
  const timerRef    = useRef(null)
  const fetchingRef = useRef(false)

  useEffect(() => { viRef.current = visibleIndex },          [visibleIndex])
  useEffect(() => { lenRef.current = candles.length;
                    candlesRef.current = candles },          [candles])
  useEffect(() => { intervalRef.current = interval },       [interval])

  // ── Auto-fetch more candles when near the end ─────────────────────────────
  const maybeFetchMore = useCallback(async (vi, cands) => {
    if (fetchingRef.current) return
    if (vi < cands.length - 60) return  // still have plenty left
    const last = cands[cands.length - 1]
    if (!last) return
    fetchingRef.current = true
    setFetching(true)
    try {
      const more = await fetchMoreForward(intervalRef.current, last.time)
      if (more.length > 0) {
        const updated = [...cands, ...more]
        candlesRef.current = updated
        lenRef.current     = updated.length
        setCandles(updated)
      }
    } catch (e) { console.warn('fetchMore failed:', e.message) }
    finally { fetchingRef.current = false; setFetching(false) }
  }, [setCandles])

  // ── Timer — clean full-candle advance ─────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    timerRef.current = setInterval(() => {
      const vi  = viRef.current
      const len = lenRef.current
      if (vi >= len - 1) {
        stopTimer(); setIsPlaying(false); return
      }
      const next = vi + 1
      viRef.current = next
      setVisibleIndex(next)
      // Trigger background fetch if getting close to end
      maybeFetchMore(next, candlesRef.current)
    }, SPEED_MS[speed])
  }, [speed, stopTimer, setVisibleIndex, maybeFetchMore])

  // Restart timer on speed change while playing
  useEffect(() => {
    if (isPlaying) startTimer()
    return stopTimer
  }, [speed]) // eslint-disable-line

  // ── Public controls ────────────────────────────────────────────────────────
  const play = useCallback(() => {
    if (!candlesRef.current.length) return
    if (viRef.current >= lenRef.current - 1) return
    setIsPlaying(true)
    startTimer()
  }, [startTimer])

  const pause = useCallback(() => {
    stopTimer(); setIsPlaying(false)
  }, [stopTimer])

  const stepForward = useCallback(() => {
    pause()
    setVisibleIndex(prev => {
      const next = Math.min(prev + 1, lenRef.current - 1)
      viRef.current = next
      maybeFetchMore(next, candlesRef.current)
      return next
    })
  }, [pause, setVisibleIndex, maybeFetchMore])

  const stepBack = useCallback(() => {
    pause()
    setVisibleIndex(prev => {
      const next = Math.max(prev - 1, replayStartIndex)
      viRef.current = next
      return next
    })
  }, [pause, setVisibleIndex, replayStartIndex])

  const jumpToStart = useCallback(() => {
    pause()
    viRef.current = replayStartIndex
    setVisibleIndex(replayStartIndex)
  }, [pause, setVisibleIndex, replayStartIndex])

  const jumpToEnd = useCallback(() => {
    pause()
    const n = lenRef.current - 1
    viRef.current = n
    setVisibleIndex(n)
  }, [pause, setVisibleIndex])

  // ── Load fresh session ─────────────────────────────────────────────────────
  const load = useCallback(async (newInterval, newDate) => {
    pause()
    setLoading(true); setError(null)
    try {
      const iv   = newInterval || interval
      const date = newDate     || startDate
      const { candles: data, replayStartIndex: rsi } = await loadSession(iv, date)
      candlesRef.current  = data
      lenRef.current      = data.length
      setCandles(data)
      setReplayStartIndex(rsi)
      viRef.current = rsi
      setVisibleIndex(rsi)
      if (newInterval) { setInterval(newInterval); intervalRef.current = newInterval }
      if (newDate)       setStartDate(newDate)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [pause, interval, startDate,
      setCandles, setVisibleIndex, setReplayStartIndex,
      setInterval, setStartDate])

  // ── TF switch — keep same timestamp ───────────────────────────────────────
  const switchInterval = useCallback(async (newInterval) => {
    if (newInterval === intervalRef.current) return
    if (!candlesRef.current.length) { setInterval(newInterval); intervalRef.current = newInterval; return }
    pause()
    setLoading(true); setError(null)
    try {
      const currentTs     = candlesRef.current[viRef.current]?.time
      const replayStartTs = candlesRef.current[replayStartIndex]?.time
      const { candles: data, replayStartIndex: rsi, newVisibleIndex } =
        await switchTimeframe(newInterval, currentTs, replayStartTs)
      candlesRef.current = data
      lenRef.current     = data.length
      setCandles(data)
      setReplayStartIndex(rsi)
      viRef.current = newVisibleIndex
      setVisibleIndex(newVisibleIndex)
      setInterval(newInterval)
      intervalRef.current = newInterval
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [replayStartIndex, pause,
      setCandles, setVisibleIndex, setReplayStartIndex, setInterval])

  useEffect(() => () => stopTimer(), [stopTimer])

  return {
    isPlaying, speed, setSpeed,
    loading, error, setError, fetching,
    play, pause, stepForward, stepBack,
    jumpToStart, jumpToEnd,
    load, switchInterval,
  }
}
