/**
 * src/components/growth/GrHome.tsx
 * Growth Mode Home —— 个人成长系统首页。
 *
 * Growth = "我正在成为怎样的人"，不是"我做了多少"。
 * 与 Normal（任务执行系统）彻底分裂：这里没有任务列表、没有等级环、没有属性值。
 *
 * 五层结构（用户拍板）：
 *   1. 成长身份   —— 我正在成为谁（基于真实数据，非鸡汤）
 *   2. 能力变化   —— 我哪里变强了（趋势，不是分数）
 *   3. 今日成长行动—— 下一步做什么（Mission 重构为成长行动 + NextStep 建议）
 *   4. 成长记忆   —— 我走过什么路（我的故事，不是统计）
 *   5. 成长趋势   —— 长期变化（辅助）
 *
 * 全部只读派生自共享 Session/Mission（useGrowthModel），不修改 Core。
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
import { useGrowthStore } from '@/stores/growthStore'
import { useGrowthModel } from '@/hooks/useGrowthModel'
import { impactForSubject, type AbilityTrend, type TrendDirection } from '@/lib/growthModel'
import { localDateStr } from '@/lib/dateUtils'

interface Props { onNavigate?: (p: PageId) => void }

/* 核心能力 id → 中文名（GrowthImpact 展示用） */
const CORE_NAME: Record<string, string> = { learning: '学习能力', focus: '专注能力', persistence: '坚持能力', recovery: '恢复能力' }
const impactName = (key: string) => CORE_NAME[key] || key

/* 趋势方向 → 视觉 */
function trendMeta(d: TrendDirection): { arrow: string; color: string; bg: string } {
  if (d === 'up') return { arrow: '↑', color: 'var(--growth-success)', bg: 'var(--growth-primary-soft)' }
  if (d === 'down') return { arrow: '↓', color: 'var(--growth-warning)', bg: 'var(--growth-warm-soft)' }
  if (d === 'flat') return { arrow: '→', color: 'var(--growth-text-secondary)', bg: 'var(--growth-surface-alt)' }
  return { arrow: '·', color: 'var(--growth-text-faint)', bg: 'var(--growth-surface-alt)' }
}

/* ── 成长趋势轨迹条（辅助层）── */
function TrendTrail({ trajectory }: { trajectory: { date: string; focusMs: number }[] }) {
  const map = new Map(trajectory.map(t => [t.date, t.focusMs]))
  const days: { date: string; focusMs: number }[] = []
  const today = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const key = localDateStr(d)
    days.push({ date: key, focusMs: map.get(key) || 0 })
  }
  const max = Math.max(1, ...days.map(p => p.focusMs))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 56 }}>
      {days.map((p, i) => {
        const h = p.focusMs > 0 ? Math.max(8, Math.round((p.focusMs / max) * 100)) : 0
        const isToday = i === days.length - 1
        return (
          <div key={p.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{
              width: '100%', height: `${h}%`, minHeight: p.focusMs > 0 ? 6 : 3, borderRadius: 3,
              background: p.focusMs > 0
                ? (isToday ? 'linear-gradient(180deg, var(--growth-warm), var(--growth-warm-deep))' : 'linear-gradient(180deg, var(--growth-primary), var(--growth-primary-deep))')
                : 'var(--growth-surface-alt)',
              opacity: p.focusMs > 0 ? 1 : 0.7,
            }} />
          </div>
        )
      })}
    </div>
  )
}

