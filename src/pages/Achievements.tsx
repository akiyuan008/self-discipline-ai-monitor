import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import { ACHIEVEMENT_TABS } from '@/data/achievements'

interface Props {
  onBack: () => void
}

export default function Achievements({ onBack }: Props) {
  const [tab, setTab] = useState<'all' | 'unlocked' | 'locked'>('all')
  const achievements = useStore(s => s.achievements)

  const list = achievements.filter(a => {
    if (tab === 'unlocked') return a.unlocked
    if (tab === 'locked') return !a.unlocked
    return true
  })

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg)',
        zIndex: 500,
        overflow: 'auto'
      }}
      className="safe-top safe-bottom animate-in"
    >
      <div style={{ padding: '16px 20px 32px' }}>
        <Header onBack={onBack} title="成就殿堂" subtitle="ACHIEVEMENTS" />

        {/* AI 管理提示 */}
        <div className="card" style={{
          padding: '12px 16px', borderRadius: 16, marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg-alt)'
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--card-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>AI 动态管理</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
              与监管者对话时，AI 会根据你的表现添加和更新成就
            </div>
          </div>
        </div>

        {/* tabs */}
        <div style={{
          display: 'flex', gap: 6, padding: 4,
          background: 'var(--bg-alt)', borderRadius: 100, marginBottom: 16
        }}>
          {ACHIEVEMENT_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '8px 12px',
                borderRadius: 100,
                background: tab === t.id ? 'var(--fg)' : 'transparent',
                color: tab === t.id ? 'var(--bg)' : 'var(--muted)',
                border: 'none', fontSize: 12, fontWeight: 500
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(a => (
            <div
              key={a.id}
              className="card"
              style={{
                padding: 14, borderRadius: 16,
                display: 'flex', gap: 12, alignItems: 'center',
                opacity: a.unlocked ? 1 : 0.7
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 16,
                background: a.iconBg, color: a.iconColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={a.iconPath} />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{a.desc}</div>
                {!a.unlocked && (
                  <div style={{
                    height: 3, background: 'var(--bg-alt)',
                    borderRadius: 100, marginTop: 8, overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${(a.progress / a.total) * 100}%`,
                      background: 'var(--fg)', borderRadius: 100
                    }} />
                  </div>
                )}
              </div>
              <div style={{
                fontSize: 10, fontFamily: 'DM Mono, monospace',
                color: a.unlocked ? 'var(--success)' : 'var(--muted)',
                whiteSpace: 'nowrap'
              }}>
                {a.unlocked ? '已解锁' : `${a.progress}/${a.total}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Header({ onBack, title, subtitle }: { onBack: () => void; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <button
        onClick={onBack}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--fg)'
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
          {subtitle}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{title}</div>
      </div>
    </div>
  )
}
