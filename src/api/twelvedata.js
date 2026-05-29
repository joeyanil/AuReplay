const API_KEY = '1a8f8b605803429a9819e8e541255b68'
const BASE_URL = 'https://api.twelvedata.com'

// Map our internal interval names to Twelve Data interval strings
const INTERVAL_MAP = {
  '1M': '1min',
  '5M': '5min',
  '15M': '15min',
  '1H': '1h',
  '4H': '4h',
  '1D': '1day',
}

/**
 * Fetch OHLC candles for XAUUSD from Twelve Data.
 * Returns array of { time, open, high, low, close } sorted oldest → newest.
 *
 * @param {string} interval  - one of '1M','5M','15M','1H','4H','1D'
 * @param {string} startDate - 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm:ss'
 * @param {number} outputsize - number of candles to fetch (max 5000 on free tier per call)
 */
export async function fetchCandles(interval, startDate, outputsize = 500) {
  const tdInterval = INTERVAL_MAP[interval]
  if (!tdInterval) throw new Error(`Unknown interval: ${interval}`)

  const params = new URLSearchParams({
    symbol: 'XAU/USD',
    interval: tdInterval,
    apikey: API_KEY,
    outputsize: String(outputsize),
    format: 'JSON',
    order: 'ASC',
  })

  if (startDate) {
    // Twelve Data expects start_date in 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm:ss'
    params.set('start_date', startDate)
  }

  const url = `${BASE_URL}/time_series?${params.toString()}`
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`Twelve Data HTTP error: ${res.status}`)
  }

  const json = await res.json()

  if (json.status === 'error') {
    throw new Error(`Twelve Data API error: ${json.message}`)
  }

  if (!json.values || !Array.isArray(json.values)) {
    throw new Error('Twelve Data returned no values')
  }

  // Transform into Lightweight Charts format
  // time must be a Unix timestamp (seconds) for time series
  return json.values.map((v) => ({
    time: Math.floor(new Date(v.datetime).getTime() / 1000),
    open: parseFloat(v.open),
    high: parseFloat(v.high),
    low: parseFloat(v.low),
    close: parseFloat(v.close),
  }))
}

/**
 * Returns the earliest available date for a given interval.
 * Used to populate the date-picker min value.
 */
export function getEarliestDate(interval) {
  // Approximate practical limits on free tier data depth
  const limits = {
    '1M':  '2020-01-01',
    '5M':  '2018-01-01',
    '15M': '2016-01-01',
    '1H':  '2010-01-01',
    '4H':  '2005-01-01',
    '1D':  '2000-01-01',
  }
  return limits[interval] || '2010-01-01'
}
