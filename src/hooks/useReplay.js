import { useState, useRef, useCallback, useEffect } from 'react'
import { SPEED_MS } from '../constants.js'
import { loadSession, switchTimeframe } from '../api/twelvedata.js'

export function useReplay(session) {
  const {
    candles, setCandles,
    visibleIndex, setVisibleIndex,
    replayStartIndex, setReplayStartIndex,
    interval, setInterval,
    startDate, setStartDate,
  } = session

  const [isPlaying,    setIsPlaying]   = useState(false)
  const [speed,        setSpeed]       = useState(1)
  const [loading,      setLoading]     = useState(false)
  const [error,        setError]       = useState(null)
  // Partial candle: { open, high, low, close, progress 0-1 }
  const [partialCandle, setPartialCandle] = useState(null)

  // Refs for stable timer access
  const viRef      = useRef(visibleIndex)
  const lenRef     = useRef(candles.length)
  const candlesRef = useRef(candles)
  const timerRef   = useRef(null)
  const partialRef = useRef(0) // partial tick counter within a candle (0-9)
  const intervalRef= useRef(interval)

  useEffect(() => { viRef.current = visibleIndex },    [visibleIndex])
  useEffect(() => { lenRef.current = candles.length;
                    candlesRef.current = candles },    [candles])
  useEffect(() => { intervalRef.current = interval }, [interval])

  // ── Build a partial candle between prev close and next close ────────────────
  const buildPartial = useCallback((nextCandle, progress) => {
    if (!nextCandle) return null
    // Simulate price moving from open toward close linearly,
    // with random wick noise like a real chart
    const { open, high, low, close } = nextCandle
    const currentClose = open + (close - open) * progress
    const currentHigh  = open + (high - open)  * Math.min(1, progress * 1.5)
    const currentLow   = open + (low - open)   * Math.min(1, progress * 1.5)
    return {
      time:  nextCandle.time,
      open,
      high:  Math.max(open, close, currentHigh, currentClose),
      low:   Math.min(open, close, currentLow,  currentClose),
      close: currentClose,
    }
  }, [])

  // ── Timer ──────────────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    const PARTIAL_TICKS = 8 // sub-steps per candle for partial animation
    partialRef.current = 0

    timerRef.current = setInterval(() => {
      const vi  = viRef.current
      const len = lenRef.current

      // Advance partial candle within the NEXT candle
      const next = candlesRef.current[vi + 1]
      if (next) {
        partialRef.current = (partialRef.current + 1) % PARTIAL_TICKS
        if (partialRef.current > 0) {
          setPartialCandle(buildPartial(next, partialRef.current / PARTIAL_TICKS))
          return // don't advance main index yet
        }
      }

      // Advance to next full candle
      if (vi >= len - 1) {
        stopTimer(); setIsPlaying(false); setPartialCandle(null); return
      }
      const newVi = vi + 1
      viRef.current = newVi
      setVisibleIndex(newVi)
      setPartialCandle(null)
      partialRef.current = 0
    }, SPEED_MS[speed] / 8)
  }, [speed, stopTimer, setVisibleIndex, buildPartial])

  useEffect(() => {
    if (isPlaying) startTimer()
    return stopTimer
  }, [speed]) // eslint-disable-line

  // ── Controls ───────────────────────────────────────────────────────────────
  const play = useCallback(() => {
    if (!candles.length || viRef.current >= lenRef.current - 1) return
    setIsPlaying(true)
    startTimer()
  }, [candles.length, startTimer])

  const pause = useCallback(() => {
    stopTimer(); setIsPlaying(false); setPartialCandle(null)
  }, [stopTimer])

  const stepForward = useCallback(() => {
    pause()
    setVisibleIndex(prev => {
      const n = Math.min(prev + 1, lenRef.current - 1)
      viRef.current = n; return n
    })
  }, [pause, setVisibleIndex])

  const stepBack = useCallback(() => {
    pause()
    setVisibleIndex(prev => {
      const n = Math.max(prev - 1, replayStartIndex)
      viRef.current = n; return n
    })
  }, [pause, setVisibleIndex, replayStartIndex])

  const jumpToStart = useCallback(() => {
    pause()
    const n = replayStartIndex
    viRef.current = n
    setVisibleIndex(n)
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
      setCandles(data)
      lenRef.current    = data.length
      candlesRef.current= data
      setReplayStartIndex(rsi)
      viRef.current     = rsi
      setVisibleIndex(rsi)
      if (newInterval) { setInterval(newInterval); intervalRef.current = newInterval }
      if (newDate)       setStartDate(newDate)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [pause, interval, startDate, setCandles, setVisibleIndex, setReplayStartIndex, setInterval, setStartDate])

  // ── TF switch — keeps same timestamp ──────────────────────────────────────
  const switchInterval = useCallback(async (newInterval) => {
    if (newInterval === intervalRef.current) return
    if (!candles.length) { setInterval(newInterval); return }
    pause()
    setLoading(true); setError(null)
    try {
      const currentTs      = candlesRef.current[viRef.current]?.time
      const replayStartTs  = candlesRef.current[replayStartIndex]?.time
      const { candles: data, replayStartIndex: rsi, newVisibleIndex } =
        await switchTimeframe(newInterval, currentTs, replayStartTs)
      setCandles(data)
      lenRef.current    = data.length
      candlesRef.current= data
      setReplayStartIndex(rsi)
      viRef.current     = newVisibleIndex
      setVisibleIndex(newVisibleIndex)
      setInterval(newInterval)
      intervalRef.current = newInterval
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [candles.length, replayStartIndex, pause, setCandles, setVisibleIndex, setReplayStartIndex, setInterval])

  useEffect(() => () => stopTimer(), [stopTimer])

  return {
    isPlaying, speed, setSpeed,
    loading, error, setError,
    partialCandle,
    play, pause, stepForward, stepBack,
    jumpToStart, jumpToEnd,
    load, switchInterval,
  }
}
