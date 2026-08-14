/**
 * src/core/discipline/courseMigration.ts
 * Legacy Migration Adapter（V3 Phase 9）—— 旧课程核验数据 → 统一 Evidence。
 *
 * 硬规则：
 *   - 保持原事实：VERIFIED→VERIFIED / PENDING→PENDING / REJECTED→REJECTED。
 *   - 不因迁移自动改变任务完成状态（不调 tryComplete、不改 mission/classTask status）。
 *   - 幂等：同一 classTaskId 的 photo 证据只生成一次（refId 去重），禁止重复生成。
 *   - 不创建 Course-specific Evidence Model；统一用 Evidence / VerificationRecommendation。
 *
 * 说明：Mission 仅当日生成，故迁移只映射"当日课程"的核验记录到当日 Mission；
 *       历史天的核验仍保留在 classTaskStore 供 ClassHistory 展示。
 */
import { useClassTaskStore } from '@/stores/classTaskStore'
import { useMissionStore } from './missionStore'
import { findMissionForPeriod } from './legacyBridge'
import { buildCoursePhotoEvidence, hasPhotoEvidenceForRef } from './courseEvidenceCore'
import { logger } from '@/lib/logger'

/**
 * 把旧课程核验记录幂等迁移为统一 Evidence + VerificationRecommendation。
 * @returns { migrated, skipped }
 */
export function migrateCourseVerifications(): { migrated: number; skipped: number } {
  const ctStore = useClassTaskStore.getState()
  const mStore = useMissionStore.getState()
  let migrated = 0
  let skipped = 0

  for (const task of ctStore.classTasks) {
    const records = ctStore.getVerifyHistory(task.id)
    // 无核验记录：无可迁移的证据（PENDING 无照片，跳过）
    if (!records || records.length === 0) continue

    const mission = findMissionForPeriod(task.period)
    if (!mission) { skipped++; continue }

    // 幂等：已有该 classTaskId 的 photo 证据 → 跳过（禁止重复生成）
    if (hasPhotoEvidenceForRef(mission.evidence, task.id)) {
      skipped++
      continue
    }

    const latest = records[records.length - 1]
    const ts = latest.verifiedAt || Date.now()
    // 保持原事实：passed → VERIFIED(ACCEPTED)；未通过 → REJECTED
    const { evidence: ev, recommendation: rec } = buildCoursePhotoEvidence({
      missionId: mission.id,
      classTaskId: task.id,
      photoPath: latest.photoUrl,
      aiPassed: !!latest.passed,
      aiScore: latest.aiScore,
      aiReview: latest.aiReview,
      ts,
      recId: `rec-mig-${ts.toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    })

    // 仅追加证据/建议，不改变 mission 完成状态
    mStore.updateMission(mission.id, {
      evidence: [...(mission.evidence || []), ev],
      recommendations: [...(mission.recommendations || []), rec]
    })
    migrated++
  }

  logger.info('courseMigration', `课程核验迁移完成`, { migrated, skipped })
  return { migrated, skipped }
}
