/**
 * src/core/discipline/resultEvaluator.ts
 * ResultEvaluator（V3 Phase 4）—— 时间型任务的执行质量评估。
 *
 * 【硬约束】本模块全部为纯函数：
 *   - 不 import 任何 store（missionStore / sessionStore / useStore）
 *   - 不修改 XP / PTS / Mission Store / UI 状态
 *   - 同样的输入永远得到同样的 A/B/C/D
 *   这样 Phase 4 后可以轻松验证"同一组行为数据为什么得到 A/B/C/D"。
 *
 * 链路：Session → 实际执行指标 → ExecutionRate → QualityScore → COMPLETED/PARTIAL/ABANDONED
 *
 * Phase 4 只处理 TIME_BASED。OUTCOME_BASED 的 Evidence 验收留给 Phase 5。
 */
import { QUALITY, COMPLETION, RESULT } from './config'
import type { ExecutionQuality, SessionOutcome } from './types'

/** 执行指标（纯数据，由调用方从 Session/Mission 采集后传入） */
export interface ExecutionMetrics {
  focusDurationMs: number
  distractionDurationMs: number
  deviationCount: number
  recoveryCount: number
  /** 目标时长（ms） */
  targetMs: number
}

/** 完整评估结果 */
export interface ExecutionEvaluation {
  executionRate: number
  focusRatio: number
  recoveryRate: number
  deviationScore: number
  qualityScore: number
  quality: ExecutionQuality
  outcome: SessionOutcome
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

/** ExecutionRate = 实际专注 / 目标时长（封顶 1） */
export function computeExecutionRate(m: ExecutionMetrics): number {
  if (m.targetMs <= 0) return m.focusDurationMs > 0 ? 1 : 0
  return clamp01(m.focusDurationMs / m.targetMs)
}

/** FocusRatio = 专注 /（专注+分心）；无任何数据时记 1（无分心证据） */
export function computeFocusRatio(m: ExecutionMetrics): number {
  const denom = m.focusDurationMs + m.distractionDurationMs
  if (denom <= 0) return 1
  return clamp01(m.focusDurationMs / denom)
}

/** RecoveryRate = 恢复次数/偏离次数；无偏离时 = 1（避免 0/0，也不惩罚未偏离者） */
export function computeRecoveryRate(m: ExecutionMetrics): number {
  if (m.deviationCount <= 0) return 1
  return clamp01(m.recoveryCount / m.deviationCount)
}

/** DeviationScore = max(0, 1 - deviationCount/NORMALIZER) */
export function computeDeviationScore(m: ExecutionMetrics): number {
  return Math.max(0, 1 - m.deviationCount / QUALITY.DEVIATION_NORMALIZER)
}

/** QualityScore = 加权综合（ExecutionRate/FocusRatio/RecoveryRate/DeviationScore） */
export function computeQualityScore(m: ExecutionMetrics): number {
  const rate = computeExecutionRate(m)
  const focus = computeFocusRatio(m)
  const recovery = computeRecoveryRate(m)
  const dev = computeDeviationScore(m)
  return clamp01(
    rate * QUALITY.W_RATE +
    focus * QUALITY.W_FOCUS +
    recovery * QUALITY.W_RECOVERY +
    dev * QUALITY.W_DEVIATION
  )
}

/**
 * 质量档位（含硬门槛）：
 *   1) 按 QualityScore 定档：A≥0.85 / B≥0.70 / C≥0.50 / D<0.50
 *   2) FocusRatio < FOCUS_RATIO_CAP_C → 最高 C（压掉 A/B）
 *   3) ExecutionRate < EXECUTION_RATE_GATE_D → 直接 D（最强门槛）
 */
export function gradeQuality(m: ExecutionMetrics): ExecutionQuality {
  const score = computeQualityScore(m)
  const rate = computeExecutionRate(m)
  const focus = computeFocusRatio(m)

  let grade: ExecutionQuality
  if (score >= QUALITY.GRADE_A) grade = 'A'
  else if (score >= QUALITY.GRADE_B) grade = 'B'
  else if (score >= QUALITY.GRADE_C) grade = 'C'
  else grade = 'D'

  // 硬门槛 1：FocusRatio 过低 → 最高 C
  if (focus < QUALITY.FOCUS_RATIO_CAP_C && (grade === 'A' || grade === 'B')) grade = 'C'
  // 硬门槛 2：ExecutionRate 过低 → 直接 D
  if (rate < QUALITY.EXECUTION_RATE_GATE_D) grade = 'D'

  return grade
}

/**
 * 三态结果（TIME_BASED）：
 *   COMPLETED —— ExecutionRate 达完成线
 *   PARTIAL   —— 有有效执行（≥ 有意义阈值）但未达完成线
 *   ABANDONED —— 几乎无有效执行
 */
export function resolveOutcome(m: ExecutionMetrics): SessionOutcome {
  const rate = computeExecutionRate(m)
  if (rate >= COMPLETION.RATIO) return 'COMPLETED'
  if (m.focusDurationMs >= RESULT.MEANINGFUL_EXECUTION_MS) return 'PARTIAL'
  return 'ABANDONED'
}

/** 一次性完整评估（纯函数入口） */
export function evaluateExecution(m: ExecutionMetrics): ExecutionEvaluation {
  return {
    executionRate: computeExecutionRate(m),
    focusRatio: computeFocusRatio(m),
    recoveryRate: computeRecoveryRate(m),
    deviationScore: computeDeviationScore(m),
    qualityScore: computeQualityScore(m),
    quality: gradeQuality(m),
    outcome: resolveOutcome(m)
  }
}
