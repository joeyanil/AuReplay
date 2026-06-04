import React from 'react'
import { DRAWING_TOOLS, C } from '../constants.js'

const MAGNET_CYCLE  = ['off', 'weak', 'strong']
const MAGNET_COLOR  = { off: C.muted, weak: C.gold, strong: '#ff9800' }
const MAGNET_TITLE  = { off: 'Magnet Off', weak: 'Magnet Weak (snap near OHLC)', strong: 'Magnet Strong (always snap)' }

export default function DrawingToolbar({ activeTool, onToolChange, onClearAll, onUndo, magnet, onMagnetChange }) {
  const cycleMagnet = () => {
    const next = MAGNET_CYCLE[(MAGNET_CYCLE.indexOf(magnet) + 1) % MAGNET_CYCLE.length]
    onMagnetChange(next)
  }

  return (
    <div style={s.wrap}>
      {DRAWING_TOOLS.map(tool => (
        <button
          key={tool.id}
          title={tool.title}
          onClick={() => onToolChange(tool.id === activeTool ? 'none' : tool.id)}
          style={{
            ...s.btn,
            ...(activeTool === tool.id && tool.id !== 'none' ? s.active : {}),
            ...(tool.id === 'long'  ? { color: C.green } : {}),
            ...(tool.id === 'short' ? { color: C.red   } : {}),
          }}
        >
          {tool.label}
        </button>
      ))}

      <div style={s.spacer} />

      {/* Magnet */}
      <button
        title={MAGNET_TITLE[magnet]}
        onClick={cycleMagnet}
        style={{
          ...s.btn,
          color:       MAGNET_COLOR[magnet],
          borderColor: magnet !== 'off' ? MAGNET_COLOR[magnet] : C.border,
          background:  magnet !== 'off' ? '#1e2a1e' : 'transparent',
          fontSize:    16,
          position:    'relative',
        }}
      >
        🧲
        {magnet !== 'off' && (
          <span style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 5, height: 5, borderRadius: '50%',
            background: MAGNET_COLOR[magnet],
          }} />
        )}
      </button>

      {/* Undo */}
      <button title="Undo last drawing" onClick={onUndo} style={{ ...s.btn, color: C.muted }}>
        ↩
      </button>

      {/* Clear all */}
      <button title="Clear all drawings" onClick={onClearAll}
        style={{ ...s.btn, color: C.red, borderColor: C.red, background: 'transparent' }}>
        ✕
      </button>
    </div>
  )
}

const s = {
  wrap: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           4,
    background:    C.panel,
    borderRight:   `1px solid ${C.border}`,
    padding:       '8px 5px',
    width:         44,
    minWidth:      44,
    flexShrink:    0,
  },
  btn: {
    background:     C.input,
    color:          C.text,
    border:         `1px solid ${C.border}`,
    borderRadius:   5,
    width:          34,
    height:         34,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    cursor:         'pointer',
    fontSize:       12,
    fontWeight:     700,
    flexShrink:     0,
    userSelect:     'none',
    padding:        0,
    position:       'relative',
  },
  active: {
    background:  '#1a1e2b',
    color:       C.gold,
    borderColor: C.gold,
  },
  spacer: { flex: 1 },
}
