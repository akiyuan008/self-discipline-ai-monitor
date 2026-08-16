/**
 * src/lib/growthModel.ts
 * Growth Mode 产品层模型与派生逻辑（纯函数，只读，不修改 Core）。
 *
 * 核心定位：Growth = "我正在成为怎样的人"，不是"我做了多少"。
 * 因此：
 *   - 能力是【趋势】，不是 RPG 属性。不显示等级/分数。
 *   - GrowthIdentity 必须基于真实数据，不生成空泛鼓励。
 *   - GrowthImpact 用系统预置模板，一期不开放用户配置。
 *   - 成长方向由系统从真实行为推导，不让用户选择。
 *   - NextStep 用规则引擎，一期不接 AI。
 *
 * 四个核心能力：学习能力 / 专注能力 / 坚持能力 / 恢复能力。
 */
import type { Session, Mission } from '@/core/discipline'
import { localDateStr } from '@/lib/dateUtils'

const DAY = 24 * 60 * 60 * 1000

/* ═══════════════════════════════════════════════
 * 核心能力定义（不是属性值，是成长维度）
 * ═══════════════════════════════════════════════ */
export type CoreAbilityId = 'learning' | 'focus' | 'persistence' | 'recovery'

export interface CoreAbility {
  id: CoreAbilityId
  name: string
  /** 这个能力在"成为谁"中的意义 */
  meaning: string
}

export const CORE_ABILITIES: CoreAbility[] = [
  { id: 'focus', name: '专注能力', meaning: '能沉下心投入一段深度时间' },
  { id: 'persistence', name: '坚持能力', meaning: '能持续地、日复一日地出现' },
  { id: 'recovery', name: '恢复能力', meaning: '能从分心和挫折中拉回自己' },
  { id: 'learning', name: '学习能力', meaning: '能高质量地吸收与完成' },
]

/* ═══════════════════════════════════════════════
 * GrowthImpact —— 成长行动对各能力的加权影响
 * 一期：系统预置模板，按 subject 映射。用户零配置。
 * 权重和 = 100。领域能力（逻辑思维等）+ 核心能力共同承载。
 * ═══════════════════════════════════════════════ */
export interface GrowthImpact {
  /** key = 能力名（核心能力用 CoreAbilityId，领域能力用中文名），value = 权重% */
  weights: Record<string, number>
}

const mk = (weights: Record<string, number>): GrowthImpact => ({ weights })

/** subject → GrowthImpact 预置模板 */
export const IMPACT_TEMPLATES: Record<string, GrowthImpact> = {
  '数学': mk({ '逻辑思维': 60, focus: 40 }),
  '物理': mk({ '逻辑思维': 50, focus: 50 }),
  '化学': mk({ '逻辑思维': 45, '记忆巩固': 25, focus: 30 }),
  '生物': mk({ '记忆巩固': 45, '逻辑思维': 25, focus: 30 }),
  '语文': mk({ '语言表达': 55, '记忆巩固': 20, focus: 25 }),
  '英语': mk({ '语言表达': 50, '记忆巩固': 30, focus: 20 }),
  '阅读': mk({ 'learning': 50, focus: 30, '逻辑思维': 20 }),
  '深度学习': mk({ focus: 60, persistence: 40 }),
  '专注': mk({ focus: 60, persistence: 40 }),
}
const DEFAULT_IMPACT = mk({ focus: 60, persistence: 40 })

export function impactForSubject(subject?: string): GrowthImpact {
  if (!subject) return DEFAULT_IMPACT
  return IMPACT_TEMPLATES[subject.trim()] || DEFAULT_IMPACT
}

/* ═══════════════════════════════════════════════
 * 能力趋势（AbilityTrend）—— 能力是趋势，不是数值
 * ═══════════════════════════════════════════════ */
export type TrendDirection = 'up' | 'down' | 'flat' | 'building'
export interface AbilityTrend {
  ability: CoreAbility
  /** 阶段描述，不是分数 */
  status: '正在提升' | '稳步保持' | '需要关注' | '正在建立'
  direction: TrendDirection
  /** 变化百分比（无可比数据时 null） */
  changePct: number | null
  /** 度量的可读名称，如"平均连续专注时间" */
  metricLabel: string
  /** 证据句，如"过去30天：平均连续专注时间 +18%" */
  evidence: string
  /** 最近窗口的度量值（供 UI 需要时展示，非分数） */
  recentValue: number | null
}

