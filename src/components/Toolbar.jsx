import React from 'react'
import { INTERVALS, SPEEDS, C } from '../constants.js'

export default function Toolbar({
  interval, onIntervalChange,
  startDate, onStartDateChange,
  onLoad, loading,
  isPlaying, onPlay, onPause,
  onStepBack, onStepForward,
  onJumpStart, onJumpEnd,
  speed, onSpeedChange,
  visibleIndex, totalCandles,
  ohlc, currentPrice,
}) {
  const canStep = totalCandles > 0 && !loading
  const pct     = totalCandles > 0 ? ((visibleIndex + 1) / totalCandles) * 100 : 0

  return (
    <div style={s.wrap}>

      {/* ── Row 1: Interval tabs + OHLC bar + Date + Load ── */}
      <div style={s.row}>
        {/* Interval tabs */}
        <div style={s.group}>
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

        {/* OHLC bar — shows on hover or current candle */}
        {ohlc && (
          <div style={s.ohlcBar}>
            <span style={s.ohlcItem}><span style={s.ohlcLabel}>O</span><span style={{ color: ohlc.close >= ohlc.open ? C.green : C.red }}>{ohlc.open?.toFixed(2)}</span></span>
            <span style={s.ohlcItem}><span style={s.ohlcLabel}>H</span><span style={{ color: C.green }}>{ohlc.high?.toFixed(2)}</span></span>
            <span style={s.ohlcItem}><span style={s.ohlcLabel}>L</span><span style={{ color: C.red }}>{ohlc.low?.toFixed(2)}</span></span>
            <span style={s.ohlcItem}><span style={s.ohlcLabel}>C</span><span style={{ color: ohlc.close >= ohlc.open ? C.green : C.red }}>{ohlc.close?.toFixed(2)}</span></span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Date picker + Load */}
        <input
          type="date"
          value={startDate}
          onChange={e => onStartDateChange(e.target.value)}
          style={s.dateInput}
        />
        <button
          onClick={() => onLoad(interval, startDate)}
          disabled={loading}
          style={s.loadBtn}
        >
          {loading ? '…' : 'Load'}
        </button>
      </div>

      {/* ── Row 2: Playback + speed + progress ── */}
      <div style={s.row}>
        {/* Jump to start */}
        <button onClick={onJumpStart} disabled={!canStep} style={s.ctrlBtn} title="Jump to start">⏮</button>

        {/* Step back */}
        <button onClick={onStepBack} disabled={!canStep || visibleIndex <= 0} style={s.ctrlBtn} title="Step back">◀</button>

        {/* Play / Pause */}
        {isPlaying
          ? <button onClick={onPause} style={{ ...s.ctrlBtn, ...s.playBtn }}>⏸</button>
          : <button onClick={onPlay}  disabled={!canStep} style={{ ...s.ctrlBtn, ...s.playBtn }}>▶</button>
        }

        {/* Step forward */}
        <button onClick={onStepForward} disabled={!canStep || visibleIndex >= totalCandles - 1} style={s.ctrlBtn} title="Step forward">▶</button>

        {/* Jump to end */}
        <button onClick={onJumpEnd} disabled={!canStep} style={s.ctrlBtn} title="Jump to end">⏭</button>

        <div style={s.divider} />

        {/* Speed */}
        <div style={s.group}>
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

        {/* Current price */}
        {currentPrice != null && (
          <span style={s.livePrice}>{currentPrice.toFixed(2)}</span>
        )}

        {/* Candle counter */}
        {totalCandles > 0 && (
          <span style={s.counter}>{visibleIndex + 1} / {totalCandles}</span>
        )}
      </div>

      {/* ── Progress bar ── */}
      {totalCandles > 0 && (
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: {
    background:   C.panel,
    borderBottom: `1px solid ${C.border}`,
    padding:      '5px 8px 0',
    display:      'flex',
    flexDirection:'column',
    gap:          5,
    flexShrink:   0,
  },
  row: {
    display:    'flex',
    alignItems: 'center',
    gap:        4,
    flexWrap:   'nowrap',
    overflow:   'hidden',
  },
  group: {
    display: 'flex',
    gap:     2,
  },
  tfBtn: {
    background:  C.input,
    color:       C.muted,
    border:      `1px solid ${C.border}`,
    borderRadius: 4,
    padding:     '4px 7px',
    fontSize:    11,
    fontWeight:  600,
    minHeight:   30,
    cursor:      'pointer',
  },
  tfActive: {
    background:  C.highlight,
    color:       C.gold,
    borderColor: C.gold,
  },
  ohlcBar: {
    display:    'flex',
    gap:        8,
    fontSize:   11,
    fontFamily: 'monospace',
    marginLeft: 6,
  },
  ohlcItem: {
    display: 'flex',
    gap:     3,
  },
  ohlcLabel: {
    color: C.muted,
  },
  dateInput: {
    background:  C.input,
    color:       C.text,
    border:      `1px solid ${C.border}`,
    borderRadius: 4,
    padding:     '4px 6px',
    fontSize:    12,
    minHeight:   30,
    width:       130,
    colorScheme: 'dark',
    flexShrink:  0,
  },
  loadBtn: {
    background:  C.gold,
    color:       C.bg,
    border:      'none',
    borderRadius: 4,
    padding:     '4px 14px',
    fontSize:    13,
    fontWeight:  700,
    minHeight:   30,
    cursor:      'pointer',
    flexShrink:  0,
  },
  ctrlBtn: {
    background:  C.input,
    color:       C.text,
    border:      `1px solid ${C.border}`,
    borderRadius: 4,
    padding:     '5px 10px',
    fontSize:    15,
    minHeight:   34,
    minWidth:    34,
    cursor:      'pointer',
    display:     'flex',
    alignItems:  'center',
    justifyContent: 'center',
    flexShrink:  0,
  },
  playBtn: {
    background: C.highlight,
    minWidth:   46,
    fontSize:   18,
  },
  divider: {
    width:      1,
    height:     22,
    background: C.border,
    flexShrink: 0,
    margin:     '0 2px',
  },
  speedBtn: {
    background:  C.input,
    color:       C.muted,
    border:      `1px solid ${C.border}`,
    borderRadius: 4,
    padding:     '4px 8px',
    fontSize:    11,
    fontWeight:  600,
    minHeight:   30,
    cursor:      'pointer',
  },
  speedActive: {
    background:  C.highlight,
    color:       C.gold,
    borderColor: C.gold,
  },
  livePrice: {
    fontSize:   13,
    fontWeight: 700,
    color:      C.gold,
    fontFamily: 'monospace',
    marginLeft: 2,
  },
  counter: {
    fontSize:  11,
    color:     C.muted,
    marginLeft:'auto',
    flexShrink: 0,
  },
  progressTrack: {
    height:     2,
    background: C.border,
    borderRadius: 1,
    overflow:   'hidden',
    marginTop:  2,
  },
  progressFill: {
    height:     '100%',
    background: C.gold,
    borderRadius: 1,
    transition: 'width 0.1s linear',
  },
}
