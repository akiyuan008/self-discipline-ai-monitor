/**
 * src/core/discipline/evidenceEvaluator.ts
 * EvidenceEvaluator（V3 Phase 5）—— 双层证据评估（纯函数）。
 *
 * 【硬约束】纯函数：不 import store，不改 XP/PTS/Mission Store/UI。
 *
 * 模型：
 *   Objective Evidence（usageStats/photo/screenshot）→ 计入 Objective Evidence Score
 *   User Assertion（manual）→ 用户自述（布尔存在，作为验证来源之一）
 *   AI → VerificationRecommendation（PENDING/ACCEPTED/REJECTED），不计入客观分
 *
 * 硬规则：AI recommendation 本身不得直接改变最终任务完成事实。
 *   只有当 AI 建议被用户 ACCEPTED 后，才作为"用户确认"这一验证来源生效。
 */
import { EVIDENCE } from './config'
import type { Evidence, EvidenceTier, VerificationRecommendation } from './types'

export type VerificationSource = 'OBJECTIVE' | 'USER_ASSERTION' | 'AI_ACCEPTED'

export interface EvidenceEvaluation {
  /** 客观证据分（仅 usageStats/photo/screenshot，封顶 1） */
  objectiveScore: number
  /** 是否存在用户自述（manual） */
  hasUserAssertion: boolean
  /** 最新一条 AI 建议（若有） */
  latestRecommendation?: VerificationRecommendation
  /** 是否已验证（可判定完成） */
  verified: boolean
  /** 验证来源 */
  verificationSource?: VerificationSource
  reason: string
}

/** 由 type 派生所属层（旧数据无 tier 字段时兜底） */
export function tierOf(e: Evidence): EvidenceTier {
  if (e.tier) return e.tier
  switch (e.type) {
    case 'usageStats':
    case 'photo':
    case 'screenshot':
      return 'OBJECTIVE'
    case 'manual':
      return 'USER_ASSERTION'
    case 'ai':
    default:
      return 'AI_RECOMMENDATION'
  }
}

/** 客观层证据的基准权重 */
function objectiveWeight(e: Evidence): number {
  // 优先用证据自带 weight；否则按类型取默认
  if (typeof e.weight === 'number' && e.weight > 0) return e.weight
  switch (e.type) {
    case 'usageStats': return EVIDENCE.WEIGHT_USAGE_STATS
    case 'photo': return EVIDENCE.WEIGHT_PHOTO
    case 'screenshot': return EVIDENCE.WEIGHT_SCREENSHOT
    default: return 0
  }
}

/**
 * 客观证据分：只统计 OBJECTIVE 层（usageStats/photo/screenshot）。
 * ⚠️ manual 与 ai 一律不计入；旧 'ai' 证据在此被天然排除。
 */
export function objectiveEvidenceScore(evidence: Evidence[]): number {
  const sum = evidence
    .filter(e => tierOf(e) === 'OBJECTIVE')
    .reduce((s, e) => s + objectiveWeight(e), 0)
  return Math.min(1, sum)
}

/** 取最新一条 AI 建议（按 createdAt 降序） */
export function latestRecommendation(
  recommendations: VerificationRecommendation[] | undefined
): VerificationRecommendation | undefined {
  if (!recommendations || recommendations.length === 0) return undefined
  return [...recommendations].sort((a, b) => b.createdAt - a.createdAt)[0]
}

/**
 * 完整证据评估（纯函数）。
 * 判定优先级：客观证据达标 → 用户自述 → AI 建议已被用户接受。
 * AI 建议 PENDING / REJECTED 均不构成验证。
 */
export function evaluateEvidence(
  evidence: Evidence[],
  recommendations?: VerificationRecommendation[]
): EvidenceEvaluation {
  const objectiveScore = objectiveEvidenceScore(evidence)
  const hasUserAssertion = evidence.some(e => tierOf(e) === 'USER_ASSERTION')
  const latest = latestRecommendation(recommendations)

  // 1) 客观证据达标
  if (objectiveScore >= EVIDENCE.OBJECTIVE_VERIFY_THRESHOLD) {
    return {
      objectiveScore, hasUserAssertion, latestRecommendation: latest,
      verified: true, verificationSource: 'OBJECTIVE',
      reason: `客观证据达标（${objectiveScore.toFixed(2)} ≥ ${EVIDENCE.OBJECTIVE_VERIFY_THRESHOLD}）`
    }
  }
  // 2) 用户自述
  if (hasUserAssertion) {
    return {
      objectiveScore, hasUserAssertion, latestRecommendation: latest,
      verified: true, verificationSource: 'USER_ASSERTION',
      reason: '用户自述确认'
    }
  }
  // 3) AI 建议已被用户接受（用户确认 = 验证来源，但 AI 本身非客观证据）
  if (latest && latest.status === 'ACCEPTED' && latest.aiVerdict === 'pass') {
    return {
      objectiveScore, hasUserAssertion, latestRecommendation: latest,
      verified: true, verificationSource: 'AI_ACCEPTED',
      reason: 'AI 建议已获用户确认'
    }
  }
  // 未验证
  if (latest && latest.status === 'PENDING') {
    return {
      objectiveScore, hasUserAssertion, latestRecommendation: latest,
      verified: false,
      reason: 'AI 建议待用户确认（PENDING）'
    }
  }
  return {
    objectiveScore, hasUserAssertion, latestRecommendation: latest,
    verified: false,
    reason: '证据不足'
  }
}