interface WindowAgg {
  focusSessionCount: number
  focusMs: number
  /** 连续专注段时长总和 / 段数 → 平均连续专注 */
  segTotalMs: number
  segCount: number
  growthDays: Set<string>
  deviationCount: number
  recoveryCount: number
  executionRates: number[]
}
function emptyAgg(): WindowAgg {
  return { focusSessionCount: 0, focusMs: 0, segTotalMs: 0, segCount: 0, growthDays: new Set(), deviationCount: 0, recoveryCount: 0, executionRates: [] }
}

function aggregateWindow(sessions: Session[], from: number, to: number): WindowAgg {
  const agg = emptyAgg()
  for (const s of sessions) {
    if (s.startedAt < from || s.startedAt > to) continue
    const fm = s.focusDurationMs || 0
    if (fm <= 0) continue
    agg.focusSessionCount++
    agg.focusMs += fm
    agg.growthDays.add(localDateStr(new Date(s.startedAt)))
    // 连续专注段
    if (Array.isArray(s.segments)) {
      for (const seg of s.segments) {
        const d = (seg.endedAt || 0) - (seg.startedAt || 0)
        if (d > 0) { agg.segTotalMs += d; agg.segCount++ }
      }
    }
    agg.deviationCount += s.deviationCount || 0
    agg.recoveryCount += s.recoveryCount || 0
    const er = s.result?.executionRate
    if (typeof er === 'number' && er > 0) agg.executionRates.push(er)
  }
  return agg
}
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
function pctChange(recent: number, prior: number): number | null {
  if (prior <= 0) return null
  return Math.round(((recent - prior) / prior) * 100)
}
function dirFromChange(ch: number | null, hasPrior: boolean): TrendDirection {
  if (!hasPrior || ch === null) return 'building'
  if (ch > 8) return 'up'
  if (ch < -8) return 'down'
  return 'flat'
}
function statusFromDir(d: TrendDirection): AbilityTrend['status'] {
  if (d === 'up') return '正在提升'
  if (d === 'down') return '需要关注'
  if (d === 'flat') return '稳步保持'
  return '正在建立'
}

/** 从共享 Session 派生四个核心能力的趋势 */
export function deriveAbilityTrends(sessions: Session[], now = Date.now()): AbilityTrend[] {
  const r30 = aggregateWindow(sessions, now - 30 * DAY, now)
  const p30 = aggregateWindow(sessions, now - 60 * DAY, now - 30 * DAY)
  const hasPrior = p30.focusSessionCount > 0
  const hasRecent = r30.focusSessionCount > 0

  // 专注能力：平均连续专注时长（优先用专注段）
  const recentFocusLen = r30.segCount > 0 ? r30.segTotalMs / r30.segCount : (r30.focusSessionCount ? r30.focusMs / r30.focusSessionCount : 0)
  const priorFocusLen = p30.segCount > 0 ? p30.segTotalMs / p30.segCount : (p30.focusSessionCount ? p30.focusMs / p30.focusSessionCount : 0)
  const focusCh = pctChange(recentFocusLen, priorFocusLen)

  // 坚持能力：成长天数
  const recentDays = r30.growthDays.size
  const priorDays = p30.growthDays.size
  const persistCh = pctChange(recentDays, priorDays)

  // 恢复能力：恢复率 = 恢复/偏离（无偏离记为满恢复，仅在出现过偏离时才有比较意义）
  const recentRecovery = r30.deviationCount > 0 ? r30.recoveryCount / r30.deviationCount : (hasRecent ? 1 : 0)
  const priorRecovery = p30.deviationCount > 0 ? p30.recoveryCount / p30.deviationCount : (hasPrior ? 1 : 0)
  const recoveryCh = pctChange(recentRecovery * 100, priorRecovery * 100)

  // 学习能力：平均执行率
  const recentLearn = avg(r30.executionRates)
  const priorLearn = avg(p30.executionRates)
  const learnCh = pctChange(recentLearn * 100, priorLearn * 100)

  const build = (
    id: CoreAbilityId, metricLabel: string, ch: number | null, dir: TrendDirection,
    recentVal: number | null, fmtEvidence: (ch: number | null) => string
  ): AbilityTrend => {
    const ability = CORE_ABILITIES.find(a => a.id === id)!
    return {
      ability,
      status: hasRecent ? statusFromDir(dir) : '正在建立',
      direction: hasRecent ? dir : 'building',
      changePct: hasRecent ? ch : null,
      metricLabel,
      evidence: fmtEvidence(hasRecent ? ch : null),
      recentValue: recentVal,
    }
  }

  const focus = build('focus', '平均连续专注时间', focusCh, dirFromChange(focusCh, hasPrior), recentFocusLen || null,
    ch => ch === null ? '过去30天：正在积累专注数据' : `过去30天：平均连续专注时间 ${ch >= 0 ? '+' : ''}${ch}%`)
  const persist = build('persistence', '成长天数', persistCh, dirFromChange(persistCh, hasPrior), recentDays,
    ch => ch === null ? `过去30天：成长了 ${recentDays} 天` : `过去30天：成长 ${recentDays} 天（${ch >= 0 ? '+' : ''}${ch}%）`)
  const recovery = build('recovery', '恢复率', recoveryCh, dirFromChange(recoveryCh, hasPrior), Math.round(recentRecovery * 100),
    ch => r30.deviationCount === 0 ? '过去30天：几乎没有偏离' : (ch === null ? `过去30天：恢复率 ${Math.round(recentRecovery * 100)}%` : `过去30天：恢复率 ${ch >= 0 ? '+' : ''}${ch}%`))
  const learn = build('learning', '完成质量', learnCh, dirFromChange(learnCh, hasPrior), Math.round(recentLearn * 100),
    ch => ch === null ? '过去30天：正在积累完成记录' : `过去30天：完成质量 ${ch >= 0 ? '+' : ''}${ch}%`)

  return [focus, persist, recovery, learn]
}

