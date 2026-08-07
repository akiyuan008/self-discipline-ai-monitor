import { useState, useMemo } from 'react'
import { useStore } from '@/stores/useStore'
import { useClassTaskStore } from '@/stores/classTaskStore'
import type { AbyssRecord } from '@/stores/classTaskStore'

interface Props {
  onBack: () => void
}

const DAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function Stats({ onBack }: Props) {
  const [view, setView] = useState<'day' | 'week' | 'month' | 'abyss' | 'heatmap'>('day')
  const theme = useStore(s => s.theme)
  const totalFocusMs = useStore(s => s.totalFocusMs)
  const todayStudyMs = useStore(s => s.todayStudyMs)
  const level = useStore(s => s.level)
  const exp = useStore(s => s.exp)
  const streak = useStore(s => s.streak)

  const taskHistory = useClassTaskStore(s => s.taskHistory)
  const abyssRecords = useClassTaskStore(s => s.abyssRecords)
  const verifyHistory = useClassTaskStore(s => s.verifyHistory)

  const isWandering = theme === 'wandering'

  // 按科目统计专注时长
  const subjectStats = useMemo(() => {
    const stats: Record<string, number> = {}
    taskHistory.forEach(day => {
      day.tasks.forEach(t => {
        if (t.status === 'completed') {
          stats[t.subject] = (stats[t.subject] || 0) + 1
        }
      })
    })
    return Object.entries(stats).sort((a, b) => b[1] - a[1])
  }, [taskHistory])

  // 深渊战绩
  const abyssStats = useMemo(() => {
    const total = abyssRecords.length
    const completed = abyssRecords.filter((r: AbyssRecord) => r.completed).length
    const failed = total - completed
    const totalDuration = abyssRecords.reduce((sum: number, r: AbyssRecord) => sum + r.duration, 0)
    return { total, completed, failed, totalDuration }
  }, [abyssRecords])

  // 热力图数据 - 最近30天
  const heatmapData = useMemo(() => {
    const data: Record<string, number> = {}
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      data[key] = 0
    }
    taskHistory.forEach(day => {
      const completed = day.tasks.filter(t => t.status === 'completed').length
      if (data[day.date] !== undefined) {
        data[day.date] = completed
      }
    })
    return data
  }, [taskHistory])

  const heatmapValues = Object.values(heatmapData).filter((v): v is number => typeof v === 'number')
  const heatmapMax = Math.max(1, ...heatmapValues)

  function getHeatColor(value: number) {
    if (value === 0) return 'rgba(255,255,255,0.03)'
    const intensity = value / heatmapMax
    if (intensity < 0.25) return 'rgba(255,69,0,0.2)'
    if (intensity < 0.5) return 'rgba(255,69,0,0.4)'
    if (intensity < 0.75) return 'rgba(255,69,0,0.6)'
    return 'rgba(255,69,0,0.9)'
  }

  const fmtTime = (ms: number) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 500, overflow: 'auto' }} className="safe-top safe-bottom animate-in">
      <div style={{ padding: '16px 16px 100px' }}>
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={onBack} style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--fg)'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'DM Mono, monospace' }}>
              {isWandering ? 'DATA CENTER' : 'STATISTICS'}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, fontFamily: isWandering ? 'Teko, sans-serif' : 'inherit', letterSpacing: isWandering ? 1 : 0 }}>
              {isWandering ? 'COMBAT RECORDS' : '数据统计'}
            </h1>
          </div>
        </div>

        {/* 视图切换 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
          {[
            { key: 'day', label: isWandering ? 'DAY' : '今日' },
            { key: 'week', label: isWandering ? 'WEEK' : '本周' },
            { key: 'month', label: isWandering ? 'MONTH' : '本月' },
            { key: 'abyss', label: isWandering ? 'ABYSS' : '深渊' },
            { key: 'heatmap', label: isWandering ? 'HEAT' : '热力' },
          ].map(t => (
            <button key={t.key} onClick={() => setView(t.key as any)} style={{
              padding: '6px 12px', fontSize: 11,
              background: view === t.key ? 'var(--accent-dim)' : 'transparent',
              border: view === t.key ? '1px solid var(--accent)' : '1px solid transparent',
              color: view === t.key ? 'var(--accent)' : 'var(--muted)',
              cursor: 'pointer', fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit',
              letterSpacing: 1,
              clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 总览数据 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            padding: '12px', position: 'relative',
            clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'
          }}>
            <div className="corner-deco tl" style={{ width: 8, height: 8, borderWidth: 1 }} />
            <div className="corner-deco tr" style={{ width: 8, height: 8, borderWidth: 1 }} />
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit' }}>TOTAL FOCUS</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)', fontFamily: 'Teko, sans-serif' }}>{fmtTime(totalFocusMs)}</div>
          </div>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            padding: '12px', position: 'relative',
            clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'
          }}>
            <div className="corner-deco tl" style={{ width: 8, height: 8, borderWidth: 1 }} />
            <div className="corner-deco tr" style={{ width: 8, height: 8, borderWidth: 1 }} />
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit' }}>TODAY</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#45a29e', fontFamily: 'Teko, sans-serif' }}>{fmtTime(todayStudyMs)}</div>
          </div>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            padding: '12px', position: 'relative',
            clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'
          }}>
            <div className="corner-deco tl" style={{ width: 8, height: 8, borderWidth: 1 }} />
            <div className="corner-deco tr" style={{ width: 8, height: 8, borderWidth: 1 }} />
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit' }}>LEVEL</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b', fontFamily: 'Teko, sans-serif' }}>LV.{level}</div>
          </div>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            padding: '12px', position: 'relative',
            clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'
          }}>
            <div className="corner-deco tl" style={{ width: 8, height: 8, borderWidth: 1 }} />
            <div className="corner-deco tr" style={{ width: 8, height: 8, borderWidth: 1 }} />
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit' }}>STREAK</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#ff4500', fontFamily: 'Teko, sans-serif' }}>{streak}D</div>
          </div>
        </div>

        {/* 科目统计 */}
        {view === 'day' && (
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            padding: '16px', marginBottom: 16, position: 'relative',
            clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
          }}>
            <div className="corner-deco tl" style={{ width: 10, height: 10, borderWidth: 1 }} />
            <div className="corner-deco tr" style={{ width: 10, height: 10, borderWidth: 1 }} />
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, fontFamily: isWandering ? 'Teko, sans-serif' : 'inherit', letterSpacing: 1 }}>
              {isWandering ? 'SUBJECT ANALYSIS' : '科目分析'}
            </div>
            {subjectStats.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, padding: '20px 0' }}>
                {isWandering ? 'NO DATA RECORDED' : '暂无数据'}
              </div>
            )}
            {subjectStats.map(([subject, count]) => {
              const max = subjectStats[0][1]
              return (
                <div key={subject} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit' }}>{subject}</span>
                    <span style={{ fontSize: 12, color: 'var(--success)', fontFamily: 'Teko, sans-serif' }}>{count} 节</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-alt)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${(count / max) * 100}%`, height: '100%',
                      background: 'linear-gradient(90deg, var(--success), #f59e0b)',
                      borderRadius: 3, transition: 'width 0.5s'
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 深渊战绩 */}
        {view === 'abyss' && (
          <div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16
            }}>
              <div style={{
                background: 'var(--card-bg)', border: '1px solid var(--border)',
                padding: '12px', textAlign: 'center',
                clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
              }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit' }}>TOTAL</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg)', fontFamily: 'Teko, sans-serif' }}>{abyssStats.total}</div>
              </div>
              <div style={{
                background: 'var(--card-bg)', border: '1px solid var(--border)',
                padding: '12px', textAlign: 'center',
                clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
              }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit' }}>SUCCESS</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#45a29e', fontFamily: 'Teko, sans-serif' }}>{abyssStats.completed}</div>
              </div>
              <div style={{
                background: 'var(--card-bg)', border: '1px solid var(--border)',
                padding: '12px', textAlign: 'center',
                clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
              }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit' }}>FAILED</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#ff4444', fontFamily: 'Teko, sans-serif' }}>{abyssStats.failed}</div>
              </div>
              <div style={{
                background: 'var(--card-bg)', border: '1px solid var(--border)',
                padding: '12px', textAlign: 'center',
                clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
              }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit' }}>DURATION</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b', fontFamily: 'Teko, sans-serif' }}>{fmtTime(abyssStats.totalDuration * 1000)}</div>
              </div>
            </div>

            {/* 深渊记录列表 */}
            <div style={{
              background: 'var(--card-bg)', border: '1px solid var(--border)',
              padding: '16px', position: 'relative',
              clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
            }}>
              <div className="corner-deco tl" style={{ width: 10, height: 10, borderWidth: 1 }} />
              <div className="corner-deco tr" style={{ width: 10, height: 10, borderWidth: 1 }} />
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, fontFamily: isWandering ? 'Teko, sans-serif' : 'inherit', letterSpacing: 1 }}>
                {isWandering ? 'MISSION LOGS' : '深渊记录'}
              </div>
              {abyssRecords.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, padding: '20px 0' }}>
                  {isWandering ? 'NO ABYSS RECORDS' : '暂无深渊记录'}
                </div>
              )}
              {[...abyssRecords].reverse().slice(0, 20).map((r, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{r.subject}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit' }}>
                      {r.date} // {Math.floor(r.duration / 60)}min
                    </div>
                  </div>
                  <div style={{
                    fontSize: 10, padding: '2px 8px',
                    background: r.completed ? 'rgba(69,162,158,0.1)' : 'rgba(255,68,68,0.1)',
                    color: r.completed ? '#45a29e' : '#ff4444',
                    border: `1px solid ${r.completed ? 'rgba(69,162,158,0.3)' : 'rgba(255,68,68,0.3)'}`,
                    fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit'
                  }}>
                    {r.completed ? 'SUCCESS' : 'FAILED'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 热力图 */}
        {view === 'heatmap' && (
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            padding: '16px', position: 'relative',
            clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
          }}>
            <div className="corner-deco tl" style={{ width: 10, height: 10, borderWidth: 1 }} />
            <div className="corner-deco tr" style={{ width: 10, height: 10, borderWidth: 1 }} />
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, fontFamily: isWandering ? 'Teko, sans-serif' : 'inherit', letterSpacing: 1 }}>
              {isWandering ? 'ACTIVITY HEATMAP' : '学习热力图'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'inherit' }}>
              LAST 30 DAYS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {Object.entries(heatmapData).map(([date, value]) => (
                <div key={date} style={{
                  aspectRatio: '1',
                  borderRadius: 2,
                  background: getHeatColor(value),
                  position: 'relative'
                }} title={`${date}: ${value} 节课`} />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>Less</span>
              {[0, 0.25, 0.5, 0.75, 1].map(v => (
                <div key={v} style={{ width: 12, height: 12, borderRadius: 2, background: getHeatColor(v * heatmapMax) }} />
              ))}
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>More</span>
            </div>
          </div>
        )}

        {/* 成就系统 */}
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          padding: '16px', marginTop: 16, position: 'relative',
          clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
        }}>
          <div className="corner-deco tl" style={{ width: 10, height: 10, borderWidth: 1 }} />
          <div className="corner-deco tr" style={{ width: 10, height: 10, borderWidth: 1 }} />
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, fontFamily: isWandering ? 'Teko, sans-serif' : 'inherit', letterSpacing: 1 }}>
            {isWandering ? 'MEDALS' : '成就勋章'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { id: 'physics', name: '物理达人', desc: '物理专注满10小时', check: () => (subjectStats.find(([s]) => s === '物理')?.[1] ?? 0) >= 10 },
              { id: 'early', name: '早起鸟', desc: '连续一周完成早八课程', check: () => streak >= 7 },
              { id: 'abyss30', name: '深渊行者', desc: '连续30天无失败记录', check: () => streak >= 30 },
              { id: 'focus100', name: '百小时专注', desc: '累计专注100小时', check: () => totalFocusMs >= 360000000 },
              { id: 'level10', name: '十级学者', desc: '等级达到10级', check: () => level >= 10 },
            ].map(medal => {
              const unlocked = medal.check()
              return (
                <div key={medal.id} style={{
                  width: 'calc(50% - 4px)', padding: '12px',
                  background: unlocked ? 'rgba(255,69,0,0.08)' : 'var(--bg-alt)',
                  border: `1px solid ${unlocked ? '#ff4500' : 'var(--border)'}`,
                  opacity: unlocked ? 1 : 0.5,
                  clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{unlocked ? '🏆' : '🔒'}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: unlocked ? '#ff4500' : 'var(--fg)' }}>{medal.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{medal.desc}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
