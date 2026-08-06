import { useState } from 'react'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { getPeriodTime } from '@/data/schedule'

interface Props {
  onBack: () => void
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateStr === today) return '今天'
  if (dateStr === yesterday) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export default function ClassHistory({ onBack }: Props) {
  const taskHistory = useClassTaskStore(s => s.taskHistory)
  const verifyHistory = useClassTaskStore(s => s.verifyHistory)
  const monitorHistory = useClassTaskStore(s => s.monitorHistory)
  const [tab, setTab] = useState<'tasks' | 'verify' | 'monitor'>('tasks')

  const sortedHistory = [...taskHistory].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 500, overflow: 'auto' }} className="safe-top safe-bottom animate-in">
      <div style={{ padding: '16px 20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--fg)' }}>←</button>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>HISTORY</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>学习档案</h1>
          </div>
        </div>

        {/* Tab切换 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
          {[
            { key: 'tasks', label: '课程记录' },
            { key: 'verify', label: '打卡审查' },
            { key: 'monitor', label: '监测记录' }
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} style={{
              padding: '6px 14px', borderRadius: 100,
              background: tab === t.key ? 'var(--fg)' : 'transparent',
              color: tab === t.key ? 'var(--bg)' : 'var(--muted)',
              border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}>{t.label}</button>
          ))}
        </div>

        {/* 课程记录 */}
        {tab === 'tasks' && (
          <div>
            {sortedHistory.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>
                暂无课程记录，开始打卡吧！
              </div>
            )}
            {sortedHistory.map(day => (
              <div key={day.date} className="card" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(day.date)}</span>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    {day.fullAttendance && <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ 全勤</span>}
                    <span style={{ color: 'var(--success)' }}>+{day.totalReward}</span>
                    {day.totalPenalty > 0 && <span style={{ color: 'var(--danger)' }}>-{day.totalPenalty}</span>}
                  </div>
                </div>
                {day.tasks.map(task => {
                  const period = getPeriodTime(task.period)
                  const timeStr = period ? `${period.startTime}-${period.endTime}` : ''
                  return (
                    <div key={task.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 0', borderBottom: '1px solid var(--border)'
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: task.status === 'completed' ? 'rgba(22,163,74,0.1)' :
                          task.status === 'overdue' ? 'rgba(229,77,46,0.1)' : 'var(--bg-alt)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700,
                        color: task.status === 'completed' ? 'var(--success)' :
                          task.status === 'overdue' ? 'var(--danger)' : 'var(--muted)'
                      }}>{task.period}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>{task.subject}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{timeStr}</div>
                      </div>
                      <div style={{ fontSize: 11, color: task.status === 'completed' ? 'var(--success)' : 'var(--danger)' }}>
                        {task.status === 'completed' ? `+${task.baseReward + task.bonusReward}` :
                          task.status === 'overdue' ? `-${task.penalty}` :
                          task.status === 'absent' ? `-${task.penalty}` : '待完成'}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* 打卡审查 */}
        {tab === 'verify' && (
          <div>
            {verifyHistory.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>
                暂无打卡审查记录
              </div>
            )}
            {[...verifyHistory].reverse().map((v, i) => (
              <div key={i} className="card" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{v.subject}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: v.passed ? 'var(--success)' : 'var(--danger)'
                  }}>{v.score}分 {v.passed ? '通过' : '未通过'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg)', marginBottom: 6 }}>{v.aiReview}</div>
                {v.suggestion && <div style={{ fontSize: 11, color: 'var(--warning)' }}>建议：{v.suggestion}</div>}
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
                  {new Date(v.verifiedAt).toLocaleString('zh-CN')}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 监测记录 */}
        {tab === 'monitor' && (
          <div>
            {monitorHistory.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 14 }}>
                暂无使用监测记录
              </div>
            )}
            {[...monitorHistory].reverse().map((m, i) => (
              <div key={i} className="card" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(m.date)}</span>
                  {m.isPunished && <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>⚠ 被警告</span>}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--success)' }}>学习</div>
                    <div style={{ fontWeight: 600 }}>{Math.floor(m.studyMs / 60000)}分钟</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--danger)' }}>娱乐</div>
                    <div style={{ fontWeight: 600 }}>{Math.floor(m.entMs / 60000)}分钟</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--warning)' }}>警告</div>
                    <div style={{ fontWeight: 600 }}>{m.warningCount}次</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}