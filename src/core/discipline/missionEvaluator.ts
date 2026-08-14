/**
 * src/core/discipline/missionEvaluator.ts
 * 完成判定器 —— Evidence 证据驱动（V3 Phase 5 接入双层证据模型）。
 *
 * 原则：
 *   - TIME_BASED：行为监测（有效学习时长达标）即可判定完成。
 *   - OUTCOME_BASED（requiresEvidence）：需经 EvidenceEvaluator 验证
 *     （客观证据达标 / 用户自述 / AI 建议已获用户确认）。
 *   - ⚠️ AI recommendation 不直接计入客观证据分，也不自动判完成（Phase 5 硬规则）。
 */
import type { Mission, Evidence, EvidenceType, EvidenceTier } from './types'
import { COMPLETION, EVIDENCE_WEIGHT } from './config'
import { evaluateEvidence } from './evidenceEvaluator'

export interface EvaluationResult {
  /** 是否可判定完成 */
  canComplete: boolean
  /** 是否还需要额外证据（如拍照/用户确认） */
  needsEvidence: boolean
  /** 客观证据分 0-1（不含 AI） */
  evidenceScore: number
  reason: string
}

/** 各证据类型的基准权重（收敛到 config；可被单条 evidence.weight 覆盖） */
const EVIDENCE_BASE_WEIGHT: Record<EvidenceType, number> = { ...EVIDENCE_WEIGHT }

/** 完成任务所需的有效学习时长占目标的比例（收敛到 config） */
const COMPLETION_RATIO = COMPLETION.RATIO

/** 由 type 派生 tier */
function tierOfType(type: EvidenceType): EvidenceTier {
  if (type === 'usageStats' || type === 'photo' || type === 'screenshot') return 'OBJECTIVE'
  if (type === 'manual') return 'USER_ASSERTION'
  return 'AI_RECOMMENDATION'
}

export function makeEvidence(type: EvidenceType, payload?: string, weight?: number): Evidence {
  return {
    type,
    tier: tierOfType(type),
    weight: weight ?? EVIDENCE_BASE_WEIGHT[type] ?? 0.5,
    ts: Date.now(),
    payload
  }
}

/**
 * 评估一个 Mission 是否可以完成。
 * @param mission 当前任务
 * @returns 判定结果
 */
export function evaluateMission(mission: Mission): EvaluationResult {
  const targetMs = mission.targetMinutes * 60_000
  if (targetMs <= 0) {
    return { canComplete: true, needsEvidence: false, evidenceScore: 1, reason: '目标时长为0，直接完成' }
  }

  const ratio = mission.actualStudyMs / targetMs

  // OUTCOME_BASED：需 EvidenceEvaluator 验证（客观证据/用户自述/已确认的 AI 建议）
  if (mission.requiresEvidence) {
    const ev = evaluateEvidence(mission.evidence, mission.recommendations)
    if (ratio >= COMPLETION_RATIO && ev.verified) {
      return { canComplete: true, needsEvidence: false, evidenceScore: ev.objectiveScore, reason: ev.reason }
    }
    if (ratio >= COMPLETION_RATIO) {
      return { canComplete: false, needsEvidence: true, evidenceScore: ev.objectiveScore, reason: ev.reason }
    }
    return { canComplete: false, needsEvidence: true, evidenceScore: ev.objectiveScore, reason: '行为时长与证据均不足' }
  }

  // TIME_BASED：行为监测达标即完成（不需要拍照）
  if (ratio >= COMPLETION_RATIO) {
    return { canComplete: true, needsEvidence: false, evidenceScore: ratio, reason: '有效学习时长达标' }
  }

  return { canComplete: false, needsEvidence: false, evidenceScore: ratio, reason: `有效学习时长不足（${Math.round(ratio * 100)}%）` }
}
