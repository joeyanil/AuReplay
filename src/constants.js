export const INTERVALS = ['1M', '5M', '15M', '1H', '4H', '1D']

export const INTERVAL_TO_TD = {
  '1M':  '1min',
  '5M':  '5min',
  '15M': '15min',
  '1H':  '1h',
  '4H':  '4h',
  '1D':  '1day',
}

// How many ms between candle reveals at each speed
export const SPEED_MS = {
  1:  800,
  2:  400,
  5:  150,
  10: 60,
}

export const SPEEDS = [1, 2, 5, 10]

export const STARTING_BALANCES = [100, 1000, 5000, 10000, 100000]

export const FIB_LEVELS = [
  { ratio: 0,     label: '0%',     color: '#9598a1' },
  { ratio: 0.236, label: '23.6%',  color: '#f7525f' },
  { ratio: 0.382, label: '38.2%',  color: '#ff9800' },
  { ratio: 0.5,   label: '50%',    color: '#f0b90b' },
  { ratio: 0.618, label: '61.8%',  color: '#4caf50' },
  { ratio: 0.786, label: '78.6%',  color: '#2196f3' },
  { ratio: 1,     label: '100%',   color: '#9598a1' },
]

export const DRAWING_TOOLS = [
  { id: 'none',       label: '↖',  title: 'Pointer' },
  { id: 'horizontal', label: '—',  title: 'Horizontal Line' },
  { id: 'trendline',  label: '↗',  title: 'Trendline' },
  { id: 'pricerange', label: '↕',  title: 'Price Range' },
  { id: 'rectangle',  label: '▭',  title: 'Rectangle' },
  { id: 'fib',        label: 'Fib', title: 'Fibonacci' },
  { id: 'long',       label: '▲',  title: 'Long Position' },
  { id: 'short',      label: '▼',  title: 'Short Position' },
]

// localStorage keys
export const LS = {
  CANDLES:        'ar_candles',
  INTERVAL:       'ar_interval',
  START_DATE:     'ar_start_date',
  VISIBLE_INDEX:  'ar_visible_index',
  DRAWINGS:       'ar_drawings',
  OPEN_POSITIONS: 'ar_open_positions',
  CLOSED_TRADES:  'ar_closed_trades',
  BALANCE:        'ar_balance',
  STARTING_BAL:   'ar_starting_balance',
}

export const COLORS = {
  bg:        '#131722',
  panel:     '#1e222d',
  border:    '#2a2e39',
  input:     '#2a2e39',
  text:      '#d1d4dc',
  muted:     '#758696',
  gold:      '#F0B90B',
  green:     '#26a69a',
  red:       '#ef5350',
  highlight: '#363a45',
}
