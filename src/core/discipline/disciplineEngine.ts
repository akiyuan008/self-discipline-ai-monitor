/**
 * src/core/discipline/disciplineEngine.ts
 * DisciplineEngine —— 自律核心状态机（V3 Phase 1：引入 Session）。
 *
 * V3 语义（最终拍板）：
 *   Mission = 计划目标；Session = 一次实际执行过程。
 *   一次"用户主动开始的执行" = 一个 Session；分心/恢复发生在 Session 内部，
 *   以 FocusSegment + Deviation + Recovery 记录；显式 Stop 后再 Start 才新建 Session。
 *
 *   Mission └── Session ─┬── FocusSegment（专注段，去重计 focusDurationMs）
 *                        ├── Deviation（偏离，带置信度）
 *                        ├── Intervention（分级干预）
 *                        ├── Recovery（恢复，正向行为）
 *                        └── Result（结果）
 *
 * 兼容策略（Phase 1）：
 *   - Session.segments 是执行期专注证据的 Source of Truth（新证据只写这里）。
 *   - Mission.actualStudyMs / distractionMs 是"跨 Session 派生聚合值"（syncMissionAggregate
 *     从 遗留 focusIntervals ∪ 所有 Session.segments 去重计算），供 MissionEvaluator /
 *     RewardEngine / Android 镜像 / 现有 UI 使用。它们是 derived，不是新的 Source of Truth。
 *   - Mission.focusIntervals 只保留历史遗留数据（不再追加新区间），仅为兼容旧持久化记录。
 *   - 所有对外 API 签名保持不变，页面（Home/Quests/Dungeon）无需改动。
 */
import { useMissionStore } from './missionStore'
import { useSessionStore, RUNNING_SESSION_STATUS } from './sessionStore'
import { evaluateMission, makeEvidence } from './missionEvaluator'
import { grantMissionReward, grantMissedPenalty } from './rewardEngine'
import { computeFocusMs, mergeIntervalsMs } from './focusMath'
import { INTERVENTION, DEVIATION } from './config'
import type { BehaviorEvent, Mission, InterventionLevel, FocusInterval, Session, Deviation } from './types'
import { useStore } from '@/stores/useStore'
import { classifyApp, getAppLabel } from './appCategories'
import { logger } from '@/lib/logger'

// ── 干预升级阈值（收敛到 config）──
const LEVEL1_AFTER_MS = INTERVENTION.LEVEL1_AFTER_MS
const LEVEL2_AFTER_MS = INTERVENTION.LEVEL2_AFTER_MS
const LEVEL3_AFTER_MS = INTERVENTION.LEVEL3_AFTER_MS

/** 干预回调（由 UI / Android 层注入，DisciplineEngine 只决定"该干预到哪一级"） */
export interface InterventionHandlers {
  onLevel1?: (m: Mission) => void
  onLevel2?: (m: Mission) => void
  onLevel3?: (m: Mission) => void
  onCompleted?: (m: Mission, points: number) => void
  onMissed?: (m: Mission) => void
  onDistracted?: (m: Mission, level: InterventionLevel) => void
}

let handlers: InterventionHandlers = {}
export function setInterventionHandlers(h: InterventionHandlers) {
  handlers = h
}

/** 获得奖励发放回调（桥接到 useStore） */
function rewardCallbacks() {
  const s = useStore.getState()
  return {
    addPoints: s.addPoints,
    addXp: (n: number) => s.addXp(n),
    addPointRecord: s.addPointRecord,
    addExp: s.addExp
  }
}

// ═══════════════════════════════════════════════════════════
// 内部工具：Session 定位 / 聚合镜像
// ═══════════════════════════════════════════════════════════

