import React from 'react'

export function computeStats(trades, startingBalance) {
  if (!trades.length) return null

  const wins = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl < 0)

  const winRate = (wins.length / trades.length) * 100

  const rrValues = trades.filter(t => t.rr != null).map(t => t.rr)
  const avgRR = rrValues.length
    ? rrValues.reduce((s, v) => s + v, 0) / rrValues.length
    : null

  const biggestWin = wins.length ? Math.max(...wins.map(t => t.pnl)) : 0
  const biggestLoss = losses.length ? Math.min(...losses.map(t => t.pnl)) : 0

  // Max drawdown: running peak → trough on cumulative P&L
  let peak = startingBalance
  let maxDD = 0
  let running = startingBalance
  for (const t of trades) {
    running += t.pnl
    if (running > peak) peak = running
    const dd = peak - running
    if (dd > maxDD) maxDD = dd
  }

  const grossWins = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0

  return { winRate, avgRR, biggestWin, biggestLoss, maxDrawdown: maxDD, profitFactor }
}

export default function StatsPanel({ trades, startingBalance }) {
  const stats = computeStats(trades, startingBalance)

  if (!stats) {
    return (
      <div style={styles.empty}>
        No closed trades yet. Stats will appear here after you close a position.
      </div>
    )
  }

  const { winRate, avgRR, biggestWin, biggestLoss, maxDrawdown, profitFactor } = stats

  return (
    <div style={styles.wrap}>
      <div style={styles.title}>Performance Stats</div>
      <div style={styles.grid}>
        <StatCard label="Win Rate" value={`${winRate.toFixed(1)}%`} color={winRate >= 50 ? '#26a69a' : '#ef5350'} />
        <StatCard label="Avg RR" value={avgRR != null ? avgRR.toFixed(2) : '—'} color={avgRR >= 1 ? '#26a69a' : '#ef5350'} />
        <StatCard label="Biggest Win" value={`$${biggestWin.toFixed(2)}`} color="#26a69a" />
        <StatCard label="Biggest Loss" value={`$${Math.abs(biggestLoss).toFixed(2)}`} color="#ef5350" />
        <StatCard label="Max Drawdown" value={`$${maxDrawdown.toFixed(2)}`} color="#ef5350" />
        <StatCard
          label="Profit Factor"
          value={isFinite(profitFactor) ? profitFactor.toFixed(2) : '∞'}
          color={profitFactor >= 1 ? '#26a69a' : '#ef5350'}
        />
      </div>
      <div style={styles.footer}>
        {trades.length} closed trade{trades.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={{ ...styles.cardValue, color }}>{value}</div>
    </div>
  )
}

const styles = {
  wrap: {
    background: '#1e222d',
    borderTop: '1px solid #2a2e39',
    padding: '10px 12px',
  },
  title: {
    fontSize: 11,
    color: '#758696',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
  },
  card: {
    background: '#131722',
    borderRadius: 6,
    padding: '7px 8px',
    textAlign: 'center',
  },
  cardLabel: {
    fontSize: 10,
    color: '#758696',
    marginBottom: 3,
  },
  cardValue: {
    fontSize: 15,
    fontWeight: 700,
  },
  footer: {
    fontSize: 11,
    color: '#758696',
    textAlign: 'right',
    marginTop: 6,
  },
  empty: {
    background: '#1e222d',
    borderTop: '1px solid #2a2e39',
    padding: '12px',
    fontSize: 12,
    color: '#758696',
    textAlign: 'center',
  },
}
