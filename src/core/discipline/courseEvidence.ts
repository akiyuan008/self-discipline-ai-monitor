/**
 * src/core/discipline/courseEvidence.ts
 * 课程拍照核验 → Evidence 统一收编（V3 Phase 9）。
 *
 * 数据流：
 *   Course Photo → Photo Evidence → Verification(AI Recommendation)
 *              → ResultEvaluator → Mission Result
 *
 * 硬规则：
 *   - CourseTask 不再拥有独立的"拍照即完成"事实来源；Evidence 是统一 SoT。
 *   - 不创建 Course-specific Evidence Model；统一用现有 Evidence / VerificationRecommendation / ResultEvaluator。
 *   - AI 只是 Verification Recommendation，不直接成为完成事实。
 *   - 幂等：同一 classTaskId 的 photo 证据只生成一次（refId 去重）。
 */
import { useMissionStore } from './missionStore'
import { useSessionStore } from './sessionStore'
import { tryComplete } from './disciplineEngine'
import { mergeIntervalsMs } from './focusMath'
import { buildCoursePhotoEvidence, hasPhotoEvidenceForRef } from './courseEvidenceCore'
import type { FocusInterval } from './types'

/**
 * 记录"已核验出勤"的专注区间（photo 通过 = 证明该节课全程出勤）。
 * 幂等：已有 tag='course-verified' 区间则不重复添加。
 * 使 actualStudyMs 达到目标时长，满足 ResultEvaluator 的时长门槛。
 */
function recordVerifiedAttendance(missionId: string) {
  const mStore = useMissionStore.getState()
  const m = mStore.getMission(missionId)
  if (!m) return
  if ((m.focusIntervals || []).some(iv => iv.tag === 'course-verified')) return
  const attendance: FocusInterval = {
    source: 'APP_USAGE',
    startedAt: m.plannedStart,
    endedAt: m.plannedEnd,
    tag: 'course-verified'
  }
  const focusIntervals = [...(m.focusIntervals || []), attendance]
  const sessionSegs = useSessionStore.getState().getSessionsByMission(missionId).flatMap(s => s.segments)
  const actualStudyMs = mergeIntervalsMs([...focusIntervals, ...sessionSegs])
  mStore.updateMission(missionId, { focusIntervals, actualStudyMs })
}

/**
 * 提交课程拍照证据并走统一完成判定。
 *   - 创建 photo Evidence（weight 反映 AI 是否通过；未通过不计客观分）
 *   - 创建 VerificationRecommendation（ACCEPTED / REJECTED）
 *   - AI 通过 → 记录出勤 + tryComplete（ResultEvaluator 决定）
 * 幂等：同一 classTaskId 已有 photo 证据则跳过。
 */
export function submitCoursePhotoEvidence(missionId: string, opts: {
  classTaskId: string
  photoPath?: string
  aiPassed: boolean
  aiScore?: number
  aiReview?: string
}): { completed: boolean } {
  const store = useMissionStore.getState()
  const m = store.getMission(missionId)
  if (!m) return { completed: false }

  // 幂等：同一 classTaskId 的 photo 证据只生成一次
  if (hasPhotoEvidenceForRef(m.evidence, opts.classTaskId)) {
    return { completed: m.status === 'COMPLETED' }
  }

  const now = Date.now()
  const { evidence: ev, recommendation: rec } = buildCoursePhotoEvidence({
    missionId,
    classTaskId: opts.classTaskId,
    photoPath: opts.photoPath,
    aiPassed: opts.aiPassed,
    aiScore: opts.aiScore,
    aiReview: opts.aiReview,
    ts: now
  })
  store.updateMission(missionId, {
    evidence: [...(m.evidence || []), ev],
    recommendations: [...(m.recommendations || []), rec]
  })

  if (opts.aiPassed) {
    recordVerifiedAttendance(missionId)
    tryComplete(missionId)
    return { completed: useMissionStore.getState().getMission(missionId)?.status === 'COMPLETED' }
  }
  return { completed: false }
}
