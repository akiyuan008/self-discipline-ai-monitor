import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import { useGaoKaoStore } from '@/stores/gaoKaoStore'
import { ACHIEVEMENT_TABS } from '@/data/achievements'
import { showToast } from '@/components/Toast'

interface Props {
  onBack: () => void
}

export default function Achievements({ onBack }: Props) {
  const [tab, setTab] = useState<'all' | 'unlocked' | 'locked'>('all')
  const achievements = useStore(s => s.achievements)
  const streak = useStore(s => s.streak)
  const totalFocusMs = useStore(s => s.totalFocusMs)

  const milestones = useGaoKaoStore(s => s.profile.milestones)
  const addMilestone = useGaoKaoStore(s => s.addMilestone)

  const focusHours = Math.floor(totalFocusMs / 3_600_000)

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
          padding: '12px 16px', borderRadius: 12, marginBottom: 12,
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
                padding: 14, borderRadius: 12,
                display: 'flex', gap: 12, alignItems: 'center',
                opacity: a.unlocked ? 1 : 0.7
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
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

        {/* ═══ 备考里程碑（从档案馆合并） ═══ */}
        <div style={{ marginTop: 24, marginBottom: 8, paddingLeft: 4 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8
          }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>备考里程碑</div>
            <div style={{
              fontSize: 10, color: 'var(--muted)',
              fontFamily: 'DM Mono, monospace'
            }}>MILESTONES</div>
          </div>
        </div>
        <div className="card" style={{ padding: 14, borderRadius: 12 }}>
          {milestones.length === 0 ? (
            <div style={{
              padding: 20, textAlign: 'center',
              fontSize: 12, color: 'var(--muted)'
            }}>
              暂无里程碑记录
            </div>
          ) : (
            milestones.map((m, i) => (
              <div key={m.id} style={{
                display: 'flex', gap: 12,
                paddingBottom: i < milestones.length - 1 ? 16 : 0,
                position: 'relative'
              }}>
                {/* 时间线 */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center'
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: m.type === 'scoreUp' ? 'var(--success)'
                      : m.type === 'errorClear' ? 'var(--info)'
                      : m.type === 'streak' ? '#F59E0B'
                      : 'var(--fg)',
                    flexShrink: 0, marginTop: 3
                  }} />
                  {i < milestones.length - 1 && (
                    <div style={{
                      width: 2, flex: 1, background: 'var(--border)', marginTop: 2
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, paddingBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {m.desc}
                  </div>
                  <div style={{
                    fontSize: 10, color: 'var(--muted)',
                    fontFamily: 'DM Mono, monospace', marginTop: 4
                  }}>
                    {new Date(m.ts).toLocaleString('zh-CN', { hour12: false })}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* 快速添加里程碑 */}
          <button
            onClick={() => {
              addMilestone({
                title: `连续专注 ${streak} 天`,
                desc: `总学习时长 ${focusHours} 小时`,
                type: 'streak'
              })
              showToast('里程碑已记录')
            }}
            style={{
              width: '100%', marginTop: 8,
              padding: '10px', borderRadius: 8,
              background: 'var(--bg-alt)', border: '1px dashed var(--border)',
              color: 'var(--muted)', fontSize: 12,
              cursor: 'pointer'
            }}
          >
            + 记录当前进度为里程碑
          </button>
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
