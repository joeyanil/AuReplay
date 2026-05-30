import React from 'react'
import { INTERVALS, SPEEDS, COLORS } from '../constants.js'

export default function Toolbar({
  interval, onIntervalChange,
  startDate, onStartDateChange,
  onLoad, loading,
  isPlaying, onPlay, onPause,
  onStepBack, onStepForward,
  speed, onSpeedChange,
  visibleIndex, totalCandles,
  onResetSession,
}) {
  const canStep = totalCandles > 0 && !loading

  return (
    <div style={s.wrap}>
      {/* Row 1: Interval tabs + Date + Load */}
      <div style={s.row}>
        <div style={s.intervalGroup}>
          {INTERVALS.map(tf => (
            <button
              key={tf}
              onClick={() => onIntervalChange(tf)}
              style={{ ...s.tfBtn, ...(interval === tf ? s.tfActive : {}) }}
            >
              {tf}
            </button>
          ))}
        </div>

        <input
          type="date"
          value={startDate}
          onChange={e => onStartDateChange(e.target.value)}
          style={s.dateInput}
        />

        <button onClick={() => onLoad(interval, startDate)} disabled={loading} style={s.loadBtn}>
          {loading ? '…' : 'Load'}
        </button>
      </div>

      {/* Row 2: Playback + Speed + Reset */}
      <div style={s.row}>
        <button onClick={onStepBack} disabled={!canStep || visibleIndex <= 0} style={s.ctrlBtn}>
          ⏮
        </button>

        {isPlaying
          ? <button onClick={onPause} style={{ ...s.ctrlBtn, ...s.playBtn }}>⏸</button>
          : <button onClick={onPlay}  disabled={!canStep} style={{ ...s.ctrlBtn, ...s.playBtn }}>▶</button>
        }

        <button onClick={onStepForward} disabled={!canStep || visibleIndex >= totalCandles - 1} style={s.ctrlBtn}>
          ⏭
        </button>

        <div style={s.divider} />

        {/* Speed */}
        <div style={s.speedGroup}>
          {SPEEDS.map(sp => (
            <button
              key={sp}
              onClick={() => onSpeedChange(sp)}
              style={{ ...s.speedBtn, ...(speed === sp ? s.speedActive : {}) }}
            >
              {sp}×
            </button>
          ))}
        </div>

        <div style={s.divider} />

        {/* Progress */}
        {totalCandles > 0 && (
          <span style={s.progress}>
            {visibleIndex + 1}/{totalCandles}
          </span>
        )}

        <button onClick={onResetSession} style={s.resetBtn} title="Reset session">
          ↺
        </button>
      </div>

      {/* Progress bar */}
      {totalCandles > 0 && (
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${((visibleIndex + 1) / totalCandles) * 100}%` }} />
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: {
    background: COLORS.panel,
    borderBottom: `1px solid ${COLORS.border}`,
    padding: '6px 8px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flexShrink: 0,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  intervalGroup: {
    display: 'flex',
    gap: 2,
  },
  tfBtn: {
    background: COLORS.input,
    color: COLORS.muted,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: '5px 7px',
    fontSize: 11,
    fontWeight: 600,
    minHeight: 32,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tfActive: {
    background: COLORS.highlight,
    color: COLORS.gold,
    borderColor: COLORS.gold,
  },
  dateInput: {
    background: COLORS.input,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: '5px 6px',
    fontSize: 12,
    minHeight: 32,
    flex: 1,
    minWidth: 0,
    colorScheme: 'dark',
  },
  loadBtn: {
    background: COLORS.gold,
    color: COLORS.bg,
    border: 'none',
    borderRadius: 4,
    padding: '5px 14px',
    fontSize: 13,
    fontWeight: 700,
    minHeight: 32,
    cursor: 'pointer',
    flexShrink: 0,
  },
  ctrlBtn: {
    background: COLORS.input,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: '5px 10px',
    fontSize: 16,
    minHeight: 36,
    minWidth: 36,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playBtn: {
    background: COLORS.highlight,
    minWidth: 48,
    fontSize: 18,
  },
  divider: {
    width: 1,
    height: 24,
    background: COLORS.border,
    flexShrink: 0,
  },
  speedGroup: {
    display: 'flex',
    gap: 2,
  },
  speedBtn: {
    background: COLORS.input,
    color: COLORS.muted,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 600,
    minHeight: 32,
    cursor: 'pointer',
  },
  speedActive: {
    background: COLORS.highlight,
    color: COLORS.gold,
    borderColor: COLORS.gold,
  },
  progress: {
    fontSize: 11,
    color: COLORS.muted,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  resetBtn: {
    background: 'transparent',
    color: COLORS.muted,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 16,
    minHeight: 32,
    cursor: 'pointer',
    flexShrink: 0,
  },
  progressBar: {
    height: 2,
    background: COLORS.border,
    borderRadius: 1,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressFill: {
    height: '100%',
    background: COLORS.gold,
    borderRadius: 1,
    transition: 'width 0.1s linear',
  },
}
