import { useState, useEffect } from 'react'
import { useGaoKaoStore } from '@/stores/gaoKaoStore'
import { useStore, daysUntilGaokao } from '@/stores/useStore'

interface Props {
  onBack: () => void
}

export default function Archive({ onBack }: Props) {
  const profile = useGaoKaoStore(s => s.profile)
  const updateSubject = useGaoKaoStore(s => s.updateSubject)
  const updateProfile = useGaoKaoStore(s => s.updateProfile)
  const syncToIndexedDB = useGaoKaoStore(s => s.syncToIndexedDB)

  const gaokaoDate = useStore(s => s.gaokaoDate)
  const streak = useStore(s => s.streak)
  const totalFocusMs = useStore(s => s.totalFocusMs)

  const [editingSubject, setEditingSubject] = useState<string | null>(null)

  const days = daysUntilGaokao(gaokaoDate)
  const scoreGap = profile.targetTotalScore - profile.currentTotalScore
  const focusHours = Math.floor(totalFocusMs / 3_600_000)

  // 启动时同步到 IndexedDB
  useEffect(() => {
    syncToIndexedDB()
  }, [])

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
        <Header onBack={onBack} title="高考档案馆" subtitle="CLASSIFIED_FILE" />

        {/* ═══ 板块1：绝密档案头 ═══ */}
        <div className="card" style={{
          padding: 20, borderRadius: 16, marginBottom: 16,
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, transparent 60%)',
            pointerEvents: 'none'
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', marginBottom: 16
            }}>
              <div>
                <div style={{
                  fontSize: 11, color: 'var(--muted)',
                  fontFamily: 'DM Mono, monospace', marginBottom: 4
                }}>
                  CANDIDATE_FILE
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {profile.nickname}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  目标：{profile.targetUniversity}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 32, fontWeight: 700, lineHeight: 1,
                  color: days <= 100 ? 'var(--danger)' : 'var(--fg)'
                }}>
                  {days}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>天后高考</div>
              </div>
            </div>

            {/* 分数对比 */}
            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 16,
              padding: '12px 0', borderTop: '1px solid var(--border)'
            }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>当前总分</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--fg)' }}>
                  {profile.currentTotalScore}
                </div>
              </div>
              <div style={{ fontSize: 20, color: 'var(--muted)', paddingBottom: 4 }}>→</div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>目标总分</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>
                  {profile.targetTotalScore}
                </div>
              </div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{
                  display: 'inline-block', padding: '4px 12px',
                  borderRadius: 100,
                  background: scoreGap > 0 ? 'rgba(229,77,46,0.1)' : 'rgba(22,163,74,0.1)',
                  color: scoreGap > 0 ? 'var(--danger)' : 'var(--success)',
                  fontSize: 13, fontWeight: 600
                }}>
                  {scoreGap > 0 ? `差 ${scoreGap} 分` : '已达标'}
                </div>
              </div>
            </div>

            {/* 快速统计 */}
            <div style={{
              display: 'flex', gap: 0,
              borderTop: '1px solid var(--border)',
              paddingTop: 10, marginTop: 4
            }}>
              <MiniStat label="连续专注" value={`${streak}天`} />
              <Divider />
              <MiniStat label="总学时" value={`${focusHours}h`} />
              <Divider />
              <MiniStat label="薄弱点" value={`${profile.weakSubjects.length}`} />
            </div>
          </div>
        </div>

        {/* ═══ 板块2：各科提分雷达 ═══ */}
        <Section title="各科提分雷达" subtitle="SUBJECT_RADAR">
          {profile.subjects.map(sub => {
            const pct = Math.min(100, (sub.currentScore / sub.targetScore) * 100)
            const gap = sub.targetScore - sub.currentScore
            const isWeak = gap > sub.fullScore * 0.2 || sub.currentScore < sub.fullScore * 0.5

            return (
              <div key={sub.name} className="card" style={{
                padding: 14, borderRadius: 12, marginBottom: 8,
                borderLeft: `3px solid ${isWeak ? 'var(--danger)' : 'var(--success)'}`
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{sub.name}</span>
                    {isWeak && (
                      <span style={{
                        padding: '2px 6px', borderRadius: 100,
                        background: 'rgba(229,77,46,0.1)',
                        color: 'var(--danger)', fontSize: 9, fontWeight: 600
                      }}>薄弱</span>
                    )}
                  </div>
                  {editingSubject === sub.name ? (
                    <input
                      type="number"
                      defaultValue={sub.currentScore}
                      max={sub.fullScore}
                      min={0}
                      onBlur={(e) => {
                        const val = Math.max(0, Math.min(sub.fullScore, Number(e.target.value) || 0))
                        updateSubject(sub.name, { currentScore: val })
                        const newSubjects = profile.subjects.map(s =>
                          s.name === sub.name ? { ...s, currentScore: val } : s
                        )
                        updateProfile({ currentTotalScore: newSubjects.reduce((sum, s) => sum + s.currentScore, 0) })
                        setEditingSubject(null)
                      }}
                      style={{
                        width: 60, padding: '4px 8px',
                        background: 'var(--bg)', color: 'var(--fg)',
                        border: '1px solid var(--border)',
                        borderRadius: 6, fontSize: 13,
                        outline: 'none', textAlign: 'right'
                      }}
                      autoFocus
                    />
                  ) : (
                    <div style={{
                      fontSize: 13, fontFamily: 'DM Mono, monospace',
                      cursor: 'pointer',
                      color: isWeak ? 'var(--danger)' : 'var(--fg)'
                    }} onClick={() => setEditingSubject(sub.name)}>
                      {sub.currentScore} / {sub.targetScore}
                    </div>
                  )}
                </div>
                <div style={{
                  height: 6, background: 'var(--bg-alt)',
                  borderRadius: 100, overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: isWeak
                      ? 'linear-gradient(90deg, #E54D2E, #F59E0B)'
                      : 'linear-gradient(90deg, #16A34A, #3B82F6)',
                    borderRadius: 100, transition: 'width 0.5s'
                  }} />
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 10, color: 'var(--muted)', marginTop: 4
                }}>
                  <span>{Math.round(pct)}%</span>
                  <span>{gap > 0 ? `提分空间 ${gap} 分` : '已达标'}</span>
                </div>
              </div>
            )
          })}
        </Section>

        {/* ═══ 板块3：薄弱点 ═══ */}
        <Section title="薄弱点" subtitle="WEAK_POINTS">
          <div className="card" style={{ padding: 14, borderRadius: 12 }}>
            {profile.weakSubjects.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {profile.weakSubjects.map((w, i) => (
                  <span key={i} style={{
                    padding: '6px 14px', borderRadius: 100,
                    background: 'rgba(229,77,46,0.08)',
                    color: 'var(--danger)',
                    fontSize: 12, fontWeight: 500
                  }}>{w}</span>
                ))}
              </div>
            ) : (
              <div style={{
                padding: 20, textAlign: 'center',
                fontSize: 12, color: 'var(--muted)'
              }}>
                暂无薄弱点，继续保持
              </div>
            )}
          </div>
        </Section>

        <div style={{
          textAlign: 'center', padding: '16px 0',
          fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace'
        }}>
          ARCHIVE · IndexedDB Persisted<br />
          数据已同步至本地数据库
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 子组件
// ═══════════════════════════════════════════════════════════

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8,
        marginBottom: 8, paddingLeft: 4
      }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        <div style={{
          fontSize: 10, color: 'var(--muted)',
          fontFamily: 'DM Mono, monospace'
        }}>{subtitle}</div>
      </div>
      {children}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, background: 'var(--border)' }} />
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