/* ═══════════════════════════════════════════════
 * GrowthIdentity —— 成长身份（基于真实数据，非鸡汤）
 * ═══════════════════════════════════════════════ */
export interface GrowthIdentity {
  headline: string
  evidence: string[]
}

export function deriveGrowthIdentity(trends: AbilityTrend[], sessions: Session[], now = Date.now()): GrowthIdentity {
  const r30 = aggregateWindow(sessions, now - 30 * DAY, now)
  const byId = Object.fromEntries(trends.map(t => [t.ability.id, t]))
  const up = (id: CoreAbilityId) => byId[id]?.direction === 'up'
  const sessionCount = r30.focusSessionCount

  let headline: string
  if (sessionCount === 0) {
    headline = '你的成长故事正要开始'
  } else if (up('persistence') && up('focus')) {
    headline = '你正在成为一个更稳定的学习者'
  } else if (up('recovery')) {
    headline = '你正在成为一个能快速回到状态的人'
  } else if (up('focus')) {
    headline = '你正在成为一个更能沉下心的人'
  } else if (up('persistence')) {
    headline = '你正在成为一个能坚持的人'
  } else if (up('learning')) {
    headline = '你正在成为一个更高效的吸收者'
  } else {
    headline = '你正在稳步成为想成为的人'
  }

  // 证据：全部来自真实数据
  const evidence: string[] = []
  if (sessionCount > 0) evidence.push(`过去30天：你完成了 ${sessionCount} 次专注投入`)
  const focusT = byId['focus']
  if (focusT?.changePct !== null && focusT?.changePct !== undefined && focusT.direction !== 'building') {
    evidence.push(`平均连续专注时间${focusT.changePct! >= 0 ? '提升' : '变化'} ${Math.abs(focusT.changePct!)}%`)
  }
  if (r30.deviationCount > 0) {
    const rate = Math.round((r30.recoveryCount / r30.deviationCount) * 100)
    evidence.push(`偏离后恢复率 ${rate}%`)
  }
  if (r30.growthDays.size > 0) evidence.push(`过去30天有 ${r30.growthDays.size} 天在成长`)

  return { headline, evidence }
}

/* ═══════════════════════════════════════════════
 * GrowthMemory —— 成长记忆（我的故事，不是统计）
 * ═══════════════════════════════════════════════ */
export interface GrowthMoment {
  label: string
  text: string
}

