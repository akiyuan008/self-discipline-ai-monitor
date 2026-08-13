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
import { grantRecoveryReward, shouldRewardRecovery } from './recoveryReward'
import { computeFocusMs, mergeIntervalsMs } from './focusMath'
import { INTERVENTION } from './config'
import {
  baseConfidenceFor, computeFinalConfidence,
  shouldRecordDeviation, shouldConsiderIntervention, isTransient
} from './deviationAnalyzer'
import { resolveSessionOutcome, evaluateSessionResult, evaluateMissionAggregateResult } from './resultResolver'
import type { BehaviorEvent, Mission, InterventionLevel, FocusInterval, Session, Deviation } from './types'
import { useStore } from '@/stores/useStore'
import { classifyApp, getAppLabel, type AppCategory } from './appCategories'
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
  onRecovered?: (m: Mission, points: number) => void
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
    // P1：不机械写 ABANDONED，由结果判定决定 COMPLETED/PARTIAL/ABANDONED
    const staleMission = useMissionStore.getState().getMission(curSession.missionId)
    const fresh = useSessionStore.getState().getSession(curSession.id)
    const outcome = staleMission && fresh ? resolveSessionOutcome(fresh, staleMission) : 'ABANDONED'
    useSessionStore.getState().updateSession(curSession.id, { status: outcome, endedAt: Date.now() })
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
    const newCount = session.recoveryCount + 1
    sstore.updateSession(session.id, {
      status: 'RECOVERING',
      interventionLevel: 0,
      distractedSince: undefined,
      pendingDeviation: undefined,
      recoveryCount: newCount
    })
    logger.info('discipline', `Session 恢复 (recoveryCount=${newCount})`, { sessionId: session.id })

    // Recovery 奖励：强化"分心后主动回来"（防刷：每 Session 仅前 MAX_PER_SESSION 次发奖）
    const m = useMissionStore.getState().getCurrentMission()
    if (shouldRewardRecovery(newCount)) {
      const reward = grantRecoveryReward(rewardCallbacks())
      logger.info('discipline', `Recovery 奖励 +${reward.points}PTS`, { sessionId: session.id, recoveryCount: newCount })
      if (m) handlers.onRecovered?.(m, reward.points)
    }
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

/**
 * App 切到前台（Phase 2 置信度流水线）：
 *   可疑 App → 挂"偏离候选"(pendingDeviation) → 持续≥阈值且置信度过门控 → 正式成立 Deviation
 *   学习 App → 处理 transient switch（未达阈值直接丢弃）或 Recovery。
 */
function onAppForeground(m: Mission, event: BehaviorEvent) {
  const pkg = event.packageName || ''
  const cat = event.appCategory ?? classifyApp(pkg)
  const isDistraction = cat === 'entertainment' || cat === 'social'
  const isNeutral = cat === 'neutral'
  const isStudy = cat === 'study'

  const sstore = useSessionStore.getState()
  const session = sstore.getCurrentSession() || sstore.getRunningSessionForMission(m.id)
  if (!session) return
  if (session.status === 'COMPLETED' || session.status === 'ABANDONED' || session.status === 'PARTIAL') return

  if (isStudy) {
    handleReturnToStudy(m, session)
    return
  }
  if (isDistraction || isNeutral) {
    handlePotentialDeviation(m, session, pkg, cat)
  }
}

/** 回到学习 App：transient switch（未达阈值）直接丢弃候选；已正式成立则恢复 */
function handleReturnToStudy(m: Mission, session: Session) {
  const sstore = useSessionStore.getState()
  const pd = session.pendingDeviation
  if (pd) {
    const elapsed = Date.now() - pd.startedAt
    if (isTransient(elapsed)) {
      // transient switch：打开错立刻返回 → 不创建 Deviation / 不干预 / 不记 Recovery，不污染 Session
      sstore.updateSession(session.id, { pendingDeviation: undefined })
      logger.debug('discipline', 'transient switch，未创建 Deviation', { pkg: pd.pkg, elapsedMs: elapsed })
      return
    }
    // 已持续过阈值：先尝试正式成立，再按恢复处理
    maybeFormalizeDeviation(m, session)
  }
  const fresh = sstore.getSession(session.id)
  if (fresh && fresh.status === 'DEVIATED') {
    recoverMission()
  }
}

/** 可疑 App（娱乐/社交/neutral）前台：开启或更新偏离候选（不立即成立 Deviation） */
function handlePotentialDeviation(m: Mission, session: Session, pkg: string, cat: AppCategory) {
  const sstore = useSessionStore.getState()
  // 已正式成立偏离：保持现状，升级交给采样/评估
  if (session.status === 'DEVIATED') return

  const now = Date.now()
  const base = baseConfidenceFor(cat)
  const existing = session.pendingDeviation
  // 多个可疑 App 间切换：保留最早起点，基准置信度取较高者
  const pending = existing
    ? { ...existing, pkg, category: cat, baseConfidence: Math.max(existing.baseConfidence, base) }
    : { pkg, category: cat, startedAt: now, baseConfidence: base }
  sstore.updateSession(session.id, { pendingDeviation: pending })

  // 事件可能到达较晚（候选已持续超阈值）→ 立即尝试成立
  const fresh = sstore.getSession(session.id)
  if (fresh) maybeFormalizeDeviation(m, fresh)
}

