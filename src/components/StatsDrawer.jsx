import React from 'react'
import { COLORS } from '../constants.js'
import { computeStats } from '../hooks/useTrades.js'

export default function StatsDrawer({ open, onToggle, closedTrades, startingBalance }) {
  const stats = computeStats(closedTrades, startingBalance)

  return (
    <>
      {/* Handle tab */}
      <button onClick={onToggle} style={s.handle}>
        <span>Stats {open ? '▼' : '▲'}</span>
        {stats && (
          <span style={{ fontSize: 12, color: COLORS.muted }}>
            {stats.winRate.toFixed(1)}% WR · {closedTrades.length} trades
          </span>
        )}
      </button>

      {/* Drawer */}
      <div style={{ ...s.drawer, maxHeight: open ? '50vh' : 0 }}>
        <div style={s.inner}>
          {!stats ? (
            <div style={s.empty}>No closed trades yet. Stats appear after your first closed position.</div>
          ) : (
            <>
              <div style={s.grid}>
                <StatCard label="Win Rate"      value={`${stats.winRate.toFixed(1)}%`}
                  color={stats.winRate >= 50 ? COLORS.green : COLORS.red} />
                <StatCard label="Avg RR"        value={stats.avgRR != null ? stats.avgRR.toFixed(2) : '—'}
                  color={stats.avgRR >= 1 ? COLORS.green : COLORS.red} />
                <StatCard label="Biggest Win"   value={`$${stats.biggestWin.toFixed(2)}`}   color={COLORS.green} />
                <StatCard label="Biggest Loss"  value={`$${Math.abs(stats.biggestLoss).toFixed(2)}`} color={COLORS.red} />
                <StatCard label="Max Drawdown"  value={`$${stats.maxDrawdown.toFixed(2)}`}  color={COLORS.red} />
                <StatCard label="Profit Factor" value={isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞'}
                  color={stats.profitFactor >= 1 ? COLORS.green : COLORS.red} />
              </div>

              {/* Equity curve (simple bar chart) */}
              {closedTrades.length > 1 && (
                <div style={s.curveWrap}>
                  <div style={s.curveLabel}>Equity Curve</div>
                  <EquityCurve trades={closedTrades} startingBalance={startingBalance} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={s.card}>
      <div style={s.cardLabel}>{label}</div>
      <div style={{ ...s.cardValue, color }}>{value}</div>
    </div>
  )
}

function EquityCurve({ trades, startingBalance }) {
  // Build equity series
  let running = startingBalance
  const points = [running, ...trades.map(t => { running += t.pnl; return running })]
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const W = 300
  const H = 50

  const pts = points.map((v, i) => {
    const x = (i / (points.length - 1)) * W
    const y = H - ((v - min) / range) * H
    return `${x},${y}`
  }).join(' ')

  const lastVal = points[points.length - 1]
  const isUp = lastVal >= startingBalance

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 50 }}>
      <polyline points={pts} fill="none" stroke={isUp ? COLORS.green : COLORS.red} strokeWidth={1.5} />
    </svg>
  )
}

const s = {
  handle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: COLORS.panel,
    borderTop: `1px solid ${COLORS.border}`,
    padding: '8px 14px',
    width: '100%',
    cursor: 'pointer',
    color: COLORS.text,
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    borderTop: `1px solid ${COLORS.border}`,
    flexShrink: 0,
  },
  drawer: {
    overflow: 'hidden',
    transition: 'max-height 0.28s ease',
    background: COLORS.panel,
    flexShrink: 0,
  },
  inner: {
    overflowY: 'auto',
    padding: '10px 12px 14px',
    borderTop: `1px solid ${COLORS.border}`,
  },
  empty: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    padding: '16px 0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
    marginBottom: 10,
  },
  card: {
    background: COLORS.bg,
    borderRadius: 6,
    padding: '8px 6px',
    textAlign: 'center',
  },
  cardLabel: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 15,
    fontWeight: 700,
  },
  curveWrap: {
    marginTop: 4,
  },
  curveLabel: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
}
