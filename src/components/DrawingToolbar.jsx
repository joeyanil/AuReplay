import React from 'react'

const TOOLS = [
  { id: 'none',       label: '✦',   title: 'Pointer (no tool)' },
  { id: 'horizontal', label: '—',   title: 'Horizontal Line' },
  { id: 'trendline',  label: '↗',   title: 'Trendline' },
  { id: 'pricerange', label: '↕',   title: 'Price Range' },
  { id: 'rectangle',  label: '▭',   title: 'Rectangle' },
  { id: 'fib',        label: 'F',   title: 'Fibonacci Retracement' },
  { id: 'long',       label: '▲L',  title: 'Long Position' },
  { id: 'short',      label: '▼S',  title: 'Short Position' },
]

export default function DrawingToolbar({ activeTool, onToolChange, onClearAll }) {
  return (
    <div style={styles.wrap}>
      {TOOLS.map(t => (
        <button
          key={t.id}
          title={t.title}
          onClick={() => onToolChange(t.id)}
          style={{
            ...styles.btn,
            ...(activeTool === t.id ? styles.active : {}),
            ...(t.id === 'long' ? styles.longBtn : {}),
            ...(t.id === 'short' ? styles.shortBtn : {}),
          }}
        >
          {t.label}
        </button>
      ))}

      <div style={styles.spacer} />

      <button
        title="Clear all drawings"
        onClick={onClearAll}
        style={{ ...styles.btn, ...styles.clearBtn }}
      >
        ✕
      </button>
    </div>
  )
}

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    background: '#1e222d',
    borderRight: '1px solid #2a2e39',
    padding: '8px 6px',
    width: 48,
    minWidth: 48,
  },
  btn: {
    background: '#2a2e39',
    color: '#d1d4dc',
    border: '1px solid #363a45',
    borderRadius: 6,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    flexShrink: 0,
    userSelect: 'none',
  },
  active: {
    background: '#363a45',
    color: '#F0B90B',
    borderColor: '#F0B90B',
  },
  longBtn: {
    color: '#26a69a',
  },
  shortBtn: {
    color: '#ef5350',
  },
  clearBtn: {
    color: '#ef5350',
    borderColor: '#ef5350',
    background: 'transparent',
  },
  spacer: {
    flex: 1,
  },
}