/** 获取某 Mission 的运行中 Session；若无则创建一个（保证焦点证据有落点） */
function ensureRunningSession(missionId: string): Session {
  const sstore = useSessionStore.getState()
  const existing = sstore.getRunningSessionForMission(missionId)
  if (existing) return existing
  const created = sstore.createSession({ missionId, mode: 'STANDARD' })
  // 把 Session 挂到 Mission 的关系上
  const mstore = useMissionStore.getState()
  const m = mstore.getMission(missionId)
  if (m) mstore.updateMission(missionId, { sessionIds: [...(m.sessionIds || []), created.id] })
  return created
}

/**
 * 把某 Mission 的"跨 Session 聚合专注时长"同步到 Mission.actualStudyMs（镜像）。
 * 聚合 = 历史遗留 focusIntervals ∪ 所有 Session 的 segments（统一去重）。
 */
function syncMissionAggregate(missionId: string) {
  const mstore = useMissionStore.getState()
  const sstore = useSessionStore.getState()
  const m = mstore.getMission(missionId)
  if (!m) return
  const legacy: Array<{ startedAt: number; endedAt: number }> = (m.focusIntervals || [])
  const segs = sstore.getSessionsByMission(missionId).flatMap(s => s.segments)
  const actualStudyMs = mergeIntervalsMs([...legacy, ...segs])
  const distractionMs = sstore.getSessionsByMission(missionId).reduce((sum, s) => sum + s.distractionDurationMs, 0)
  mstore.updateMission(missionId, { actualStudyMs, distractionMs })
}

/** Phase 1 的偏离置信度占位（按分类给基准值；Phase 2 由 DeviationAnalyzer 细化） */
function deviationConfidence(category: string): number {
  if (category === 'entertainment') return DEVIATION.CONF_ENTERTAINMENT
  if (category === 'social') return DEVIATION.CONF_SOCIAL
  return DEVIATION.CONF_NEUTRAL
}

// ═══════════════════════════════════════════════════════════
// 对外 API（签名保持不变）
// ═══════════════════════════════════════════════════════════

/** 开始一个 Mission（用户点击"开始专注"）→ 创建一个新 Session */
export function startMission(missionId: string) {
  const mstore = useMissionStore.getState()
  const m = mstore.getMission(missionId)
  if (!m) return
  // 同一时刻只有一个执行：关闭属于其它 Mission 且仍在运行的 Session
  const curSession = useSessionStore.getState().getCurrentSession()
  if (curSession && curSession.missionId !== missionId && RUNNING_SESSION_STATUS.includes(curSession.status)) {
    resolveCurrentDeviation(curSession.id, 'AUTO')
    useSessionStore.getState().updateSession(curSession.id, { status: 'ABANDONED', endedAt: Date.now() })
  }
  useMissionStore.setState({ currentMissionId: missionId })
  // 创建一个新 Session（执行期状态全部归 Session）
  const session = ensureRunningSession(missionId)
  useSessionStore.setState({ currentSessionId: session.id })
  // Mission 计划级：镜像 FOCUSING（供 UI/Android 镜像），重置执行期累计
  mstore.updateMission(missionId, { status: 'FOCUSING', startedAt: Date.now(), distractionMs: 0, distractedSince: undefined })
  handleEvent({ type: 'MISSION_STARTED', ts: Date.now() })
  logger.info('discipline', `Mission 开始: ${m.title}`, { id: missionId, sessionId: session.id })
}

/** 手动停止当前 Mission → 结束当前 Session（ABANDONED） */
export function stopCurrentMission() {
  handleEvent({ type: 'MISSION_STOPPED', ts: Date.now() })
}

/** 用户点击"回到任务"（从干预/分心中恢复）→ 记一次 Recovery */
export function recoverMission() {
  const sstore = useSessionStore.getState()
  const session = sstore.getCurrentSession() || undefined
  if (session && RUNNING_SESSION_STATUS.includes(session.status)) {
    resolveCurrentDeviation(session.id, 'USER_RECOVERY')
    sstore.updateSession(session.id, { status: 'RECOVERING', interventionLevel: 0, distractedSince: undefined, recoveryCount: session.recoveryCount + 1 })
    logger.info('discipline', `Session 恢复 (recoveryCount=${session.recoveryCount + 1})`, { sessionId: session.id })
  }
  // Mission 镜像（供 UI）
  const m = useMissionStore.getState().getCurrentMission()
  if (m) useMissionStore.getState().updateMission(m.id, { status: 'RECOVERING', interventionLevel: 0, distractedSince: undefined })
}

