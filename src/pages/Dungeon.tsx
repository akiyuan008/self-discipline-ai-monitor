import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'

interface Props {
  onExit: () => void
}

export default function Dungeon({ onExit }: Props) {
  const dungeonDurationMin = useStore(s => s.dungeonDurationMin)
  const setDungeon = useStore(s => s.setDungeon)
  const addPoints = useStore(s => s.addPoints)
  const completeQuest = useStore(s => s.completeQuest)
  const unlockAchievement = useStore(s => s.unlockAchievement)
  const addFocusMs = useStore(s => s.addFocusMs)

  const totalSec = dungeonDurationMin * 60
  const [remaining, setRemaining] = useState(totalSec)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)
  const handlersRef = useRef({
    onExit,
    addPoints,
    addFocusMs,
    completeQuest,
    unlockAchievement,
    setDungeon
  })

  // keep latest handlers in a ref to avoid re-creating interval when store selectors change
  useEffect(() => {
    handlersRef.current = { onExit, addPoints, addFocusMs, completeQuest, unlockAchievement, setDungeon }
  }, [onExit, addPoints, addFocusMs, completeQuest, unlockAchievement, setDungeon])

  useEffect(() => {
    // reset remaining when duration changes
    setRemaining(totalSec)

    // initialize dungeon state
    handlersRef.current.setDungeon(totalSec, true)

    // ensure previous timer cleared
    if (timerRef.current) window.clearInterval(timerRef.current)

    const tick = () => {
      if (paused) return
      setRemaining(prev => {
        const next = Math.max(0, prev - 1)
        handlersRef.current.setDungeon(next, true)
        if (next <= 0) {
          window.clearInterval(timerRef.current)
          const reward = 100 + dungeonDurationMin * 20
          handlersRef.current.addPoints(reward)
          handlersRef.current.addFocusMs(dungeonDurationMin * 60_000)
          handlersRef.current.completeQuest('q3')
          handlersRef.current.unlockAchievement('a1')
          showToast(`胜利 +${reward} 积分`)
          setTimeout(() => handlersRef.current.onExit(), 800)
        }
        return next
      })
    }

    timerRef.current = window.setInterval(tick, 1000)
    return () => window.clearInterval(timerRef.current)
  }, [paused, dungeonDurationMin])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const progress = ((totalSec - remaining) / totalSec) * 100

  return (
    <div
      className="dungeon-bg"
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 500,
        padding: 'max(40px, env(safe-area-inset-top)) 20px max(40px, env(safe-area-inset-bottom))'
      }}
    >
      <div style={{ fontSize: 11, color: '#8a8a8a', fontFamily: 'DM Mono, monospace', letterSpacing: 1 }}>
        DEEP_DIVE_MODE
      </div>
      <div style={{ fontSize: 13, color: '#fff', marginTop: 8, opacity: 0.8 }}>
        全神贯注 {dungeonDurationMin} 分钟
      </div>

      <div className="timer-text" style={{ marginTop: 32, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>

      <div style={{ width: 240, height: 2, background: '#1F1F1F', marginTop: 32, borderRadius: 100, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: '#fff',
          transition: 'width 1s linear'
        }} />
      </div>

      <div style={{ fontSize: 12, color: '#8a8a8a', marginTop: 16 }}>
        {paused ? '已暂停' : '专注中... 放下手机'}
      </div>

      {/* 控制按钮 */}
      <div style={{ display: 'flex', gap: 12, position: 'absolute', bottom: 'max(40px, env(safe-area-inset-bottom))' }}>
        <button
          onClick={() => setPaused(p => !p)}
          style={{
            padding: '12px 24px',
            borderRadius: 100,
            background: 'transparent',
            border: '1px solid #333',
            color: '#fff',
            fontSize: 13
          }}
        >
          {paused ? '继续' : '暂停'}
        </button>
        <button
          onClick={() => {
            window.clearInterval(timerRef.current)
            const penalty = 30
            useStore.getState().addPoints(-penalty)
            useStore.getState().addPointRecord('spend', penalty, '放弃深渊挑战')
            showToast(`放弃挑战 -${penalty} 积分`)
            onExit()
          }}
          style={{
            padding: '12px 24px',
            borderRadius: 100,
            background: 'transparent',
            border: '1px solid #E54D2E',
            color: '#E54D2E',
            fontSize: 13
          }}
        >
          放弃
        </button>
      </div>
    </div>
  )
}
