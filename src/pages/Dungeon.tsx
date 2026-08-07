import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'

interface Props {
  onExit: () => void
}

const MODES = [
  { key: 'focus', label: 'FOCUS', min: 25 },
  { key: 'short', label: 'SHORT', min: 5 },
  { key: 'long', label: 'LONG', min: 15 },
  { key: 'free', label: 'FREE', min: 0 },
]

export default function Dungeon({ onExit }: Props) {
  const theme = useStore(s => s.theme)
  const addFocusMs = useStore(s => s.addFocusMs)
  const addExp = useStore(s => s.addExp)
  const dungeonDurationMin = useStore(s => s.dungeonDurationMin)
  const setDungeonDuration = useStore(s => s.setDungeonDuration)

  const [mode, setMode] = useState('focus')
  const [timeLeft, setTimeLeft] = useState(dungeonDurationMin * 60)
  const [totalTime, setTotalTime] = useState(dungeonDurationMin * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [freeTime, setFreeTime] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [setMin, setSetMin] = useState(dungeonDurationMin)
  const [flash, setFlash] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const isWandering = theme === 'wandering'

  const circumference = 2 * Math.PI * 100
  const progress = mode === 'free'
    ? ((freeTime % 60) / 60) * 100
    : totalTime > 0 ? (timeLeft / totalTime) * 100 : 100
  const strokeOffset = circumference - (progress / 100) * circumference

  const thrust = mode === 'free' ? 100 : totalTime > 0 ? Math.floor(((totalTime - timeLeft) / totalTime) * 100) : 0

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const triggerFlash = () => {
    setFlash(true)
    setTimeout(() => setFlash(false), 150)
  }

  const toggleEngine = useCallback(() => {
    triggerFlash()
    if (isRunning) {
      if (timerRef.current) clearInterval(timerRef.current)
      setIsRunning(false)
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      if (elapsed > 0) {
        addFocusMs(elapsed * 1000)
        addExp(elapsed, '专注学习')
      }
    } else {
      setIsRunning(true)
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (mode === 'free') {
            setFreeTime(f => f + 1)
            return prev
          }
          if (prev > 0) return prev - 1
          return 0
        })
      }, 1000)
    }
  }, [isRunning, mode, addFocusMs, addExp])

  const resetEngine = () => {
    triggerFlash()
    if (isRunning && timerRef.current) {
      clearInterval(timerRef.current)
      setIsRunning(false)
    }
    if (mode === 'free') {
      setFreeTime(0)
    } else {
      setTimeLeft(totalTime)
    }
  }

  const setModeHandler = (newMode: string) => {
    if (isRunning && timerRef.current) {
      clearInterval(timerRef.current)
      setIsRunning(false)
    }
    setMode(newMode)
    const m = MODES.find(x => x.key === newMode)
    if (m) {
      const secs = m.min * 60
      setTotalTime(secs)
      setTimeLeft(secs)
    }
    setFreeTime(0)
  }

  const saveSettings = () => {
    const val = Math.max(1, Math.min(120, setMin))
    setDungeonDuration(val)
    if (mode === 'focus') {
      const secs = val * 60
      setTotalTime(secs)
      setTimeLeft(secs)
    }
    setShowSettings(false)
    showToast(`专注时长设为 ${val} 分钟`)
  }

  useEffect(() => {
    if (timeLeft === 0 && isRunning && mode !== 'free') {
      if (timerRef.current) clearInterval(timerRef.current)
      setIsRunning(false)
      const elapsed = totalTime
      addFocusMs(elapsed * 1000)
      addExp(elapsed, '专注完成')
      showToast('专注完成！')
    }
  }, [timeLeft, isRunning, mode, totalTime, addFocusMs, addExp])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const displayTime = mode === 'free' ? freeTime : timeLeft

  const btnBase: React.CSSProperties = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid var(--border)',
    color: 'var(--fg)',
    padding: '12px 16px',
    fontFamily: isWandering ? 'Teko, sans-serif' : 'inherit',
    fontSize: '1.1rem',
    letterSpacing: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
    transition: 'all 0.2s',
  }

  const ignitionBtn: React.CSSProperties = {
    ...btnBase,
    flexGrow: 1,
    justifyContent: 'center',
    background: isRunning ? 'var(--success)' : 'rgba(255,69,0,0.1)',
    borderColor: 'var(--success)',
    color: isRunning ? '#fff' : 'var(--success)',
    fontSize: '1.2rem',
    boxShadow: isRunning ? '0 0 20px rgba(255,69,0,0.4)' : 'none',
  }

  return (
    <div className="safe-top safe-bottom" style={{
      position: 'fixed', inset: 0,
      background: isWandering ? '#0b0c10' : 'var(--bg)',
      zIndex: 600, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
    }}>
      {/* 背景网格 - 仅流浪地球主题 */}
      {isWandering && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(255, 69, 0, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 69, 0, 0.05) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          zIndex: 0, pointerEvents: 'none'
        }} />
      )}

      {/* 扫描线 */}
      {isWandering && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(69, 162, 158, 0.03) 2px, rgba(69, 162, 158, 0.03) 4px)',
          zIndex: 1, pointerEvents: 'none'
        }} />
      )}

      {/* 全屏闪烁 */}
      <div className={flash ? 'flash-overlay active' : 'flash-overlay'} style={{
        position: 'fixed', inset: 0,
        background: isWandering ? '#ff4500' : 'var(--success)',
        opacity: 0, pointerEvents: 'none', zIndex: 9999
      }} />

      {/* 返回按钮 */}
      <button onClick={() => {
        if (isRunning && timerRef.current) {
          clearInterval(timerRef.current)
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
          if (elapsed > 0) {
            addFocusMs(elapsed * 1000)
            addExp(elapsed, '专注学习')
          }
        }
        onExit()
      }} style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10,
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        color: 'var(--fg)', padding: '8px 14px', fontSize: 13,
        cursor: 'pointer', fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit',
        clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
      }}>
        ← {isWandering ? 'EXIT' : '返回'}
      </button>

      {/* 主控制台 */}
      <div style={{
        position: 'relative', zIndex: 10, width: '90%', maxWidth: 450,
        padding: '30px 20px', background: 'var(--card-bg)',
        border: '2px solid var(--border)',
        clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
        boxShadow: isWandering ? '0 0 40px rgba(0,0,0,0.8)' : '0 10px 30px rgba(0,0,0,0.1)'
      }}>
        {/* 角标 */}
        <div className="corner-deco tl" />
        <div className="corner-deco tr" />
        <div className="corner-deco bl" />
        <div className="corner-deco br" />

        {/* 顶部数据栏 */}
        <div style={{
          width: '100%', display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-end', marginBottom: 25, paddingBottom: 10,
          borderBottom: '1px solid rgba(69, 162, 158, 0.3)'
        }}>
          <div>
            <div style={{
              fontFamily: isWandering ? 'Teko, sans-serif' : 'inherit',
              fontSize: '1.8rem', letterSpacing: 2,
              color: 'var(--fg)', textTransform: 'uppercase', margin: 0,
              fontWeight: 700
            }}>
              {isWandering ? 'UEG CONTROL' : '专注模式'}
            </div>
            <span style={{
              fontSize: '0.7rem', color: 'var(--muted)',
              fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit'
            }}>
              {isWandering ? 'UNIT: CN-171-11' : 'SELF-DISCIPLINE'}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '0.7rem', color: 'var(--muted)',
              fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit'
            }}>
              {isWandering ? 'THRUST' : '进度'}
            </div>
            <div className={isWandering ? 'thrust-text' : ''} style={{
              color: 'var(--success)', fontWeight: 'bold',
              fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit',
              fontSize: '1.1rem'
            }}>
              {thrust}%
            </div>
          </div>
        </div>

        {/* 核心反应堆 */}
        <div style={{
          position: 'relative', width: 260, height: 260,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 30px'
        }}>
          {/* 涡轮环 */}
          <div style={{
            position: 'absolute', width: '100%', height: '100%',
            border: `3px dashed ${isWandering ? 'rgba(255,255,255,0.1)' : 'rgba(128,128,128,0.2)'}`,
            borderRadius: '50%',
            animation: 'turbineSpinReverse 30s linear infinite'
          }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%', height: '90%',
              border: `2px solid ${isWandering ? 'rgba(255,69,0,0.2)' : 'rgba(128,128,128,0.15)'}`,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderRadius: '50%',
              animation: 'turbineSpin 10s linear infinite'
            }} />
          </div>

          {/* SVG进度环 */}
          <svg style={{
            position: 'absolute', width: 220, height: 220,
            transform: 'rotate(-90deg)'
          }} viewBox="0 0 220 220">
            <circle cx="110" cy="110" r="100" fill="none"
              stroke={isWandering ? 'rgba(255,255,255,0.05)' : 'var(--bg-alt)'}
              strokeWidth={15} />
            <circle cx="110" cy="110" r="100" fill="none"
              stroke="var(--success)" strokeWidth={15}
              strokeLinecap="butt"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              style={{
                transition: 'stroke-dashoffset 1s linear, stroke 0.3s',
                filter: isWandering && isRunning
                  ? 'drop-shadow(0 0 15px rgba(255,69,0,0.8))'
                  : isWandering
                    ? 'drop-shadow(0 0 5px rgba(255,69,0,0.3))'
                    : 'none'
              }} />
          </svg>

          {/* 时间显示 */}
          <div style={{
            fontFamily: isWandering ? 'Teko, sans-serif' : 'DM Mono, monospace',
            fontSize: '4.5rem', lineHeight: 1, color: 'var(--fg)',
            zIndex: 5,
            textShadow: isWandering ? '0 0 20px rgba(255,69,0,0.4)' : 'none',
            textAlign: 'center'
          }}>
            {formatTime(displayTime)}
          </div>

          {/* 状态指示器 */}
          <div style={{
            position: 'absolute', bottom: 55,
            fontSize: '0.9rem', letterSpacing: 3,
            color: isRunning ? 'var(--success)' : 'var(--muted)',
            background: 'var(--card-bg)',
            padding: '2px 8px',
            border: `1px solid ${isRunning ? 'var(--success)' : 'var(--muted)'}`,
            fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit'
          }}>
            {isRunning ? (isWandering ? 'IGNITION' : '专注中') : (isWandering ? 'STANDBY' : '待机')}
          </div>
        </div>

        {/* 控制按钮 */}
        <div style={{ width: '100%', display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => setShowSettings(true)} style={btnBase}>
            <span>⚙</span> {isWandering ? 'SET' : '设置'}
          </button>
          <button onClick={toggleEngine} style={ignitionBtn}>
            <span>{isRunning ? '❚❚' : '▶'}</span>
            {isRunning ? (isWandering ? 'SHUTDOWN' : '停止') : (isWandering ? 'IGNITION' : '开始')}
          </button>
          <button onClick={resetEngine} style={btnBase}>
            <span>↺</span> {isWandering ? 'RST' : '重置'}
          </button>
        </div>

        {/* 底部模式切换 */}
        <div style={{
          marginTop: 25, width: '100%', display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)', gap: 5,
          borderTop: '1px solid rgba(128,128,128,0.2)',
          paddingTop: 15
        }}>
          {MODES.map(m => (
            <button key={m.key} onClick={() => setModeHandler(m.key)} style={{
              background: 'transparent', border: 'none',
              borderBottom: mode === m.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: mode === m.key ? 'var(--accent)' : 'var(--muted)',
              padding: '8px 0',
              fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit',
              fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.3s',
              textAlign: 'center'
            }}>
              {isWandering ? m.label : (m.key === 'focus' ? '专注' : m.key === 'short' ? '短休' : m.key === 'long' ? '长休' : '自由')}
            </button>
          ))}
        </div>
      </div>

      {/* 设置弹窗 */}
      {showSettings && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 700, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }} onClick={() => setShowSettings(false)}>
          <div style={{
            background: 'var(--bg)', border: '2px solid var(--success)',
            padding: 20, width: '80%', maxWidth: 300,
            clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{
              fontFamily: isWandering ? 'Teko, sans-serif' : 'inherit',
              color: 'var(--success)', fontSize: '1.5rem',
              marginBottom: 15, textTransform: 'uppercase'
            }}>
              {isWandering ? 'SET DURATION' : '设置时长'}
            </h3>
            <input type="number" value={setMin} onChange={e => setSetMin(parseInt(e.target.value) || 1)}
              style={{
                width: '100%', background: 'var(--bg-alt)',
                border: '1px solid var(--border)', color: 'var(--success)',
                padding: 10, fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit',
                fontSize: '1.2rem', marginBottom: 20
              }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowSettings(false)} style={{
                background: 'transparent', border: 'none',
                color: 'var(--muted)', padding: '8px 14px', cursor: 'pointer'
              }}>
                {isWandering ? 'CANCEL' : '取消'}
              </button>
              <button onClick={saveSettings} style={{
                background: 'var(--accent)', border: 'none',
                color: '#fff', padding: '8px 14px', cursor: 'pointer'
              }}>
                {isWandering ? 'CONFIRM' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
