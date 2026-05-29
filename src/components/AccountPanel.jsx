import React, { useState } from 'react'

const BALANCES = [100, 1000, 5000, 10000, 100000]
const DEFAULT_SIZE = 0.1  // default lot size

export default function AccountPanel({
  balance,
  startingBalance,
  openPositions,
  closedTrades,
  currentPrice,
  onSetStartingBalance,
  onBuy,
  onSell,
  onClosePosition,
}) {
  const [size, setSize] = useState(DEFAULT_SIZE)

  const unrealisedPnl = openPositions.reduce((sum, p) => {
    if (!currentPrice) return sum
    const pnl = p.direction === 'long'
      ? (currentPrice - p.entryPrice) * p.size * 100
      : (p.entryPrice - currentPrice) * p.size * 100
    return sum + pnl
  }, 0)

  const realisedPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)

  return (
    <div style={styles.wrap}>
      {/* Starting balance picker */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Account</div>
        <div style={styles.balanceRow}>
          {BALANCES.map(b => (
            <button
              key={b}
              onClick={() => onSetStartingBalance(b)}
              style={{
                ...styles.balChip,
                ...(startingBalance === b ? styles.balChipActive : {}),
              }}
            >
              ${b >= 1000 ? `${b / 1000}k` : b}
            </button>
          ))}
        </div>
        <div style={styles.statsRow}>
          <Stat label="Balance" value={`$${balance.toFixed(2)}`} />
          <Stat label="Realised" value={`${realisedPnl >= 0 ? '+' : ''}$${realisedPnl.toFixed(2)}`} color={realisedPnl >= 0 ? '#26a69a' : '#ef5350'} />
          <Stat label="Unrealised" value={`${unrealisedPnl >= 0 ? '+' : ''}$${unrealisedPnl.toFixed(2)}`} color={unrealisedPnl >= 0 ? '#26a69a' : '#ef5350'} />
        </div>
      </div>

      {/* Trade execution */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Execute</div>
        <div style={styles.execRow}>
          <div style={styles.sizeWrap}>
            <span style={styles.sizeLabel}>Size</span>
            <input
              type="number"
              value={size}
              min={0.01}
              step={0.01}
              onChange={e => setSize(parseFloat(e.target.value) || 0.01)}
              style={styles.sizeInput}
            />
          </div>
          <button onClick={() => onBuy(size)} style={{ ...styles.execBtn, ...styles.buyBtn }} disabled={!currentPrice}>
            BUY
          </button>
          <button onClick={() => onSell(size)} style={{ ...styles.execBtn, ...styles.sellBtn }} disabled={!currentPrice}>
            SELL
          </button>
        </div>
        {currentPrice && (
          <div style={styles.priceLabel}>@ {currentPrice.toFixed(2)}</div>
        )}
      </div>

      {/* Open positions */}
      {openPositions.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Open ({openPositions.length})</div>
          {openPositions.map((p, i) => {
            const upnl = currentPrice
              ? (p.direction === 'long'
                  ? (currentPrice - p.entryPrice) * p.size * 100
                  : (p.entryPrice - currentPrice) * p.size * 100)
              : 0
            return (
              <div key={i} style={styles.positionRow}>
                <span style={{ color: p.direction === 'long' ? '#26a69a' : '#ef5350', fontWeight: 700, fontSize: 12 }}>
                  {p.direction.toUpperCase()}
                </span>
                <span style={styles.posDetail}>@ {p.entryPrice.toFixed(2)}</span>
                <span style={{ ...styles.posDetail, color: upnl >= 0 ? '#26a69a' : '#ef5350' }}>
                  {upnl >= 0 ? '+' : ''}${upnl.toFixed(2)}
                </span>
                <button onClick={() => onClosePosition(i)} style={styles.closeBtn}>✕</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Closed trades history */}
      {closedTrades.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>History ({closedTrades.length})</div>
          <div style={styles.historyList}>
            {[...closedTrades].reverse().slice(0, 20).map((t, i) => (
              <div key={i} style={styles.historyRow}>
                <span style={{ color: t.direction === 'long' ? '#26a69a' : '#ef5350', fontSize: 11, fontWeight: 700 }}>
                  {t.direction === 'long' ? 'L' : 'S'}
                </span>
                <span style={styles.histDetail}>{t.entryPrice?.toFixed(2)} → {t.exitPrice?.toFixed(2)}</span>
                <span style={{ ...styles.histDetail, color: t.pnl >= 0 ? '#26a69a' : '#ef5350', fontWeight: 600 }}>
                  {t.pnl >= 0 ? '+' : ''}${t.pnl?.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: '#758696', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: color || '#d1d4dc', fontWeight: 600 }}>{value}</div>
    </div>
  )
}

const styles = {
  wrap: {
    background: '#1e222d',
    borderLeft: '1px solid #2a2e39',
    width: 220,
    minWidth: 220,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  section: {
    borderBottom: '1px solid #2a2e39',
    padding: '10px 10px',
  },
  sectionTitle: {
    fontSize: 11,
    color: '#758696',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  balanceRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  balChip: {
    background: '#2a2e39',
    color: '#758696',
    border: '1px solid #363a45',
    borderRadius: 4,
    padding: '4px 7px',
    fontSize: 11,
    cursor: 'pointer',
    minHeight: 28,
  },
  balChipActive: {
    background: '#363a45',
    color: '#F0B90B',
    borderColor: '#F0B90B',
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 4,
  },
  execRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    marginBottom: 4,
  },
  sizeWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
  },
  sizeLabel: {
    fontSize: 10,
    color: '#758696',
  },
  sizeInput: {
    background: '#2a2e39',
    color: '#d1d4dc',
    border: '1px solid #363a45',
    borderRadius: 4,
    padding: '6px 6px',
    fontSize: 13,
    width: '100%',
    minHeight: 34,
  },
  execBtn: {
    border: 'none',
    borderRadius: 6,
    padding: '8px 10px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    minHeight: 40,
    minWidth: 52,
    flex: '0 0 auto',
  },
  buyBtn: {
    background: '#26a69a',
    color: '#fff',
  },
  sellBtn: {
    background: '#ef5350',
    color: '#fff',
  },
  priceLabel: {
    fontSize: 11,
    color: '#758696',
    textAlign: 'right',
  },
  positionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    background: '#131722',
    borderRadius: 5,
    padding: '6px 8px',
  },
  posDetail: {
    fontSize: 11,
    color: '#d1d4dc',
    flex: 1,
  },
  closeBtn: {
    background: 'transparent',
    color: '#ef5350',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 4px',
    minHeight: 28,
    minWidth: 28,
  },
  historyList: {
    maxHeight: 160,
    overflowY: 'auto',
  },
  historyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 0',
    borderBottom: '1px solid #2a2e39',
  },
  histDetail: {
    fontSize: 11,
    color: '#758696',
    flex: 1,
  },
}
