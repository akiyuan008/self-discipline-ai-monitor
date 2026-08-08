import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { useClassTaskStore } from '@/stores/classTaskStore'

const ABYSS_QUOTES = [
  '正在深渊重载中，行星发动机全功率输出！',
  '专注即力量，分心即毁灭 — UEG核心法则',
  '地表温度-84℃，内部反应堆保持全效运行',
  '放弃幻想，坚守岗位，准备冲出重围',
  '每一秒专注都在为地球提供推力',
  '系统锁定深渊模式，禁止中断',
  '你的未来正在此刻通过铁血纪律构建',
]

interface Props {
  onExit: () => void
}

const MODES = [
  { key: 'focus', label: 'FOCUS', min: 25, title: '标准专注' },
  { key: 'abyss', label: 'ABYSS', min: 45, title: '深渊重载' },
  { key: 'short', label: 'SHORT', min: 5, title: '短休补给' },
  { key: 'long', label: 'LONG', min: 15, title: '长休调试' },
  { key: 'free', label: 'FREE', min: 0, title: '自由漫游' },
]

export default function Dungeon({ onExit }: Props) {
  const theme = useStore(s => s.theme)
  const addFocusMs = useStore(s => s.addFocusMs)
  const addExp = useStore(s => s.addExp)
  const addPoints = useStore(s => s.addPoints)
  const addPointRecord = useStore(s => s.addPointRecord)
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
  const [quote, setQuote] = useState(() => ABYSS_QUOTES[Math.floor(Math.random() * ABYSS_QUOTES.length)])
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [quitPenalty, setQuitPenalty] = useState('')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const currentTask = useClassTaskStore(s => s.currentTask)
  const addAbyssRecord = useClassTaskStore(s => s.addAbyssRecord)

  const isWandering = theme === 'wandering'
  const isAbyssMode = mode === 'abyss'

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
    setTimeout(() => setFlash(false), 200)
  }

  const toggleEngine = useCallback(() => {
    triggerFlash()
    if (isRunning) {
      if (isAbyssMode) {
        const penalties = ['背诵一段公式课文', '完成 15 个深蹲', '抄写 10 个英语单词', '静坐冥想 2 分钟']
        setQuitPenalty(penalties[Math.floor(Math.random() * penalties.length)])
        setShowQuitConfirm(true)
        return
      }
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
      setQuote(ABYSS_QUOTES[Math.floor(Math.random() * ABYSS_QUOTES.length)])
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
  }, [isRunning, isAbyssMode, mode, addFocusMs, addExp])

  const confirmQuitAbyss = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRunning(false)
    setShowQuitConfirm(false)
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)

    if (isAbyssMode) {
      addAbyssRecord({
        date: new Date().toISOString().slice(0, 10),
        subject: currentTask ? currentTask.subject : '深渊重载模式',
        duration: elapsed,
        completed: false,
        quitReason: quitPenalty,
        timestamp: Date.now()
      })
      showToast(`深渊挑战中断！未完成深渊模式。记录已归档。`)
    } else if (elapsed > 0) {
      addFocusMs(elapsed * 1000)
      addExp(elapsed, '部分专注完成')
    }
  }

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
    const val = Math.max(1, Math.min(180, setMin))
    setDungeonDuration(val)
    if (mode === 'focus' || mode === 'abyss') {
      const secs = val * 60
      setTotalTime(secs)
      setTimeLeft(secs)
    }
    setShowSettings(false)
    showToast(`专注时长已设定为 ${val} 分钟`)
  }

  useEffect(() => {
    if (timeLeft === 0 && isRunning && mode !== 'free') {
      if (timerRef.current) clearInterval(timerRef.current)
      setIsRunning(false)
      const elapsed = totalTime
      addFocusMs(elapsed * 1000)

      if (isAbyssMode) {
        addExp(elapsed * 2, '深渊重载完美通关')
        addPoints(200)
        addPointRecord('earn', 200, '完成深渊重载挑战')
        addAbyssRecord({
          date: new Date().toISOString().slice(0, 10),
          subject: currentTask ? currentTask.subject : '深渊重载',
          duration: elapsed,
          completed: true,
          timestamp: Date.now()
        })
        showToast('🔥 归档成功！深渊重载模式挑战成功！+200 PTS')
      } else {
        addExp(elapsed, '专注完成')
        showToast('🎉 专注完成！做得很棒！')
      }
    }
  }, [timeLeft, isRunning, mode, totalTime, isAbyssMode, currentTask, addFocusMs, addExp, addPoints, addPointRecord, addAbyssRecord])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const displayTime = mode === 'free' ? freeTime : timeLeft

  const btnBase: React.CSSProperties = {
    background: isWandering ? 'rgba(13,27,42,0.8)' : 'var(--bg-alt)',
    border: `1px solid ${isWandering ? '#ff4500' : 'var(--border)'}`,
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
    background: isRunning ? (isAbyssMode ? '#ff3344' : '#ff4500') : (isWandering ? 'rgba(255,69,0,0.15)' : 'var(--accent-dim)'),
    borderColor: isRunning ? (isAbyssMode ? '#ff3344' : '#ff4500') : 'var(--accent)',
    color: isRunning ? '#fff' : (isWandering ? '#ff4500' : 'var(--accent)'),
    fontSize: '1.25rem',
    fontWeight: 700,
    boxShadow: isRunning ? `0 0 25px ${isAbyssMode ? 'rgba(255,51,68,0.6)' : 'rgba(255,69,0,0.6)'}` : 'none',
  }

  return (
    <div className="safe-top safe-bottom" style={{
      position: 'fixed', inset: 0,
      background: isWandering ? '#07090e' : 'var(--bg)',
      zIndex: 600, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
    }}>
      {/* 背景网格 - 仅流浪地球主题 */}
      {isWandering && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(255, 69, 0, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 69, 0, 0.06) 1px, transparent 1px)`,
          backgroundSize: '36px 36px',
          zIndex: 0, pointerEvents: 'none'
        }} />
      )}

      {/* 扫描线 */}
      {isWandering && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 229, 255, 0.03) 2px, rgba(0, 229, 255, 0.03) 4px)',
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
        if (isRunning) {
          const penalties = ['背诵一段课文', '做10个深蹲', '抄写10个单词', '闭眼冥想1分钟']
          setQuitPenalty(penalties[Math.floor(Math.random() * penalties.length)])
          setShowQuitConfirm(true)
          return
        }
        onExit()
      }} style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10,
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        color: 'var(--fg)', padding: '8px 14px', fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit',
        clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
      }}>
        ← {isWandering ? 'EXIT PROTOCOL' : '退出引擎'}
      </button>

      {/* 深渊模式特制警告横幅 */}
      {isAbyssMode && (
        <div style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          background: 'rgba(255,51,68,0.15)', border: '1px solid #ff3344',
          color: '#ff3344', padding: '6px 12px', borderRadius: 4,
          fontSize: 10, fontWeight: 700, fontFamily: 'Share Tech Mono, monospace',
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: '0 0 12px rgba(255,51,68,0.3)'
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3344', animation: 'breathe 1.2s infinite' }} />
          ABYSS PROTOCOL: HIGH STAKES
        </div>
      )}

      {/* 主控制台卡片 */}
      <div style={{
        position: 'relative', zIndex: 10, width: '92%', maxWidth: 440,
        padding: '24px 20px', background: 'var(--card-bg)',
        border: `2px solid ${isAbyssMode ? '#ff3344' : 'var(--border)'}`,
        clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
        boxShadow: isWandering ? '0 0 50px rgba(0,0,0,0.9)' : '0 10px 30px rgba(0,0,0,0.1)'
      }}>
        <div className="corner-deco tl" />
        <div className="corner-deco tr" />
        <div className="corner-deco bl" />
        <div className="corner-deco br" />

        {/* 顶部数据栏 */}
        <div style={{
          width: '100%', display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-end', marginBottom: 20, paddingBottom: 10,
          borderBottom: `1px solid ${isWandering ? 'rgba(0, 229, 255, 0.25)' : 'var(--border)'}`
        }}>
          <div>
            <div style={{
              fontFamily: isWandering ? 'Teko, sans-serif' : 'inherit',
              fontSize: '1.8rem', letterSpacing: 2,
              color: isAbyssMode ? '#ff3344' : 'var(--fg)', textTransform: 'uppercase', margin: 0,
              fontWeight: 700, lineHeight: 1
            }}>
              {isAbyssMode ? 'ABYSS REACTOR' : (isWandering ? 'UEG CONTROL' : '专注模式')}
            </div>
            <span style={{
              fontSize: '0.7rem', color: 'var(--muted)',
              fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit'
            }}>
              {isAbyssMode ? 'ABYSS LOCKOUT // HIGH GRAVITY' : (isWandering ? 'UNIT: CN-171-11 // ENGINE' : 'SELF-DISCIPLINE')}
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
              color: isAbyssMode ? '#ff3344' : (isWandering ? '#ff4500' : 'var(--accent)'), fontWeight: 'bold',
              fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit',
              fontSize: '1.2rem'
            }}>
              {thrust}%
            </div>
          </div>
        </div>

        {/* 核心反应堆 */}
        <div style={{
          position: 'relative', width: 250, height: 250,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          {/* 涡轮环 */}
          <div style={{
            position: 'absolute', width: '100%', height: '100%',
            border: `3px dashed ${isAbyssMode ? 'rgba(255,51,68,0.3)' : (isWandering ? 'rgba(0,229,255,0.2)' : 'rgba(128,128,128,0.2)')}`,
            borderRadius: '50%',
            animation: 'turbineSpinReverse 30s linear infinite'
          }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '88%', height: '88%',
              border: `2px solid ${isAbyssMode ? '#ff3344' : (isWandering ? '#ff4500' : 'rgba(128,128,128,0.15)')}`,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderRadius: '50%',
              animation: 'turbineSpin 12s linear infinite'
            }} />
          </div>

          {/* SVG进度环 */}
          <svg style={{
            position: 'absolute', width: 210, height: 210,
            transform: 'rotate(-90deg)'
          }} viewBox="0 0 220 220">
            <circle cx="110" cy="110" r="100" fill="none"
              stroke={isWandering ? 'rgba(255,255,255,0.05)' : 'var(--bg-alt)'}
              strokeWidth={14} />
            <circle cx="110" cy="110" r="100" fill="none"
              stroke={isAbyssMode ? '#ff3344' : (isWandering ? '#ff4500' : 'var(--accent)')} strokeWidth={14}
              strokeLinecap="butt"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              style={{
                transition: 'stroke-dashoffset 1s linear, stroke 0.3s',
                filter: isWandering && isRunning
                  ? `drop-shadow(0 0 18px ${isAbyssMode ? 'rgba(255,51,68,0.9)' : 'rgba(255,69,0,0.8)'})`
                  : 'none'
              }} />
          </svg>

          {/* 时间显示 */}
          <div style={{
            fontFamily: isWandering ? 'Teko, sans-serif' : 'DM Mono, monospace',
            fontSize: '4.2rem', lineHeight: 1, color: isAbyssMode ? '#ff3344' : 'var(--fg)',
            zIndex: 5,
            textShadow: isWandering ? `0 0 20px ${isAbyssMode ? 'rgba(255,51,68,0.6)' : 'rgba(255,69,0,0.5)'}` : 'none',
            textAlign: 'center'
          }}>
            {formatTime(displayTime)}
          </div>

          {/* 状态指示器 */}
          <div style={{
            position: 'absolute', bottom: 48,
            fontSize: '0.85rem', letterSpacing: 3, fontWeight: 700,
            color: isRunning ? (isAbyssMode ? '#ff3344' : '#00e5ff') : 'var(--muted)',
            background: 'var(--card-bg)',
            padding: '2px 10px',
            border: `1px solid ${isRunning ? (isAbyssMode ? '#ff3344' : '#00e5ff') : 'var(--muted)'}`,
            fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit'
          }}>
            {isRunning ? (isAbyssMode ? 'ABYSS ENGAGED' : (isWandering ? 'IGNITION' : '专注中')) : (isWandering ? 'STANDBY' : '待机')}
          </div>

          {/* 励志名言 */}
          <div style={{
            position: 'absolute', top: -32, width: '100%', textAlign: 'center',
            fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace',
            letterSpacing: 1, opacity: 0.85
          }}>
            {quote}
          </div>
        </div>

        {/* 控制按钮 */}
        <div style={{ width: '100%', display: 'flex', gap: 10, justifyContent: 'center' }}>
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

        {/* 底部模式切换标签 */}
        <div style={{
          marginTop: 20, width: '100%', display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)', gap: 4,
          borderTop: `1px solid ${isWandering ? 'rgba(255,255,255,0.08)' : 'var(--border)'}`,
          paddingTop: 12
        }}>
          {MODES.map(m => (
            <button key={m.key} onClick={() => setModeHandler(m.key)} style={{
              background: mode === m.key ? (m.key === 'abyss' ? 'rgba(255,51,68,0.15)' : 'rgba(255,69,0,0.1)') : 'transparent',
              border: 'none',
              borderBottom: mode === m.key ? `2px solid ${m.key === 'abyss' ? '#ff3344' : 'var(--accent)'}` : '2px solid transparent',
              color: mode === m.key ? (m.key === 'abyss' ? '#ff3344' : 'var(--accent)') : 'var(--muted)',
              padding: '6px 0',
              fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit',
              fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.2s',
              textAlign: 'center', fontWeight: mode === m.key ? 700 : 400
            }}>
              {isWandering ? m.label : m.title}
            </button>
          ))}
        </div>
      </div>

      {/* 退出确认遮罩 (深渊挑战失败警告) */}
      {showQuitConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
          zIndex: 800, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }}>
          <div style={{
            background: '#0d1117', border: '2px solid #ff3344',
            padding: 24, width: '100%', maxWidth: 320, color: '#e2e8f0',
            clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
            boxShadow: '0 0 30px rgba(255,51,68,0.5)'
          }}>
            <div style={{ fontSize: 11, color: '#ff3344', fontFamily: 'Share Tech Mono, monospace', marginBottom: 4 }}>
              [ABYSS INTERRUPT WARNING]
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Teko, sans-serif', color: '#ff3344', margin: '0 0 10px' }}>
              确定中断深渊挑战？
            </h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
              深渊模式为钢铁高压专注，中途退出将直接判定为【深渊挑战失败】并在战绩表留下记录！
            </p>
            {quitPenalty && (
              <div style={{
                padding: 10, background: 'rgba(255,51,68,0.1)',
                border: '1px dashed #ff3344', borderRadius: 6,
                fontSize: 12, color: '#ff3344', marginBottom: 16
              }}>
                惩罚任务: {quitPenalty}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowQuitConfirm(false)} style={{
                flex: 1, padding: '10px', background: '#ff3344', color: '#fff',
                border: 'none', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Share Tech Mono, monospace'
              }}>
                继续坚守
              </button>
              <button onClick={confirmQuitAbyss} style={{
                flex: 1, padding: '10px', background: 'transparent', color: 'var(--muted)',
                border: '1px solid var(--border)', cursor: 'pointer',
                fontFamily: 'Share Tech Mono, monospace'
              }}>
                确认中断
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 设置时长弹窗 */}
      {showSettings && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 700, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }} onClick={() => setShowSettings(false)}>
          <div style={{
            background: 'var(--bg)', border: '2px solid var(--accent)',
            padding: 20, width: '80%', maxWidth: 300,
            clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{
              fontFamily: isWandering ? 'Teko, sans-serif' : 'inherit',
              color: 'var(--accent)', fontSize: '1.5rem',
              marginBottom: 15, textTransform: 'uppercase'
            }}>
              {isWandering ? 'SET DURATION' : '设置时长'}
            </h3>
            <input type="number" value={setMin} onChange={e => setSetMin(parseInt(e.target.value) || 1)}
              style={{
                width: '100%', background: 'var(--bg-alt)',
                border: '1px solid var(--border)', color: 'var(--accent)',
                padding: 10, fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit',
                fontSize: '1.2rem', marginBottom: 20, boxSizing: 'border-box'
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
                color: '#fff', padding: '8px 14px', cursor: 'pointer', fontWeight: 600
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