/** 附加证据（如拍照验证），然后尝试完成 */
export function attachEvidenceAndTryComplete(missionId: string, type: 'photo' | 'screenshot' | 'manual' | 'ai', payload?: string, weight?: number) {
  const store = useMissionStore.getState()
  const m = store.getMission(missionId)
  if (!m) return
  const ev = makeEvidence(type, payload, weight)
  store.updateMission(missionId, { evidence: [...m.evidence, ev] })
  tryComplete(missionId)
}

/**
 * 统一专注时间证据入口（FocusEvidence）。
 * DUNGEON 与 APP_USAGE 区间写入当前 Session 的 segments（Source of Truth），
 * 并同步 Mission 聚合镜像（供评估/奖励/UI）。去重由 computeFocusMs 保证。
 */
export function addFocusInterval(missionId: string, interval: FocusInterval) {
  if (interval.endedAt <= interval.startedAt) return
  const mstore = useMissionStore.getState()
  const m = mstore.getMission(missionId)
  if (!m) return
  if (m.status === 'COMPLETED' || m.status === 'MISSED') return

  // 写入 Session（执行期 SoT）
  const session = ensureRunningSession(missionId)
  const seg = {
    id: `seg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId: session.id,
    source: interval.source,
    startedAt: interval.startedAt,
    endedAt: interval.endedAt,
    packageName: interval.packageName,
    tag: interval.tag
  }
  const segments = [...session.segments, seg]
  useSessionStore.getState().updateSession(session.id, {
    segments,
    focusDurationMs: computeFocusMs(segments)
  })

  // 同步 Mission 聚合镜像 + 尝试完成
  syncMissionAggregate(missionId)
  logger.debug('discipline', `FocusEvidence 写入 Session`, {
    mission: m.title, sessionId: session.id, source: interval.source,
    intervalMs: interval.endedAt - interval.startedAt
  })
  tryComplete(missionId)
}

/** Dungeon 结束一段专注区间时调用：把 [startedAt, endedAt] 作为 DUNGEON 证据提交 */
export function submitDungeonFocus(missionId: string, startedAt: number, endedAt: number, tag?: string) {
  addFocusInterval(missionId, { source: 'DUNGEON', startedAt, endedAt, tag })
}

/** 主入口：处理一个 BehaviorEvent */
export function handleEvent(event: BehaviorEvent) {
  const mstore = useMissionStore.getState()
  const m = mstore.getCurrentMission()
  if (!m) return
  if (m.status === 'COMPLETED' || m.status === 'MISSED') return

  switch (event.type) {
    case 'APP_FOREGROUND':
      onAppForeground(m, event)
      break
    case 'USAGE_SAMPLE':
      onUsageSample(m, event)
      break
    case 'SCREEN_OFF':
      // 息屏视为可能的分心起点（保守：不立即判分心，交给采样）
      break
    case 'MISSION_STOPPED':
      onMissionStopped(m)
      break
    default:
      break
  }
}

// ═══════════════════════════════════════════════════════════
// 内部逻辑
// ═══════════════════════════════════════════════════════════

/** App 切到前台：判断是否是分心（在当前 Session 上记录 Deviation） */
function onAppForeground(m: Mission, event: BehaviorEvent) {
  const pkg = event.packageName || ''
  const cat = event.appCategory ?? classifyApp(pkg)
  const isDistraction = cat === 'entertainment' || cat === 'social'
  const isStudy = cat === 'study'

  const sstore = useSessionStore.getState()
  const session = sstore.getCurrentSession() || sstore.getRunningSessionForMission(m.id)

  if (isDistraction && session && ['ACTIVE', 'RECOVERING'].includes(session.status)) {
    // 进入偏离：记一条 DISTRACTION Deviation（置信度按分类，Phase 2 细化）
    const now = Date.now()
    const dev: Deviation = {
      id: `dev-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId: session.id,
      type: 'DISTRACTION',
      startedAt: now,
      durationMs: 0,
      confidence: deviationConfidence(cat),
      trigger: `打开 ${getAppLabel(pkg)}`
    }
    sstore.updateSession(session.id, {
      status: 'DEVIATED',
      distractedSince: now,
      deviations: [...session.deviations, dev],
      deviationCount: session.deviationCount + 1
    })
    // Mission 镜像（供 UI / Android 镜像）
    useMissionStore.getState().updateMission(m.id, { status: 'DISTRACTED', distractedSince: now })
    logger.info('discipline', `检测到偏离: ${pkg}`, { category: cat, sessionId: session.id, confidence: dev.confidence })
    escalateIntervention(m.id)
  } else if (isStudy && session && session.status === 'DEVIATED') {
    // 回到学习 App → 恢复
    recoverMission()
  }
}

