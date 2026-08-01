import { useState } from 'react'
import { useStore, type PageId } from '@/stores/useStore'
import { CATEGORY_TABS } from '@/data/quests'
import { showToast } from '@/components/Toast'

const ACCENT_COLOR: Record<string, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  info: 'var(--info)'
}

interface Props {
  onNavigate?: (p: PageId) => void
}

export default function Quests({ onNavigate }: Props) {
  const [tab, setTab] = useState<'daily' | 'weekly' | 'main'>('daily')
  const quests = useStore(s => s.quests)
  const completeQuest = useStore(s => s.completeQuest)
  const points = useStore(s => s.points)

  const list = quests.filter(q => q.category === tab)

  return (
    <div className="safe-top" style={{ padding: '24px 20px 140px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
            QUEST_CENTER
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginBottom: 0 }}>
            任务中心
          </h1>
        </div>
        <button
          onClick={() => onNavigate?.('pointsDetail')}
          style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 100, padding: '6px 14px',
            display: 'flex', alignItems: 'center', gap: 4,
            cursor: 'pointer', color: 'var(--fg)'
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>{points}</span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>PTS ›</span>
        </button>
      </div>

      {/* tabs */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: 4,
        background: 'var(--bg-alt)',
        borderRadius: 100,
        marginBottom: 16
      }}>
        {CATEGORY_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 100,
              background: tab === t.id ? 'var(--fg)' : 'transparent',
              color: tab === t.id ? 'var(--bg)' : 'var(--muted)',
              border: 'none',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* task list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.length === 0 && (
          <div className="card" style={{
            padding: '32px 16px', borderRadius: 16,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>📋</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
              暂无任务
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
              去和监管者对话，让它给你布置任务
            </div>
          </div>
        )}
        {list.map(q => {
          const pct = Math.min(100, (q.progress / q.total) * 100)
          const accent = ACCENT_COLOR[q.accent]
          return (
            <div
              key={q.id}
              className="card"
              style={{
                padding: 16,
                borderRadius: 16,
                borderLeft: `3px solid ${accent}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{q.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{q.desc}</div>
                </div>
                <div style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: accent, marginLeft: 8, whiteSpace: 'nowrap' }}>
                  +{q.reward} {q.rewardType}
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 12
              }}>
                <div style={{
                  flex: 1, height: 4,
                  background: 'var(--bg-alt)',
                  borderRadius: 100, overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: q.completed ? 'var(--success)' : accent,
                    borderRadius: 100
                  }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', minWidth: 36, textAlign: 'right' }}>
                  {q.completed ? '完成' : `${q.progress}/${q.total}`}
                </div>
              </div>

              {!q.completed && q.progress < q.total && (
                <button
                  onClick={() => {
                    completeQuest(q.id)
                    showToast(`任务完成 +${q.reward}`)
                  }}
                  style={{
                    marginTop: 10, width: '100%',
                    padding: '8px',
                    borderRadius: 8,
                    background: 'var(--bg-alt)',
                    border: 'none',
                    color: 'var(--fg)',
                    fontSize: 12,
                    fontWeight: 500
                  }}
                >
                  完成
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
