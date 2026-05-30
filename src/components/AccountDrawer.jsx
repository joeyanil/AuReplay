import React, { useState } from 'react'
import { STARTING_BALANCES, C } from '../constants.js'

export default function AccountDrawer({
  open, onToggle,
  balance, startingBalance, onSetStartingBalance,
  openPositions, closedTrades,
  currentPrice, getUnrealisedPnl, currentCandle,
  onBuy, onSell, onClosePosition,
  onResetSession,
}) {
  const [size, setSize] = useState('0.10')
  const [tp,   setTp]   = useState('')
  const [sl,   setSl]   = useState('')

  const candle       = currentCandle
  const unrealised   = getUnrealisedPnl(openPositions, candle)
  const realisedPnl  = closedTrades.reduce((s, t) => s + (t.pnl || 0), 0)

  const submit = (dir) => {
    const s   = parseFloat(size) || 0.1
    const tpV = tp ? parseFloat(tp) : null
    const slV = sl ? parseFloat(sl) : null
    if (dir === 'long')  onBuy(s, tpV, slV)
    else                 onSell(s, tpV, slV)
  }

  return (
    <>
      {/* Handle */}
      <button onClick={onToggle} style={s.handle}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>
          Account {open ? '▼' : '▲'}
        </span>
        <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {currentPrice != null && (
            <span style={{ fontSize: 12, color: C.gold, fontFamily: 'monospace', fontWeight: 700 }}>
              {currentPrice.toFixed(2)}
            </span>
          )}
          <span style={{ fontSize: 12, color: unrealised >= 0 ? C.green : C.red, fontWeight: 700 }}>
            {unrealised >= 0 ? '+' : ''}${unrealised.toFixed(2)}
          </span>
          <span style={{ fontSize: 12, color: C.text }}>
            ${balance.toFixed(2)}
          </span>
        </span>
      </button>

      {/* Drawer */}
      <div style={{ ...s.drawer, maxHeight: open ? '72vh' : 0 }}>
        <div style={s.inner}>

          {/* Summary row */}
          <div style={s.summaryRow}>
            <Stat label="Balance"    value={`$${balance.toFixed(2)}`} />
            <Stat label="Realised"   value={`${realisedPnl >= 0 ? '+' : ''}$${realisedPnl.toFixed(2)}`}
                  color={realisedPnl >= 0 ? C.green : C.red} />
            <Stat label="Unrealised" value={`${unrealised >= 0 ? '+' : ''}$${unrealised.toFixed(2)}`}
                  color={unrealised >= 0 ? C.green : C.red} />
          </div>

          {/* Starting balance picker */}
          <div style={s.section}>
            <div style={s.sLabel}>Starting Balance</div>
            <div style={s.chipRow}>
              {STARTING_BALANCES.map(b => (
                <button key={b}
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
            <div style={s.sLabel}>
              Execute
              {currentPrice != null && (
                <span style={{ color: C.muted, marginLeft: 6, fontWeight: 400 }}>
                  @ {currentPrice.toFixed(2)}
                </span>
              )}
            </div>
            <div style={s.execGrid}>
              <label style={s.fieldLabel}>
                Lots
                <input type="number" value={size} min="0.01" step="0.01"
                  onChange={e => setSize(e.target.value)} style={s.input} />
              </label>
              <label style={s.fieldLabel}>
                TP
                <input type="number" value={tp} placeholder="optional"
                  onChange={e => setTp(e.target.value)} style={s.input} />
              </label>
              <label style={s.fieldLabel}>
                SL
                <input type="number" value={sl} placeholder="optional"
                  onChange={e => setSl(e.target.value)} style={s.input} />
              </label>
            </div>
            <div style={s.execBtns}>
              <button onClick={() => submit('long')}  disabled={!currentPrice}
                style={{ ...s.execBtn, background: C.green }}>▲ BUY</button>
              <button onClick={() => submit('short')} disabled={!currentPrice}
                style={{ ...s.execBtn, background: C.red }}>▼ SELL</button>
            </div>
          </div>

          {/* Open positions */}
          {openPositions.length > 0 && (
            <div style={s.section}>
              <div style={s.sLabel}>Open ({openPositions.length})</div>
              {openPositions.map(pos => {
                const upnl = candle
                  ? (pos.direction === 'long'
                      ? (candle.close - pos.entryPrice) * pos.size * 100
                      : (pos.entryPrice - candle.close) * pos.size * 100)
                  : 0
                return (
                  <div key={pos.id} style={s.posRow}>
                    <span style={{ color: pos.direction==='long' ? C.green : C.red, fontWeight:700, fontSize:12, minWidth:40 }}>
                      {pos.direction === 'long' ? 'LONG' : 'SHORT'}
                    </span>
                    <span style={s.posDetail}>@ {pos.entryPrice.toFixed(2)}</span>
                    {pos.tp != null && <span style={{ fontSize:11, color: C.green }}>TP {pos.tp.toFixed(2)}</span>}
                    {pos.sl != null && <span style={{ fontSize:11, color: C.red }}>SL {pos.sl.toFixed(2)}</span>}
                    <span style={{ ...s.posDetail, color: upnl>=0 ? C.green : C.red, fontWeight:600, textAlign:'right' }}>
                      {upnl>=0?'+':''}${upnl.toFixed(2)}
                    </span>
                    <button onClick={() => onClosePosition(pos.id)} style={s.closeBtn}>✕</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Trade history */}
          {closedTrades.length > 0 && (
            <div style={s.section}>
              <div style={s.sLabel}>History ({closedTrades.length})</div>
              <div style={s.histList}>
                {[...closedTrades].reverse().slice(0, 40).map((t, i) => (
                  <div key={i} style={s.histRow}>
                    <span style={{ color: t.direction==='long'?C.green:C.red, fontWeight:700, fontSize:11, minWidth:12 }}>
                      {t.direction==='long'?'L':'S'}
                    </span>
                    <span style={s.histDetail}>{t.entryPrice?.toFixed(2)}→{t.exitPrice?.toFixed(2)}</span>
                    {t.rr && <span style={{ fontSize:10, color:C.muted }}>RR {t.rr.toFixed(2)}</span>}
                    <span style={{ ...s.histDetail, color: t.pnl>=0?C.green:C.red, fontWeight:600, textAlign:'right' }}>
                      {t.pnl>=0?'+':''}${t.pnl?.toFixed(2)}
                    </span>
                    <span style={{ fontSize:10, color:C.muted, minWidth:30, textAlign:'right' }}>
                      {t.closeType==='tp'?'✓TP':t.closeType==='sl'?'✗SL':'MAN'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          <div style={{ padding: '8px 12px 14px' }}>
            <button onClick={onResetSession} style={s.resetBtn}>
              ↺ Reset Session
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
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: color || C.text, fontWeight: 700 }}>{value}</div>
    </div>
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
    overflowY:  'auto',
    maxHeight:  '70vh',
    borderTop:  `1px solid ${C.border}`,
  },
  summaryRow: {
    display: 'flex',
    gap:     4,
    padding: '10px 12px',
    borderBottom: `1px solid ${C.border}`,
  },
  section: {
    padding:      '8px 12px',
    borderBottom: `1px solid ${C.border}`,
  },
  sLabel: {
    fontSize:      11,
    color:         C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom:  6,
    display:       'flex',
    alignItems:    'center',
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  chip: {
    background:  C.input,
    color:       C.muted,
    border:      `1px solid ${C.border}`,
    borderRadius: 4,
    padding:     '5px 9px',
    fontSize:    12,
    cursor:      'pointer',
    minHeight:   32,
  },
  chipActive: {
    background:  C.highlight,
    color:       C.gold,
    borderColor: C.gold,
  },
  execGrid: {
    display:             'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap:                 6,
    marginBottom:        8,
  },
  fieldLabel: {
    display:       'flex',
    flexDirection: 'column',
    gap:           3,
    fontSize:      11,
    color:         C.muted,
  },
  input: {
    background:  C.input,
    color:       C.text,
    border:      `1px solid ${C.border}`,
    borderRadius: 4,
    padding:     '7px 6px',
    fontSize:    13,
    width:       '100%',
    minHeight:   36,
  },
  execBtns: { display: 'flex', gap: 8 },
  execBtn: {
    flex:        1,
    border:      'none',
    borderRadius: 6,
    padding:     '10px',
    color:       '#fff',
    fontWeight:  700,
    fontSize:    14,
    cursor:      'pointer',
    minHeight:   44,
  },
  posRow: {
    display:     'flex',
    alignItems:  'center',
    gap:         6,
    background:  C.bg,
    borderRadius: 5,
    padding:     '7px 8px',
    marginBottom: 4,
  },
  posDetail: { fontSize: 11, color: C.text, flex: 1 },
  closeBtn: {
    background: 'transparent',
    color:      C.red,
    border:     'none',
    cursor:     'pointer',
    fontSize:   16,
    minHeight:  32,
    minWidth:   32,
    display:    'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  histList: { maxHeight: 200, overflowY: 'auto' },
  histRow: {
    display:     'flex',
    alignItems:  'center',
    gap:         6,
    padding:     '5px 0',
    borderBottom:`1px solid ${C.border}`,
  },
  histDetail: { fontSize: 11, color: C.muted, flex: 1 },
  resetBtn: {
    width:       '100%',
    background:  'transparent',
    color:       C.red,
    border:      `1px solid ${C.red}`,
    borderRadius: 5,
    padding:     '9px',
    fontSize:    13,
    cursor:      'pointer',
    minHeight:   40,
  },
}
