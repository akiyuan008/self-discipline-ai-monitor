import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/stores/useStore'
import type { PageId } from '@/stores/useStore'

interface DungeonProps {
  onNavigate?: (page: PageId) => void
}

export default function Dungeon({ onNavigate }: DungeonProps) {
  const dungeonActive = useStore(s => s.dungeonActive)
  const dungeonRemainingSec = useStore(s => s.dungeonRemainingSec)
  const dungeonDurationMin = useStore(s => s.dungeonDurationMin)
  const setDungeon = useStore(s => s.setDungeon)
  const addFocusMs = useStore(s => s.addFocusMs)
  const doublerActive = useStore(s => s.doublerActive)
  const consumeDoubler = useStore(s => s.consumeDoubler)
  const addPoints = useStore(s => s.addPoints)
  const addPointRecord = useStore(s => s.addPointRecord)

  const [displaySec, setDisplaySec] = useState(dungeonRemainingSec)
  const intervalRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  // 同步 store 状态到本地显示
  useEffect(() => {
    setDisplaySec(dungeonRemainingSec)
  }, [dungeonRemainingSec])

  // 倒计时逻辑
  useEffect(() => {
    if (!dungeonActive || displaySec <= 0) return

    startTimeRef.current = Date.now()
    intervalRef.current = window.setInterval(() => {
      setDisplaySec(prev => {
        if (prev <= 1) {
          // 倒计时结束
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          // 计算实际专注时长
          const elapsedMs = Date.now() - startTimeRef.current
          const focusMs = Math.min(elapsedMs, dungeonDurationMin * 60 * 1000)
          addFocusMs(focusMs)

          // 奖励积分
          const baseReward = dungeonDurationMin * 2
          const reward = doublerActive ? baseReward * 2 : baseReward
          addPoints(reward)
          addPointRecord('earn', reward, `深渊完成 ${dungeonDurationMin}分钟`)
          if (doublerActive) {
            consumeDoubler()
          }

          setDungeon(0, false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [dungeonActive, displaySec, dungeonDurationMin, doublerActive, addFocusMs, addPoints, addPointRecord, consumeDoubler, setDungeon])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleStart = () => {
    setDungeon(dungeonDurationMin * 60, true)
    setDisplaySec(dungeonDurationMin * 60)
    startTimeRef.current = Date.now()
  }

  const handleGiveUp = () => {
    if (confirm('确定要放弃吗？本次专注不会计入统计。')) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setDungeon(0, false)
      setDisplaySec(0)
    }
  }

  if (!dungeonActive && displaySec <= 0) {
    return (
      <div className="view active safe-top" style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100%', background: 'var(--bg)',
        padding: '0 32px'
      }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>⏱️</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>深渊挑战</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', marginBottom: 40, lineHeight: 1.6 }}>
          专注 {dungeonDurationMin} 分钟，期间不要离开此页面。
          <br />
          完成后获得 {dungeonDurationMin * 2} 积分奖励。
          {doublerActive && <span style={{ color: 'var(--warning)' }}><br />🎉 双倍卡生效中，奖励翻倍！</span>}
        </p>
        <button
          onClick={handleStart}
          className="btn-primary"
          style={{ width: '100%', maxWidth: 280, padding: 16, fontSize: 16 }}
        >
          开始专注
        </button>
        <button
          onClick={() => onNavigate?.('home')}
          style={{
            marginTop: 16, background: 'none', border: 'none',
            color: 'var(--muted)', fontSize: 14, cursor: 'pointer'
          }}
        >
          返回首页
        </button>
      </div>
    )
  }

  return (
    <div className="view active" style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100%',
      background: 'var(--fg)',
      color: 'var(--bg)',
      padding: '0 32px'
    }}>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 16, letterSpacing: 2 }}>
        DEEP_FOCUS
      </div>
      <div style={{ fontSize: '6rem', fontWeight: 200, fontFamily: 'DM Mono, monospace', lineHeight: 1 }}>
        {formatTime(displaySec)}
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 16 }}>
        {dungeonDurationMin} 分钟专注中...
      </div>
      {doublerActive && (
        <div style={{
          marginTop: 12, padding: '6px 14px', borderRadius: 100,
          background: 'rgba(245,158,11,0.2)', color: '#F59E0B',
          fontSize: 12, fontWeight: 600
        }}>
          🎉 双倍卡生效中
        </div>
      )}
      <button
        onClick={handleGiveUp}
        style={{
          marginTop: 60,
          padding: '12px 32px',
          borderRadius: 100,
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'transparent',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 14,
          cursor: 'pointer'
        }}
      >
        放弃
      </button>
    </div>
  )
}
