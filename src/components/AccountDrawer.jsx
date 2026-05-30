import React, { useState } from 'react'
import { STARTING_BALANCES, COLORS } from '../constants.js'

export default function AccountDrawer({
  open, onToggle,
  balance, startingBalance, onSetStartingBalance,
  openPositions, closedTrades,
  currentPrice, currentCandle,
  onBuy, onSell, onClosePosition,
  onResetSession,
}) {
  const [size, setSize] = useState('0.10')
  const [tp,   setTp]   = useState('')
  const [sl,   setSl]   = useState('')

  const unrealisedPnl = openPositions.reduce((sum, pos) => {
    if (!currentPrice) return sum
    const diff = pos.direction === 'long'
      ? currentPrice - pos.entryPrice
      : pos.entryPrice - currentPrice
    return sum + diff * pos.size * 100
  }, 0)

  const realisedPnl = closedTrades.reduce((s, t) => s + (t.pnl || 0), 0)

  const handleBuy = () => {
    onBuy(parseFloat(size) || 0.1, tp ? parseFloat(tp) : null, sl ? parseFloat(sl) : null)
  }
  const handleSell = () => {
    onSell(parseFloat(size) || 0.1, tp ? parseFloat(tp) : null, sl ? parseFloat(sl) : null)
  }

  return (
    <>
      {/* Handle tab */}
      <button onClick={onToggle} style={s.handle}>
        <span style={s.handleLabel}>
          Account {open ? '▼' : '▲'}
        </span>
        <span style={{ ...s.pnlBadge, color: unrealisedPnl >= 0 ? COLORS.green : COLORS.red }}>
          {unrealisedPnl >= 0 ? '+' : ''}{unrealisedPnl.toFixed(0)}
        </span>
      </button>

      {/* Drawer */}
      <div style={{ ...s.drawer, maxHeight: open ? '70vh' : 0 }}>
        <div style={s.inner}>

          {/* Balance summary */}
          <div style={s.summaryRow}>
            <Stat label="Balance"    value={`$${balance.toFixed(2)}`} />
            <Stat label="Realised"   value={`${realisedPnl >= 0 ? '+' : ''}$${realisedPnl.toFixed(2)}`}   color={realisedPnl >= 0 ? COLORS.green : COLORS.red} />
            <Stat label="Unrealised" value={`${unrealisedPnl >= 0 ? '+' : ''}$${unrealisedPnl.toFixed(2)}`} color={unrealisedPnl >= 0 ? COLORS.green : COLORS.red} />
          </div>

          {/* Starting balance picker */}
          <div style={s.section}>
            <div style={s.sectionLabel}>Starting Balance</div>
            <div style={s.chipRow}>
              {STARTING_BALANCES.map(b => (
                <button
                  key={b}
                  onClick={() => onSetStartingBalance(b)}
                  style={{ ...s.chip, ...(startingBalance === b ? s.chipActive : {}) }}
                >
                  ${b >= 1000 ? `${b / 1000}k` : b}
                </button>
              ))}
            </div>
          </div>

          {/* Execute trade */}
          <div style={s.section}>
            <div style={s.sectionLabel}>
              Execute {currentPrice ? <span style={{ color: COLORS.muted }}>@ {currentPrice.toFixed(2)}</span> : null}
            </div>
            <div style={s.execGrid}>
              <label style={s.inputLabel}>
                Size (lots)
                <input
                  type="number" value={size} min="0.01" step="0.01"
                  onChange={e => setSize(e.target.value)}
                  style={s.input}
                />
              </label>
              <label style={s.inputLabel}>
                TP Price
                <input
                  type="number" value={tp} placeholder="optional"
                  onChange={e => setTp(e.target.value)}
                  style={s.input}
                />
              </label>
              <label style={s.inputLabel}>
                SL Price
                <input
                  type="number" value={sl} placeholder="optional"
                  onChange={e => setSl(e.target.value)}
                  style={s.input}
                />
              </label>
            </div>
            <div style={s.execBtns}>
              <button onClick={handleBuy}  disabled={!currentPrice} style={{ ...s.execBtn, background: COLORS.green }}>
                BUY LONG
              </button>
              <button onClick={handleSell} disabled={!currentPrice} style={{ ...s.execBtn, background: COLORS.red }}>
                SELL SHORT
              </button>
            </div>
          </div>

          {/* Open positions */}
          {openPositions.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionLabel}>Open Positions ({openPositions.length})</div>
              {openPositions.map(pos => {
                const upnl = currentPrice
                  ? (pos.direction === 'long'
                      ? (currentPrice - pos.entryPrice) * pos.size * 100
                      : (pos.entryPrice - currentPrice) * pos.size * 100)
                  : 0
                return (
                  <div key={pos.id} style={s.posRow}>
                    <span style={{ color: pos.direction === 'long' ? COLORS.green : COLORS.red, fontWeight: 700, fontSize: 12, minWidth: 36 }}>
                      {pos.direction === 'long' ? 'LONG' : 'SHORT'}
                    </span>
                    <span style={s.posDetail}>@ {pos.entryPrice.toFixed(2)}</span>
                    {pos.tp && <span style={{ fontSize: 11, color: COLORS.green }}>TP {pos.tp.toFixed(2)}</span>}
                    {pos.sl && <span style={{ fontSize: 11, color: COLORS.red }}>SL {pos.sl.toFixed(2)}</span>}
                    <span style={{ ...s.posDetail, color: upnl >= 0 ? COLORS.green : COLORS.red, fontWeight: 600 }}>
                      {upnl >= 0 ? '+' : ''}${upnl.toFixed(2)}
                    </span>
                    <button onClick={() => onClosePosition(pos.id)} style={s.closeBtn}>✕</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Closed trades history */}
          {closedTrades.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionLabel}>Trade History ({closedTrades.length})</div>
              <div style={s.historyList}>
                {[...closedTrades].reverse().slice(0, 30).map((t, i) => (
                  <div key={i} style={s.histRow}>
                    <span style={{ color: t.direction === 'long' ? COLORS.green : COLORS.red, fontWeight: 700, fontSize: 11, minWidth: 14 }}>
                      {t.direction === 'long' ? 'L' : 'S'}
                    </span>
                    <span style={s.histDetail}>{t.entryPrice?.toFixed(2)} → {t.exitPrice?.toFixed(2)}</span>
                    {t.rr && <span style={{ fontSize: 10, color: COLORS.muted }}>RR {t.rr.toFixed(2)}</span>}
                    <span style={{ ...s.histDetail, color: t.pnl >= 0 ? COLORS.green : COLORS.red, fontWeight: 600, textAlign: 'right' }}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl?.toFixed(2)}
                    </span>
                    <span style={{ fontSize: 10, color: COLORS.muted, minWidth: 36 }}>
                      {t.closeType === 'tp' ? '✓TP' : t.closeType === 'sl' ? '✗SL' : 'MAN'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          <div style={{ padding: '8px 12px 12px' }}>
            <button onClick={onResetSession} style={s.resetBtn}>
              Reset Session (wipe trades + balance)
            </button>
          </div>

        </div>
      </div>
    </>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: color || COLORS.text, fontWeight: 700 }}>{value}</div>
    </div>
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
  handleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  pnlBadge: {
    fontSize: 12,
    fontWeight: 700,
  },
  drawer: {
    overflow: 'hidden',
    transition: 'max-height 0.28s ease',
    background: COLORS.panel,
    flexShrink: 0,
  },
  inner: {
    overflowY: 'auto',
    maxHeight: '68vh',
    borderTop: `1px solid ${COLORS.border}`,
  },
  summaryRow: {
    display: 'flex',
    gap: 4,
    padding: '10px 12px',
    borderBottom: `1px solid ${COLORS.border}`,
  },
  section: {
    padding: '8px 12px',
    borderBottom: `1px solid ${COLORS.border}`,
  },
  sectionLabel: {
    fontSize: 11,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  chip: {
    background: COLORS.input,
    color: COLORS.muted,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: '5px 9px',
    fontSize: 12,
    cursor: 'pointer',
    minHeight: 32,
  },
  chipActive: {
    background: COLORS.highlight,
    color: COLORS.gold,
    borderColor: COLORS.gold,
  },
  execGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 6,
    marginBottom: 8,
  },
  inputLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 11,
    color: COLORS.muted,
  },
  input: {
    background: COLORS.input,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: '7px 6px',
    fontSize: 13,
    width: '100%',
    minHeight: 36,
  },
  execBtns: {
    display: 'flex',
    gap: 8,
  },
  execBtn: {
    flex: 1,
    border: 'none',
    borderRadius: 6,
    padding: '10px',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    minHeight: 44,
  },
  posRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: COLORS.bg,
    borderRadius: 5,
    padding: '7px 8px',
    marginBottom: 4,
  },
  posDetail: {
    fontSize: 11,
    color: COLORS.text,
    flex: 1,
  },
  closeBtn: {
    background: 'transparent',
    color: COLORS.red,
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    minHeight: 32,
    minWidth: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyList: {
    maxHeight: 180,
    overflowY: 'auto',
  },
  histRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 0',
    borderBottom: `1px solid ${COLORS.border}`,
  },
  histDetail: {
    fontSize: 11,
    color: COLORS.muted,
    flex: 1,
  },
  resetBtn: {
    width: '100%',
    background: 'transparent',
    color: COLORS.red,
    border: `1px solid ${COLORS.red}`,
    borderRadius: 5,
    padding: '9px',
    fontSize: 13,
    cursor: 'pointer',
    minHeight: 40,
  },
}
