/**
 * src/core/discipline/unifiedMissionView.ts
 * Unified Mission View / Read Model（V3 Phase 8）。
 *
 * 目标：把 Course Timeline + Dynamic Mission + Schedule + DayPlan 映射到统一视图，
 * Mission 作为统一 UI 身份，避免同一任务出现多个列表/时间轴副本。
 *
 * 【Phase 8 边界】只解决 View / Read Model：
 *   - 不迁移 Photo Evidence（课程拍照核验仍走 legacy，视图仅反映其状态）
 *   - 不重构 CourseTask / Evidence / Session / Reward
 *
 * 纯函数：输入全部由调用方从 store 采集传入，便于测试。
 */
import type { Mission, Session, DayPlan, CommitmentAction, TaskType } from './types'
import { getPeriodTime } from '../../data/schedule'
import { RESULT } from './config'
import { hasVerifiedPhotoEvidenceAny } from './courseEvidenceCore'

/** 统一视图状态 */
export type MissionViewStatus =
  | 'PLANNED' | 'COMMITTED' | 'EXECUTING' | 'COMPLETED' | 'PARTIAL' | 'ABANDONED'

/** 遗留课程任务的最小引用（避免 core 依赖 legacy store，仅取视图所需字段） */
export interface LegacyCourseTaskRef {
  id: string
  period: number
  date: string
  subject: string
  status: 'pending' | 'started' | 'completed' | 'overdue' | 'absent'
}

export interface MissionView {
  /** 统一 UI 身份 = Mission id */
  id: string
  title: string
  subject?: string
  source: 'SCHEDULE' | 'USER' | 'AI' | 'COURSE'
  plannedStart: number
  plannedEnd: number
  targetMinutes: number
  viewStatus: MissionViewStatus
  /** 执行进度 */
  focusDurationMs: number
  executionRate: number
  deviationCount: number
  recoveryCount: number
  /** DayPlan 承诺 */
  commitment: CommitmentAction | 'PLANNED'
  taskType: TaskType
  requiresEvidence: boolean
  /** 遗留课程关联（供 UI 展示拍照核验等 legacy 动作） */
  classTaskId?: string
  classTaskStatus?: LegacyCourseTaskRef['status']
}

function isSameDay(ts: number, date: string): boolean {
  const d = new Date(ts)
  const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return ds === date
}

/** 由 Mission 的 plannedStart 反推课表节次（用于关联 ClassTask） */
function periodOfMission(m: Mission): number | undefined {
  const d = new Date(m.plannedStart)
  for (let p = 1; p <= 12; p++) {
    const pd = getPeriodTime(p)
    if (!pd) continue
    const [sh, sm] = pd.startTime.split(':').map(Number)
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm).getTime()
    if (m.plannedStart === start) return p
  }
  return undefined
}

/** 找一个 Mission 对应的遗留 ClassTask（按节次 + 日期） */
function findClassTaskForMission(
  courseTasks: LegacyCourseTaskRef[], m: Mission, date: string
): LegacyCourseTaskRef | undefined {
  const period = periodOfMission(m)
  if (period == null) return undefined
  return courseTasks.find(ct => ct.date === date && ct.period === period)
}

/** DayPlan 中某 Mission 的承诺 */
function commitmentFor(dayPlan: DayPlan | undefined, missionId: string): CommitmentAction | 'PLANNED' {
  if (!dayPlan) return 'PLANNED'
  const c = dayPlan.commitments.find(x => x.missionId === missionId)
  if (c) return c.action
  return dayPlan.status !== 'PLANNED' ? 'COMMITTED' : 'PLANNED'
}

/** 统一视图状态推导 */
export function deriveViewStatus(
  m: Mission,
  sessionsOfM: Session[],
  commitment: CommitmentAction | 'PLANNED'
): MissionViewStatus {
  // V3 Phase 10C：完成态读 Mission.status（ResultEvaluator）+ Evidence（兼容），
  // classTask.status 不再参与判定（CourseTask 退役为 Metadata/Adapter）。
  if (m.status === 'COMPLETED') return 'COMPLETED'
  // 兼容：已有 VERIFIED（weight>0）照片证据 → 视为完成（历史迁移可能未写 Mission.status）
  if (hasVerifiedPhotoEvidenceAny(m.evidence)) return 'COMPLETED'
  if (m.status === 'MISSED') return 'ABANDONED'

  const runningSession = sessionsOfM.some(s =>
    ['ACTIVE', 'PAUSED', 'DEVIATED', 'RECOVERING'].includes(s.status))
  const missionActive = ['FOCUSING', 'DISTRACTED', 'INTERVENTION', 'RECOVERING'].includes(m.status)
  if (runningSession || missionActive) return 'EXECUTING'

  // 已开始但当前未运行、未完成
  const focus = sessionsOfM.reduce((s, x) => s + x.focusDurationMs, 0)
  if (sessionsOfM.length > 0 || m.startedAt) {
    return focus >= RESULT.MEANINGFUL_EXECUTION_MS ? 'PARTIAL' : 'ABANDONED'
  }

  // 未开始
  return commitment === 'COMMITTED' ? 'COMMITTED' : 'PLANNED'
}