/** UsageStats 周期采样：学习时长→Session 区间（去重），分心时长→累计，并尝试完成 */
function onUsageSample(m: Mission, event: BehaviorEvent) {
  const studyMs = event.studyMs ?? 0
  const distractionMs = event.distractionMs ?? 0

  // 学习时长：锚定采样窗口生成 APP_USAGE 区间，写入 Session（统一去重入口）
  if (studyMs > 0) {
    const ws = event.windowStart ?? (event.ts - studyMs)
    addFocusInterval(m.id, {
      source: 'APP_USAGE',
      startedAt: ws,
      endedAt: Math.min(ws + studyMs, event.ts)
    })
  }

  // 分心时长：累计到当前 Session，并同步 Mission 镜像
  if (distractionMs > 0) {
    const sstore = useSessionStore.getState()
    const session = sstore.getCurrentSession() || sstore.getRunningSessionForMission(m.id)
    if (session) {
      sstore.updateSession(session.id, { distractionDurationMs: session.distractionDurationMs + distractionMs })
      syncMissionAggregate(m.id)
    }
  }

  // 采样时若已偏离，尝试升级干预
  const s = useSessionStore.getState().getCurrentSession()
  if (s && (s.status === 'DEVIATED' || m.status === 'INTERVENTION')) {
    escalateIntervention(m.id)
  }

  tryComplete(m.id)
}

/** 手动停止：结束当前 Session（ABANDONED），Mission 回 IDLE，清指针 */
function onMissionStopped(m: Mission) {
  const sstore = useSessionStore.getState()
  const session = sstore.getCurrentSession() || sstore.getRunningSessionForMission(m.id)
  if (session && RUNNING_SESSION_STATUS.includes(session.status)) {
    // 若处于偏离，先 resolve
    resolveCurrentDeviation(session.id, 'AUTO')
    sstore.updateSession(session.id, {
      status: 'ABANDONED',
      endedAt: Date.now(),
      result: {
        outcome: 'ABANDONED',
        executionRate: m.targetMinutes > 0 ? session.focusDurationMs / (m.targetMinutes * 60000) : 0,
        focusDurationMs: session.focusDurationMs,
        distractionDurationMs: session.distractionDurationMs,
        deviationCount: session.deviationCount,
        recoveryCount: session.recoveryCount
      }
    })
  }
  sstore.setCurrentSession(null)
  useMissionStore.getState().updateMission(m.id, { status: 'IDLE' })
  useMissionStore.setState({ currentMissionId: null })
}

