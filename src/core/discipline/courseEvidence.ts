/**
 * src/core/discipline/courseEvidence.ts
 * 课程拍照核验 → Evidence 统一收编（V3 Phase 9 / Phase 10B）。
 *
 * 数据流：
 *   Course Photo → Verification
 *     ├── ACCEPTED → Photo Evidence VERIFIED → ResultEvaluator → Mission Result
 *     └── REJECTED → Photo Evidence REJECTED（独立持久化；≠ ABANDONED，不发奖）
 *
 * 硬规则：
 *   - Evidence 是统一 SoT；不创建 Course-specific Evidence Model。
 *   - AI 只是 Verification Recommendation，不直接成为完成事实。
 *   - REJECTED ≠ Mission ABANDONED：不改 Mission 状态、不 tryComplete、不发完成奖励。
 *   - 多次提交保留完整 Evidence 历史（REJECTED REJECTED … VERIFIED）。
 *   - 幂等：VERIFIED（weight>0）每任务只一条；REJECTED 每次提交各留一条（历史）。
 */
import { useMissionStore } from './missionStore'
import { useSessionStore } from './sessionStore'
import { tryComplete } from './disciplineEngine'
import { mergeIntervalsMs } from './focusMath'
import { buildCoursePhotoEvidence } from './courseEvidenceCore'
import type { FocusInterval } from './types'

/** 该任务是否已有 VERIFIED（weight>0）photo 证据 */
function hasVerifiedPhotoEvidence(mission: { evidence?: any[] } | undefined, classTaskId: string): boolean {
  return (mission?.evidence || []).some(
    e => e.type === 'photo' && e.refId === classTaskId && (e.weight ?? 0) > 0
  )
}

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
 * 提交课程拍照核验【通过】证据（ACCEPTED / VERIFIED）。
 *   - 创建 photo Evidence（weight=0.8，计客观分）+ ACCEPTED recommendation
 *   - 记录出勤 + tryComplete（ResultEvaluator 决定）
 * 幂等：该任务已有 VERIFIED（weight>0）photo 则跳过（防重复核验）；
 *       允许"先 REJECTED 后 VERIFIED"（保留完整历史）。
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

  // 幂等：已有 VERIFIED（weight>0）则跳过（防重复核验）
  if (hasVerifiedPhotoEvidence(m, opts.classTaskId)) {
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

/**
 * 提交课程拍照核验【未通过】证据（REJECTED）。
 *   - 持久化为独立 photo Evidence（weight=0，不计客观分）+ REJECTED recommendation
 *   - REJECTED ≠ Mission ABANDONED：不改 Mission 状态、不 tryComplete、不发完成奖励
 *   - 每次失败提交各留一条 REJECTED（保留完整历史：REJECTED REJECTED … VERIFIED）
 */
export function submitRejectedCoursePhotoEvidence(missionId: string, opts: {
  classTaskId: string
  photoPath?: string
  aiScore?: number
  aiReview?: string
}): void {
  const store = useMissionStore.getState()
  const m = store.getMission(missionId)
  if (!m) return
  const now = Date.now()
  const { evidence: ev, recommendation: rec } = buildCoursePhotoEvidence({
    missionId,
    classTaskId: opts.classTaskId,
    photoPath: opts.photoPath,
    aiPassed: false,
    aiScore: opts.aiScore,
    aiReview: opts.aiReview,
    ts: now
  })
  store.updateMission(missionId, {
    evidence: [...(m.evidence || []), ev],
    recommendations: [...(m.recommendations || []), rec]
  })
  // REJECTED：不 tryComplete、不发奖、不改 Mission 状态（REJECTED ≠ ABANDONED）
}
