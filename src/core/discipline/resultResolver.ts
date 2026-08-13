/**
 * src/core/discipline/resultResolver.ts
 * Session 结果判定（V3 Phase 2 最小版）。
 *
 * 目的：修复 P1 —— "Stop 机械等价 Abandoned"。
 * 用户主动停止 / 切换任务时，Session 的最终 outcome 由实际执行结果决定，
 * 而不是一律写 ABANDONED。
 *
 * Phase 4 将扩展为完整 ResultEvaluator：三态(COMPLETED/PARTIAL/ABANDONED)
 * + executionRate + executionQuality(A/B/C/D)，并按 TIME/OUTCOME 任务类型分流。
 */
import type { Session, Mission, SessionOutcome } from './types'
import { evaluateMission } from './missionEvaluator'
import { RESULT } from './config'

/**
 * 判定 Session 的最终 outcome。
 *  - 完成条件已满足          → COMPLETED
 *  - 有有效执行（≥ 阈值）     → PARTIAL（做了一部分，不是失败）
 *  - 几乎没有执行            → ABANDONED
 */
export function resolveSessionOutcome(session: Session, mission: Mission): SessionOutcome {
  if (evaluateMission(mission).canComplete) return 'COMPLETED'
  if (session.focusDurationMs >= RESULT.MEANINGFUL_EXECUTION_MS) return 'PARTIAL'
  return 'ABANDONED'
}

/** 计算执行率（实际专注 / 目标时长，封顶 1） */
export function computeExecutionRate(session: Session, mission: Mission): number {
  const targetMs = mission.targetMinutes * 60_000
  if (targetMs <= 0) return session.focusDurationMs > 0 ? 1 : 0
  return Math.min(1, session.focusDurationMs / targetMs)
}
