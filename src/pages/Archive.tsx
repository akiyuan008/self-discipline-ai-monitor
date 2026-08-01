import { useState, useEffect } from 'react'
import { useGaoKaoStore, type SubjectScore } from '@/stores/gaoKaoStore'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { daysUntilGaokao } from '@/stores/useStore'

interface Props {
  onBack: () => void
}

export default function Archive({ onBack }: Props) {
  const profile = useGaoKaoStore(s => s.profile)
  const updateProfile = useGaoKaoStore(s => s.updateProfile)
  const updateSubject = useGaoKaoStore(s => s.updateSubject)
  const addErrorQuestion = useGaoKaoStore(s => s.addErrorQuestion)
  const resolveErrorQuestion = useGaoKaoStore(s => s.resolveErrorQuestion)
  const removeErrorQuestion = useGaoKaoStore(s => s.removeErrorQuestion)
  const generateWeeklyPlan = useGaoKaoStore(s => s.generateWeeklyPlan)
  const togglePlanTask = useGaoKaoStore(s => s.togglePlanTask)
  const addMilestone = useGaoKaoStore(s => s.addMilestone)
  const syncToIndexedDB = useGaoKaoStore(s => s.syncToIndexedDB)

  const gaokaoDate = useStore(s => s.gaokaoDate)
  const streak = useStore(s => s.streak)
  const totalFocusMs = useStore(s => s.totalFocusMs)

  const [editingSubject, setEditingSubject] = useState<string | null>(null)
  const [showAddError, setShowAddError] = useState(false)

  const days = daysUntilGaokao(gaokaoDate)
  const scoreGap = profile.targetTotalScore - profile.currentTotalScore
  const focusHours = Math.floor(totalFocusMs / 3_600_000)

  // 启动时同步到 IndexedDB
  useEffect(() => {
    syncToIndexedDB()
  }, [])

  // 计算错题标签分布
  const tagDistribution: Record<string, number> = {}
  for (const q of profile.errorQuestions.filter(q => !q.resolved)) {
    tagDistribution[q.tag] = (tagDistribution[q.tag] || 0) + 1
  }
  const sortedTags = Object.entries(tagDistribution).sort((a, b) => b[1] - a[1])
  const maxTagCount = sortedTags[0]?.[1] || 1

  // 计划完成率
  const planTotal = profile.generatedPlan.length
  const planDone = profile.generatedPlan.filter(t => t.completed).length
  const planPct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0

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
              <MiniStat label="错题" value={`${profile.errorQuestions.filter(q => !q.resolved).length}`} />
              <Divider />
              <MiniStat label="里程碑" value={`${profile.milestones.length}`} />
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
                        // 重算总分
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

        {/* ═══ 板块3：错题与薄弱点分析 ═══ */}
        <Section title="错题与薄弱点" subtitle="ERROR_ANALYSIS">
          {/* 薄弱科目清单 */}
          {profile.weakSubjects.length > 0 && (
            <div className="card" style={{ padding: 14, borderRadius: 12, marginBottom: 8 }}>
              <div style={{
                fontSize: 11, color: 'var(--danger)',
                fontFamily: 'DM Mono, monospace', marginBottom: 8
              }}>
                WEAK_POINTS
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {profile.weakSubjects.map((w, i) => (
                  <span key={i} style={{
                    padding: '4px 10px', borderRadius: 100,
                    background: 'rgba(229,77,46,0.08)',
                    color: 'var(--danger)',
                    fontSize: 11, fontWeight: 500
                  }}>{w}</span>
                ))}
              </div>
            </div>
          )}

          {/* 错题标签分布 */}
          {sortedTags.length > 0 && (
            <div className="card" style={{ padding: 14, borderRadius: 12, marginBottom: 8 }}>
              <div style={{
                fontSize: 11, color: 'var(--muted)',
                fontFamily: 'DM Mono, monospace', marginBottom: 10
              }}>
                TAG_DISTRIBUTION
              </div>
              {sortedTags.slice(0, 8).map(([tag, count]) => (
                <div key={tag} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 6
                }}>
                  <div style={{
                    fontSize: 12, minWidth: 80,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>{tag}</div>
                  <div style={{
                    flex: 1, height: 8, background: 'var(--bg-alt)',
                    borderRadius: 100, overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${(count / maxTagCount) * 100}%`,
                      background: 'var(--danger)',
                      borderRadius: 100, transition: 'width 0.5s'
                    }} />
                  </div>
                  <div style={{
                    fontSize: 11, fontFamily: 'DM Mono, monospace',
                    color: 'var(--muted)', minWidth: 24, textAlign: 'right'
                  }}>{count}</div>
                </div>
              ))}
            </div>
          )}

          {/* 错题列表 */}
          <div className="card" style={{ padding: 14, borderRadius: 12, marginBottom: 8 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 10
            }}>
              <div style={{
                fontSize: 11, color: 'var(--muted)',
                fontFamily: 'DM Mono, monospace'
              }}>
                ERROR_LOG ({profile.errorQuestions.filter(q => !q.resolved).length})
              </div>
              <button
                onClick={() => setShowAddError(!showAddError)}
                style={{
                  padding: '4px 10px', borderRadius: 100,
                  background: 'var(--bg-alt)', border: 'none',
                  fontSize: 11, color: 'var(--fg)', cursor: 'pointer'
                }}
              >+ 添加</button>
            </div>

            {showAddError && (
              <AddErrorForm onAdd={(subject, tag, desc) => {
                addErrorQuestion({ subject, tag, desc })
                showToast('错题已记录')
                setShowAddError(false)
              }} />
            )}

            {profile.errorQuestions.filter(q => !q.resolved).length === 0 ? (
              <div style={{
                padding: 20, textAlign: 'center',
                fontSize: 12, color: 'var(--muted)'
              }}>
                暂无未解决错题，继续保持
              </div>
            ) : (
              profile.errorQuestions.filter(q => !q.resolved).slice(0, 10).map(q => (
                <div key={q.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 0', borderBottom: '1px solid var(--border)'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      <span style={{ color: 'var(--danger)' }}>[{q.subject}]</span> {q.desc}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {q.tag} · {new Date(q.ts).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <button
                    onClick={() => { resolveErrorQuestion(q.id); showToast('已标记解决') }}
                    style={{
                      padding: '4px 8px', borderRadius: 6,
                      background: 'rgba(22,163,74,0.1)',
                      color: 'var(--success)', border: 'none',
                      fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap'
                    }}
                  >解决</button>
                  <button
                    onClick={() => removeErrorQuestion(q.id)}
                    style={{
                      padding: '4px 8px', borderRadius: 6,
                      background: 'var(--bg-alt)',
                      color: 'var(--muted)', border: 'none',
                      fontSize: 10, cursor: 'pointer'
                    }}
                  >删除</button>
                </div>
              ))
            )}
          </div>
        </Section>

        {/* ═══ 板块4：本周复习计划 ═══ */}
        <Section title="本周复习计划" subtitle="WEEKLY_PLAN">
          <div className="card" style={{ padding: 14, borderRadius: 12 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 12
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  完成率 {planPct}%
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                  {planDone} / {planTotal} 项任务
                </div>
              </div>
              <button
                onClick={() => { generateWeeklyPlan(); showToast('已生成复习计划') }}
                style={{
                  padding: '6px 14px', borderRadius: 100,
                  background: 'var(--fg)', color: 'var(--bg)',
                  border: 'none', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer'
                }}
              >生成计划</button>
            </div>

            {/* 进度条 */}
            <div style={{
              height: 4, background: 'var(--bg-alt)',
              borderRadius: 100, overflow: 'hidden', marginBottom: 12
            }}>
              <div style={{
                height: '100%', width: `${planPct}%`,
                background: 'var(--success)', borderRadius: 100,
                transition: 'width 0.5s'
              }} />
            </div>

            {profile.generatedPlan.length === 0 ? (
              <div style={{
                padding: 20, textAlign: 'center',
                fontSize: 12, color: 'var(--muted)'
              }}>
                点击「生成计划」基于薄弱科目和错题自动生成
              </div>
            ) : (
              profile.generatedPlan.map(task => (
                <div key={task.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 0', borderBottom: '1px solid var(--border)'
                }}>
                  <button
                    onClick={() => togglePlanTask(task.id)}
                    style={{
                      width: 20, height: 20, borderRadius: 6,
                      border: task.completed ? 'none' : '2px solid var(--border)',
                      background: task.completed ? 'var(--success)' : 'transparent',
                      cursor: 'pointer', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 12
                    }}
                  >
                    {task.completed && '✓'}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 500,
                      textDecoration: task.completed ? 'line-through' : 'none',
                      opacity: task.completed ? 0.5 : 1
                    }}>
                      {task.content}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {task.subject} · {task.estimatedMinutes}分钟
                    </div>
                  </div>
                  <span style={{
                    padding: '2px 6px', borderRadius: 100,
                    background: task.priority === 'high'
                      ? 'rgba(229,77,46,0.1)'
                      : task.priority === 'medium'
                        ? 'rgba(245,158,11,0.1)'
                        : 'var(--bg-alt)',
                    color: task.priority === 'high'
                      ? 'var(--danger)'
                      : task.priority === 'medium'
                        ? '#F59E0B'
                        : 'var(--muted)',
                    fontSize: 9, fontWeight: 600
                  }}>
                    {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                  </span>
                </div>
              ))
            )}
          </div>
        </Section>

        {/* ═══ 板块5：备考里程碑 ═══ */}
        <Section title="备考里程碑" subtitle="MILESTONES">
          <div className="card" style={{ padding: 14, borderRadius: 12 }}>
            {profile.milestones.length === 0 ? (
              <div style={{
                padding: 20, textAlign: 'center',
                fontSize: 12, color: 'var(--muted)'
              }}>
                暂无里程碑记录
              </div>
            ) : (
              profile.milestones.map((m, i) => (
                <div key={m.id} style={{
                  display: 'flex', gap: 12,
                  paddingBottom: i < profile.milestones.length - 1 ? 16 : 0,
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
                    {i < profile.milestones.length - 1 && (
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

function AddErrorForm({ onAdd }: { onAdd: (subject: string, tag: string, desc: string) => void }) {
  const [subject, setSubject] = useState('数学')
  const [tag, setTag] = useState('')
  const [desc, setDesc] = useState('')

  return (
    <div style={{
      padding: 12, marginBottom: 10,
      background: 'var(--bg-alt)', borderRadius: 8
    }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <select
          value={subject}
          onChange={e => setSubject(e.target.value)}
          style={{
            padding: '6px 8px', borderRadius: 6,
            background: 'var(--bg)', color: 'var(--fg)',
            border: '1px solid var(--border)', fontSize: 12
          }}
        >
          {['语文', '数学', '英语', '物理', '化学', '生物'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          value={tag}
          onChange={e => setTag(e.target.value)}
          placeholder="知识点标签，如 函数图像"
          style={{
            flex: 1, padding: '6px 8px', borderRadius: 6,
            background: 'var(--bg)', color: 'var(--fg)',
            border: '1px solid var(--border)', fontSize: 12, outline: 'none'
          }}
        />
      </div>
      <input
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="错题描述"
        style={{
          width: '100%', padding: '6px 8px', borderRadius: 6,
          background: 'var(--bg)', color: 'var(--fg)',
          border: '1px solid var(--border)', fontSize: 12, outline: 'none',
          marginBottom: 8, boxSizing: 'border-box'
        }}
      />
      <button
        onClick={() => {
          if (tag.trim() && desc.trim()) {
            onAdd(subject, tag.trim(), desc.trim())
          }
        }}
        style={{
          width: '100%', padding: '8px', borderRadius: 6,
          background: 'var(--fg)', color: 'var(--bg)',
          border: 'none', fontSize: 12, fontWeight: 600,
          cursor: 'pointer'
        }}
      >确认添加</button>
    </div>
  )
}

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
