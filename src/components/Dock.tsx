import type { PageId } from '@/stores/useStore'

interface DockProps {
  current: PageId
  onChange: (p: PageId) => void
}

const ICONS: Record<string, string> = {
  home: 'M3 12l9-9 9 9M5 10v10h14V10',
  quests: 'M9 11l3 3L22 4M2 13l3 3 5-5',
  shop: 'M3 9h18l-2 11H5L3 9zM8 9V5a4 4 0 0 1 8 0v4',
  profile: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2'
}

export default function Dock({ current, onChange }: DockProps) {
  const items: PageId[] = ['home', 'quests', 'dungeon', 'shop', 'profile']

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'max(20px, env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 8,
          borderRadius: 30,
          background: 'var(--card-bg)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          border: '1px solid var(--border)'
        }}
      >
        {items.map((it) => {
          const isCenter = it === 'dungeon'
          const active = current === it
          if (isCenter) {
            return (
              <button
                key={it}
                onClick={() => onChange(it)}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--fg)',
                  color: 'var(--bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer',
                  margin: '-16px 4px 0',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  transition: 'transform 0.2s'
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </button>
            )
          }
          return (
            <button
              key={it}
              onClick={() => onChange(it)}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: active ? 'var(--fg)' : 'transparent',
                color: active ? 'var(--bg)' : 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={ICONS[it]} />
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}
