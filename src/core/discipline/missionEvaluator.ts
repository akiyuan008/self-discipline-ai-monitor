/**
 * src/core/discipline/missionEvaluator.ts
 * 完成判定器 —— Evidence 证据驱动。
 *
 * 原则：拍照不再是默认完成条件，只是 Evidence Provider 之一。
 * 默认完成判断 = 行为监测（有效学习时长达标）。
 * 对 UsageStats 无法证明的任务（requiresEvidence），要求额外证据。
 *
 * 未来 Evidence 可扩展：usageStats / photo / screenshot / manual / ai。
 */
import type { Mission, Evidence, EvidenceType } from './types'

export interface EvaluationResult {
  /** 是否可判定完成 */
  canComplete: boolean
  /** 是否还需要额外证据（如拍照） */
  needsEvidence: boolean
  /** 证据充分度 0-1 */
  evidenceScore: number
  reason: string
}

/** 各证据类型的基准权重（可被单条 evidence.weight 覆盖） */
const EVIDENCE_BASE_WEIGHT: Record<EvidenceType, number> = {
  usageStats: 1.0,   // 行为监测是最可靠的证据
  photo: 0.8,
  screenshot: 0.7,
  manual: 0.5,
  ai: 0.9
}

/** 完成任务所需的有效学习时长占目标的比例 */
const COMPLETION_RATIO = 0.8

export function makeEvidence(type: EvidenceType, payload?: string, weight?: number): Evidence {
  return {
    type,
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

  // 任务需要"结果证据"（UsageStats 无法证明），且行为时长不足 → 需要证据
  if (mission.requiresEvidence) {
    const evidenceScore = mission.evidence.reduce((sum, e) => sum + e.weight, 0)
    if (ratio >= COMPLETION_RATIO && evidenceScore >= 0.6) {
      return { canComplete: true, needsEvidence: false, evidenceScore, reason: '行为时长达标且有充分证据' }
    }
    if (ratio >= COMPLETION_RATIO) {
      return { canComplete: false, needsEvidence: true, evidenceScore, reason: '行为时长达标，但需要补充证据（如拍照）' }
    }
    return { canComplete: false, needsEvidence: true, evidenceScore, reason: '行为时长与证据均不足' }
  }

  // 普通任务：行为监测达标即完成（不需要拍照）
  if (ratio >= COMPLETION_RATIO) {
    return { canComplete: true, needsEvidence: false, evidenceScore: ratio, reason: '有效学习时长达标' }
  }

  return { canComplete: false, needsEvidence: false, evidenceScore: ratio, reason: `有效学习时长不足（${Math.round(ratio * 100)}%）` }
}
