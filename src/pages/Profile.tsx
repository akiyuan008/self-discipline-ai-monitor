import { useState } from 'react'
import { useStore, calcGaokaoScore, daysUntilGaokao } from '@/stores/useStore'
import { useGaoKaoStore } from '@/stores/gaoKaoStore'
import GaokaoProgress from '@/components/GaokaoProgress'
import type { PageId } from '@/stores/useStore'

interface ProfileProps {
  onNavigate?: (page: PageId) => void
}

export default function Profile({ onNavigate }: ProfileProps) {
  const playerTag = useStore(s => s.playerTag)
  const streak = useStore(s => s.streak)
  const points = useStore(s => s.points)
  const totalFocusMs = useStore(s => s.totalFocusMs)
  const gaokaoDate = useStore(s => s.gaokaoDate)
  const gaokaoTargetScore = useStore(s => s.gaokaoTargetScore)

  const { profile, updateSubject, updateProfile } = useGaoKaoStore()
  const [editingSubject, setEditingSubject] = useState<string | null>(null)

  const days = daysUntilGaokao(gaokaoDate)
  const currentScore = calcGaokaoScore(useStore.getState())
  const scoreGap = gaokaoTargetScore - currentScore

  const focusHours = Math.floor(totalFocusMs / 3600000)

  return (
    <div className="view active safe-top safe-bottom" style={{ padding: '0 16px 100px', overflowY: 'auto' }}>
      {/* 头部 */}
      <header style={{ padding: '24px 0 16px' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600 }}>
          CANDIDATE_FILE · {playerTag}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 0' }}>{profile.nickname}</h1>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          目标：{profile.targetUniversity}
        </div>
      </header>

      {/* 高考倒计时 */}
      <div className="card" style={{ padding: 20, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 200, lineHeight: 1 }}>{days}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>天后高考</div>
      </div>

      {/* 分数对比 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>当前</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{profile.currentTotalScore}</div>
          </div>
          <div style={{ fontSize: 20, color: 'var(--muted)' }}>→</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>目标</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{profile.targetTotalScore}</div>
          </div>
        </div>
        <div style={{
          marginTop: 12, padding: '8px 14px', borderRadius: 10,
          textAlign: 'center', fontWeight: 600,
          background: scoreGap > 0 ? 'rgba(229,77,46,0.1)' : 'rgba(22,163,74,0.1)',
          color: scoreGap > 0 ? 'var(--danger)' : 'var(--success)',
          fontSize: 12
        }}>
          {scoreGap > 0 ? `差 ${scoreGap} 分` : '已达标'}
        </div>
      </div>

      {/* 快速统计 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <MiniStat label="连胜" value={`${streak} 天`} />
        <MiniStat label="积分" value={`${points}`} />
        <MiniStat label="专注" value={`${focusHours}h`} />
      </div>

      {/* 各科提分雷达 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600, marginBottom: 12 }}>
          SUBJECT_RADAR
        </div>
        {profile.subjects.map(sub => {
          const pct = Math.min(100, (sub.currentScore / sub.targetScore) * 100)
          const gap = sub.targetScore - sub.currentScore
          const isWeak = gap > sub.fullScore * 0.2 || sub.currentScore < sub.fullScore * 0.5

          return (
            <div key={sub.name} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{sub.name}</span>
                  {isWeak && (
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(229,77,46,0.1)', color: 'var(--danger)', fontWeight: 600
                    }}>
                      薄弱
                    </span>
                  )}
                </div>
                {editingSubject === sub.name ? (
                  <input
                    type="number"
                    defaultValue={sub.currentScore}
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
                  <div
                    onClick={() => setEditingSubject(sub.name)}
                    style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {sub.currentScore} / {sub.targetScore}
                  </div>
                )}
              </div>
              <div className="achieve-progress">
                <div className="achieve-progress-bar" style={{
                  width: `${pct}%`,
                  background: isWeak ? 'var(--danger)' : 'var(--success)'
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* 薄弱点 */}
      {profile.weakSubjects.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600, marginBottom: 12 }}>
            WEAK_POINTS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {profile.weakSubjects.map((w, i) => (
              <span key={i} style={{
                padding: '6px 12px', borderRadius: 100,
                background: 'rgba(229,77,46,0.08)',
                color: 'var(--danger)', fontSize: 12, fontWeight: 600
              }}>
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 高考进度精简版 */}
      <div style={{ marginBottom: 16 }}>
        <GaokaoProgress mode="compact" />
      </div>

      {/* 列表入口 */}
      <ListRow title="🏆 成就殿堂" desc="查看已解锁和进行中的成就" onClick={() => onNavigate?.('achievements')} />
      <ListRow title="⚙️ 设置" desc="AI 配置、备份、数据管理" onClick={() => onNavigate?.('settings')} />

      <div style={{ height: 24 }} />
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function ListRow({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: 16, marginBottom: 12, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer'
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ fontSize: 18, color: 'var(--muted)' }}>›</div>
    </div>
  )
}
