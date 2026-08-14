/**
 * src/core/discipline/courseEvidenceCore.ts
 * 课程证据的纯逻辑（V3 Phase 9）—— 不依赖 store，可独立测试。
 * store 编排见 courseEvidence.ts / courseMigration.ts。
 */
import { EVIDENCE } from './config'
import type { Evidence, VerificationRecommendation, RecommendationStatus } from './types'

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

/** 旧核验状态 → 统一 RecommendationStatus（保持原事实） */
export function mapLegacyVerifyStatus(passed: boolean): RecommendationStatus {
  return passed ? 'ACCEPTED' : 'REJECTED'
}

/** 幂等判断：evidence 中是否已有该 refId 的 photo 证据 */
export function hasPhotoEvidenceForRef(evidence: Evidence[] | undefined, refId: string): boolean {
  return (evidence || []).some(e => e.type === 'photo' && e.refId === refId)
}

/**
 * 构造课程拍照证据 + AI 核验建议（纯函数）。
 *   - AI 通过 → photo weight=0.8（计客观分）+ recommendation ACCEPTED
 *   - AI 未过 → photo weight=0（不计客观分）+ recommendation REJECTED
 *   - AI 始终是 Recommendation，不直接成为完成事实。
 */
export function buildCoursePhotoEvidence(opts: {
  missionId: string
  classTaskId: string
  photoPath?: string
  aiPassed: boolean
  aiScore?: number
  aiReview?: string
  ts?: number
  recId?: string
}): { evidence: Evidence; recommendation: VerificationRecommendation } {
  const ts = opts.ts ?? Date.now()
  const evidence: Evidence = {
    type: 'photo',
    tier: 'OBJECTIVE',
    weight: opts.aiPassed ? EVIDENCE.WEIGHT_PHOTO : 0,
    ts,
    payload: opts.photoPath,
    refId: opts.classTaskId
  }
  const recommendation: VerificationRecommendation = {
    id: opts.recId ?? `rec-${ts.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    missionId: opts.missionId,
    aiVerdict: opts.aiPassed ? 'pass' : 'fail',
    confidence: clamp01((opts.aiScore ?? 0) / 100),
    reason: opts.aiReview,
    status: mapLegacyVerifyStatus(opts.aiPassed),
    createdAt: ts,
    resolvedAt: ts
  }
  return { evidence, recommendation }
}
