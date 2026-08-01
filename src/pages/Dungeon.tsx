import { useEffect, useRef } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'

export default function Dungeon() {
  const setDungeon = useStore(s => s.setDungeon)
  const setHp = useStore(s => s.setHp)
  const addPoints = useStore(s => s.addPoints)
  const completeQuest = useStore(s => s.completeQuest)
  const hp = useStore(s => s.hp)

  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    let time = 10
    setDungeon(time, true)
    const tick = () => {
      time -= 1
      setDungeon(time, true)
      if (time <= 0) {
        window.clearInterval(timerRef.current)
        addPoints(500)
        completeQuest('q3')
        showToast('胜利 +500')
        window.history.back()
      }
    }
    timerRef.current = window.setInterval(tick, 1000)
    return () => window.clearInterval(timerRef.current)
  }, [])

  const remaining = useStore(s => s.dungeonRemainingSec)

  return (
    <div
      className="dungeon-bg"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div style={{ fontSize: 11, color: '#8a8a8a', fontFamily: 'DM Mono, monospace', marginBottom: 12, letterSpacing: 2 }}>
        DEEP DIVE MODE
      </div>
      <div style={{ fontSize: 96, fontWeight: 200, color: '#fff', letterSpacing: -2 }}>
        00:{remaining < 10 ? '0' + remaining : remaining}
      </div>
      <div style={{ width: 240, height: 2, background: '#1F1F1F', marginTop: 24, borderRadius: 100, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${(10 - remaining) * 10}%`,
          background: '#fff',
          transition: 'width 1s linear'
        }} />
      </div>
      <div style={{ fontSize: 12, color: '#8a8a8a', marginTop: 16 }}>
        全神贯注完成挑战
      </div>

      <button
        onClick={() => {
          window.clearInterval(timerRef.current)
          setHp(Math.max(0, hp - 30))
          showToast('放弃挑战 -30 HP')
          window.history.back()
        }}
        style={{
          position: 'absolute',
          bottom: 'max(40px, env(safe-area-inset-bottom))',
          padding: '12px 32px',
          borderRadius: 100,
          background: 'transparent',
          border: '1px solid #333',
          color: '#8a8a8a',
          fontSize: 13
        }}
      >
        放弃
      </button>
    </div>
  )
}
