/**
 * src/components/growth/GrHome.tsx
 * Growth Mode Home —— 成长旅程首页。
 *
 * Growth 是第二套产品逻辑（个人成长系统），不是 Normal 的换肤。
 * 用户目标 = 培养能力，看见自己的长期变化。
 *
 * 本页核心 = 「成长旅程」：
 *   不是等级环 / 游戏属性，而是真实的成长轨迹（每一天投入了多少、走了多远）。
 *   信息层级：晨光问候 → 成长旅程(轨迹+真实指标) → 正在培养的能力 → 今日成长 → 当前成长方向
 *
 * 数据全部只读派生自共享 Session/Mission（useGrowthJourney），不修改 Core。
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
import { useGrowthJourney, type TrajectoryPoint } from '@/hooks/useGrowthJourney'
import { useGrowthStore } from '@/stores/growthStore'
import { localDateStr } from '@/lib/dateUtils'

interface Props { onNavigate?: (p: PageId) => void }

/* 把轨迹补全为最近 N 天（缺的天补 0），用于旅程条 */
function buildRecentDays(trajectory: TrajectoryPoint[], days = 14): TrajectoryPoint[] {
  const map = new Map(trajectory.map(t => [t.date, t.focusMs]))
  const out: TrajectoryPoint[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = localDateStr(d)
    out.push({ date: key, focusMs: map.get(key) || 0 })
  }
  return out
}