export default function GrHome({ onNavigate }: Props) {
  const playerTag = useStore(s => s.playerTag)
  const level = useStore(s => s.level)
  const totalExp = useStore(s => s.totalExp)
  const totalFocusMsStore = useStore(s => s.totalFocusMs)
  const streakStore = useStore(s => s.streak)

  // Growth 产品层：整套派生数据
  const model = useGrowthModel()
  const ensureTodaySnapshot = useGrowthStore(s => s.ensureTodaySnapshot)

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

  // 每日成长快照（长期趋势数据）
  useEffect(() => {
    if (snapshotDone.current) return
    snapshotDone.current = true
    ensureTodaySnapshot({ level, totalExp, totalFocusMs: totalFocusMsStore, streak: streakStore, sessionCount: 0 })
  }, [ensureTodaySnapshot, level, totalExp, totalFocusMsStore, streakStore])

  const missionActive = currentMission && ['FOCUSING', 'EXECUTING', 'DISTRACTED', 'RECOVERING', 'INTERVENTION'].includes(currentMission.status)
  const missionImpact = currentMission ? impactForSubject(currentMission.subject) : null
  const missionAbilities = missionImpact ? Object.entries(missionImpact.weights).sort((a, b) => b[1] - a[1]).map(([k]) => impactName(k)) : []

  const handleOpenPermission = async () => {
    try { showToast('正在打开系统权限设置…'); await openUsageAccessSettings() }
    catch { showToast('请在系统设置中开启使用情况访问权限') }
  }

  return (
    <div className="gj-page">
      {/* ═══ 头部：问候 + 成长方向 ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--growth-text-secondary)' }}>欢迎回来</div>
          <div style={{ fontSize: 21, fontWeight: 700, color: 'var(--growth-text)', marginTop: 1 }}>{playerTag}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--growth-text-faint)', marginBottom: 3 }}>成长方向 · 系统推导</div>
          <span className="gj-pill gj-pill-green" style={{ fontSize: 12 }}>{model.direction.title}</span>
        </div>
      </div>

      {/* 权限提示 */}
      {!hasAccess && !dismissPermission && (
        <div className="gj-card" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={handleOpenPermission}>
          <span className="gj-spark" style={{ background: 'var(--growth-warm-soft)' }}><Icon.Warning size={16} color="var(--growth-warm-deep)" /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--growth-text)' }}>开启使用情况访问</div>
            <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginTop: 1 }}>让我更准确地看见你的成长</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setDismissPermission(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Icon.Close size={15} color="var(--growth-text-faint)" />
          </button>
        </div>
      )}

      {/* ═══ 1. 成长身份 —— 我正在成为谁 ═══ */}
      <div className="gj-label" style={{ marginBottom: 12 }}>成长身份</div>
      <div className="gj-card-warm" style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span className="gj-spark" style={{ width: 42, height: 42, flexShrink: 0 }}>
            <Icon.Sprout size={20} color="var(--growth-primary)" />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--growth-text)', lineHeight: 1.4 }}>
              {model.identity.headline}
            </div>
            {model.identity.evidence.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {model.identity.evidence.map((ev, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--growth-text-secondary)', display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.4 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--growth-warm)', flexShrink: 0 }} />
                    {ev}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 2. 能力变化 —— 我哪里变强了（趋势，不是分数）═══ */}
      <div className="gj-label" style={{ marginBottom: 12 }}>能力变化</div>
      <div className="gj-card" style={{ marginBottom: 22 }}>
        {model.trends.map((t, idx) => <AbilityRow key={t.ability.id} trend={t} isLast={idx === model.trends.length - 1} />)}
      </div>

      {/* ═══ 3. 今日成长行动 —— 下一步做什么 ═══ */}
      <div className="gj-label" style={{ marginBottom: 12 }}>今日成长行动</div>
      {/* NextStep：规则引擎建议 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--growth-primary-soft)', borderRadius: 'var(--growth-radius-sm)', marginBottom: 10 }}>
        <Icon.Sun size={16} color="var(--growth-primary)" />
        <div style={{ fontSize: 13, color: 'var(--growth-primary-deep)', fontWeight: 500, lineHeight: 1.4 }}>{model.nextStep.text}</div>
      </div>
      {currentMission ? (
        <div className="gj-card" style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--growth-text)', lineHeight: 1.35 }}>{currentMission.title}</div>
          {/* 这次行动培养的能力（GrowthImpact 可视化） */}
          {missionAbilities.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>这次投入培养</span>
              {missionAbilities.map(a => <span key={a} className="gj-pill gj-pill-warm" style={{ fontSize: 11 }}>{a}</span>)}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginTop: 8 }}>
            目标 {currentMission.targetMinutes} 分钟 · 已投入 {Math.floor(currentMission.actualStudyMs / 60000)} 分钟
          </div>
          {currentMission.targetMinutes > 0 && (
            <div className="gr-progress" style={{ margin: '12px 0 4px', height: 7 }}>
              <div className="gr-progress-fill" style={{ width: `${Math.min(100, (currentMission.actualStudyMs / (currentMission.targetMinutes * 60000)) * 100)}%`, background: 'linear-gradient(90deg, var(--growth-primary), var(--growth-warm))' }} />
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            {currentMission.status === 'READY' && (
              <button className="gj-btn gj-btn-primary" onClick={() => startMission(currentMission.id)} style={{ width: '100%' }}>
                <Icon.Play size={17} color="#fff" /> 开始这次培养
              </button>
            )}
            {missionActive && (
              <button className="gj-btn gj-btn-primary" onClick={() => onNavigate?.('dungeon')} style={{ width: '100%' }}>进入专注空间</button>
            )}
            {currentMission.status === 'RECOVERING' && (
              <div style={{ fontSize: 13, color: 'var(--growth-warm-deep)', textAlign: 'center', padding: '8px 0', fontWeight: 600 }}>
                重新回来，本身就是一种成长
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="gj-card" style={{ marginBottom: 22, textAlign: 'center', padding: '24px 20px' }}>
          <div style={{ fontSize: 14, color: 'var(--growth-text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
            今天还没有成长行动。<br />去定一段想投入的专注吧。
          </div>
          <button className="gj-btn gj-btn-ghost" onClick={() => onNavigate?.('quests')} style={{ padding: '11px 24px' }}>去安排</button>
        </div>
      )}

      {/* ═══ 4. 成长记忆 —— 我走过什么路 ═══ */}
      <div className="gj-label" style={{ marginBottom: 12 }}>成长记忆</div>
      {model.memory.length > 0 ? (
        <div className="gj-card" style={{ marginBottom: 22 }}>
          {model.memory.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < model.memory.length - 1 ? 14 : 0 }}>
              <span className="gj-pill" style={{ fontSize: 10, flexShrink: 0, minWidth: 64, justifyContent: 'center' }}>{m.label}</span>
              <span style={{ fontSize: 13, color: 'var(--growth-text)', lineHeight: 1.45 }}>{m.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="gj-card" style={{ marginBottom: 22, textAlign: 'center', padding: '22px 18px', color: 'var(--growth-text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
          你的第一次专注，会成为这里的第一段记忆。
        </div>
      )}

      {/* ═══ 5. 成长趋势 —— 长期变化（辅助）═══ */}
      <div className="gj-label" style={{ marginBottom: 12 }}>成长趋势</div>
      <div className="gj-card" style={{ marginBottom: 16 }}>
        {model.hasAnyGrowth ? (
          <>
            <TrendTrail trajectory={model.trajectory} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--growth-text-faint)' }}>
              <span>14 天前</span><span>今天</span>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--growth-text-secondary)', fontSize: 13, padding: '8px 0' }}>
            开始投入后，这里会画出你的长期变化。
          </div>
        )}
      </div>
    </div>
  )
}

/* ── 能力趋势行：只显示趋势 + 证据，不显示分数 ── */
function AbilityRow({ trend, isLast }: { trend: AbilityTrend; isLast: boolean }) {
  const meta = trendMeta(trend.direction)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isLast ? '2px 0' : '2px 0 14px', borderBottom: isLast ? 'none' : '1px solid var(--growth-border)' }}>
      <span style={{
        width: 34, height: 34, borderRadius: '50%', background: meta.bg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700, color: meta.color,
      }}>{meta.arrow}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--growth-text)' }}>{trend.ability.name}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: meta.color }}>{trend.status}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginTop: 3, lineHeight: 1.4 }}>{trend.evidence}</div>
      </div>
    </div>
  )
}
