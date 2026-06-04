import React from 'react'

export default function Notifications({ notifications }) {
  if (!notifications.length) return null
  return (
    <div style={s.wrap}>
      {notifications.map(n => (
        <div key={n.id} style={{ ...s.toast, borderLeftColor: n.color }}>
          <span style={{ color: n.color, fontWeight: 700, fontSize: 13 }}>{n.msg}</span>
        </div>
      ))}
    </div>
  )
}

const s = {
  wrap: {
    position: 'absolute', top: 60, left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100, display: 'flex', flexDirection: 'column', gap: 6,
    pointerEvents: 'none', width: 'calc(100% - 60px)', maxWidth: 380,
  },
  toast: {
    background: 'rgba(19,23,34,0.96)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderLeft: '3px solid',
    borderRadius: 6, padding: '10px 14px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    animation: 'fadeInDown 0.2s ease',
  },
}
