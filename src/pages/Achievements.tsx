import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import type { PageId } from '@/stores/useStore'

const ACHIEVEMENT_TABS = [
  { id: 'all' as const, label: '全部' },
  { id: 'unlocked' as const, label: '已解锁' },
  { id: 'locked' as const, label: '进行中' }
]

interface AchievementsProps {
  onNavigate?: (page: PageId) => void
}

export default function Achievements({ onNavigate }: AchievementsProps) {
  const achievements = useStore(s => s.achievements)
  const [activeTab, setActiveTab] = useState<'all' | 'unlocked' | 'locked'>('all')

  const list = achievements.filter(a => {
    if (activeTab === 'unlocked') return a.unlocked
    if (activeTab === 'locked') return !a.unlocked
    return true
  })

  return (
    <div className="view active safe-top safe-bottom" style={{ padding: '0 16px 100px', overflowY: 'auto' }}>
      <Header onBack={() => onNavigate?.('profile')} title="成就殿堂" subtitle="ACHIEVEMENT_HALL" />

      {/* AI 管理提示 */}
      <div className="card" style={{ padding: 16, marginBottom: 16, background: 'rgba(59,130,246,0.05)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--info)' }}>🤖 AI 动态管理</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          与监管者对话时，AI 会根据你的表现添加和更新成就
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {ACHIEVEMENT_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 100,
              border: '1px solid var(--border)',
              background: activeTab === t.id ? 'var(--fg)' : 'var(--card-bg)',
              color: activeTab === t.id ? 'var(--bg)' : 'var(--fg)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {list.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
          <div style={{ fontSize: 14 }}>暂无成就</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>与 AI 监管者对话添加成就挑战</div>
        </div>
      ) : (
        list.map(a => (
          <div key={a.id} className="card" style={{ padding: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className={`achieve-icon-box ${a.unlocked ? '' : 'locked'}`} style={{
              background: a.unlocked ? a.iconBg : undefined,
              border: a.unlocked ? 'none' : undefined
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={a.unlocked ? a.iconColor : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={a.iconPath} />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{a.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{a.desc}</div>
              {!a.unlocked && (
                <div className="achieve-progress" style={{ marginTop: 8 }}>
                  <div className="achieve-progress-bar" style={{
                    width: `${Math.min(100, (a.progress / a.total) * 100)}%`,
                    background: 'var(--info)'
                  }} />
                </div>
              )}
            </div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: a.unlocked ? 'var(--success)' : 'var(--muted)'
            }}>
              {a.unlocked ? '已解锁' : `${a.progress}/${a.total}`}
            </div>
          </div>
        ))
      )}

      <div style={{ height: 24 }} />
    </div>
  )
}

function Header({ onBack, title, subtitle }: { onBack: () => void; title: string; subtitle: string }) {
  return (
    <header style={{ padding: '24px 0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--fg)' }}
      >
        ←
      </button>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600 }}>
          {subtitle}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
      </div>
    </header>
  )
}
