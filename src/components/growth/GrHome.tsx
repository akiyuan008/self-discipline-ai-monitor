/**
 * src/components/growth/GrHome.tsx
 * Growth Journey Home — 成长旅程首页。
 *
 * 这不是任务 Dashboard，是用户经营自己成长的空间。
 * 主角是「成长环」：等级 + 当前阶段 + 通往下一级的旅程。
 *
 * 信息层级：
 *   晨光问候 → 成长环(等级/阶段) → 今日成长状态 → 连续坚持 → 当前成长目标
 *
 * 所有数据读取现有 Store/Core，UI 层不重新计算业务。
 */
import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { App } from '@capacitor/app'
import { fetchUsageStats, hasUsageAccess, fmtMs, openUsageAccessSettings } from '@/lib/usageStats'
import { logger } from '@/lib/logger'
import Icon from '@/components/Icons'
import type { PageId } from '@/stores/useStore'
import { useMissionStore, startMission } from '@/core/discipline'

interface Props { onNavigate?: (p: PageId) => void }

/* ── 成长阶段：等级 → 旅程意象 ── */
const STAGES = [
  { max: 4, name: '萌芽', sub: '破土而出' },
  { max: 9, name: '生长', sub: '向阳而生' },
  { max: 14, name: '扎根', sub: '向下扎根' },
  { max: 19, name: '抽枝', sub: '舒展枝叶' },
  { max: 29, name: '绽放', sub: '静静绽放' },
  { max: Infinity, name: '参天', sub: '蔚然参天' },
]
function getStage(level: number) {
  return STAGES.find(s => level <= s.max) || STAGES[STAGES.length - 1]
}

/* ── 成长环（年轮）：等级居中，进度弧环绕 ── */
function GrowthRing({ level, pct }: { level: number; pct: number }) {
  const size = 196
  const stroke = 12
  const r = (size - stroke) / 2 - 6
  const c = 2 * Math.PI * r
  const filled = c * Math.min(100, Math.max(0, pct)) / 100
  const cx = size / 2, cy = size / 2
  return (
    <div className="gj-ring-wrap" style={{ width: size, height: size }}>
      <div className="gj-ring-halo" />
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="gjRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--growth-primary)" />
            <stop offset="100%" stopColor="var(--growth-warm)" />
          </linearGradient>
        </defs>
        {/* 年轮底轨 */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--growth-surface-alt)" strokeWidth={stroke} />
        {/* 内圈细纹（年轮感） */}
        <circle cx={cx} cy={cy} r={r - 18} fill="none" stroke="var(--growth-border)" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={r - 32} fill="none" stroke="var(--growth-border)" strokeWidth={1} />
        {/* 成长进度弧 */}
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="url(#gjRingGrad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <div className="gj-ring-center">
        <div className="gj-ring-cap">LEVEL</div>
        <div className="gj-ring-num">{level}</div>
        <div className="gj-ring-cap">成长等级</div>
      </div>
    </div>
  )
}

