import React from 'react'

const SPEEDS = [1, 2, 5, 10]
const INTERVALS = ['1M', '5M', '15M', '1H', '4H', '1D']

export default function ReplayControls({
  isPlaying,
  speed,
  interval,
  startDate,
  visibleIndex,
  totalCandles,
  onPlay,
  onPause,
  onStepForward,
  onStepBack,
  onSpeedChange,
  onIntervalChange,
  onStartDateChange,
  onLoad,
  loading,
}) {
  return (
    <div style={styles.wrap}>
      {/* Row 1: Interval + Date + Load */}
      <div style={styles.row}>
        <select
          value={interval}
          onChange={e => onIntervalChange(e.target.value)}
          style={styles.select}
        >
          {INTERVALS.map(i => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>

        <input
          type="date"
          value={startDate}
          onChange={e => onStartDateChange(e.target.value)}
          style={styles.dateInput}
        />

        <button onClick={onLoad} style={styles.loadBtn} disabled={loading}>
          {loading ? '…' : 'Load'}
        </button>
      </div>

      {/* Row 2: Playback controls + speed */}
      <div style={styles.row}>
        <button onClick={onStepBack} style={styles.btn} disabled={visibleIndex <= 0 || loading}>
          ◀
        </button>

        {isPlaying ? (
          <button onClick={onPause} style={{ ...styles.btn, ...styles.primaryBtn }}>
            ⏸
          </button>
        ) : (
          <button onClick={onPlay} style={{ ...styles.btn, ...styles.primaryBtn }} disabled={loading || totalCandles === 0}>
            ▶
          </button>
        )}

        <button onClick={onStepForward} style={styles.btn} disabled={visibleIndex >= totalCandles - 1 || loading}>
          ▶▶
        </button>

        {/* Speed selector */}
        <div style={styles.speedWrap}>
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              style={{ ...styles.speedBtn, ...(speed === s ? styles.speedActive : {}) }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Progress indicator */}
      {totalCandles > 0 && (
        <div style={styles.progress}>
          <div
            style={{
              ...styles.progressBar,
              width: `${((visibleIndex + 1) / totalCandles) * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  )
}

const styles = {
  wrap: {
    background: '#1e222d',
    borderBottom: '1px solid #2a2e39',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  select: {
    background: '#2a2e39',
    color: '#d1d4dc',
    border: '1px solid #363a45',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 14,
    minHeight: 40,
    flex: '0 0 auto',
  },
  dateInput: {
    background: '#2a2e39',
    color: '#d1d4dc',
    border: '1px solid #363a45',
    borderRadius: 6,
    padding: '8px 8px',
    fontSize: 14,
    minHeight: 40,
    flex: 1,
    minWidth: 140,
    colorScheme: 'dark',
  },
  loadBtn: {
    background: '#F0B90B',
    color: '#131722',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 700,
    minHeight: 40,
    minWidth: 56,
    cursor: 'pointer',
    flex: '0 0 auto',
  },
  btn: {
    background: '#2a2e39',
    color: '#d1d4dc',
    border: '1px solid #363a45',
    borderRadius: 6,
    padding: '8px 14px',
    fontSize: 18,
    minHeight: 44,
    minWidth: 44,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
  },
  primaryBtn: {
    background: '#363a45',
    fontSize: 20,
    minWidth: 52,
  },
  speedWrap: {
    display: 'flex',
    gap: 4,
    marginLeft: 'auto',
  },
  speedBtn: {
    background: '#2a2e39',
    color: '#758696',
    border: '1px solid #363a45',
    borderRadius: 5,
    padding: '6px 10px',
    fontSize: 12,
    minHeight: 36,
    cursor: 'pointer',
  },
  speedActive: {
    background: '#363a45',
    color: '#F0B90B',
    borderColor: '#F0B90B',
  },
  progress: {
    height: 3,
    background: '#2a2e39',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: '#F0B90B',
    borderRadius: 2,
    transition: 'width 0.15s',
  },
}
