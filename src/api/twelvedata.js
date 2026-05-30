import { INTERVAL_TO_TD } from '../constants.js'

const API_KEY = '1a8f8b605803429a9819e8e541255b68'
const BASE    = 'https://api.twelvedata.com'

async function tdFetch(interval, params) {
  const p = new URLSearchParams({
    symbol:   'XAU/USD',
    interval: INTERVAL_TO_TD[interval],
    apikey:   API_KEY,
    format:   'JSON',
    order:    'ASC',
    ...params,
  })
  const res  = await fetch(`${BASE}/time_series?${p}`)
  if (!res.ok) throw new Error(`Network error ${res.status}`)
  const json = await res.json()
  if (json.status === 'error') throw new Error(`Twelve Data: ${json.message}`)
  if (!Array.isArray(json.values) || !json.values.length)
    throw new Error('No data returned. Try a different date or interval.')
  return json.values.map(v => ({
    time:  Math.floor(new Date(v.datetime).getTime() / 1000),
    open:  parseFloat(v.open),
    high:  parseFloat(v.high),
    low:   parseFloat(v.low),
    close: parseFloat(v.close),
  }))
}

/**
 * Load a full replay session:
 * 1. Fetch 500 candles BEFORE startDate  → history (all visible, scrollable)
 * 2. Fetch 500 candles FROM  startDate   → replay candles (revealed one by one)
 *
 * Returns { candles, replayStartIndex }
 * candles = [...history, ...replayCandlesForward]
 * replayStartIndex = index of the first replay candle
 */
export async function loadSession(interval, startDate) {
  // Fetch history before start date (end_date = startDate)
  let history = []
  try {
    history = await tdFetch(interval, {
      outputsize: '500',
      end_date:   startDate,
    })
    // Remove the last candle if it exactly equals startDate (avoid duplicate)
    if (history.length) {
      const startTs = Math.floor(new Date(startDate).getTime() / 1000)
      if (history[history.length - 1].time >= startTs) history.pop()
    }
  } catch { history = [] }

  // Fetch forward from startDate
  const forward = await tdFetch(interval, {
    outputsize: '500',
    start_date: startDate,
  })

  const candles          = [...history, ...forward]
  const replayStartIndex = history.length  // first candle of the replay portion

  return { candles, replayStartIndex }
}

/**
 * Switch timeframe: fetch new candles centred on the current timestamp.
 * Returns { candles, replayStartIndex, newVisibleIndex }
 */
export async function switchTimeframe(newInterval, currentTimestamp, replayStartTimestamp) {
  // Convert unix → 'YYYY-MM-DD HH:mm:ss'
  const fmt = ts => {
    const d = new Date(ts * 1000)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
  }

  // Fetch history before replay start
  let history = []
  try {
    history = await tdFetch(newInterval, {
      outputsize: '500',
      end_date:   fmt(replayStartTimestamp),
    })
    if (history.length) {
      if (history[history.length - 1].time >= replayStartTimestamp) history.pop()
    }
  } catch { history = [] }

  // Fetch forward from replay start
  const forward = await tdFetch(newInterval, {
    outputsize: '500',
    start_date: fmt(replayStartTimestamp),
  })

  const candles          = [...history, ...forward]
  const replayStartIndex = history.length

  // Find closest candle to currentTimestamp
  let newVisibleIndex = replayStartIndex
  for (let i = replayStartIndex; i < candles.length; i++) {
    if (candles[i].time <= currentTimestamp) newVisibleIndex = i
    else break
  }

  return { candles, replayStartIndex, newVisibleIndex }
}