export default function GrHome({ onNavigate }: Props) {
  const points = useStore(s => s.points)
  const streak = useStore(s => s.streak)
  const dailyGoalMin = useStore(s => s.dailyGoalMin)
  const playerTag = useStore(s => s.playerTag)
  const todayStudyMs = useStore(s => s.todayStudyMs)
  const totalFocusMs = useStore(s => s.totalFocusMs)
  const level = useStore(s => s.level)
  const exp = useStore(s => s.exp)
  const totalExp = useStore(s => s.totalExp)

  const missions = useMissionStore(s => s.missions)
  const currentMissionId = useMissionStore(s => s.currentMissionId)
  const currentMission = missions.find(m => m.id === currentMissionId)

  const [hasAccess, setHasAccess] = useState(false)
  const [dismissPermission, setDismissPermission] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = async () => {
    try {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const stats = await fetchUsageStats(startOfDay.getTime(), now.getTime())
      useStore.getState().syncUsage(stats.study, stats.ent)
    } catch (e) { logger.warn('growth-home', 'refresh usage failed', { error: String(e) }) }
  }
  const checkAndRefresh = async () => {
    try { setHasAccess(await hasUsageAccess()) } catch { setHasAccess(false) }
    refresh()
  }
  useEffect(() => {
    checkAndRefresh()
    const sub = App.addListener('resume', () => { checkAndRefresh() })
    return () => { sub.then(s => s.remove()) }
  }, [])
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(refresh, 30000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // ── 成长旅程计算 ──
  const stage = getStage(level)
  const expInLevel = exp % 1000
  const expToNext = 1000 - expInLevel
  const levelPct = expInLevel / 10   // 0–100

  // 今日成长状态
  const grewToday = todayStudyMs > 0
  const todayMin = Math.floor(todayStudyMs / 60000)
  const goalPct = dailyGoalMin > 0 ? Math.min(100, Math.round(todayMin / dailyGoalMin * 100)) : 0
  const missionActive = currentMission && ['FOCUSING', 'EXECUTING', 'DISTRACTED', 'RECOVERING', 'INTERVENTION'].includes(currentMission.status)

  // 今日成长的一句话（陪伴感）
  let todayLine = '今天还没开始，任何时候开始都不晚。'
  if (missionActive) todayLine = '正在成长中，保持这份专注。'
  else if (goalPct >= 100) todayLine = '今日目标已达成，你在稳步前进。'
  else if (grewToday) todayLine = `已经成长了 ${todayMin} 分钟，继续就好。`

  const handleOpenPermission = async () => {
    try { showToast('正在打开系统权限设置…'); await openUsageAccessSettings() }
    catch { showToast('请在系统设置中开启使用情况访问权限') }
  }

  return (
    <div className="gj-page">
      {/* ═══ 晨光问候 ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--growth-text-secondary)' }}>欢迎回来</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--growth-text)', marginTop: 1 }}>{playerTag}</div>
        </div>
        <button
          onClick={() => onNavigate?.('profile')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 99, background: 'var(--growth-surface)', border: '1px solid var(--growth-border)', cursor: 'pointer', boxShadow: 'var(--growth-shadow)' }}
        >
          <span style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>成长值</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--growth-warm-deep)' }}>{points}</span>
        </button>
      </div>

      {/* ═══ 主角：成长环 + 阶段 ═══ */}
      <div className="gj-hero">
        <GrowthRing level={level} pct={levelPct} />
        <div style={{ marginTop: 18 }}>
          <span className="gj-stage">
            <span className="gj-stage-dot" />
            {stage.name} · {stage.sub}
          </span>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--growth-text-secondary)' }}>
          距下一级还差 <span style={{ fontWeight: 700, color: 'var(--growth-primary)' }}>{expToNext}</span> 成长
        </div>
      </div>

      {/* 权限提示（温暖、不打扰） */}
      {!hasAccess && !dismissPermission && (
        <div className="gj-card" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={handleOpenPermission}>
          <span className="gj-spark" style={{ background: 'var(--growth-warm-soft)' }}>
            <Icon.Warning size={16} color="var(--growth-warm-deep)" />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--growth-text)' }}>开启使用情况访问</div>
            <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginTop: 1 }}>让我更准确地记录你的成长</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setDismissPermission(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Icon.Close size={15} color="var(--growth-text-faint)" />
          </button>
        </div>
      )}

      {/* ═══ 今日成长状态 ═══ */}
      <div className="gj-label" style={{ marginBottom: 12 }}>今日成长</div>
      <div className="gj-card-warm" style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: grewToday ? 14 : 0 }}>
          <span className="gj-spark">
            {grewToday
              ? <Icon.Sun size={17} color="var(--growth-warm-deep)" />
              : <Icon.Moon size={17} color="var(--growth-text-secondary)" />}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--growth-text)' }}>
              {grewToday ? `已成长 ${fmtMs(todayStudyMs)}` : '尚未开始'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginTop: 1 }}>{todayLine}</div>
          </div>
        </div>
        {grewToday && dailyGoalMin > 0 && (
          <div>
            <div className="gr-progress" style={{ height: 8 }}>
              <div className="gr-progress-fill" style={{ width: `${goalPct}%`, background: 'linear-gradient(90deg, var(--growth-primary), var(--growth-warm))' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--growth-text-secondary)' }}>
              <span>今日目标 {dailyGoalMin} 分钟</span>
              <span style={{ fontWeight: 700, color: 'var(--growth-primary)' }}>{goalPct}%</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══ 连续坚持 ═══ */}
      <div className="gj-label" style={{ marginBottom: 12 }}>连续坚持</div>
      <div className="gj-card" style={{ marginBottom: 22, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {Array.from({ length: 7 }).map((_, i) => {
            const lit = i < Math.min(streak, 7)
            return (
              <div key={i} style={{
                width: i === Math.min(streak, 7) - 1 && streak > 0 ? 26 : 18,
                height: i === Math.min(streak, 7) - 1 && streak > 0 ? 26 : 18,
                borderRadius: '50%',
                background: lit ? 'linear-gradient(135deg, var(--growth-warm), var(--growth-warm-deep))' : 'var(--growth-surface-alt)',
                boxShadow: lit ? '0 2px 8px rgba(217,151,78,0.3)' : 'none',
                transition: 'all 0.3s'
              }} />
            )
          })}
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div>
            <span className="gj-stat-num" style={{ color: 'var(--growth-warm-deep)' }}>{streak}</span>
            <span className="gj-stat-unit">天</span>
          </div>
          <div className="gj-stat-cap">{streak > 0 ? '每一天都算数' : '从今天开始'}</div>
        </div>
      </div>

      {/* ═══ 当前成长目标 ═══ */}
      <div className="gj-label" style={{ marginBottom: 12 }}>当前成长目标</div>
      {currentMission ? (
        <div className="gj-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--growth-text)', lineHeight: 1.3 }}>{currentMission.title}</div>
              <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginTop: 4 }}>
                目标 {currentMission.targetMinutes} 分钟 · 已投入 {Math.floor(currentMission.actualStudyMs / 60000)} 分钟
              </div>
            </div>
          </div>
          {currentMission.targetMinutes > 0 && (
            <div className="gr-progress" style={{ margin: '14px 0 4px', height: 7 }}>
              <div className="gr-progress-fill" style={{ width: `${Math.min(100, (currentMission.actualStudyMs / (currentMission.targetMinutes * 60000)) * 100)}%`, background: 'linear-gradient(90deg, var(--growth-primary), var(--growth-warm))' }} />
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            {currentMission.status === 'READY' && (
              <button className="gj-btn gj-btn-primary" onClick={() => startMission(currentMission.id)} style={{ width: '100%' }}>
                <Icon.Play size={17} color="#fff" /> 开始这段成长
              </button>
            )}
            {missionActive && (
              <button className="gj-btn gj-btn-primary" onClick={() => onNavigate?.('dungeon')} style={{ width: '100%' }}>
                进入专注空间
              </button>
            )}
            {currentMission.status === 'RECOVERING' && (
              <div style={{ fontSize: 13, color: 'var(--growth-warm-deep)', textAlign: 'center', padding: '8px 0', fontWeight: 600 }}>
                重新回来，本身就是一种成长
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="gj-card" style={{ marginBottom: 16, textAlign: 'center', padding: '26px 20px' }}>
          <div style={{ fontSize: 14, color: 'var(--growth-text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
            还没有进行中的成长目标。<br />去「成长行动」里定一个今天想投入的方向吧。
          </div>
          <button className="gj-btn gj-btn-ghost" onClick={() => onNavigate?.('quests')} style={{ padding: '11px 24px' }}>
            去看看
          </button>
        </div>
      )}

      {/* ═══ 累计成长（轻量收尾）═══ */}
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <div className="gj-block" style={{ flex: 1, textAlign: 'center', padding: '14px 8px', background: 'var(--growth-surface)', borderRadius: 'var(--growth-radius-sm)', border: '1px solid var(--growth-border)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--growth-primary)' }}>{fmtMs(totalFocusMs)}</div>
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginTop: 2 }}>累计专注</div>
        </div>
        <div className="gj-block" style={{ flex: 1, textAlign: 'center', padding: '14px 8px', background: 'var(--growth-surface)', borderRadius: 'var(--growth-radius-sm)', border: '1px solid var(--growth-border)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--growth-warm-deep)' }}>{totalExp}</div>
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginTop: 2 }}>累计成长</div>
        </div>
      </div>
    </div>
  )
}
