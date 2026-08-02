import { useStore, calcGaokaoScore, daysUntilGaokao } from '@/stores/useStore'

interface Props {
  variant?: 'full' | 'compact'
  mode?: 'full' | 'compact'
}

export default function GaokaoProgress({ variant = 'full', mode }: Props) {
  const actualMode = mode || variant
  const gaokaoDate = useStore(s => s.gaokaoDate)
  const gaokaoTargetScore = useStore(s => s.gaokaoTargetScore)
  const totalFocusMs = useStore(s => s.totalFocusMs)
  const totalEntMs = useStore(s => s.totalEntMs)
  const quests = useStore(s => s.quests)
  const streak = useStore(s => s.streak)

  const days = daysUntilGaokao(gaokaoDate)
  const currentScore = calcGaokaoScore({
    gaokaoBaseScore: useStore(s => s.gaokaoBaseScore),
    totalFocusMs,
    totalEntMs,
    quests
  })

  const progress = Math.min(100, Math.max(0, (currentScore / gaokaoTargetScore) * 100))
  const studyHours = Math.floor(totalFocusMs / 3_600_000)
  const entHours = Math.floor(totalEntMs / 3_600_000)

  // 状态判断
  const isOnTrack = currentScore >= gaokaoTargetScore * 0.85
  const isWarning = currentScore >= gaokaoTargetScore * 0.6 && !isOnTrack
  const isDanger = !isOnTrack && !isWarning

  if (actualMode === 'compact') {
    return (
      <div className="card" style={{
        padding: '10px 14px', borderRadius: 12,
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 12
      }}>
        <div style={{
          fontSize: 22, fontWeight: 700, lineHeight: 1,
          color: isDanger ? 'var(--danger)' : isWarning ? '#F59E0B' : 'var(--success)'
        }}>
          {days}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>距高考 · 天</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 1 }}>
            估分 {currentScore}
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>
              {' '}/ {gaokaoTargetScore}
            </span>
          </div>
        </div>
        <div style={{ width: 60, height: 4, background: 'var(--bg-alt)', borderRadius: 100, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: isDanger ? 'var(--danger)' : isWarning ? '#F59E0B' : 'var(--success)',
            borderRadius: 100, transition: 'width 0.6s ease'
          }} />
        </div>
      </div>
    )
  }

  // full 模式 — 首页大卡片
  return (
    <div className="card" style={{
      padding: 20, borderRadius: 16, marginBottom: 16,
      position: 'relative', overflow: 'hidden'
    }}>
      {/* 背景渐变 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: isDanger
          ? 'linear-gradient(135deg, rgba(229,77,46,0.06) 0%, transparent 60%)'
          : isWarning
            ? 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, transparent 60%)'
            : 'linear-gradient(135deg, rgba(22,163,74,0.06) 0%, transparent 60%)',
        pointerEvents: 'none'
      }} />

      <div style={{ position: 'relative' }}>
        {/* 倒计时大数字 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
          <div style={{
            fontSize: 56, fontWeight: 700, lineHeight: 0.9, letterSpacing: -2,
            color: isDanger ? 'var(--danger)' : isWarning ? '#F59E0B' : 'var(--fg)'
          }}>
            {days}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', paddingBottom: 6 }}>
            天后高考
          </div>
        </div>

        {/* 日期 */}
        <div style={{
          fontSize: 11, color: 'var(--muted)',
          fontFamily: 'DM Mono, monospace',
          marginBottom: 16
        }}>
          {gaokaoDate} · 目标 {gaokaoTargetScore} 分
        </div>

        {/* 分数进度条 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline', marginBottom: 6
          }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>当前估分</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{
                fontSize: 24, fontWeight: 700,
                color: isDanger ? 'var(--danger)' : isWarning ? '#F59E0B' : 'var(--success)'
              }}>
                {currentScore}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                / {gaokaoTargetScore}
              </span>
            </div>
          </div>

          {/* 大进度条 */}
          <div style={{
            height: 10, background: 'var(--bg-alt)',
            borderRadius: 100, overflow: 'hidden', position: 'relative'
          }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: isDanger
                ? 'linear-gradient(90deg, #E54D2E, #F59E0B)'
                : isWarning
                  ? 'linear-gradient(90deg, #F59E0B, #16A34A)'
                  : 'linear-gradient(90deg, #16A34A, #3B82F6)',
              borderRadius: 100,
              transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
            }} />
            {/* 目标线标记 */}
            <div style={{
              position: 'absolute', right: 0, top: -2, bottom: -2,
              width: 2, background: 'var(--fg)', opacity: 0.3
            }} />
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 10, color: 'var(--muted)', marginTop: 4
          }}>
            <span>{Math.round(progress)}% 达成</span>
            <span>{currentScore >= gaokaoTargetScore ? '已达标' : `还差 ${gaokaoTargetScore - currentScore} 分`}</span>
          </div>
        </div>

        {/* 统计明细 */}
        <div style={{
          display: 'flex', gap: 0,
          borderTop: '1px solid var(--border)',
          paddingTop: 10, marginTop: 4
        }}>
          <Stat label="累计学习" value={`${studyHours}h`} color="var(--success)" />
          <Divider />
          <Stat label="累计娱乐" value={`${entHours}h`} color="var(--danger)" />
          <Divider />
          <Stat label="连胜" value={`${streak}天`} color="var(--fg)" />
          <Divider />
          <Stat
            label="完成任务"
            value={`${quests.filter(q => q.completed).length}`}
            color="var(--fg)"
          />
        </div>

        {/* 提示语 */}
        <div style={{
          fontSize: 11, color: 'var(--muted)', marginTop: 10,
          textAlign: 'center'
        }}>
          {isOnTrack && '势头不错，保持节奏'}
          {isWarning && '进度偏慢，需要加把劲'}
          {isDanger && '危险！再不努力就来不及了'}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color }}>{value}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, background: 'var(--border)', margin: '0 0' }} />
}
