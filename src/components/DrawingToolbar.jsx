import React from 'react'
import { DRAWING_TOOLS, COLORS } from '../constants.js'

export default function DrawingToolbar({ activeTool, onToolChange, onClearAll }) {
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
            ...(tool.id === 'long'  ? s.longColor  : {}),
            ...(tool.id === 'short' ? s.shortColor : {}),
          }}
        >
          {tool.label}
        </button>
      ))}

      <div style={s.spacer} />

      <button
        title="Clear all drawings"
        onClick={onClearAll}
        style={{ ...s.btn, ...s.clearBtn }}
      >
        ✕
      </button>
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    background: COLORS.panel,
    borderRight: `1px solid ${COLORS.border}`,
    padding: '8px 5px',
    width: 44,
    minWidth: 44,
    flexShrink: 0,
  },
  btn: {
    background: COLORS.input,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 5,
    width: 34,
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
    userSelect: 'none',
    padding: 0,
  },
  active: {
    background: COLORS.highlight,
    color: COLORS.gold,
    borderColor: COLORS.gold,
  },
  longColor: {
    color: COLORS.green,
  },
  shortColor: {
    color: COLORS.red,
  },
  clearBtn: {
    color: COLORS.red,
    borderColor: COLORS.red,
    background: 'transparent',
  },
  spacer: {
    flex: 1,
  },
}
