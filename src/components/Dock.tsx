import type { PageId } from '@/stores/useStore'
import { useGrowth } from '@/hooks/useGrowth'

interface DockProps {
  current: PageId
  onChange: (p: PageId) => void
  keyboardHeight?: number
}

const ICONS: Record<string, string> = {
  home: 'M3 12l9-9 9 9M5 10v10h14V10',
  quests: 'M9 11l3 3L22 4M2 13l3 3 5-5',
  dungeon: 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
  shop: 'M3 9h18l-2 11H5L3 9zM8 9V5a4 4 0 0 1 8 0v4',
  profile: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2',
  chat: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'
}

// 新顺序：[quests, chat(监管者), home(中间大黑圆), shop, profile]
const ORDER: PageId[] = ['quests', 'chat', 'home', 'shop', 'profile']
const CENTER: PageId = 'home'

export default function Dock({ current, onChange, keyboardHeight = 0 }: DockProps) {
  const isGrowth = useGrowth()

  // 键盘弹起时把 Dock 抬高到键盘上方，避免遮挡输入框
  const dockBottom = keyboardHeight > 0
    ? `calc(${keyboardHeight}px + 8px)`
    : 'max(20px, env(safe-area-inset-bottom))'

  if (isGrowth) {
    // Growth Mode Dock: 温暖圆角
    return (
      <div style={{
        position: 'fixed', bottom: dockBottom, left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, transition: 'bottom 0.2s ease-out'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 10px',
          background: 'var(--growth-surface)',
          border: '1px solid var(--growth-border)',
          borderRadius: 20,
          boxShadow: '0 4px 20px rgba(45, 42, 38, 0.06)'
        }}>
          {ORDER.map((it) => {
            const isCenter = it === CENTER
            const active = current === it
            if (isCenter) {
              return (
                <button key={it} onClick={() => onChange(it)} style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: active ? 'var(--growth-primary)' : 'var(--growth-surface-alt)',
                  color: active ? '#fff' : 'var(--growth-text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', cursor: 'pointer', margin: '-8px 2px 0', transition: 'all 0.2s'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[it]} /></svg>
                </button>
              )
            }
            return (
              <button key={it} onClick={() => onChange(it)} style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'transparent',
                color: active ? 'var(--growth-primary)' : 'var(--growth-text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[it]} /></svg>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Normal Mode Dock: 原有设计完全保留
  return (
    <div
      style={{
        position: 'fixed',
        bottom: dockBottom,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        transition: 'bottom 0.2s ease-out'
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
        {ORDER.map((it) => {
          const isCenter = it === CENTER
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
                  <path d={ICONS[it]} />
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