/* ── 成长旅程轨迹条：最近 14 天，每天一根真实投入 ── */
function JourneyTrail({ trajectory }: { trajectory: TrajectoryPoint[] }) {
  const recent = buildRecentDays(trajectory, 14)
  const max = Math.max(1, ...recent.map(p => p.focusMs))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 84, padding: '0 2px' }}>
      {recent.map((p, i) => {
        const h = p.focusMs > 0 ? Math.max(8, Math.round((p.focusMs / max) * 100)) : 0
        const isToday = i === recent.length - 1
        return (
          <div key={p.date} title={`${p.date} · ${fmtMs(p.focusMs)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{
              width: '100%', height: `${h}%`, minHeight: p.focusMs > 0 ? 8 : 3,
              borderRadius: 4,
              background: p.focusMs > 0
                ? (isToday ? 'linear-gradient(180deg, var(--growth-warm), var(--growth-warm-deep))' : 'linear-gradient(180deg, var(--growth-primary), var(--growth-primary-deep))')
                : 'var(--growth-surface-alt)',
              opacity: p.focusMs > 0 ? 1 : 0.7,
              transition: 'height 0.4s ease',
            }} />
          </div>
        )
      })}
    </div>
  )
}

export default function GrHome({ onNavigate }: Props) {
  const playerTag = useStore(s => s.playerTag)
  const dailyGoalMin = useStore(s => s.dailyGoalMin)
  const todayStudyMs = useStore(s => s.todayStudyMs)

  // Growth 数据模型：旅程派生 + 快照
  const journey = useGrowthJourney()
  const ensureTodaySnapshot = useGrowthStore(s => s.ensureTodaySnapshot)
  const level = useStore(s => s.level)
  const totalExp = useStore(s => s.totalExp)
  const totalFocusMsStore = useStore(s => s.totalFocusMs)
  const streakStore = useStore(s => s.streak)

  const missions = useMissionStore(s => s.missions)
  const currentMissionId = useMissionStore(s => s.currentMissionId)
  const currentMission = missions.find(m => m.id === currentMissionId)

  const [hasAccess, setHasAccess] = useState(false)
  const [dismissPermission, setDismissPermission] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const snapshotDone = useRef(false)

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

  // 每天取样一次成长快照（长期轨迹）
  useEffect(() => {
    if (snapshotDone.current) return
    snapshotDone.current = true
    ensureTodaySnapshot({
      level, totalExp,
      totalFocusMs: totalFocusMsStore,
      streak: streakStore,
      sessionCount: journey.sessionCount,
    })
  }, [ensureTodaySnapshot, level, totalExp, totalFocusMsStore, streakStore, journey.sessionCount])

  // 今日成长状态
  const grewToday = todayStudyMs > 0
  const todayMin = Math.floor(todayStudyMs / 60000)
  const goalPct = dailyGoalMin > 0 ? Math.min(100, Math.round(todayMin / dailyGoalMin * 100)) : 0
  const missionActive = currentMission && ['FOCUSING', 'EXECUTING', 'DISTRACTED', 'RECOVERING', 'INTERVENTION'].includes(currentMission.status)

  let todayLine = '今天还没开始，任何时候开始都不晚。'
  if (missionActive) todayLine = '正在投入，这份专注会长成你的能力。'
  else if (goalPct >= 100) todayLine = '今日目标已达成，你在稳步前进。'
  else if (grewToday) todayLine = `已经投入 ${todayMin} 分钟，继续就好。`

  const abilityCount = journey.subjectAbilities.length
  const startedGrowing = journey.daysGrowing > 0

  const handleOpenPermission = async () => {
    try { showToast('正在打开系统权限设置…'); await openUsageAccessSettings() }
    catch { showToast('请在系统设置中开启使用情况访问权限') }
  }

  return (
    <div className="gj-page">
      {/* ═══ 晨光问候 ═══ */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--growth-text-secondary)' }}>欢迎回来</div>
        <div style={{ fontSize: 21, fontWeight: 700, color: 'var(--growth-text)', marginTop: 1 }}>{playerTag}</div>
      </div>

      {/* ═══ 核心：成长旅程 ═══ */}
      <div className="gj-label" style={{ marginBottom: 12 }}>成长旅程</div>
      <div className="gj-card" style={{ marginBottom: 22 }}>
        {startedGrowing ? (
          <>
            <JourneyTrail trajectory={journey.trajectory} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--growth-text-faint)' }}>
              <span>14 天前</span><span>今天</span>
            </div>
            {/* 真实成长指标（非游戏数值） */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '12px 6px', background: 'var(--growth-surface-alt)', borderRadius: 'var(--growth-radius-sm)' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--growth-primary)', fontVariantNumeric: 'tabular-nums' }}>{journey.daysGrowing}</div>
                <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginTop: 2 }}>成长天数</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '12px 6px', background: 'var(--growth-surface-alt)', borderRadius: 'var(--growth-radius-sm)' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--growth-text)', fontVariantNumeric: 'tabular-nums' }}>{fmtMs(journey.totalFocusMs)}</div>
                <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginTop: 2 }}>累计专注</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '12px 6px', background: 'var(--growth-surface-alt)', borderRadius: 'var(--growth-radius-sm)' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--growth-warm-deep)', fontVariantNumeric: 'tabular-nums' }}>{abilityCount}</div>
                <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginTop: 2 }}>培养能力</div>
              </div>
            </div>
            <div style={{ marginTop: 14, fontSize: 13, color: 'var(--growth-text-secondary)', lineHeight: 1.5, textAlign: 'center' }}>
              每一步投入，都在让你成为想成为的人。
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '18px 8px' }}>
            <span className="gj-spark" style={{ width: 46, height: 46, marginBottom: 12 }}>
              <Icon.Sprout size={22} color="var(--growth-primary)" />
            </span>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--growth-text)', marginBottom: 6 }}>你的成长旅程从这里开始</div>
            <div style={{ fontSize: 13, color: 'var(--growth-text-secondary)', lineHeight: 1.6 }}>
              每一次专注投入，都会被记录成你真实的变化。<br />定一个方向，开始今天的第一段投入吧。
            </div>
          </div>
        )}
      </div>

      {/* 权限提示（温暖、不打扰） */}
      {!hasAccess && !dismissPermission && (
        <div className="gj-card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={handleOpenPermission}>
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

      {/* ═══ 正在培养的能力 ═══ */}
      <div className="gj-label" style={{ marginBottom: 12 }}>正在培养的能力</div>
      {abilityCount > 0 ? (
        <div className="gj-card" style={{ marginBottom: 22 }}>
          {journey.subjectAbilities.slice(0, 5).map((ab, idx) => {
            const maxMs = journey.subjectAbilities[0]?.totalFocusMs || 1
            return (
              <div key={ab.dimension.id} style={{ marginBottom: idx < Math.min(journey.subjectAbilities.length, 5) - 1 ? 14 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--growth-text)' }}>{ab.dimension.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--growth-text-secondary)' }}>{fmtMs(ab.totalFocusMs)}</span>
                </div>
                <div className="gr-progress" style={{ height: 6 }}>
                  <div className="gr-progress-fill" style={{ width: `${Math.max(4, (ab.totalFocusMs / maxMs) * 100)}%`, background: 'linear-gradient(90deg, var(--growth-primary), var(--growth-warm))' }} />
                </div>
              </div>
            )
          })}
          {/* 底层能力 */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--growth-border)' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="gj-spark" style={{ width: 30, height: 30 }}><Icon.Sun size={15} color="var(--growth-warm-deep)" /></span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--growth-text)' }}>专注力</div>
                <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>{fmtMs(journey.totalFocusMs)}</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="gj-spark" style={{ width: 30, height: 30 }}><Icon.Medal size={15} color="var(--growth-primary)" /></span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--growth-text)' }}>坚持</div>
                <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>{journey.daysGrowing} 天成长</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="gj-card" style={{ marginBottom: 22, textAlign: 'center', padding: '22px 18px', color: 'var(--growth-text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
          专注投入后，这里会出现你正在培养的能力。
        </div>
      )}

      {/* ═══ 今日成长 ═══ */}
      <div className="gj-label" style={{ marginBottom: 12 }}>今日成长</div>
      <div className="gj-card-warm" style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: grewToday ? 14 : 0 }}>
          <span className="gj-spark">
            {grewToday ? <Icon.Sun size={17} color="var(--growth-warm-deep)" /> : <Icon.Moon size={17} color="var(--growth-text-secondary)" />}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--growth-text)' }}>
              {grewToday ? `已投入 ${fmtMs(todayStudyMs)}` : '尚未开始'}
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

      {/* ═══ 当前成长方向 ═══ */}
      <div className="gj-label" style={{ marginBottom: 12 }}>当前成长方向</div>
      {currentMission ? (
        <div className="gj-card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--growth-text)', lineHeight: 1.3 }}>{currentMission.title}</div>
          <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginTop: 4 }}>
            目标 {currentMission.targetMinutes} 分钟 · 已投入 {Math.floor(currentMission.actualStudyMs / 60000)} 分钟
          </div>
          {currentMission.targetMinutes > 0 && (
            <div className="gr-progress" style={{ margin: '14px 0 4px', height: 7 }}>
              <div className="gr-progress-fill" style={{ width: `${Math.min(100, (currentMission.actualStudyMs / (currentMission.targetMinutes * 60000)) * 100)}%`, background: 'linear-gradient(90deg, var(--growth-primary), var(--growth-warm))' }} />
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            {currentMission.status === 'READY' && (
              <button className="gj-btn gj-btn-primary" onClick={() => startMission(currentMission.id)} style={{ width: '100%' }}>
                <Icon.Play size={17} color="#fff" /> 开始投入
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
            还没有进行中的成长方向。<br />去定一个今天想投入的能力吧。
          </div>
          <button className="gj-btn gj-btn-ghost" onClick={() => onNavigate?.('quests')} style={{ padding: '11px 24px' }}>
            去看看
          </button>
        </div>
      )}
    </div>
  )
}
