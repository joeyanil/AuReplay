import { useState, useRef, useCallback, useEffect } from 'react'
import { SPEED_MS } from '../constants.js'
import { fetchCandles, fetchCandlesAtTime } from '../api/twelvedata.js'

export function useReplay(session) {
  const {
    candles, setCandles,
    visibleIndex, setVisibleIndex,
    interval, setInterval,
    startDate, setStartDate,
  } = session

  const [isPlaying, setIsPlaying]   = useState(false)
  const [speed, setSpeed]           = useState(1)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  // Use refs so the timer closure always has fresh values
  const visibleIndexRef = useRef(visibleIndex)
  const candlesLengthRef = useRef(candles.length)
  const timerRef = useRef(null)

  useEffect(() => { visibleIndexRef.current = visibleIndex }, [visibleIndex])
  useEffect(() => { candlesLengthRef.current = candles.length }, [candles.length])

  // ── Timer ──────────────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    timerRef.current = setInterval(() => {
      const next = visibleIndexRef.current + 1
      if (next >= candlesLengthRef.current) {
        stopTimer()
        setIsPlaying(false)
        return
      }
      visibleIndexRef.current = next
      setVisibleIndex(next)
    }, SPEED_MS[speed])
  }, [speed, stopTimer, setVisibleIndex])

  // Restart timer when speed changes while playing
  useEffect(() => {
    if (isPlaying) startTimer()
    return stopTimer
  }, [speed]) // eslint-disable-line

  // ── Controls ───────────────────────────────────────────────────────────────
  const play = useCallback(() => {
    if (!candles.length || visibleIndexRef.current >= candlesLengthRef.current - 1) return
    setIsPlaying(true)
    startTimer()
  }, [candles.length, startTimer])

  const pause = useCallback(() => {
    stopTimer()
    setIsPlaying(false)
  }, [stopTimer])

  const stepForward = useCallback(() => {
    pause()
    setVisibleIndex(prev => {
      const next = Math.min(prev + 1, candlesLengthRef.current - 1)
      visibleIndexRef.current = next
      return next
    })
  }, [pause, setVisibleIndex])

  const stepBack = useCallback(() => {
    pause()
    setVisibleIndex(prev => {
      const next = Math.max(prev - 1, 0)
      visibleIndexRef.current = next
      return next
    })
  }, [pause, setVisibleIndex])

  // ── Load (fresh date) ──────────────────────────────────────────────────────
  const load = useCallback(async (newInterval, newDate) => {
    pause()
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCandles(newInterval || interval, newDate || startDate)
      setCandles(data)
      setVisibleIndex(0)
      visibleIndexRef.current = 0
      candlesLengthRef.current = data.length
      if (newInterval) setInterval(newInterval)
      if (newDate) setStartDate(newDate)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [pause, interval, startDate, setCandles, setVisibleIndex, setInterval, setStartDate])

  // ── Timeframe switch (keep same timestamp) ─────────────────────────────────
  const switchInterval = useCallback(async (newInterval) => {
    if (!candles.length) {
      setInterval(newInterval)
      return
    }
    pause()
    setLoading(true)
    setError(null)
    try {
      const currentTimestamp = candles[visibleIndexRef.current]?.time
      const { candles: newCandles, newIndex } = await fetchCandlesAtTime(newInterval, currentTimestamp)
      setCandles(newCandles)
      setVisibleIndex(newIndex)
      visibleIndexRef.current = newIndex
      candlesLengthRef.current = newCandles.length
      setInterval(newInterval)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [candles, pause, setCandles, setVisibleIndex, setInterval])

  // Cleanup on unmount
  useEffect(() => () => stopTimer(), [stopTimer])

  return {
    isPlaying, speed, setSpeed,
    loading, error, setError,
    play, pause, stepForward, stepBack,
    load, switchInterval,
  }
}
