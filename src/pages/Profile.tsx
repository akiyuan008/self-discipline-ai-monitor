import { useState } from 'react'
import { useStore, daysUntilGaokao } from '@/stores/useStore'
import { useGaoKaoStore } from '@/stores/gaoKaoStore'

interface ProfileProps {
  onNavigate?: (page: 'achievements' | 'settings' | 'chat') => void
}

export default function Profile({ onNavigate }: ProfileProps) {
  const playerTag = useStore(s => s.playerTag)
  const streak = useStore(s => s.streak)
  const points = useStore(s => s.points)
  const gaokaoDate = useStore(s => s.gaokaoDate)

  const profile = useGaoKaoStore(s => s.profile)
  const updateSubject = useGaoKaoStore(s => s.updateSubject)
  const updateProfile = useGaoKaoStore(s => s.updateProfile)

  const [editingSubject, setEditingSubject] = useState<string | null>(null)

  const days = daysUntilGaokao(gaokaoDate)
  const scoreGap = profile.targetTotalScore - profile.currentTotalScore
  const syncRate = Math.min(100, Math.round(streak * 5))

  return (
    <div className="safe-top" style={{ padding: '24px 20px 140px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
        PROFILE
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 16 }}>
        个人中心
      </h1>

      {/* 学习档案入口（含薄弱点摘要） */}
      <div className="card" style={{ padding: 14, borderRadius: 16, marginBottom: 8, cursor: 'pointer' }}
        onClick={() => onNavigate?.('classHistory' as any)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>学习档案</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>课程记录、打卡审查、薄弱项分析</div>
          </div>
          <div style={{ fontSize: 18, color: 'var(--muted)' }}>›</div>
        </div>
        {profile.weakSubjects.length > 0 && (
          <div style={{
            marginTop: 10, paddingTop: 10,
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: 10, color: 'var(--danger)', fontFamily: 'DM Mono, monospace' }}>WEAK</span>
            {profile.weakSubjects.map((w, i) => (
              <span key={i} style={{
                padding: '2px 8px', borderRadius: 100,
                background: 'rgba(229,77,46,0.08)',
                color: 'var(--danger)',
                fontSize: 10, fontWeight: 500
              }}>{w}</span>
            ))}
          </div>
        )}
      </div>

      {/* ═══ 档案馆内容提上来：绝密档案头 ═══ */}
      <div className="card" style={{
        padding: 20, borderRadius: 16, marginBottom: 12,
        position: 'relative'
      }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', marginBottom: 12
          }}>
            <div>
              <div style={{
                fontSize: 11, color: 'var(--muted)',
                fontFamily: 'DM Mono, monospace', marginBottom: 4
              }}>
                CANDIDATE_FILE · {playerTag}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {profile.nickname}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                目标：{profile.targetUniversity}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 28, fontWeight: 700, lineHeight: 1,
                color: days <= 100 ? 'var(--danger)' : 'var(--fg)'
              }}>
                {days}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>天后高考</div>
            </div>
          </div>

          {/* 分数对比 */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 12,
            padding: '10px 0', borderTop: '1px solid var(--border)'
          }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>当前</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)' }}>
                {profile.currentTotalScore}
              </div>
            </div>
            <div style={{ fontSize: 16, color: 'var(--muted)', paddingBottom: 2 }}>→</div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>目标</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>
                {profile.targetTotalScore}
              </div>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{
                display: 'inline-block', padding: '3px 10px',
                borderRadius: 100,
                background: scoreGap > 0 ? 'rgba(229,77,46,0.1)' : 'rgba(22,163,74,0.1)',
                color: scoreGap > 0 ? 'var(--danger)' : 'var(--success)',
                fontSize: 12, fontWeight: 600
              }}>
                {scoreGap > 0 ? `差 ${scoreGap} 分` : '已达标'}
              </div>
            </div>
          </div>

          {/* 快速统计 */}
          <div style={{
            display: 'flex', gap: 0,
            borderTop: '1px solid var(--border)',
            paddingTop: 8, marginTop: 4
          }}>
            <MiniStat label="连签" value={`${streak}天`} />
            <MiniStat label="积分" value={`${points}`} />
            <Divider />
            
            <Divider />
            <MiniStat label="同步率" value={`${syncRate}%`} />
          </div>
        </div>
      </div>

      {/* ═══ 各科提分雷达 ═══ */}
      <div style={{ marginBottom: 8, paddingLeft: 4 }}>
        <div style={{
          fontSize: 11, color: 'var(--muted)',
          fontFamily: 'DM Mono, monospace', marginBottom: 8
        }}>
          SUBJECT_RADAR
        </div>
      </div>
      {profile.subjects.map(sub => {
        const pct = Math.min(100, (sub.currentScore / sub.targetScore) * 100)
        const gap = sub.targetScore - sub.currentScore
        const isWeak = gap > sub.fullScore * 0.2 || sub.currentScore < sub.fullScore * 0.5

        return (
          <div key={sub.name} className="card" style={{
            padding: 12, borderRadius: 12, marginBottom: 6,
            borderLeft: `3px solid ${isWeak ? 'var(--danger)' : 'var(--success)'}`
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 6
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{sub.name}</span>
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
                  onPaste={() => { /* defaultValue 不需要同步 */ }}
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
                  fontSize: 12, fontFamily: 'DM Mono, monospace',
                  cursor: 'pointer',
                  color: isWeak ? 'var(--danger)' : 'var(--fg)'
                }} onClick={() => setEditingSubject(sub.name)}>
                  {sub.currentScore} / {sub.fullScore}
                </div>
              )}
            </div>
            <div style={{
              height: 5, background: 'var(--bg-alt)',
              borderRadius: 100, overflow: 'hidden'
            }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: isWeak
                  ? 'var(--danger)'
                  : 'var(--success)',
                borderRadius: 100, transition: 'width 0.5s'
              }} />
            </div>
          </div>
        )
      })}

      {/* 列表 */}
      <ListRow
        title="成就殿堂"
        desc="成就与里程碑"
        onClick={() => onNavigate?.('achievements')}
      />
      <ListRow
        title="系统设置"
        desc="深色模式、AI 配置、备份、关于"
        onClick={() => onNavigate?.('settings')}
      />
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, background: 'var(--border)' }} />
}

function ListRow({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '14px 16px',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        marginBottom: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        textAlign: 'left'
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{desc}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}
