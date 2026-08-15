/**
 * src/core/discipline/rewardEngine.ts
 * 奖励引擎 —— Mission 完成后统一发放 XP / PTS（V3 Phase 10A：唯一新增奖励来源）。
 *
 * 原则：
 *   - 页面 / Android / AI / classTaskStore 不直接发奖；所有新增奖励经此发放。
 *   - 幂等基于稳定 eventId（completionEventId / missedEventId），非 PTS/XP 余额。
 *   - 每次发放经 useRewardStore.recordReward 落流水（recordReward 本身不改余额）。
 *   - 课程 Mission 用课程规则（金额与 legacy 一致）；其余用通用规则。
 */
import type { Mission } from './types'
import { REWARD } from './config'
import { useSessionStore } from './sessionStore'
import { useRewardStore } from './rewardStore'
import {
  completionEventId, missedEventId, isCourseMission,
  gatherCourseRewardParts, computeCourseRewardFromParts, computeGenericReward
} from './rewardCore'

export interface RewardResult {
  points: number
  xp: number
  reasons: string[]
  /** 幂等命中（已发放过）→ 本次不再发 */
  alreadyIssued?: boolean
}

export interface RewardCallbacks {
  addPoints: (n: number) => void
  addXp: (n: number) => void
  addPointRecord: (type: 'earn' | 'spend', amount: number, reason: string) => void
  addExp?: (amount: number, reason: string) => void
  /** 奖励结算后驱动"积分变动"提示（Phase 10A：由 RewardEngine 统一产出，替代 legacy lastPointsChange） */
  onSettled?: (amount: number, reason: string) => void
}

/**
 * Mission 完成后发放奖励（幂等）。
 */
export function grantMissionReward(m: Mission, cb: RewardCallbacks): RewardResult {
  const eventId = completionEventId(m.id)
  if (useRewardStore.getState().hasRewardByEvent(eventId)) {
    return { points: 0, xp: 0, reasons: [], alreadyIssued: true }
  }

  let points: number
  let xp: number
  let reasons: string[]
  const course = isCourseMission(m)

  if (course) {
    const parts = gatherCourseRewardParts(m)
    const res = computeCourseRewardFromParts(parts)
    points = res.points
    xp = res.xp
    reasons = [`完成课程：${m.title}`]
  } else {
    const sessionSegs = useSessionStore.getState().getSessionsByMission(m.id).flatMap(s => s.segments)
    const allFocusIntervals = [...(m.focusIntervals || []), ...sessionSegs]
    const res = computeGenericReward(m, allFocusIntervals)
    points = res.points
    xp = res.xp
    reasons = res.reasons
  }

  // 应用余额
  cb.addPoints(points)
  if (cb.addExp) cb.addExp(xp, `完成任务：${m.title}`)
  else cb.addXp(xp)
  cb.addPointRecord('earn', points, `完成任务：${m.title}`)
  cb.onSettled?.(points, `完成任务：${m.title}`)

  // 落流水（幂等记录）
  useRewardStore.getState().recordReward({
    id: eventId,
    eventId,
    missionId: m.id,
    kind: course ? 'COURSE_COMPLETE' : 'MISSION_COMPLETE',
    points,
    xp,
    reason: reasons.join('；'),
    ts: Date.now(),
    sourceType: 'REWARD_ENGINE',
    migrationStatus: 'NONE'
  })

  return { points, xp, reasons }
}

/** 任务错过的惩罚（幂等；轻度，体现"恢复优先"） */
export function grantMissedPenalty(m: Mission, cb: RewardCallbacks): RewardResult {
  const eventId = missedEventId(m.id)
  if (useRewardStore.getState().hasRewardByEvent(eventId)) {
    return { points: 0, xp: 0, reasons: [], alreadyIssued: true }
  }
  const penalty = Math.min(REWARD.MISSED_PENALTY_MAX, Math.round(m.targetMinutes / 2))
  if (penalty > 0) {
    cb.addPoints(-penalty)
    cb.addPointRecord('spend', penalty, `错过任务：${m.title}`)
    cb.onSettled?.(-penalty, `错过任务：${m.title}`)
  }
  useRewardStore.getState().recordReward({
    id: eventId,
    eventId,
    missionId: m.id,
    kind: 'MISSED_PENALTY',
    points: -penalty,
    xp: 0,
    reason: `错过任务：${m.title}`,
    ts: Date.now(),
    sourceType: 'REWARD_ENGINE',
    migrationStatus: 'NONE'
  })
  return { points: -penalty, xp: 0, reasons: [`错过任务：${m.title}`] }
}
