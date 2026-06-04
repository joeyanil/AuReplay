import React from 'react'
import { INTERVALS, SPEEDS, C } from '../constants.js'

export default function Toolbar({
  interval, onIntervalChange,
  startDate, onStartDateChange,
  onLoad, loading, fetching,
  isPlaying, onPlay, onPause,
  onStepBack, onStepForward,
  onJumpStart, onJumpEnd,
  speed, onSpeedChange,
  visibleIndex, totalCandles, replayStartIndex,
  ohlc, currentPrice,
}) {
  // Replay progress: how many replay candles have been revealed
  const replayTotal    = Math.max(0, totalCandles - replayStartIndex)
  const replayRevealed = Math.max(0, visibleIndex - replayStartIndex + 1)
  const pct            = replayTotal > 0 ? (replayRevealed / replayTotal) * 100 : 0
  const canStep        = totalCandles > 0 && !loading

  return (
    <div style={s.wrap}>

      {/* ── Row 1: Interval tabs + OHLC + Date + Load ── */}
      <div style={s.row}>
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

        {/* OHLC bar */}
        {ohlc && (
          <div style={s.ohlc}>
            <OhlcItem label="O" value={ohlc.open}  color={ohlc.close >= ohlc.open ? C.green : C.red} />
            <OhlcItem label="H" value={ohlc.high}  color={C.green} />
            <OhlcItem label="L" value={ohlc.low}   color={C.red} />
            <OhlcItem label="C" value={ohlc.close} color={ohlc.close >= ohlc.open ? C.green : C.red} />
          </div>
        )}

        <div style={{ flex: 1 }} />

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

      {/* ── Row 2: Playback + Speed + Price + Counter ── */}
      <div style={s.row}>
        <button onClick={onJumpStart}    disabled={!canStep} style={s.ctrlBtn} title="Jump to start">⏮</button>
        <button onClick={onStepBack}     disabled={!canStep || visibleIndex <= replayStartIndex} style={s.ctrlBtn} title="Step back">◀</button>

        {isPlaying
          ? <button onClick={onPause} style={{ ...s.ctrlBtn, ...s.playBtn }}>⏸</button>
          : <button onClick={onPlay}  disabled={!canStep} style={{ ...s.ctrlBtn, ...s.playBtn }}>▶</button>
        }

        <button onClick={onStepForward}  disabled={!canStep || visibleIndex >= totalCandles - 1} style={s.ctrlBtn} title="Step forward">▶</button>
        <button onClick={onJumpEnd}      disabled={!canStep} style={s.ctrlBtn} title="Jump to end">⏭</button>

        <div style={s.divider} />

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

        {/* Live price */}
        {currentPrice != null && (
          <span style={s.livePrice}>{currentPrice.toFixed(2)}</span>
        )}

        {/* Replay candle counter — shows replay progress not total */}
        {replayTotal > 0 && (
          <span style={s.counter}>
            {replayRevealed}/{replayTotal}
            {fetching && <span style={{ color: C.gold, marginLeft: 4 }}>…</span>}
          </span>
        )}
      </div>

      {/* ── Progress bar — replay progress only ── */}
      <div style={s.progressTrack}>
        <div style={{ ...s.progressFill, width: `${pct}%` }} />
      </div>
    </div>
  )
}

function OhlcItem({ label, value, color }) {
  return (
    <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <span style={{ color: C.muted, fontSize: 10 }}>{label}</span>
      <span style={{ color, fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>
        {value?.toFixed(2)}
      </span>
    </span>
  )
}

const s = {
  wrap: {
    background:    C.panel,
    borderBottom:  `1px solid ${C.border}`,
    padding:       '5px 8px 0',
    display:       'flex',
    flexDirection: 'column',
    gap:           5,
    flexShrink:    0,
  },
  row: {
    display:    'flex',
    alignItems: 'center',
    gap:        4,
    overflow:   'hidden',
  },
  group: { display: 'flex', gap: 2 },
  tfBtn: {
    background:   C.input,
    color:        C.muted,
    border:       `1px solid ${C.border}`,
    borderRadius: 4,
    padding:      '4px 7px',
    fontSize:     11,
    fontWeight:   600,
    minHeight:    30,
    cursor:       'pointer',
  },
  tfActive: {
    background:  '#1a1e2b',
    color:       C.gold,
    borderColor: C.gold,
  },
  ohlc: {
    display:    'flex',
    gap:        8,
    marginLeft: 8,
    flexShrink: 0,
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
    background:   C.gold,
    color:        C.bg,
    border:       'none',
    borderRadius: 4,
    padding:      '4px 14px',
    fontSize:     13,
    fontWeight:   700,
    minHeight:    30,
    cursor:       'pointer',
    flexShrink:   0,
  },
  ctrlBtn: {
    background:     C.input,
    color:          C.text,
    border:         `1px solid ${C.border}`,
    borderRadius:   4,
    padding:        '4px 10px',
    fontSize:       15,
    minHeight:      34,
    minWidth:       34,
    cursor:         'pointer',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  playBtn: {
    background: '#2a2e39',
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
    background:   C.input,
    color:        C.muted,
    border:       `1px solid ${C.border}`,
    borderRadius: 4,
    padding:      '4px 8px',
    fontSize:     11,
    fontWeight:   600,
    minHeight:    30,
    cursor:       'pointer',
  },
  speedActive: {
    background:  '#1a1e2b',
    color:       C.gold,
    borderColor: C.gold,
  },
  livePrice: {
    fontSize:   13,
    fontWeight: 700,
    color:      C.gold,
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  counter: {
    fontSize:  11,
    color:     C.muted,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  progressTrack: {
    height:       2,
    background:   C.border,
    borderRadius: 1,
    overflow:     'hidden',
    marginTop:    2,
  },
  progressFill: {
    height:     '100%',
    background: C.gold,
    borderRadius: 1,
    transition: 'width 0.12s linear',
  },
}