/**
 * 尝试把待定候选正式成立为 Deviation。
 *   Deviation Gate：final confidence ≥ RECORD_MIN_CONFIDENCE 才记录（记录层）。
 *   Intervention Gate：confidence ≥ INTERVENTION_MIN_CONFIDENCE 才考虑干预（干预层）。
 *   → 二者分离：可"记录 Deviation 但不干预"。
 */
function maybeFormalizeDeviation(m: Mission, session: Session) {
  const sstore = useSessionStore.getState()
  const pd = session.pendingDeviation
  if (!pd) return
  const now = Date.now()
  const elapsed = now - pd.startedAt
  if (isTransient(elapsed)) return // 仍属 transient

  // 置信度流水线：base → context → duration → final
  const conf = computeFinalConfidence(pd, session, m, elapsed)

  // Deviation Gate：置信度不足 → 不正式成立（浏览器/低置信场景在此被拦下）
  if (!shouldRecordDeviation(conf)) {
    logger.debug('discipline', '低置信候选，未成立 Deviation', { pkg: pd.pkg, conf, elapsedMs: elapsed })
    return
  }

  const dev: Deviation = {
    id: `dev-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId: session.id,
    type: 'DISTRACTION',
    startedAt: pd.startedAt,
    durationMs: elapsed,
    confidence: conf,
    trigger: `打开 ${getAppLabel(pd.pkg)}`
  }
  sstore.updateSession(session.id, {
    status: 'DEVIATED',
    distractedSince: pd.startedAt,
    pendingDeviation: undefined,
    deviations: [...session.deviations, dev],
    deviationCount: session.deviationCount + 1
  })
  // Mission 镜像（供 UI / Android 镜像）
  useMissionStore.getState().updateMission(m.id, { status: 'DISTRACTED', distractedSince: pd.startedAt })
  logger.info('discipline', `Deviation 成立: ${pd.pkg}`, { conf, elapsedMs: elapsed, sessionId: session.id })

  // Intervention Gate：Deviation ≠ Intervention
  if (shouldConsiderIntervention(conf)) {
    escalateIntervention(m.id)
  } else {
    logger.info('discipline', '记录 Deviation 但不干预（置信度未达干预门槛）', { conf })
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

  // 采样时：先尝试成立持续的偏离候选，再对已成立的偏离升级干预（置信度门控在 escalate 内）
  const s = useSessionStore.getState().getCurrentSession()
  if (s && s.pendingDeviation) {
    maybeFormalizeDeviation(m, s)
  }
  const s2 = useSessionStore.getState().getCurrentSession()
  if (s2 && (s2.status === 'DEVIATED' || m.status === 'INTERVENTION')) {
    escalateIntervention(m.id)
  }

  tryComplete(m.id)
}

/**
 * 手动停止：结束当前 Session，Mission 回 IDLE，清指针。
 * P1 修复：Stop ≠ 机械 Abandoned —— 最终 outcome 由 resolveSessionOutcome
 * 依据实际执行结果判定 COMPLETED / PARTIAL / ABANDONED。
 */
function onMissionStopped(m: Mission) {
  const sstore = useSessionStore.getState()
  const session = sstore.getCurrentSession() || sstore.getRunningSessionForMission(m.id)
  if (session && RUNNING_SESSION_STATUS.includes(session.status)) {
    // 若处于偏离 / 有待定候选，先收尾
    resolveCurrentDeviation(session.id, 'AUTO')
    const fresh = sstore.getSession(session.id) || session
    // Phase 4：完整评估（三态 + 执行率 + 质量综合评分）
    const result = evaluateSessionResult(fresh, m)
    sstore.updateSession(session.id, {
      status: result.outcome,
      endedAt: Date.now(),
      pendingDeviation: undefined,
      result
    })
    logger.info('discipline', `Session 结束(Stop) → ${result.outcome} (quality=${result.executionQuality})`, {
      sessionId: session.id, rate: result.executionRate, qualityScore: result.qualityScore
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

/** 分级干预：Session 权威、Mission 镜像。Intervention Gate：置信度达标才干预，再按 duration 分级。 */
function escalateIntervention(missionId: string) {
  const sstore = useSessionStore.getState()
  const session = sstore.getCurrentSession() || sstore.getRunningSessionForMission(missionId)
  if (!session || !session.distractedSince) return

  // Intervention Gate：活动（未 resolve）Deviation 的置信度须达干预门槛
  // → Deviation ≠ Intervention：低置信偏离只记录、不干预
  const activeDev = [...session.deviations].reverse().find(d => d.resolvedAt == null)
  const conf = activeDev?.confidence ?? 0
  if (!shouldConsiderIntervention(conf)) return

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
  logger.info('discipline', `干预升级 LEVEL ${level}`, { sessionId: session.id, distractedMs, conf })

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

  // 收尾当前 Session（Phase 4：Mission 完成时聚合全部 Session 评估整体执行质量）
  const sstore = useSessionStore.getState()
  const session = sstore.getCurrentSession() || sstore.getRunningSessionForMission(missionId)
  if (session && RUNNING_SESSION_STATUS.includes(session.status)) {
    resolveCurrentDeviation(session.id, 'AUTO')
    const allSessions = sstore.getSessionsByMission(missionId)
    const aggResult = evaluateMissionAggregateResult(allSessions, m)
    sstore.updateSession(session.id, {
      status: 'COMPLETED',
      endedAt: Date.now(),
      result: aggResult
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