export function deriveGrowthMemory(sessions: Session[], now = Date.now()): GrowthMoment[] {
  const focusSessions = sessions.filter(s => (s.focusDurationMs || 0) > 0).sort((a, b) => a.startedAt - b.startedAt)
  const moments: GrowthMoment[] = []
  if (focusSessions.length === 0) return moments

  const fmtMin = (ms: number) => `${Math.max(1, Math.round(ms / 60000))} 分钟`

  // 第一次专注
  const first = focusSessions[0]
  const firstDaysAgo = Math.floor((now - first.startedAt) / DAY)
  moments.push({
    label: firstDaysAgo === 0 ? '今天' : `${firstDaysAgo} 天前`,
    text: `你完成了第一次专注投入（${fmtMin(first.focusDurationMs)}）`,
  })

  // 最长一次专注
  const longest = focusSessions.reduce((a, b) => (b.focusDurationMs > a.focusDurationMs ? b : a))
  if (longest !== first) {
    moments.push({ label: '里程碑', text: `最长一次专注：${fmtMin(longest.focusDurationMs)}` })
  }

  // 30 天前 vs 现在 的平均专注
  const priorWin = focusSessions.filter(s => s.startedAt >= now - 60 * DAY && s.startedAt < now - 30 * DAY)
  const recentWin = focusSessions.filter(s => s.startedAt >= now - 30 * DAY)
  if (priorWin.length > 0 && recentWin.length > 0) {
    const avgMs = (arr: Session[]) => arr.reduce((x, y) => x + (y.focusDurationMs || 0), 0) / arr.length
    moments.push({ label: '30天前 → 今天', text: `平均专注从 ${fmtMin(avgMs(priorWin))} 到 ${fmtMin(avgMs(recentWin))}` })
  }

  // 最近一次
  const last = focusSessions[focusSessions.length - 1]
  if (last !== first) {
    moments.push({ label: '最近一次', text: `${fmtMin(last.focusDurationMs)} 的专注投入` })
  }

  return moments.slice(0, 4)
}

/* ═══════════════════════════════════════════════
 * NextStep —— 下一步建议（规则引擎，一期不接 AI）
 * ═══════════════════════════════════════════════ */
export interface NextStep {
  text: string
}

export function deriveNextStep(trends: AbilityTrend[], streak: number, grewToday: boolean): NextStep {
  const byId = Object.fromEntries(trends.map(t => [t.ability.id, t]))
  const up = (id: CoreAbilityId) => byId[id]?.direction === 'up'
  const down = (id: CoreAbilityId) => byId[id]?.direction === 'down'

  // 规则：恢复率提高但连续天数下降 → 保持节奏，不追求强度
  if (up('recovery') && down('persistence')) return { text: '保持节奏，不追求强度——先把连续找回来。' }
  // 规则：专注时间显著提高 → 尝试更长深度训练
  if (up('focus') && (byId['focus']?.changePct ?? 0) >= 20) return { text: '你的专注在变强，可以尝试更长一段深度投入。' }
  // 今天还没成长 → 轻量推动连续
  if (!grewToday) return { text: streak > 0 ? `今天投入一小段，别让 ${streak} 天的连续停下来。` : '今天投入一小段专注，就是成长的开始。' }
  // 坚持下滑
  if (down('persistence')) return { text: '最近节奏有点断，明天继续出现就好。' }
  return { text: '保持当前的节奏，你在稳步前进。' }
}

/* ═══════════════════════════════════════════════
 * GrowthDirection —— 成长方向（系统从行为推导，不让用户选）
 * ═══════════════════════════════════════════════ */
export interface GrowthDirection {
  title: string
  abilities: string[]
}

export function deriveGrowthDirection(sessions: Session[], missions: Mission[]): GrowthDirection {
  // 统计 subject 出现（按专注时长加权）
  const byId = new Map(missions.map(m => [m.id, m]))
  const subjMs = new Map<string, number>()
  let totalMs = 0
  for (const s of sessions) {
    const fm = s.focusDurationMs || 0
    if (fm <= 0) continue
    totalMs += fm
    const subj = byId.get(s.missionId)?.subject?.trim()
    if (subj) subjMs.set(subj, (subjMs.get(subj) || 0) + fm)
  }
  if (totalMs === 0) return { title: '探索者', abilities: ['专注能力'] }

  const top = Array.from(subjMs.entries()).sort((a, b) => b[1] - a[1])
  const topSubjects = top.slice(0, 3).map(([s]) => s)

  // 领域能力：从 subject 的 GrowthImpact 中聚合权重最高的领域能力
  const domainAgg = new Map<string, number>()
  for (const [subj] of top) {
    const impact = impactForSubject(subj)
    for (const [k, w] of Object.entries(impact.weights)) {
      // 只收集领域能力（中文命名），核心能力单独呈现
      if (!['learning', 'focus', 'persistence', 'recovery'].includes(k)) {
        domainAgg.set(k, (domainAgg.get(k) || 0) + w)
      }
    }
  }
  const domains = Array.from(domainAgg.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k)

  // 方向原型
  const hasAcademic = topSubjects.some(s => ['数学', '物理', '化学', '生物', '语文', '英语'].includes(s))
  const hasReading = topSubjects.some(s => s === '阅读' || s.includes('读'))
  const title = hasAcademic ? '知识构建者' : hasReading ? '深度阅读者' : '专注修炼者'

  return { title, abilities: [...domains, '专注能力', '坚持能力'].slice(0, 4) }
}
