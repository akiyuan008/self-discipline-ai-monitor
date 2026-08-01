import { useEffect, useState } from 'react'
import { useStore, hpFromStudy } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { fetchUsageStats, hasUsageAccess, fmtMs, isLateNight } from '@/lib/usageStats'
import type { PageId } from '@/stores/useStore'

interface Props {
  onNavigate?: (p: PageId) => void
}

export default function Home({ onNavigate }: Props) {
  const hp = useStore(s => s.hp)
  const points = useStore(s => s.points)
  const streak = useStore(s => s.streak)
  const totalFocusMs = useStore(s => s.totalFocusMs)
  const dailyGoalMin = useStore(s => s.dailyGoalMin)
  const playerTag = useStore(s => s.playerTag)
  const todayStudyMs = useStore(s => s.todayStudyMs)
  const todayEntMs = useStore(s => s.todayEntMs)
  const setHp = useStore(s => s.setHp)
  const setDungeonDuration = useStore(s => s.setDungeonDuration)
  const dungeonDurationMin = useStore(s => s.dungeonDurationMin)

  const [entTop3, setEntTop3] = useState<{ label: string; ms: number }[]>([])
  const [hasAccess, setHasAccess] = useState(true)
  const [lateAlert, setLateAlert] = useState(false)

  useEffect(() => {
    hasUsageAccess().then(setHasAccess)
    refresh()
    if (isLateNight()) setLateAlert(true)
  }, [])

  async function refresh() {
    const now = Date.now()
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const { study, ent } = await fetchUsageStats(start.getTime(), now)
    useStore.getState().syncUsage(study, ent)
    const top = [...ent].sort((a, b) => b.totalMs - a.totalMs).slice(0, 3)
      .map(e => ({ label: e.label, ms: e.totalMs }))
    setEntTop3(top)
    const s = useStore.getState()
    // 仅在 HP 未被 AI 锁定时才根据学习时长自动设置
    if (!s.hpLocked) {
      setHp(hpFromStudy(s.todayStudyMs, s.dailyGoalMin * 60_000))
      useStore.setState({ hpLocked: false })
    }
  }

  const focusHours = Math.floor(totalFocusMs / 3600_000)
  const studyMin = Math.floor(todayStudyMs / 60_000)
  const entMin = Math.floor(todayEntMs / 60_000)
  const mainProgress = Math.min(100, Math.round((todayStudyMs / (dailyGoalMin * 60_000)) * 100))

  const circumference = 2 * Math.PI * 90
  const offset = circumference - (hp / 100) * circumference

  return (
    <div className="safe-top" style={{ padding: '24px 20px 140px' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--muted)' }}>
            CYBER_SURVIVAL · {playerTag}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>
            你已存活 <span style={{ color: 'var(--fg)' }}>{streak}</span> 天
          </div>
        </div>
        <button
          onClick={() => onNavigate?.('chat')}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--fg)'
          }}
          title="与监管者对话"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
      </div>

      {/* 深夜提醒 */}
      {lateAlert && (
        <div className="card" style={{
          padding: '12px 16px', borderRadius: 12, marginBottom: 16,
          background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)'
        }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#F59E0B' }}>
            深夜了，监管者注意到你还在熬夜
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            熬夜会扣 HP，明日状态会变差
          </div>
        </div>
      )}

      {/* 使用权限引导 */}
      {!hasAccess && (
        <div className="card" style={{
          padding: 14, borderRadius: 12, marginBottom: 16,
          background: 'rgba(229, 77, 46, 0.08)', border: '1px solid rgba(229, 77, 46, 0.2)'
        }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#E54D2E' }}>
            缺少使用情况访问权限
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, marginBottom: 10 }}>
            监管者需要此权限拉取真实学习/娱乐时长
          </div>
          <button
            onClick={async () => {
              const { openUsageAccessSettings } = await import('@/lib/usageStats')
              await openUsageAccessSettings()
              setTimeout(() => hasUsageAccess().then(setHasAccess), 2000)
            }}
            style={{
              padding: '6px 12px', borderRadius: 100,
              background: '#E54D2E', color: '#fff',
              border: 'none', fontSize: 11, fontWeight: 600
            }}
          >
            去授权
          </button>
        </div>
      )}

      {/* 精神力环 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 24, marginBottom: 24 }}>
        <div style={{ position: 'relative', width: 220, height: 220 }}>
          <svg width="220" height="220" viewBox="0 0 220 220">
            <circle cx="110" cy="110" r="90" stroke="var(--border)" strokeWidth="4" fill="none" />
            <circle
              cx="110" cy="110" r="90"
              stroke="var(--fg)" strokeWidth="4" fill="none"
              strokeLinecap="round"
              transform="rotate(-90 110 110)"
              style={{ strokeDasharray: circumference, strokeDashoffset: offset, transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ fontSize: 64, fontWeight: 300, letterSpacing: -2, lineHeight: 1 }}>{hp}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: 1, marginTop: 4 }}>
              HP / 100
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
              精神力
            </div>
          </div>
        </div>
      </div>

      {/* 今日数据 */}
      <div className="card" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>TODAY</span>
          <button onClick={refresh} style={{
            background: 'none', border: 'none', color: 'var(--muted)',
            fontSize: 11, cursor: 'pointer', padding: 0
          }}>↻ 刷新</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--success)', fontFamily: 'DM Mono, monospace' }}>学习</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{fmtMs(todayStudyMs)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--danger)', fontFamily: 'DM Mono, monospace' }}>娱乐</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{fmtMs(todayEntMs)}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
          目标 {dailyGoalMin} 分钟 · 达成 {Math.round(studyMin / dailyGoalMin * 100)}%
        </div>
      </div>

      {/* 娱乐黑洞 Top3 */}
      {entTop3.length > 0 && (
        <div className="card" style={{ padding: 14, borderRadius: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--danger)', fontFamily: 'DM Mono, monospace', marginBottom: 10 }}>
            ENTERTAINMENT_BLACK_HOLES
          </div>
          {entTop3.map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--danger)', color: '#fff', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, fontSize: 13 }}>{e.label}</div>
              <div style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--muted)' }}>
                {fmtMs(e.ms)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 主线进度 */}
      <div className="card" style={{ padding: 16, borderRadius: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>MAIN_QUEST</div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{mainProgress}%</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>
          每日学习目标 · {dailyGoalMin} 分钟
        </div>
        <div style={{ height: 6, background: 'var(--bg-alt)', borderRadius: 100, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${mainProgress}%`,
            background: 'var(--fg)', transition: 'width 0.5s ease'
          }} />
        </div>
      </div>

      {/* 番茄钟时长选择 */}
      <div className="card" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginBottom: 8 }}>
          DUNGEON_DURATION
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[5, 15, 25, 50].map(m => (
            <button
              key={m}
              onClick={() => setDungeonDuration(m)}
              style={{
                flex: 1, padding: '8px',
                borderRadius: 8,
                background: dungeonDurationMin === m ? 'var(--fg)' : 'var(--bg-alt)',
                color: dungeonDurationMin === m ? 'var(--bg)' : 'var(--muted)',
                border: 'none', fontSize: 12, fontWeight: 600
              }}
            >
              {m}min
            </button>
          ))}
        </div>
      </div>

      {/* 操作 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onNavigate?.('dungeon')}
          style={{
            flex: 2, padding: '14px',
            borderRadius: 12,
            background: 'var(--fg)',
            border: 'none',
            color: 'var(--bg)',
            fontSize: 14,
            fontWeight: 600
          }}
        >
          进入深渊 · {dungeonDurationMin}min
        </button>
      </div>

      {/* 状态摘要 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 16 }}>
        <Stat label="连胜" value={`${streak}`} suffix="DAYS" />
        <Stat label="积分" value={points.toString()} onClick={() => onNavigate?.('pointsDetail')} />
        <Stat label="总专注" value={`${focusHours}`} suffix="HOURS" />
      </div>
    </div>
  )
}

function Stat({ label, value, suffix, onClick }: { label: string; value: string; suffix?: string; onClick?: () => void }) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: 14, borderRadius: 12, textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative'
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 20, fontWeight: 500, marginTop: 4 }}>
        {value}
        {suffix && (
          <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 3, fontFamily: 'DM Mono, monospace' }}>
            {suffix}
          </span>
        )}
      </div>
      {onClick && (
        <div style={{
          position: 'absolute', top: 6, right: 8,
          fontSize: 10, color: 'var(--muted)', opacity: 0.5
        }}>›</div>
      )}
    </div>
  )
}
