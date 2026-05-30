import React from 'react'
import { DRAWING_TOOLS, C } from '../constants.js'

const MAGNET_STATES = ['off', 'weak', 'strong']
const MAGNET_LABELS = { off: '🧲', weak: '🧲', strong: '🧲' }
const MAGNET_TITLES = { off: 'Magnet: Off', weak: 'Magnet: Weak', strong: 'Magnet: Strong' }
const MAGNET_COLORS = { off: C.muted, weak: C.gold, strong: '#ff9800' }

export default function DrawingToolbar({ activeTool, onToolChange, onClearAll, onUndo, magnet, onMagnetChange }) {
  const cycleMagnet = () => {
    const idx  = MAGNET_STATES.indexOf(magnet)
    const next = MAGNET_STATES[(idx + 1) % MAGNET_STATES.length]
    onMagnetChange(next)
  }

  return (
    <div style={s.wrap}>
      {/* Drawing tools */}
      {DRAWING_TOOLS.map(tool => (
        <button
          key={tool.id}
          title={tool.title}
          onClick={() => onToolChange(tool.id === activeTool ? 'none' : tool.id)}
          style={{
            ...s.btn,
            ...(activeTool === tool.id && tool.id !== 'none' ? s.active : {}),
            ...(tool.id === 'long'  ? { color: C.green } : {}),
            ...(tool.id === 'short' ? { color: C.red }   : {}),
          }}
        >
          {tool.label}
        </button>
      ))}

      <div style={s.spacer} />

      {/* Magnet mode */}
      <button
        onClick={cycleMagnet}
        title={MAGNET_TITLES[magnet]}
        style={{
          ...s.btn,
          color:       MAGNET_COLORS[magnet],
          borderColor: magnet !== 'off' ? MAGNET_COLORS[magnet] : C.border,
          background:  magnet !== 'off' ? C.highlight : 'transparent',
          fontSize:    16,
          position:    'relative',
        }}
      >
        🧲
        {/* Indicator dot */}
        <span style={{
          position:   'absolute',
          bottom:     2, right: 2,
          width:      5, height: 5,
          borderRadius: '50%',
          background: MAGNET_COLORS[magnet],
          display:    magnet === 'off' ? 'none' : 'block',
        }} />
      </button>

      {/* Undo last drawing */}
      <button
        onClick={onUndo}
        title="Undo last drawing"
        style={{ ...s.btn, color: C.muted }}
      >
        ↩
      </button>

      {/* Clear all */}
      <button
        onClick={onClearAll}
        title="Clear all drawings"
        style={{ ...s.btn, color: C.red, borderColor: C.red, background: 'transparent' }}
      >
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
    background:      C.input,
    color:           C.text,
    border:          `1px solid ${C.border}`,
    borderRadius:    5,
    width:           34,
    height:          34,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    cursor:          'pointer',
    fontSize:        12,
    fontWeight:      700,
    flexShrink:      0,
    userSelect:      'none',
    padding:         0,
    position:        'relative',
  },
  active: {
    background:  C.highlight,
    color:       C.gold,
    borderColor: C.gold,
  },
  spacer: { flex: 1 },
}
