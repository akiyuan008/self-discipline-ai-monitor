import { useEffect } from 'react'
import { useStore } from '@/stores/useStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'wandering')
  }, [])

  return <>{children}</>
}

export function ThemeToggle() {
  return (
    <div style={{
      padding: '14px', borderRadius: 12,
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      marginBottom: 12, position: 'relative'
    }}>
      <div className="corner-deco tl" />
      <div className="corner-deco tr" />
      <div className="corner-deco bl" />
      <div className="corner-deco br" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <div>
          <div style={{
            fontSize: 16, fontWeight: 600, fontFamily: 'Teko, sans-serif',
            letterSpacing: 1, textTransform: 'uppercase', color: '#ff4500'
          }}>
            🌍 UEG THEME
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, fontFamily: 'Share Tech Mono, monospace' }}>
            STATUS: ACTIVE // UNIT: CN-171-11
          </div>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: 4,
          background: 'rgba(255,69,0,0.15)', color: '#ff4500',
          border: '1px solid #ff4500', fontSize: 11,
          fontWeight: 600, fontFamily: 'Share Tech Mono, monospace',
          clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
        }}>
          ONLINE
        </div>
      </div>

      <div style={{
        marginTop: 10, padding: 10, borderRadius: 8,
        background: 'linear-gradient(135deg, #0a0e1a, #0d1b2a)',
        border: '1px solid #ff4500', display: 'flex',
        alignItems: 'center', gap: 8, position: 'relative', zIndex: 1
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #4a90d9, #1a3a5c)',
          boxShadow: '0 0 15px rgba(0, 212, 255, 0.3)'
        }} />
        <div>
          <div style={{
            fontSize: 12, fontWeight: 600, color: '#e8ecf1',
            fontFamily: 'Teko, sans-serif', letterSpacing: 1
          }}>
            PLANETARY ENGINE ONLINE
          </div>
          <div style={{
            fontSize: 10, color: '#5a6a7a',
            fontFamily: 'Share Tech Mono, monospace'
          }}>
            THRUST: 100% // ALL SYSTEMS NOMINAL
          </div>
        </div>
      </div>
    </div>
  )
}
