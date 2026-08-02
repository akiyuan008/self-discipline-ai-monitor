import { useEffect, useState, useMemo } from 'react'
import { useStore } from '@/stores/useStore'
import { fetchUsageStats, hasUsageAccess, openUsageAccessSettings, fmtMs, isLateNight } from '@/lib/usageStats'
import GaokaoProgress from '@/components/GaokaoProgress'
import type { PageId } from '@/stores/useStore'

interface HomeProps {
  onNavigate?: (page: PageId) => void
}

export default function Home({ onNavigate }: HomeProps) {
  const playerTag = useStore(s => s.playerTag)
  const streak = useStore(s => s.streak)
  const hp = useStore(s => s.hp)
  const dailyGoalMin = useStore(s => s.dailyGoalMin)
  const todayStudyMs = useStore(s => s.todayStudyMs)
  const todayEntMs = useStore(s => s.todayEntMs)
  const points = useStore(s => s.points)
  const dungeonDurationMin = useStore(s => s.dungeonDurationMin)
  const setDungeonDuration = useStore(s => s.setDungeonDuration)
  const setDungeon = useStore(s => s.setDungeon)

  const [lateAlert, setLateAlert] = useState(false)
  const [hasAccess, setHasAccess] = useState(true)
  const [entTop3, setEntTop3] = useState<{ label: string; ms: number }[]>([])

  const studyMin = Math.floor(todayStudyMs / 60000)
  const mainProgress = useMemo(() => {
    if (dailyGoalMin <= 0) return 0
    return Math.min(100, Math.round((studyMin / dailyGoalMin) * 100))
  }, [studyMin, dailyGoalMin])

  useEffect(() => {
    setLateAlert(isLateNight())
    hasUsageAccess().then(setHasAccess)

    const now = Date.now()
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    fetchUsageStats(start.getTime(), now)
      .then(({ ent }) => {
        const top = ent
          .sort((a, b) => b.totalMs - a.totalMs)
          .slice(0, 3)
          .map(e => ({ label: e.label, ms: e.totalMs }))
        setEntTop3(top)
      })
      .catch(() => setEntTop3([]))
  }, [])

  const handleStartDungeon = () => {
    setDungeon(dungeonDurationMin * 60, true)
    onNavigate?.('dungeon')
  }

  return (
    <div className="view active safe-top safe-bottom" style={{ padding: '0 16px 100px', overflowY: 'auto' }}>
      {/* 头部 */}
      <header style={{ padding: '24px 0 16px' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600 }}>
          CYBER_SURVIVAL · {playerTag}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
          你已存活 {streak} 天
        </div>
      </header>

      {/* 深夜提醒 */}
      {lateAlert && (
        <div
          className="card animate-in"
          style={{ padding: 16, marginBottom: 16, background: 'rgba(229,77,46,0.08)', borderColor: 'rgba(229,77,46,0.2)' }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)' }}>
            深夜了，继续保持专注会更稳
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            熬夜会扣 HP，明日状态会变差
          </div>
        </div>
      )}

      {/* 使用权限引导 */}
      {!hasAccess && (
        <div
          className="card animate-in"
          style={{ padding: 16, marginBottom: 16, cursor: 'pointer' }}
          onClick={() => openUsageAccessSettings()}
        >
          <div style={{ fontSize: 14, fontWeight: 600 }}>缺少使用情况访问权限</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            需要此权限来拉取真实学习/娱乐时长
          </div>
        </div>
      )}

      {/* 高考倒计时进度 */}
      <div style={{ marginBottom: 20 }}>
        <GaokaoProgress mode="full" />
      </div>

      {/* 精神力环 */}
      <div className="card" style={{ padding: 24, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
          <svg viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="70" cy="70" r="60" fill="none" stroke="var(--border)" strokeWidth="10" />
            <circle
              cx="70" cy="70" r="60" fill="none"
              stroke={hp > 50 ? 'var(--success)' : hp > 30 ? 'var(--warning)' : 'var(--danger)'}
              strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 60}`}
              strokeDashoffset={`${2 * Math.PI * 60 * (1 - hp / 100)}`}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{hp}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>HP / 100</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>精神力</div>
      </div>

      {/* 今日数据 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600, marginBottom: 12 }}>
          TODAY
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>学习</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{fmtMs(todayStudyMs)}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>娱乐</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, color: 'var(--danger)' }}>{fmtMs(todayEntMs)}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
          目标 {dailyGoalMin} 分钟 · 达成 {mainProgress}%
        </div>
        <div className="achieve-progress" style={{ marginTop: 8 }}>
          <div
            className="achieve-progress-bar"
            style={{ width: `${mainProgress}%`, background: 'var(--success)' }}
          />
        </div>
      </div>

      {/* 娱乐黑洞 Top3 */}
      {entTop3.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600, marginBottom: 12 }}>
            ENTERTAINMENT_BLACK_HOLES
          </div>
          {entTop3.map((e, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 0',
                borderBottom: i < entTop3.length - 1 ? '1px solid var(--border)' : 'none'
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--bg-alt)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, fontSize: 14 }}>{e.label}</div>
              <div style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>{fmtMs(e.ms)}</div>
            </div>
          ))}
        </div>
      )}

      {/* 主线进度 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
          MAIN_QUEST
        </div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{mainProgress}%</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          每日学习目标 · {dailyGoalMin} 分钟
        </div>
      </div>

      {/* 番茄钟时长选择 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600, marginBottom: 12 }}>
          DUNGEON_DURATION
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[5, 15, 25, 50].map(m => (
            <button
              key={m}
              onClick={() => setDungeonDuration(m)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                border: '1px solid var(--border)',
                background: dungeonDurationMin === m ? 'var(--fg)' : 'transparent',
                color: dungeonDurationMin === m ? 'var(--bg)' : 'var(--fg)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {/* 操作 */}
      <button
        onClick={handleStartDungeon}
        className="btn-primary"
        style={{ width: '100%', padding: 16, fontSize: 16, marginBottom: 16 }}
      >
        进入深渊
      </button>

      {/* 状态摘要 */}
      <Stat
        label="积分明细"
        value={`${points} PTS`}
        suffix="›"
        onClick={() => onNavigate?.('pointsDetail')}
      />

      <div style={{ height: 24 }} />
    </div>
  )
}

function Stat({ label, value, suffix, onClick }: {
  label: string
  value: string
  suffix?: string
  onClick?: () => void
}) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        marginBottom: 12
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, fontWeight: 600 }}>
          {label.toUpperCase()}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{value}</div>
      </div>
      {suffix && <div style={{ fontSize: 18, color: 'var(--muted)' }}>{suffix}</div>}
    </div>
  )
}
