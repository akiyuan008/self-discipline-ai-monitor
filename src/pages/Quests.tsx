import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import GaokaoProgress from '@/components/GaokaoProgress'
import type { PageId } from '@/stores/useStore'

const CATEGORY_TABS = [
  { id: 'daily' as const, label: '日常任务' },
  { id: 'weekly' as const, label: '周常挑战' },
  { id: 'main' as const, label: '主线' }
]

const ACCENT_COLOR: Record<string, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  info: 'var(--info)'
}

interface QuestsProps {
  onNavigate?: (page: PageId) => void
}

export default function Quests({ onNavigate }: QuestsProps) {
  const quests = useStore(s => s.quests)
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'main'>('daily')

  const list = quests.filter(q => q.category === activeTab)

  return (
    <div className="view active safe-top safe-bottom" style={{ padding: '0 16px 100px', overflowY: 'auto' }}>
      <header style={{ padding: '24px 0 16px' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600 }}>
          QUEST_CENTER
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 0' }}>任务中心</h1>
      </header>

      {/* 高考进度精简版 */}
      <div style={{ marginBottom: 20 }}>
        <GaokaoProgress mode="compact" />
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {CATEGORY_TABS.map(t => (
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

      {/* task list */}
      {list.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 14 }}>暂无{activeTab === 'daily' ? '日常' : activeTab === 'weekly' ? '周常' : '主线'}任务</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>与 AI 监管者对话添加任务</div>
        </div>
      ) : (
        list.map(q => {
          const pct = Math.min(100, (q.progress / q.total) * 100)
          const accent = ACCENT_COLOR[q.accent] || 'var(--info)'
          return (
            <div key={q.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: q.completed ? 'var(--success)' : accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0
                }}>
                  {q.completed ? '✓' : q.category[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{q.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{q.desc}</div>
                  <div style={{ fontSize: 12, color: accent, fontWeight: 600, marginTop: 4 }}>
                    +{q.reward} {q.rewardType}
                  </div>
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  color: q.completed ? 'var(--success)' : 'var(--muted)'
                }}>
                  {q.completed ? '完成' : `${q.progress}/${q.total}`}
                </div>
              </div>
              {!q.completed && q.progress < q.total && (
                <div className="achieve-progress" style={{ marginTop: 10 }}>
                  <div className="achieve-progress-bar" style={{ width: `${pct}%`, background: accent }} />
                </div>
              )}
            </div>
          )
        })
      )}

      <div style={{ height: 24 }} />
    </div>
  )
}
