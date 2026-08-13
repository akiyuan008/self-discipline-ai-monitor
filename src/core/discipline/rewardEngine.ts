/**
 * src/core/discipline/rewardEngine.ts
 * 奖励引擎 —— Mission 完成后统一发放 XP / PTS / Achievement。
 *
 * 原则：页面 / Android / AI 不直接发奖。所有奖励统一由这里发放。
 * Mission 完成 → RewardEngine → XP / PTS / Achievement。
 */
import type { Mission } from './types'
import { REWARD } from './config'
import { useSessionStore } from './sessionStore'

export interface RewardResult {
  points: number
  xp: number
  reasons: string[]
}

export interface RewardCallbacks {
  addPoints: (n: number) => void
  addXp: (n: number) => void
  addPointRecord: (type: 'earn' | 'spend', amount: number, reason: string) => void
  addExp?: (amount: number, reason: string) => void
}

/** 基础 PTS（按目标时长，每分钟 1 分，下限取 config） */
function basePoints(m: Mission): number {
  return Math.max(REWARD.BASE_POINTS_MIN, Math.round(m.targetMinutes))
}

/** 基础 XP（按有效学习分钟） */
function baseXp(m: Mission): number {
  return Math.max(10, Math.round(m.actualStudyMs / 60_000))
}

/**
 * Mission 完成后发放奖励。
 * @returns 本次发放的奖励明细
 */
export function grantMissionReward(m: Mission, cb: RewardCallbacks): RewardResult {
  const reasons: string[] = []
  let points = 0
  let xp = 0

  // 基础奖励：完成即得
  points += basePoints(m)
  xp += baseXp(m)
  reasons.push(`完成任务：${m.title}`)

  // 高专注加成：分心时间占比低于阈值
  const totalMs = m.actualStudyMs + m.distractionMs
  if (totalMs > 0 && m.distractionMs / totalMs < REWARD.FOCUS_BONUS_DISTRACTION_RATIO) {
    points += REWARD.FOCUS_BONUS
    xp += REWARD.FOCUS_BONUS
    reasons.push('高度专注加成')
  }

  // 深渊挑战奖励：专注证据含 DUNGEON(abyss) 区间 → +ABYSS_BONUS PTS
  // （V3：证据在 Session.segments，需合并 Mission 遗留 focusIntervals 一起检测）
  const sessionSegs = useSessionStore.getState().getSessionsByMission(m.id).flatMap(s => s.segments)
  const allFocusIntervals = [...(m.focusIntervals || []), ...sessionSegs]
  const hasAbyssDungeon = allFocusIntervals.some(iv => iv.source === 'DUNGEON' && iv.tag === 'abyss')
  if (hasAbyssDungeon) {
    points += REWARD.ABYSS_BONUS
    reasons.push('深渊重载挑战奖励')
  }

  cb.addPoints(points)
  if (cb.addExp) cb.addExp(xp, `完成任务：${m.title}`)
  else cb.addXp(xp)
  cb.addPointRecord('earn', points, `完成任务：${m.title}`)

  return { points, xp, reasons }
}

/** 任务错过的惩罚（可选，轻度，体现"恢复优先"） */
export function grantMissedPenalty(m: Mission, cb: RewardCallbacks): RewardResult {
  const penalty = Math.min(REWARD.MISSED_PENALTY_MAX, Math.round(m.targetMinutes / 2))
  if (penalty > 0) {
    cb.addPoints(-penalty)
    cb.addPointRecord('spend', penalty, `错过任务：${m.title}`)
  }
  return { points: -penalty, xp: 0, reasons: [`错过任务：${m.title}`] }
}
