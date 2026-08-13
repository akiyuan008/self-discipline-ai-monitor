/**
 * src/core/discipline/resultResolver.ts
 * Result Resolver —— 适配层：从 Session/Mission 采集执行指标，调用纯函数 ResultEvaluator。
 *
 * 职责拆分：
 *   - resultEvaluator.ts 是纯函数（不碰 store），负责 metrics → rate/quality/outcome。
 *   - 本模块负责"把 Session/Mission 变成 ExecutionMetrics"，并组装成 SessionResult。
 *   - 仍不修改任何 store / XP / PTS / UI（写入由 disciplineEngine 决定）。
 */
import type { Session, Mission, SessionOutcome, SessionResult } from './types'
import { evaluateMission } from './missionEvaluator'
import { evaluateExecution, resolveOutcome, computeExecutionRate as evalRate } from './resultEvaluator'
import type { ExecutionMetrics } from './resultEvaluator'

/** 从单个 Session + Mission 采集执行指标（Session 级） */
export function metricsFromSession(session: Session, mission: Mission): ExecutionMetrics {
  return {
    focusDurationMs: session.focusDurationMs,
    distractionDurationMs: session.distractionDurationMs,
    deviationCount: session.deviationCount,
    recoveryCount: session.recoveryCount,
    targetMs: mission.targetMinutes * 60_000
  }
}

/** 汇总某 Mission 全部 Session 的指标（Mission 级，用于完成时的整体评估） */
export function metricsFromSessions(sessions: Session[], mission: Mission): ExecutionMetrics {
  return {
    focusDurationMs: sessions.reduce((s, x) => s + x.focusDurationMs, 0),
    distractionDurationMs: sessions.reduce((s, x) => s + x.distractionDurationMs, 0),
    deviationCount: sessions.reduce((s, x) => s + x.deviationCount, 0),
    recoveryCount: sessions.reduce((s, x) => s + x.recoveryCount, 0),
    targetMs: mission.targetMinutes * 60_000
  }
}

/**
 * 判定 Session 的最终 outcome（Stop / 切换任务时）。
 *  - Mission 聚合已达完成条件 → COMPLETED
 *  - 否则交给纯函数 resolveOutcome（PARTIAL / ABANDONED）
 */
export function resolveSessionOutcome(session: Session, mission: Mission): SessionOutcome {
  if (evaluateMission(mission).canComplete) return 'COMPLETED'
  return resolveOutcome(metricsFromSession(session, mission))
}

/** Session 执行率（兼容旧调用；委托纯函数） */
export function sessionExecutionRate(session: Session, mission: Mission): number {
  return evalRate(metricsFromSession(session, mission))
}

/**
 * 完整评估一个 Session → SessionResult（含三态 + 执行率 + 质量综合评分）。
 * 纯计算，不改任何 store；由 disciplineEngine 决定写入时机。
 */
export function evaluateSessionResult(session: Session, mission: Mission): SessionResult {
  const ev = evaluateExecution(metricsFromSession(session, mission))
  // 若 Mission 聚合已达完成条件，outcome 以 COMPLETED 为准
  const outcome: SessionOutcome = evaluateMission(mission).canComplete ? 'COMPLETED' : ev.outcome
  return {
    outcome,
    executionRate: ev.executionRate,
    executionQuality: ev.quality,
    qualityScore: ev.qualityScore,
    focusRatio: ev.focusRatio,
    recoveryRate: ev.recoveryRate,
    deviationScore: ev.deviationScore,
    focusDurationMs: session.focusDurationMs,
    distractionDurationMs: session.distractionDurationMs,
    deviationCount: session.deviationCount,
    recoveryCount: session.recoveryCount
  }
}

/**
 * Mission 完成时的整体评估（聚合全部 Session）→ SessionResult。
 */
export function evaluateMissionAggregateResult(sessions: Session[], mission: Mission): SessionResult {
  const ev = evaluateExecution(metricsFromSessions(sessions, mission))
  return {
    outcome: 'COMPLETED',
    executionRate: ev.executionRate,
    executionQuality: ev.quality,
    qualityScore: ev.qualityScore,
    focusRatio: ev.focusRatio,
    recoveryRate: ev.recoveryRate,
    deviationScore: ev.deviationScore,
    focusDurationMs: sessions.reduce((s, x) => s + x.focusDurationMs, 0),
    distractionDurationMs: sessions.reduce((s, x) => s + x.distractionDurationMs, 0),
    deviationCount: sessions.reduce((s, x) => s + x.deviationCount, 0),
    recoveryCount: sessions.reduce((s, x) => s + x.recoveryCount, 0)
  }
}
