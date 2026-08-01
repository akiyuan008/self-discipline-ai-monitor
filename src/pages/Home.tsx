import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import type { PageId } from '@/stores/useStore'

interface Props {
  onNavigate?: (p: PageId) => void
}

export default function Home({ onNavigate }: Props) {
  const hp = useStore(s => s.hp)
  const points = useStore(s => s.points)
  const streak = useStore(s => s.streak)
  const totalFocusMs = useStore(s => s.totalFocusMs)
  const setHp = useStore(s => s.setHp)
  const addPoints = useStore(s => s.addPoints)
  const dailyGoalMin = useStore(s => s.dailyGoalMin)
  const playerTag = useStore(s => s.playerTag)

  const focusHours = Math.floor(totalFocusMs / 3600_000)
  // 主线进度：今日专注 / 目标（mock 当前 45%）
  const mainProgress = 45

  const circumference = 2 * Math.PI * 90
  const offset = circumference - (hp / 100) * circumference

  return (
    <div className="safe-top" style={{ padding: '24px 20px 140px' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--muted)' }}>
            STATUS // ACTIVE
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
            {playerTag}
          </div>
        </div>
        <div style={{
          padding: '6px 12px',
          borderRadius: 100,
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          fontSize: 12,
          fontFamily: 'DM Mono, monospace'
        }}>
          DAY_{(streak + 1).toString().padStart(2, '0')}
        </div>
      </div>

      {/* 精神力环 */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0 24px' }}>
        <div style={{ position: 'relative', width: 220, height: 220 }}>
          <svg width="220" height="220" viewBox="0 0 220 220">
            <circle cx="110" cy="110" r="90" fill="none" stroke="var(--border)" strokeWidth="2" />
            <circle
              cx="110" cy="110" r="90"
              fill="none"
              stroke={hp > 50 ? 'var(--success)' : hp > 20 ? 'var(--warning)' : 'var(--danger)'}
              strokeWidth="2"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 110 110)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ fontSize: 64, fontWeight: 300, letterSpacing: -2, lineHeight: 1 }}>
              {hp}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: 4 }}>
              SPIRIT_POWER
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              今日目标 {dailyGoalMin}m · 已 {Math.floor(totalFocusMs / 60_000)}m
            </div>
          </div>
        </div>
      </div>

      {/* 主线任务 */}
      <div
        className="card"
        style={{
          padding: 20,
          borderRadius: 16,
          marginBottom: 12
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>主线任务</div>
          <div style={{ fontSize: 12, color: 'var(--fg)', fontWeight: 500 }}>{mainProgress}%</div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          完成今日 2 小时专注
        </div>
        <div style={{
          height: 6,
          background: 'var(--bg-alt)',
          borderRadius: 100,
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${mainProgress}%`,
            background: 'var(--fg)',
            borderRadius: 100,
            transition: 'width 0.6s ease'
          }} />
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <button
          onClick={() => {
            addPoints(-50)
            setHp(Math.max(0, hp - 15))
            showToast('检测到分心！HP -15')
          }}
          style={{
            flex: 1, padding: '14px',
            borderRadius: 12,
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            color: 'var(--fg)',
            fontSize: 13,
            fontWeight: 500
          }}
        >
          模拟分心
        </button>
        <button
          onClick={() => {
            onNavigate?.('dungeon')
          }}
          style={{
            flex: 1, padding: '14px',
            borderRadius: 12,
            background: 'var(--fg)',
            border: 'none',
            color: 'var(--bg)',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          进入深渊
        </button>
      </div>

      {/* 状态摘要 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8
      }}>
        <Stat label="连胜" value={`${streak}`} suffix="DAYS" />
        <Stat label="积分" value={points.toString()} />
        <Stat label="总专注" value={`${focusHours}`} suffix="HOURS" />
      </div>
    </div>
  )
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="card" style={{
      padding: 14,
      borderRadius: 12,
      textAlign: 'center'
    }}>
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
    </div>
  )
}
