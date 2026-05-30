import { INTERVAL_TO_TD } from '../constants.js'

const API_KEY = '1a8f8b605803429a9819e8e541255b68'
const BASE = 'https://api.twelvedata.com'

/**
 * Fetch OHLC candles for XAU/USD.
 * Fetches 5000 candles (max) starting from startDate going forward.
 * Returns array sorted oldest → newest: [{ time, open, high, low, close }]
 */
export async function fetchCandles(interval, startDate) {
  const tdInterval = INTERVAL_TO_TD[interval]
  if (!tdInterval) throw new Error(`Unknown interval: ${interval}`)

  const params = new URLSearchParams({
    symbol:     'XAU/USD',
    interval:   tdInterval,
    apikey:     API_KEY,
    outputsize: '5000',
    format:     'JSON',
    order:      'ASC',
    start_date: startDate,
  })

  const res = await fetch(`${BASE}/time_series?${params}`)
  if (!res.ok) throw new Error(`Network error: ${res.status}`)

  const json = await res.json()
  if (json.status === 'error') throw new Error(`Twelve Data: ${json.message}`)
  if (!Array.isArray(json.values) || !json.values.length)
    throw new Error('No data returned for this date/interval. Try a different date.')

  return json.values.map(v => ({
    time:  Math.floor(new Date(v.datetime).getTime() / 1000),
    open:  parseFloat(v.open),
    high:  parseFloat(v.high),
    low:   parseFloat(v.low),
    close: parseFloat(v.close),
  }))
}

/**
 * Given a timestamp (unix seconds) and a new interval,
 * fetch candles for the new interval starting from the same date.
 * Returns { candles, newIndex } where newIndex is the closest candle
 * to the original timestamp.
 */
export async function fetchCandlesAtTime(interval, timestamp) {
  // Convert unix timestamp to YYYY-MM-DD HH:mm:ss
  const d = new Date(timestamp * 1000)
  const pad = n => String(n).padStart(2, '0')
  const startDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} 00:00:00`

  const candles = await fetchCandles(interval, startDate)

  // Find the index of the candle closest to (but not exceeding) the timestamp
  let newIndex = 0
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].time <= timestamp) newIndex = i
    else break
  }

  return { candles, newIndex }
}
