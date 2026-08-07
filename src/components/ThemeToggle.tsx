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
  const setTheme = useStore(s => s.setTheme)
  const level = useStore(s => s.level)
  const streak = useStore(s => s.streak)
  const unlockedThemes = useStore(s => s.unlockedThemes)

  const isWanderingUnlocked = unlockedThemes.includes('wandering') || level >= 5 || streak >= 7

  return (
    <div style={{ padding: '14px', borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', marginBottom: 12, position: 'relative' }}>
      {/* 角标装饰 */}
      <div className="corner-deco tl" />
      <div className="corner-deco tr" />
      <div className="corner-deco bl" />
      <div className="corner-deco br" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, position: 'relative', zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'Teko, sans-serif', letterSpacing: 1, textTransform: 'uppercase' }}>
            🌍 UEG THEME
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, fontFamily: 'Share Tech Mono, monospace' }}>
            {isWanderingUnlocked ? 'STATUS: UNLOCKED' : `REQUIRE: LVL.5 OR STREAK 7D (NOW: LVL.${level}, ${streak}D)`}
          </div>
        </div>
        <button
          onClick={() => {
            if (!isWanderingUnlocked) return
            setTheme(theme === 'wandering' ? 'default' : 'wandering')
          }}
          disabled={!isWanderingUnlocked}
          style={{
            padding: '8px 16px',
            borderRadius: 100,
            background: theme === 'wandering' ? '#ff4500' : 'var(--bg-alt)',
            color: theme === 'wandering' ? '#fff' : 'var(--fg)',
            border: '1px solid var(--border)',
            fontSize: 12,
            fontWeight: 600,
            cursor: isWanderingUnlocked ? 'pointer' : 'not-allowed',
            opacity: isWanderingUnlocked ? 1 : 0.5,
            transition: 'all 0.3s ease',
            fontFamily: 'Share Tech Mono, monospace'
          }}
        >
          {theme === 'wandering' ? 'ACTIVE' : 'ACTIVATE'}
        </button>
      </div>

      {/* 预览 */}
      <div style={{
        padding: 10,
        borderRadius: 8,
        background: theme === 'wandering' ? 'linear-gradient(135deg, #0a0e1a, #0d1b2a)' : 'var(--bg-alt)',
        border: `1px solid ${theme === 'wandering' ? '#ff4500' : 'var(--border)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: theme === 'wandering' 
            ? 'radial-gradient(circle at 30% 30%, #4a90d9, #1a3a5c)' 
            : 'var(--fg)',
          boxShadow: theme === 'wandering' ? '0 0 15px rgba(0, 212, 255, 0.3)' : 'none'
        }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme === 'wandering' ? '#e8ecf1' : 'var(--fg)', fontFamily: 'Teko, sans-serif' }}>
            {theme === 'wandering' ? 'PLANETARY ENGINE ONLINE' : 'DEFAULT INTERFACE'}
          </div>
          <div style={{ fontSize: 10, color: theme === 'wandering' ? '#5a6a7a' : 'var(--muted)', fontFamily: 'Share Tech Mono, monospace' }}>
            {theme === 'wandering' ? 'UNIT: CN-171-11 // THRUST: 100%' : 'STANDARD MODE'}
          </div>
        </div>
      </div>
    </div>
  )
}
