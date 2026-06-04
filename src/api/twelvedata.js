import { INTERVAL_TO_TD } from '../constants.js'

const API_KEY = '1a8f8b605803429a9819e8e541255b68'
const BASE    = 'https://api.twelvedata.com'

function toDateStr(ts) {
  const d   = new Date(ts * 1000)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

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
    throw new Error('No data for this date/interval. Try a different date.')
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
 *   history  = 500 candles BEFORE startDate  (all visible, scrollable)
 *   forward  = 500 candles FROM  startDate   (revealed one by one)
 * Returns { candles, replayStartIndex }
 */
export async function loadSession(interval, startDate) {
  let history = []
  try {
    const raw = await tdFetch(interval, { outputsize: '500', end_date: startDate })
    // Remove any candle at or after startDate to avoid overlap
    const startTs = Math.floor(new Date(startDate).getTime() / 1000)
    history = raw.filter(c => c.time < startTs)
  } catch { history = [] }

  const forward = await tdFetch(interval, { outputsize: '500', start_date: startDate })

  const candles          = [...history, ...forward]
  const replayStartIndex = history.length

  return { candles, replayStartIndex }
}

/**
 * Switch timeframe — keep same timestamp position.
 */
export async function switchTimeframe(newInterval, currentTimestamp, replayStartTimestamp) {
  const startDateStr = toDateStr(replayStartTimestamp)

  let history = []
  try {
    const raw = await tdFetch(newInterval, { outputsize: '500', end_date: startDateStr })
    history = raw.filter(c => c.time < replayStartTimestamp)
  } catch { history = [] }

  const forward = await tdFetch(newInterval, { outputsize: '500', start_date: startDateStr })

  const candles          = [...history, ...forward]
  const replayStartIndex = history.length

  // Find closest visible index to currentTimestamp
  let newVisibleIndex = replayStartIndex
  for (let i = replayStartIndex; i < candles.length; i++) {
    if (candles[i].time <= currentTimestamp) newVisibleIndex = i
    else break
  }

  return { candles, replayStartIndex, newVisibleIndex }
}

/**
 * Fetch more candles forward from the last known timestamp.
 * Used when replay approaches the end of loaded data.
 */
export async function fetchMoreForward(interval, lastTimestamp) {
  const startDateStr = toDateStr(lastTimestamp + 1)
  try {
    const more = await tdFetch(interval, { outputsize: '500', start_date: startDateStr })
    // Remove the first candle if it duplicates lastTimestamp
    return more.filter(c => c.time > lastTimestamp)
  } catch { return [] }
}