/** resolve 当前 Session 未结束的偏离（恢复/停止/超时时调用） */
function resolveCurrentDeviation(sessionId: string, resolvedBy: Deviation['resolvedBy']) {
  const sstore = useSessionStore.getState()
  const session = sstore.getSession(sessionId)
  if (!session) return
  const now = Date.now()
  const deviations = session.deviations.map(d =>
    d.endedAt == null
      ? { ...d, endedAt: now, durationMs: now - d.startedAt, resolvedAt: now, resolvedBy }
      : d
  )
  sstore.updateSession(sessionId, { deviations })
}

/** 分级干预：根据偏离持续时长升级（Session 权威，Mission 镜像） */
function escalateIntervention(missionId: string) {
  const sstore = useSessionStore.getState()
  const session = sstore.getCurrentSession() || sstore.getRunningSessionForMission(missionId)
  if (!session || !session.distractedSince) return

  const distractedMs = Date.now() - session.distractedSince
  let level: InterventionLevel = 0
  if (distractedMs >= LEVEL3_AFTER_MS) level = 3
  else if (distractedMs >= LEVEL2_AFTER_MS) level = 2
  else if (distractedMs >= LEVEL1_AFTER_MS) level = 1

  if (level === session.interventionLevel) return
  sstore.updateSession(session.id, { interventionLevel: level })
  // Mission 镜像（供干预回调 / Android 镜像）
  const m = useMissionStore.getState().getMission(missionId)
  if (m) useMissionStore.getState().updateMission(missionId, { interventionLevel: level, status: level > 0 ? 'INTERVENTION' : m.status })
  logger.info('discipline', `干预升级 LEVEL ${level}`, { sessionId: session.id, distractedMs })

  if (m) {
    if (level >= 1) handlers.onDistracted?.(m, level)
    if (level === 1) handlers.onLevel1?.(m)
    else if (level === 2) handlers.onLevel2?.(m)
    else if (level === 3) handlers.onLevel3?.(m)
  }
}

/** 尝试完成（证据驱动；完成时同时收尾当前 Session） */
export function tryComplete(missionId: string) {
  const store = useMissionStore.getState()
  const m = store.getMission(missionId)
  if (!m || m.status === 'COMPLETED' || m.status === 'MISSED') return

  const result = evaluateMission(m)
  if (!result.canComplete) return

  // 收尾当前 Session（Phase 1 最小 result；Phase 4 完整评定三态+质量）
  const sstore = useSessionStore.getState()
  const session = sstore.getCurrentSession() || sstore.getRunningSessionForMission(missionId)
  if (session && RUNNING_SESSION_STATUS.includes(session.status)) {
    resolveCurrentDeviation(session.id, 'AUTO')
    sstore.updateSession(session.id, {
      status: 'COMPLETED',
      endedAt: Date.now(),
      result: {
        outcome: 'COMPLETED',
        executionRate: m.targetMinutes > 0 ? Math.min(1, session.focusDurationMs / (m.targetMinutes * 60000)) : 1,
        focusDurationMs: session.focusDurationMs,
        distractionDurationMs: session.distractionDurationMs,
        deviationCount: session.deviationCount,
        recoveryCount: session.recoveryCount
      }
    })
    sstore.setCurrentSession(null)
  }

  store.updateMission(missionId, { status: 'COMPLETED', completedAt: Date.now() })
  const reward = grantMissionReward(m, rewardCallbacks())
  logger.info('discipline', `Mission 完成: ${m.title}`, { points: reward.points, xp: reward.xp })
  handlers.onCompleted?.(m, reward.points)
  store.setCurrentMission(null)
}

/** 定时扫描：把错过窗口的 READY 任务标记为 MISSED */
export function scanMissedMissions() {
  const store = useMissionStore.getState()
  const now = Date.now()
  for (const m of store.missions) {
    if (m.status === 'READY' && now > m.plannedEnd) {
      useMissionStore.getState().updateMission(m.id, { status: 'MISSED' })
      grantMissedPenalty(m, rewardCallbacks())
      logger.info('discipline', `Mission 错过: ${m.title}`)
      handlers.onMissed?.(m)
    }
  }
}
