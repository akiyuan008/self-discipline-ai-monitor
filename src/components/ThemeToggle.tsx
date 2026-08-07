import { useEffect } from 'react'
import { useStore } from '@/stores/useStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useStore(s => s.theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return <>{children}</>
}

export function ThemeToggle() {
  const theme = useStore(s => s.theme)
  const points = useStore(s => s.points)
  const unlockedThemes = useStore(s => s.unlockedThemes)
  const setTheme = useStore(s => s.setTheme)
  const unlockTheme = useStore(s => s.unlockTheme)
  const addPoints = useStore(s => s.addPoints)
  const addPointRecord = useStore(s => s.addPointRecord)

  const isWandering = theme === 'wandering'
  const hasWandering = unlockedThemes.includes('wandering')
  const WANDERING_COST = 800

  function buyWandering() {
    if (points < WANDERING_COST) {
      showToast(`需要 ${WANDERING_COST} 积分，当前 ${points}`)
      return
    }
    addPoints(-WANDERING_COST)
    addPointRecord('spend', -WANDERING_COST, '解锁行星发动机皮肤')
    unlockTheme('wandering')
    setTheme('wandering')
    showToast('🌍 行星发动机皮肤已解锁！')
  }

  return (
    <div style={{
      padding: '14px', borderRadius: 12,
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      marginBottom: 12, position: 'relative'
    }}>
      <div className="corner-deco tl" style={{ width: 10, height: 10, borderWidth: 1 }} />
      <div className="corner-deco tr" style={{ width: 10, height: 10, borderWidth: 1 }} />
      <div className="corner-deco bl" style={{ width: 10, height: 10, borderWidth: 1 }} />
      <div className="corner-deco br" style={{ width: 10, height: 10, borderWidth: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'Teko, sans-serif', letterSpacing: 1, textTransform: 'uppercase' }}>
            {isWandering ? '🌍 UEG THEME' : '主题设置'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {isWandering ? 'UNIT: CN-171-11 // ONLINE' : '当前：默认主题'}
          </div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 4,
          background: isWandering ? 'rgba(255,69,0,0.15)' : 'var(--bg-alt)',
          color: isWandering ? '#ff4500' : 'var(--muted)',
          border: isWandering ? '1px solid #ff4500' : '1px solid var(--border)',
          fontSize: 10, fontWeight: 600, fontFamily: 'Share Tech Mono, monospace'
        }}>
          {isWandering ? 'ACTIVE' : 'DEFAULT'}
        </div>
      </div>

      {/* 默认主题 */}
      <button onClick={() => setTheme('default')} style={{
        width: '100%', padding: '12px', marginBottom: 8,
        background: theme === 'default' ? 'var(--accent-dim)' : 'var(--bg-alt)',
        border: theme === 'default' ? '1px solid var(--accent)' : '1px solid var(--border)',
        color: theme === 'default' ? 'var(--accent)' : 'var(--fg)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
        clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #667eea, #764ba2)' }} />
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>默认主题</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>已解锁</div>
        </div>
        {theme === 'default' && <span style={{ color: 'var(--accent)', fontSize: 16 }}>✓</span>}
      </button>

      {/* 流浪地球主题 */}
      <button onClick={() => {
        if (hasWandering) setTheme('wandering')
        else buyWandering()
      }} style={{
        width: '100%', padding: '12px',
        background: theme === 'wandering' ? 'rgba(255,69,0,0.1)' : 'var(--bg-alt)',
        border: theme === 'wandering' ? '1px solid #ff4500' : '1px solid var(--border)',
        color: theme === 'wandering' ? '#ff4500' : 'var(--fg)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
        clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'radial-gradient(circle at 30% 30%, #4a90d9, #1a3a5c)',
          boxShadow: '0 0 10px rgba(0, 212, 255, 0.3)'
        }} />
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Teko, sans-serif', letterSpacing: 0.5 }}>
            行星发动机
          </div>
          <div style={{ fontSize: 10, color: hasWandering ? '#45a29e' : 'var(--muted)' }}>
            {hasWandering ? '已解锁' : `${WANDERING_COST} 积分解锁`}
          </div>
        </div>
        {theme === 'wandering' && <span style={{ color: '#ff4500', fontSize: 16 }}>✓</span>}
        {!hasWandering && (
          <span style={{
            fontSize: 10, padding: '2px 8px', background: 'rgba(255,69,0,0.15)',
            color: '#ff4500', border: '1px solid #ff4500', borderRadius: 4,
            fontFamily: 'Share Tech Mono, monospace'
          }}>
            LOCKED
          </span>
        )}
      </button>
    </div>
  )
}

function showToast(msg: string) {
  const el = document.createElement('div')
  el.textContent = msg
  el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(0,0,0,0.9);color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;white-space:nowrap;'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2500)
}
