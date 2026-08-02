import { useEffect, useState } from 'react'
import { useStore } from '@/stores/useStore'
import { fetchUsageStats, fmtMs } from '@/lib/usageStats'
import type { PageId } from '@/stores/useStore'

interface StatsProps {
  onNavigate?: (page: PageId) => void
}

export default function Stats({ onNavigate }: StatsProps) {
  const dailyGoalMin = useStore(s => s.dailyGoalMin)
  const [studyList, setStudyList] = useState<{ label: string; ms: number }[]>([])
  const [entList, setEntList] = useState<{ label: string; ms: number }[]>([])
  const [totalStudy, setTotalStudy] = useState(0)
  const [totalEnt, setTotalEnt] = useState(0)

  useEffect(() => {
    const now = Date.now()
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    fetchUsageStats(start.getTime(), now)
      .then(({ study, ent }) => {
        setStudyList(study.sort((a, b) => b.totalMs - a.totalMs).map(s => ({ label: s.label, ms: s.totalMs })))
        setEntList(ent.sort((a, b) => b.totalMs - a.totalMs).map(e => ({ label: e.label, ms: e.totalMs })))
        setTotalStudy(study.reduce((sum, s) => sum + s.totalMs, 0))
        setTotalEnt(ent.reduce((sum, e) => sum + e.totalMs, 0))
      })
      .catch(() => {
        setStudyList([])
        setEntList([])
      })
  }, [])

  const studyMin = Math.floor(totalStudy / 60000)
  const goalPercent = dailyGoalMin > 0 ? Math.min(100, Math.round((studyMin / dailyGoalMin) * 100)) : 0

  return (
    <div className="view active safe-top safe-bottom" style={{ padding: '0 16px 100px', overflowY: 'auto' }}>
      <header style={{ padding: '24px 0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => onNavigate?.('home')}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--fg)' }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600 }}>
            USAGE_STATS
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>今日使用统计</div>
        </div>
      </header>

      {/* 总览 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{fmtMs(totalStudy)}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>学习总时长</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--danger)' }}>{fmtMs(totalEnt)}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>娱乐总时长</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          目标 {dailyGoalMin} 分钟 · 达成 {goalPercent}%
        </div>
        <div className="achieve-progress" style={{ marginTop: 8 }}>
          <div className="achieve-progress-bar" style={{ width: `${goalPercent}%`, background: 'var(--success)' }} />
        </div>
      </div>

      {/* 学习榜单 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600, marginBottom: 12 }}>
          STUDY_TOP
        </div>
        {studyList.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
            暂无学习记录
          </div>
        ) : (
          studyList.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < studyList.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, fontSize: 14 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtMs(s.ms)}</div>
            </div>
          ))
        )}
      </div>

      {/* 娱乐榜单 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600, marginBottom: 12 }}>
          ENTERTAINMENT_TOP
        </div>
        {entList.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
            暂无娱乐记录
          </div>
        ) : (
          entList.map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < entList.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, fontSize: 14 }}>{e.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>{fmtMs(e.ms)}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ height: 24 }} />
    </div>
  )
}
