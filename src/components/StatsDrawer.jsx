import React from 'react'
import { C } from '../constants.js'
import { computeStats } from '../hooks/useTrades.js'

export default function StatsDrawer({ open, onToggle, closedTrades, startingBalance }) {
  const stats = computeStats(closedTrades, startingBalance)

  return (
    <>
      <button onClick={onToggle} style={s.handle}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>Stats {open ? '▼' : '▲'}</span>
        {stats
          ? <span style={{ fontSize: 12, color: C.muted }}>
              WR {stats.winRate.toFixed(1)}% · PF {isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞'} · {closedTrades.length} trades
            </span>
          : <span style={{ fontSize: 12, color: C.muted }}>No trades yet</span>
        }
      </button>

      <div style={{ ...s.drawer, maxHeight: open ? '50vh' : 0 }}>
        <div style={s.inner}>
          {!stats ? (
            <div style={s.empty}>Close a position to see performance stats.</div>
          ) : (
            <>
              <div style={s.grid}>
                <Card label="Win Rate"      value={`${stats.winRate.toFixed(1)}%`}       color={stats.winRate >= 50 ? C.green : C.red} />
                <Card label="Avg RR"        value={stats.avgRR != null ? stats.avgRR.toFixed(2) : '—'} color={stats.avgRR >= 1 ? C.green : C.red} />
                <Card label="Profit Factor" value={isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞'} color={stats.profitFactor >= 1 ? C.green : C.red} />
                <Card label="Biggest Win"   value={`$${stats.biggestWin.toFixed(2)}`}    color={C.green} />
                <Card label="Biggest Loss"  value={`$${Math.abs(stats.biggestLoss).toFixed(2)}`} color={C.red} />
                <Card label="Max Drawdown"  value={`$${stats.maxDrawdown.toFixed(2)}`}   color={C.red} />
              </div>

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

function Card({ label, value, color }) {
  return (
    <div style={s.card}>
      <div style={s.cardLabel}>{label}</div>
      <div style={{ ...s.cardValue, color }}>{value}</div>
    </div>
  )
}

function EquityCurve({ trades, startingBalance }) {
  let running = startingBalance
  const pts = [running, ...[...trades]
    .sort((a, b) => new Date(a.closedAt) - new Date(b.closedAt))
    .map(t => { running += t.pnl; return running })
  ]
  const min = Math.min(...pts), max = Math.max(...pts)
  const range = max - min || 1
  const W = 300, H = 52
  const coords = pts.map((v, i) =>
    `${(i / (pts.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`
  ).join(' ')
  const isProfit = pts[pts.length - 1] >= startingBalance

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 52 }} preserveAspectRatio="none">
      {/* Fill under curve */}
      <polyline
        points={`0,${H} ${coords} ${W},${H}`}
        fill={isProfit ? 'rgba(38,166,154,0.10)' : 'rgba(239,83,80,0.10)'}
        stroke="none"
      />
      <polyline
        points={coords}
        fill="none"
        stroke={isProfit ? C.green : C.red}
        strokeWidth={1.5}
      />
      {/* Start/end dots */}
      <circle cx={0} cy={H - ((pts[0] - min) / range) * (H - 4) - 2} r={2} fill={C.muted} />
      <circle cx={W} cy={H - ((pts[pts.length-1] - min) / range) * (H-4) - 2} r={3}
              fill={isProfit ? C.green : C.red} />
    </svg>
  )
}

const s = {
  handle: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    background:     C.panel,
    borderTop:      `1px solid ${C.border}`,
    padding:        '8px 14px',
    width:          '100%',
    cursor:         'pointer',
    color:          C.text,
    border:         'none',
    borderTop:      `1px solid ${C.border}`,
    flexShrink:     0,
  },
  drawer: {
    overflow:   'hidden',
    transition: 'max-height 0.28s ease',
    background: C.panel,
    flexShrink: 0,
  },
  inner: {
    overflowY: 'auto',
    padding:   '10px 12px 14px',
    borderTop: `1px solid ${C.border}`,
  },
  empty: {
    fontSize:  12,
    color:     C.muted,
    textAlign: 'center',
    padding:   '14px 0',
  },
  grid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap:                 6,
    marginBottom:        10,
  },
  card: {
    background:   C.bg,
    borderRadius: 6,
    padding:      '8px 6px',
    textAlign:    'center',
  },
  cardLabel: { fontSize: 10, color: C.muted, marginBottom: 4 },
  cardValue:  { fontSize: 15, fontWeight: 700 },
  curveWrap:  { marginTop: 4 },
  curveLabel: {
    fontSize:      10,
    color:         C.muted,
    marginBottom:  4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
}
