/**
 * src/core/discipline/dailyReview.ts
 * DailyReview 确定性聚合（V3 Phase 6）—— 纯函数，不调 AI、不碰 store。
 *
 * DailyReview 是 Day End 的事实快照：planned/committed/started/completed/partial/abandoned
 * + executionRate/focusTime/deviationCount/recoveryCount/recoveryRate/executionQuality/reliabilityScore。
 * AI Insight 不参与这里的基础计算（On-Demand，见 aiSupervisor）。
 */
import type { Mission, Session, DailyReview, ReviewAggregate, SessionOutcome, ExecutionQuality } from './types'
import { RESULT } from './config'
import { gradeQuality } from './resultEvaluator'
import type { ExecutionMetrics } from './resultEvaluator'

/** 纯输入：某天的数据（由调用方从 store 采集后传入） */
export interface DayData {
  date: string
  missions: Mission[]
  sessions: Session[]
  /** DayPlan 内的 Mission id（planned） */
  plannedMissionIds: string[]
  /** 有效承诺为 COMMITTED 的 Mission id */
  committedMissionIds: string[]
}

/**
 * 判定单个 Mission 的最终结果（用于日度聚合）。
 *   COMPLETED  —— Mission 已完成
 *   PARTIAL    —— 有 Session 且有效专注 ≥ 阈值，但未完成
 *   ABANDONED  —— MISSED / 或开始过但几乎无有效执行
 *   NOT_STARTED—— 从未开始
 */
export function missionOutcome(mission: Mission, sessionsOfMission: Session[]): SessionOutcome | 'NOT_STARTED' {
  if (mission.status === 'COMPLETED') return 'COMPLETED'
  if (mission.status === 'MISSED') return 'ABANDONED'
  if (sessionsOfMission.length === 0 && !mission.startedAt) return 'NOT_STARTED'
  const focus = sessionsOfMission.reduce((s, x) => s + x.focusDurationMs, 0)
  if (focus >= RESULT.MEANINGFUL_EXECUTION_MS) return 'PARTIAL'
  return 'ABANDONED'
}

/** 生成某天的 DailyReview（纯函数） */
export function generateDailyReviewCore(data: DayData): DailyReview {
  const { date, missions, sessions, plannedMissionIds, committedMissionIds } = data

  let started = 0
  let completed = 0
  let partial = 0
  let abandoned = 0
  let totalFocus = 0
  let totalDistraction = 0
  let totalDeviations = 0
  let totalRecoveries = 0
  let totalTarget = 0

  for (const m of missions) {
    const sOfM = sessions.filter(s => s.missionId === m.id)
    const outcome = missionOutcome(m, sOfM)
    if (sOfM.length > 0 || m.startedAt) started++
    if (outcome === 'COMPLETED') completed++
    else if (outcome === 'PARTIAL') partial++
    else if (outcome === 'ABANDONED') abandoned++

    totalFocus += sOfM.reduce((s, x) => s + x.focusDurationMs, 0)
    totalDistraction += sOfM.reduce((s, x) => s + x.distractionDurationMs, 0)
    totalDeviations += sOfM.reduce((s, x) => s + x.deviationCount, 0)
    totalRecoveries += sOfM.reduce((s, x) => s + x.recoveryCount, 0)
    totalTarget += m.targetMinutes * 60_000
  }

  const executionRate = totalTarget > 0 ? Math.min(1, totalFocus / totalTarget) : 0
  const recoveryRate = totalDeviations > 0 ? Math.min(1, totalRecoveries / totalDeviations) : 1

  // 全天聚合执行质量（复用 Phase 4 模型）
  let executionQuality: ExecutionQuality = 'D'
  if (totalTarget > 0) {
    const agg: ExecutionMetrics = {
      focusDurationMs: totalFocus,
      distractionDurationMs: totalDistraction,
      deviationCount: totalDeviations,
      recoveryCount: totalRecoveries,
      targetMs: totalTarget
    }
    executionQuality = gradeQuality(agg)
  }

  // 可靠度 = 承诺的兑现程度（completed + 0.5*partial）/ committed
  const committed = committedMissionIds.length
  const reliabilityScore = committed > 0
    ? Math.min(1, (completed + 0.5 * partial) / committed)
    : 0

  return {
    date,
    planned: plannedMissionIds.length,
    committed,
    started,
    completed,
    partial,
    abandoned,
    executionRate,
    focusTimeMs: totalFocus,
    deviationCount: totalDeviations,
    recoveryCount: totalRecoveries,
    recoveryRate,
    executionQuality,
    reliabilityScore,
    generatedAt: Date.now()
  }
}

/** 多日 DailyReview 聚合（7天/30天，供 AI Insight 读取） */
export function aggregateReviews(reviews: DailyReview[]): ReviewAggregate {
  const days = reviews.length
  const dist: Record<ExecutionQuality, number> = { A: 0, B: 0, C: 0, D: 0 }
  if (days === 0) {
    return {
      days: 0, totalFocusMs: 0, avgExecutionRate: 0, totalDeviations: 0,
      totalRecoveries: 0, avgRecoveryRate: 1, totalCompleted: 0, totalCommitted: 0,
      avgReliabilityScore: 0, qualityDistribution: dist
    }
  }
  const sum = (f: (r: DailyReview) => number) => reviews.reduce((s, r) => s + f(r), 0)
  reviews.forEach(r => { dist[r.executionQuality] = (dist[r.executionQuality] || 0) + 1 })
  return {
    days,
    totalFocusMs: sum(r => r.focusTimeMs),
    avgExecutionRate: sum(r => r.executionRate) / days,
    totalDeviations: sum(r => r.deviationCount),
    totalRecoveries: sum(r => r.recoveryCount),
    avgRecoveryRate: sum(r => r.recoveryRate) / days,
    totalCompleted: sum(r => r.completed),
    totalCommitted: sum(r => r.committed),
    avgReliabilityScore: sum(r => r.reliabilityScore) / days,
    qualityDistribution: dist
  }
}
