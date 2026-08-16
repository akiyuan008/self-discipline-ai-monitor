/**
 * src/components/growth/GrStats.tsx
 * Growth Mode Stats — 成长记录。温暖、中文为主的统计页。
 * 复用现有 store 数据（totalFocusMs, todayStudyMs, abyssRecords 等）。
 */
import { useState, useMemo } from 'react'
import { useStore } from '@/stores/useStore'
import { useClassTaskStore } from '@/stores/classTaskStore'
import type { AbyssRecord } from '@/stores/classTaskStore'
import Icon from '@/components/Icons'
import { localDateStr } from '@/lib/dateUtils'

interface Props { onBack: () => void }

const DAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function GrStats({ onBack }: Props) {
  const [view, setView] = useState<'day' | 'week' | 'month' | 'abyss' | 'heatmap'>('day')
  const totalFocusMs = useStore(s => s.totalFocusMs)
  const todayStudyMs = useStore(s => s.todayStudyMs)
  const level = useStore(s => s.level)
  const streak = useStore(s => s.streak)

  const taskHistory = useClassTaskStore(s => s.taskHistory)
  const abyssRecords = useClassTaskStore(s => s.abyssRecords)

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

  const abyssStats = useMemo(() => {
    const total = abyssRecords.length
    const completed = abyssRecords.filter((r: AbyssRecord) => r.completed).length
    const failed = total - completed
    const totalDuration = abyssRecords.reduce((sum: number, r: AbyssRecord) => sum + r.duration, 0)
    return { total, completed, failed, totalDuration }
  }, [abyssRecords])

  const heatmapData = useMemo(() => {
    const data: Record<string, number> = {}
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      data[localDateStr(d)] = 0
    }
    taskHistory.forEach(day => {
      const completed = day.tasks.filter(t => t.status === 'completed').length
      if (data[day.date] !== undefined) data[day.date] = completed
    })
    return data
  }, [taskHistory])

  const heatmapValues = Object.values(heatmapData).filter((v): v is number => typeof v === 'number')
  const heatmapMax = Math.max(1, ...heatmapValues)

  function getHeatColor(value: number) {
    if (value === 0) return 'var(--growth-surface-alt)'
    const intensity = value / heatmapMax
    if (intensity < 0.25) return 'rgba(124,108,171,0.2)'
    if (intensity < 0.5) return 'rgba(124,108,171,0.4)'
    if (intensity < 0.75) return 'rgba(124,108,171,0.6)'
    return 'rgba(124,108,171,0.9)'
  }

  const fmtTime = (ms: number) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h}小时${m}分`
  }

  return (
    <div className="gr-page">
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button onClick={onBack} style={{ width: 36, height: 36, background: 'var(--growth-surface)', border: '1px solid var(--growth-border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon.Back size={16} color="var(--growth-text)" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: 'var(--growth-text-secondary)', marginBottom: 2 }}>成长记录</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--growth-text)' }}>数据统计</div>
        </div>
      </div>

      {/* 视图切换 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid var(--growth-border)', paddingBottom: 8 }}>
        {[
          { key: 'day' as const, label: '今日' },
          { key: 'week' as const, label: '本周' },
          { key: 'month' as const, label: '本月' },
          { key: 'abyss' as const, label: '深渊' },
          { key: 'heatmap' as const, label: '热力' },
        ].map(t => (
          <button key={t.key} onClick={() => setView(t.key)} style={{
            padding: '6px 14px', fontSize: 12, cursor: 'pointer', borderRadius: 100,
            background: view === t.key ? 'var(--growth-primary)' : 'transparent',
            color: view === t.key ? '#fff' : 'var(--growth-text-secondary)', border: 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* 总览数据 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <div className="gr-card-alt" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>累计专注</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{fmtTime(totalFocusMs)}</div>
        </div>
        <div className="gr-card-alt" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>今日</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--growth-primary)' }}>{fmtTime(todayStudyMs)}</div>
        </div>
        <div className="gr-card-alt" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>等级</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--growth-warm)' }}>Lv.{level}</div>
        </div>
        <div className="gr-card-alt" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>连续打卡</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--growth-warm)' }}>{streak}天</div>
        </div>
      </div>

      {/* 科目统计 */}
      {view === 'day' && (
        <div className="gr-card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--growth-text)', marginBottom: 12 }}>科目分析</div>
          {subjectStats.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--growth-text-secondary)', fontSize: 12, padding: '20px 0' }}>暂无数据</div>
          )}
          {subjectStats.map(([subject, count]) => {
            const max = subjectStats[0][1]
            return (
              <div key={subject} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--growth-text)' }}>{subject}</span>
                  <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>{count} 节</span>
                </div>
                <div className="gr-progress">
                  <div className="gr-progress-fill" style={{ width: `${(count / max) * 100}%`, background: 'var(--growth-primary)' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 深渊战绩 */}
      {view === 'abyss' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <div className="gr-card-alt" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>总计</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--growth-text)' }}>{abyssStats.total}</div>
            </div>
            <div className="gr-card-alt" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>成功</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{abyssStats.completed}</div>
            </div>
            <div className="gr-card-alt" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>失败</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{abyssStats.failed}</div>
            </div>
            <div className="gr-card-alt" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>总时长</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--growth-warm)' }}>{fmtTime(abyssStats.totalDuration * 1000)}</div>
            </div>
          </div>
          <div className="gr-card">
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--growth-text)', marginBottom: 12 }}>深渊记录</div>
            {abyssRecords.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--growth-text-secondary)', fontSize: 12, padding: '20px 0' }}>暂无深渊记录</div>
            )}
            {[...abyssRecords].reverse().slice(0, 20).map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--growth-border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--growth-text)' }}>{r.subject}</div>
                  <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>{r.date} · {Math.floor(r.duration / 60)}分钟</div>
                </div>
                <div style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 100,
                  background: r.completed ? 'rgba(78,184,160,0.1)' : 'rgba(192,80,74,0.1)',
                  color: r.completed ? 'var(--success)' : 'var(--danger)',
                }}>
                  {r.completed ? '成功' : '失败'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 热力图 */}
      {view === 'heatmap' && (
        <div className="gr-card">
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--growth-text)', marginBottom: 12 }}>学习热力图</div>
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginBottom: 8 }}>最近 30 天</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {Object.entries(heatmapData).map(([date, value]) => (
              <div key={date} style={{ aspectRatio: '1', borderRadius: 4, background: getHeatColor(value) }} title={`${date}: ${value} 节课`} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>少</span>
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <div key={v} style={{ width: 12, height: 12, borderRadius: 3, background: getHeatColor(v * heatmapMax) }} />
            ))}
            <span style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>多</span>
          </div>
        </div>
      )}
    </div>
  )
}