/** 组装单个 MissionView */
function toMissionView(
  m: Mission,
  sessionsOfM: Session[],
  dayPlan: DayPlan | undefined,
  classTask: LegacyCourseTaskRef | undefined,
  date: string
): MissionView {
  const commitment = commitmentFor(dayPlan, m.id)
  const focusDurationMs = sessionsOfM.reduce((s, x) => s + x.focusDurationMs, 0)
  const targetMs = m.targetMinutes * 60_000
  return {
    id: m.id,
    title: m.title,
    subject: m.subject,
    source: m.source,
    plannedStart: m.plannedStart,
    plannedEnd: m.plannedEnd,
    targetMinutes: m.targetMinutes,
    viewStatus: deriveViewStatus(m, sessionsOfM, commitment),
    focusDurationMs,
    executionRate: targetMs > 0 ? Math.min(1, focusDurationMs / targetMs) : 0,
    deviationCount: sessionsOfM.reduce((s, x) => s + x.deviationCount, 0),
    recoveryCount: sessionsOfM.reduce((s, x) => s + x.recoveryCount, 0),
    commitment,
    taskType: m.taskType || (m.requiresEvidence ? 'OUTCOME_BASED' : 'TIME_BASED'),
    requiresEvidence: m.requiresEvidence,
    classTaskId: classTask?.id,
    classTaskStatus: classTask?.status
  }
}

/** 仅有遗留课程、无对应 Mission 的兜底视图（边界情况，避免丢任务） */
function courseOnlyView(ct: LegacyCourseTaskRef, date: string): MissionView {
  const pd = getPeriodTime(ct.period)
  const [sh, sm] = pd ? pd.startTime.split(':').map(Number) : [0, 0]
  const [eh, em] = pd ? pd.endTime.split(':').map(Number) : [0, 0]
  const base = new Date()
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), sh, sm).getTime()
  const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), eh, em).getTime()
  const status: MissionViewStatus =
    ct.status === 'completed' ? 'COMPLETED'
      : ct.status === 'started' ? 'EXECUTING'
        : (ct.status === 'overdue' || ct.status === 'absent') ? 'ABANDONED' : 'PLANNED'
  return {
    id: `course-${ct.id}`,
    title: `${ct.subject} · 第${ct.period}节`,
    subject: ct.subject,
    source: 'COURSE',
    plannedStart: start,
    plannedEnd: end,
    targetMinutes: Math.max(1, Math.round((end - start) / 60_000)),
    viewStatus: status,
    focusDurationMs: 0,
    executionRate: 0,
    deviationCount: 0,
    recoveryCount: 0,
    commitment: 'PLANNED',
    taskType: 'TIME_BASED',
    requiresEvidence: false,
    classTaskId: ct.id,
    classTaskStatus: ct.status
  }
}

/**
 * 构建统一 Mission View（去重：以 Mission 为身份，ClassTask 仅 join 不另起副本）。
 */
export function buildUnifiedMissionView(args: {
  date: string
  missions: Mission[]
  courseTasks: LegacyCourseTaskRef[]
  sessions: Session[]
  dayPlan?: DayPlan
}): MissionView[] {
  const { date, missions, courseTasks, sessions, dayPlan } = args

  const dayMissions = missions.filter(m => isSameDay(m.plannedStart, date))
  const matchedClassTaskIds = new Set<string>()

  const views: MissionView[] = dayMissions.map(m => {
    const ct = findClassTaskForMission(courseTasks, m, date)
    if (ct) matchedClassTaskIds.add(ct.id)
    return toMissionView(m, sessions.filter(s => s.missionId === m.id), dayPlan, ct, date)
  })

  // 兜底：无对应 Mission 的遗留课程（边界情况）
  for (const ct of courseTasks) {
    if (ct.date !== date || matchedClassTaskIds.has(ct.id)) continue
    views.push(courseOnlyView(ct, date))
  }

  return views.sort((a, b) => a.plannedStart - b.plannedStart)
}
