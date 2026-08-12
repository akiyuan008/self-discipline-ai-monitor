/**
 * src/core/discipline/rewardEngine.ts
 * 奖励引擎 —— Mission 完成后统一发放 XP / PTS / Achievement。
 *
 * 原则：页面 / Android / AI 不直接发奖。所有奖励统一由这里发放。
 * Mission 完成 → RewardEngine → XP / PTS / Achievement。
 */
import type { Mission } from './types'

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

/** 基础 PTS（按目标时长，每分钟 1 分，下限 20） */
function basePoints(m: Mission): number {
  return Math.max(20, Math.round(m.targetMinutes))
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

  // 高专注加成：分心时间占比 < 10%
  const totalMs = m.actualStudyMs + m.distractionMs
  if (totalMs > 0 && m.distractionMs / totalMs < 0.1) {
    points += 20
    xp += 20
    reasons.push('高度专注加成')
  }

  cb.addPoints(points)
  if (cb.addExp) cb.addExp(xp, `完成任务：${m.title}`)
  else cb.addXp(xp)
  cb.addPointRecord('earn', points, `完成任务：${m.title}`)

  return { points, xp, reasons }
}

/** 任务错过的惩罚（可选，轻度，体现"恢复优先"） */
export function grantMissedPenalty(m: Mission, cb: RewardCallbacks): RewardResult {
  const penalty = Math.min(30, Math.round(m.targetMinutes / 2))
  if (penalty > 0) {
    cb.addPoints(-penalty)
    cb.addPointRecord('spend', penalty, `错过任务：${m.title}`)
  }
  return { points: -penalty, xp: 0, reasons: [`错过任务：${m.title}`] }
}
