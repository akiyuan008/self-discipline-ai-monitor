/**
 * src/core/discipline/disciplineEngine.ts
 * DisciplineEngine —— 自律核心状态机。
 *
 * 数据流（最终架构，不再摇摆）：
 *   Android / UsageStats → BehaviorEvent → DisciplineEngine
 *     → 判断"该做什么 / 实际在做什么 / 是否分心"
 *     → 更新 Mission 状态（READY/FOCUSING/DISTRACTED/INTERVENTION/RECOVERING/COMPLETED/MISSED）
 *     → 分级干预（LEVEL 0/1/2/3，Recovery > Punishment）
 *     → 完成判定（MissionEvaluator）→ 奖励（RewardEngine）→ 下一任务
 *
 * 页面 / Android / AI 都不自己判断完成，统一交给这里。
 */
import { useMissionStore } from './missionStore'
import { evaluateMission, makeEvidence } from './missionEvaluator'
import { grantMissionReward, grantMissedPenalty } from './rewardEngine'
import type { BehaviorEvent, Mission, InterventionLevel } from './types'
import { useStore } from '@/stores/useStore'
import { classifyApp } from './appCategories'
import { logger } from '@/lib/logger'

// ── 干预升级阈值（分心持续多久升级到下一级）──
const LEVEL1_AFTER_MS = 60_000        // 分心 1 分钟 → LEVEL 1 轻提醒
const LEVEL2_AFTER_MS = 5 * 60_000    // 分心 5 分钟 → LEVEL 2 强提醒+遮罩(可恢复)
const LEVEL3_AFTER_MS = 15 * 60_000   // 分心 15 分钟 → LEVEL 3 强制恢复

/** 干预回调（由 UI / Android 层注入，DisciplineEngine 只决定"该干预到哪一级"） */
export interface InterventionHandlers {
  onLevel1?: (m: Mission) => void   // 普通通知/提醒
  onLevel2?: (m: Mission) => void   // 强提醒 + 锁屏遮罩（可恢复）
  onLevel3?: (m: Mission) => void   // 强制恢复模式
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
// 对外 API
// ═══════════════════════════════════════════════════════════

/** 开始一个 Mission（用户点击"开始专注"） */
export function startMission(missionId: string) {
  const store = useMissionStore.getState()
  const m = store.getMission(missionId)
  if (!m) return
  useMissionStore.setState({ currentMissionId: missionId })
  store.updateMission(missionId, { status: 'FOCUSING', startedAt: Date.now(), distractionMs: 0, distractedSince: undefined })
  handleEvent({ type: 'MISSION_STARTED', ts: Date.now() })
  logger.info('discipline', `Mission 开始: ${m.title}`, { id: missionId })
}

/** 手动停止当前 Mission */
export function stopCurrentMission() {
  const store = useMissionStore.getState()
  const m = store.getCurrentMission()
  if (!m) return
  handleEvent({ type: 'MISSION_STOPPED', ts: Date.now() })
}

/** 用户点击"回到任务"（从干预/分心中恢复） */
export function recoverMission() {
  const store = useMissionStore.getState()
  const m = store.getCurrentMission()
  if (!m) return
  store.updateMission(m.id, { status: 'RECOVERING', interventionLevel: 0, distractedSince: undefined })
  logger.info('discipline', `Mission 恢复: ${m.title}`)
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

/** 主入口：处理一个 BehaviorEvent */
export function handleEvent(event: BehaviorEvent) {
  const store = useMissionStore.getState()
  const m = store.getCurrentMission()
  if (!m) return
  // 已结束的任务不再处理事件
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
      store.updateMission(m.id, { status: 'IDLE' })
      store.setCurrentMission(null)
      break
    default:
      break
  }
}

// ═══════════════════════════════════════════════════════════
// 内部逻辑
// ═══════════════════════════════════════════════════════════

/** App 切到前台：判断是否是分心 */
function onAppForeground(m: Mission, event: BehaviorEvent) {
  const store = useMissionStore.getState()
  const pkg = event.packageName || ''
  const cat = event.appCategory ?? classifyApp(pkg)

  const isDistraction = cat === 'entertainment' || cat === 'social'
  const isStudy = cat === 'study'

  if (isDistraction && (m.status === 'FOCUSING' || m.status === 'RECOVERING')) {
    // 进入分心
    store.updateMission(m.id, { status: 'DISTRACTED', distractedSince: Date.now() })
    logger.info('discipline', `检测到分心: ${pkg}`, { category: cat, mission: m.title })
    escalateIntervention(m.id)
  } else if (isStudy && m.status === 'DISTRACTED') {
    // 回到学习 App → 恢复
    recoverMission()
  }
}

/** UsageStats 周期采样：累计有效学习 / 分心时长，并尝试完成 */
function onUsageSample(m: Mission, event: BehaviorEvent) {
  const store = useMissionStore.getState()
  const studyMs = event.studyMs ?? 0
  const distractionMs = event.distractionMs ?? 0

  store.updateMission(m.id, {
    actualStudyMs: m.actualStudyMs + studyMs,
    distractionMs: m.distractionMs + distractionMs
  })

  // 采样时若已分心，尝试升级干预
  if (m.status === 'DISTRACTED' || m.status === 'INTERVENTION') {
    escalateIntervention(m.id)
  }

  tryComplete(m.id)
}

/** 分级干预：根据分心持续时长升级 */
function escalateIntervention(missionId: string) {
  const store = useMissionStore.getState()
  const m = store.getMission(missionId)
  if (!m || !m.distractedSince) return

  const distractedMs = Date.now() - m.distractedSince
  let level: InterventionLevel = 0
  if (distractedMs >= LEVEL3_AFTER_MS) level = 3
  else if (distractedMs >= LEVEL2_AFTER_MS) level = 2
  else if (distractedMs >= LEVEL1_AFTER_MS) level = 1

  if (level === m.interventionLevel) return
  store.updateMission(missionId, { interventionLevel: level, status: level > 0 ? 'INTERVENTION' : m.status })
  logger.info('discipline', `干预升级 LEVEL ${level}`, { mission: m.title, distractedMs })

  if (level >= 1) handlers.onDistracted?.(m, level)
  if (level === 1) handlers.onLevel1?.(m)
  else if (level === 2) handlers.onLevel2?.(m)
  else if (level === 3) handlers.onLevel3?.(m)
}

/** 尝试完成（证据驱动） */
export function tryComplete(missionId: string) {
  const store = useMissionStore.getState()
  const m = store.getMission(missionId)
  if (!m || m.status === 'COMPLETED' || m.status === 'MISSED') return

  const result = evaluateMission(m)
  if (!result.canComplete) return

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
