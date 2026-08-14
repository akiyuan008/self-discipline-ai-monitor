/**
 * src/core/discipline/legacyBridge.ts
 * 遗留系统桥接（V3 Phase 7）。
 *
 * 目标：旧系统不再制造第二套事实来源，同时不破坏现有功能。
 *   1. CommitmentBreak：替代旧"entertainment>study → -50 PTS"，只记录事实不扣分。
 *   2. currentTask → missionStore：遗留课程任务开始时，把对应 SCHEDULE Mission
 *      设为当前 Mission（执行状态归 Session/missionStore，单一事实来源）。
 *
 * 注意：课程拍照核验（Photo Verification → Evidence → Mission）不在 Phase 7，
 *       留待 Phase 9。
 */
import { useMissionStore } from './missionStore'
import { useSessionStore } from './sessionStore'
import { useReviewStore } from './reviewStore'
import { startMission } from './disciplineEngine'
import { submitCoursePhotoEvidence } from './courseEvidence'
import { getPeriodTime } from '@/data/schedule'
import { localDateStr } from '@/lib/dateUtils'
import { logger } from '@/lib/logger'
import type { CommitmentBreak, Mission } from './types'

/**
 * 记录一条 CommitmentBreak（承诺中断）。不扣 PTS。
 * 由遗留监测（entertainment>study）触发；自动附带当前 Mission/Session 上下文。
 */
export function recordMonitorCommitmentBreak(reason: string): CommitmentBreak {
  const mission = useMissionStore.getState().getCurrentMission()
  const session = useSessionStore.getState().getCurrentSession()
  const cb: CommitmentBreak = {
    id: `cb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    missionId: mission?.id,
    sessionId: session?.id,
    detectedAt: Date.now(),
    reason
  }
  useReviewStore.getState().recordCommitmentBreak(cb)
  logger.info('legacyBridge', `CommitmentBreak 记录（不扣分）`, { reason, missionId: cb.missionId })
  return cb
}

/** 依据课表节次找到当日对应的 SCHEDULE Mission */
export function findMissionForPeriod(period: number): Mission | undefined {
  const periodDef = getPeriodTime(period)
  if (!periodDef) return undefined
  const [sh, sm] = periodDef.startTime.split(':').map(Number)
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm).getTime()
  return useMissionStore
    .getState()
    .getMissionsByDate(localDateStr())
    .find(m => m.source === 'SCHEDULE' && m.plannedStart === start)
}

/**
 * 遗留课程任务开始时调用：把对应 SCHEDULE Mission 设为当前 Mission。
 * 使 missionStore.currentMissionId 成为唯一"当前任务"事实来源。
 * 已完成/已错过的 Mission 不再重启。
 */
export function startMissionForClassTask(period: number): void {
  const mission = findMissionForPeriod(period)
  if (!mission) {
    logger.debug('legacyBridge', `未找到第${period}节对应 Mission，跳过桥接`)
    return
  }
  if (mission.status === 'COMPLETED' || mission.status === 'MISSED') return
  startMission(mission.id)
  logger.info('legacyBridge', `课程任务 → Mission 桥接`, { period, missionId: mission.id, title: mission.title })
}

/**
 * 课程拍照核验 → Evidence（Phase 9）。
 * 由 classTaskStore.completeClassTask 调用：按节次定位当日 Mission，
 * 把照片证据 + AI 核验建议提交给统一 Evidence/ResultEvaluator。
 * CourseTask 不再独立"拍照即完成"；完成事实由 Mission(Evidence) 承载。
 */
export function submitCoursePhotoEvidenceForTask(
  task: { period: number },
  opts: { classTaskId: string; photoPath?: string; aiPassed: boolean; aiScore?: number; aiReview?: string }
): { completed: boolean } {
  const mission = findMissionForPeriod(task.period)
  if (!mission) {
    logger.debug('legacyBridge', `拍照核验未找到第${task.period}节 Mission，跳过证据提交`)
    return { completed: false }
  }
  return submitCoursePhotoEvidence(mission.id, opts)
}
