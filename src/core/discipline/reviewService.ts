/**
 * src/core/discipline/reviewService.ts
 * DayPlan / DailyReview 服务层（V3 Phase 6）—— 从各 store 采集数据，调用纯函数聚合。
 *
 * 架构边界：Schedule → Mission → DayPlan → Commitment → Session → Result → DailyReview。
 * DayPlan 由当日 Mission 自动同步（默认 PLANNED，需用户 Commitment 才 COMMITTED）。
 */
import { useMissionStore } from './missionStore'
import { useSessionStore } from './sessionStore'
import { useDayPlanStore } from './dayPlanStore'
import { useReviewStore } from './reviewStore'
import { generateDailyReviewCore } from './dailyReview'
import type { DayPlan, DailyReview } from './types'

/** 确保当日 DayPlan 存在并与当日 Mission 同步（PLANNED，默认不 COMMITTED） */
export function ensureDayPlan(date: string): DayPlan {
  const dpstore = useDayPlanStore.getState()
  const missionIds = useMissionStore.getState().getMissionsByDate(date).map(m => m.id)
  const existing = dpstore.getDayPlanByDate(date)
  if (!existing) {
    return dpstore.createDayPlan({ date, missionIds })
  }
  dpstore.syncMissions(date, missionIds)
  return useDayPlanStore.getState().getDayPlanByDate(date)!
}

/** 采集数据并生成某天的 DailyReview（纯聚合，不保存） */
export function gatherDailyReview(date: string): DailyReview {
  const mstore = useMissionStore.getState()
  const sstore = useSessionStore.getState()
  const dpstore = useDayPlanStore.getState()

  const missions = mstore.getMissionsByDate(date)
  const missionIdSet = new Set(missions.map(m => m.id))
  const sessions = sstore.sessions.filter(s => missionIdSet.has(s.missionId))
  const plan = dpstore.getDayPlanByDate(date)
  const plannedMissionIds = plan ? plan.missionIds : missions.map(m => m.id)
  const committedMissionIds = plannedMissionIds.filter(
    mid => dpstore.effectiveCommitment(date, mid) === 'COMMITTED'
  )

  return generateDailyReviewCore({ date, missions, sessions, plannedMissionIds, committedMissionIds })
}

/** Day End：生成 DailyReview 快照、保存、并把 DayPlan 置为 RESULT */
export function finalizeDailyReview(date: string): DailyReview {
  const review = gatherDailyReview(date)
  useReviewStore.getState().saveDailyReview(review)
  useDayPlanStore.getState().markResult(date)
  return review
}
