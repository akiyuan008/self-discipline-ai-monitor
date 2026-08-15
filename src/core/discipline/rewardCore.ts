/**
 * src/core/discipline/rewardCore.ts
 * 奖励纯逻辑（V3 Phase 10A）—— 不依赖 store，可独立测试。
 * store 编排（recordReward / grantMissionReward）见 rewardStore.ts / rewardEngine.ts。
 *
 * 幂等基于稳定 eventId（非 PTS/XP 余额）。
 */
import type { Mission, RewardTransaction, FocusInterval } from './types'
import { REWARD } from './config'
import { SCHEDULE, getPeriodTime } from '../../data/schedule'

// ═══════════════════════════════════════════════════════════
// eventId（稳定幂等键）
// ═══════════════════════════════════════════════════════════
export function completionEventId(missionId: string): string {
  return `mission-complete:${missionId}`
}
export function recoveryEventId(sessionId: string, recoveryCount: number): string {
  return `recovery:${sessionId}:#${recoveryCount}`
}
export function missedEventId(missionId: string): string {
  return `missed:${missionId}`
}

/** 幂等判断：transactions 中已存在该 eventId → 已处理 */
export function isAlreadyIssued(transactions: RewardTransaction[] | undefined, eventId: string): boolean {
  return (transactions || []).some(t => t.eventId === eventId)
}

// ═══════════════════════════════════════════════════════════
// 课程 Mission 判定与奖励
// ═══════════════════════════════════════════════════════════
export function isCourseMission(m: Mission): boolean {
  return m.source === 'SCHEDULE' && m.requiresEvidence === true
}

/** 课程奖励计算的输入（缺失记 null，不猜测） */
export interface CourseRewardParts {
  baseReward: number | null
  completedAt: number | null
  classEndTime: number | null
  aiScore: number | null
}

export interface CourseRewardResult {
  points: number
  xp: number
  onTime: boolean | null
  onTimeSource: string | null
  onTimeBonus: number
  aiBonus: number
  baseXp: number
  aiXpBonus: number
}

/**
 * 课程奖励纯计算（null 安全，显式 fallback，不猜测）。
 *   PTS = baseReward + 准点(+15, 仅 onTime===true) + AI(+25, 仅 aiScore≥80)
 *   XP  = 50 + (aiScore≥90 ? 30 : 0)
 *   onTime 仅在 completedAt 与 classEndTime 均存在时判定；null → 不加准点 bonus。
 */
export function computeCourseRewardFromParts(p: CourseRewardParts): CourseRewardResult {
  const baseReward = p.baseReward ?? 0
  let onTime: boolean | null = null
  let onTimeSource: string | null = null
  if (p.completedAt != null && p.classEndTime != null) {
    onTime = p.completedAt <= p.classEndTime
    onTimeSource = 'completedAt<=classEndTime(RECONSTRUCTED)'
  }
  const onTimeBonus = onTime === true ? 15 : 0
  const aiBonus = p.aiScore != null && p.aiScore >= 80 ? 25 : 0
  const baseXp = 50
  const aiXpBonus = p.aiScore != null && p.aiScore >= 90 ? 30 : 0
  return {
    points: baseReward + onTimeBonus + aiBonus,
    xp: baseXp + aiXpBonus,
    onTime,
    onTimeSource,
    onTimeBonus,
    aiBonus,
    baseXp,
    aiXpBonus
  }
}

/** 由 Mission 的 plannedStart 反推课表节次 */
export function findPeriodForMission(m: Mission): number | undefined {
  const d = new Date(m.plannedStart)
  for (let p = 1; p <= 12; p++) {
    const pd = getPeriodTime(p)
    if (!pd) continue
    const [sh, sm] = pd.startTime.split(':').map(Number)
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm).getTime()
    if (m.plannedStart === start) return p
  }
  return undefined
}

/** 从 Mission 的既有 ACCEPTED Recommendation 读 aiScore（不重新调 AI）；无则 null */
export function latestAcceptedAiScore(m: Mission): number | null {
  const recs = (m.recommendations || []).filter(r => r.status === 'ACCEPTED' && r.aiVerdict === 'pass')
  if (recs.length === 0) return null
  const latest = [...recs].sort((a, b) => b.createdAt - a.createdAt)[0]
  return Math.round(latest.confidence * 100)
}

/** 采集课程奖励所需 parts（baseReward 查 SCHEDULE；缺失记 null） */
export function gatherCourseRewardParts(m: Mission): CourseRewardParts {
  const period = findPeriodForMission(m)
  const dayOfWeek = new Date(m.plannedStart).getDay()
  let baseReward: number | null = null
  let classEndTime: number | null = null
  if (period != null) {
    const entry = SCHEDULE.find(s => s.dayOfWeek === dayOfWeek && s.period === period)
    if (entry) baseReward = entry.baseReward
    const pd = getPeriodTime(period)
    if (pd) {
      const [eh, em] = pd.endTime.split(':').map(Number)
      const d = new Date(m.plannedStart)
      classEndTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em).getTime()
    }
  }
  return {
    baseReward,
    completedAt: m.completedAt ?? null,
    classEndTime,
    aiScore: latestAcceptedAiScore(m)
  }
}

// ═══════════════════════════════════════════════════════════
// 通用 Mission 奖励（非课程；从 rewardEngine 抽取，纯函数）
// ═══════════════════════════════════════════════════════════
export function basePoints(m: Mission): number {
  return Math.max(REWARD.BASE_POINTS_MIN, Math.round(m.targetMinutes))
}
export function baseXpOf(m: Mission): number {
  return Math.max(10, Math.round(m.actualStudyMs / 60_000))
}

/**
 * 通用奖励纯计算。allFocusIntervals 由调用方合并（mission.focusIntervals + session.segments）。
 */
export function computeGenericReward(m: Mission, allFocusIntervals: FocusInterval[]): {
  points: number
  xp: number
  reasons: string[]
} {
  const reasons: string[] = []
  let points = basePoints(m)
  let xp = baseXpOf(m)
  reasons.push(`完成任务：${m.title}`)

  const totalMs = m.actualStudyMs + m.distractionMs
  if (totalMs > 0 && m.distractionMs / totalMs < REWARD.FOCUS_BONUS_DISTRACTION_RATIO) {
    points += REWARD.FOCUS_BONUS
    xp += REWARD.FOCUS_BONUS
    reasons.push('高度专注加成')
  }

  const hasAbyssDungeon = allFocusIntervals.some(iv => iv.source === 'DUNGEON' && iv.tag === 'abyss')
  if (hasAbyssDungeon) {
    points += REWARD.ABYSS_BONUS
    reasons.push('深渊重载挑战奖励')
  }

  return { points, xp, reasons }
}
