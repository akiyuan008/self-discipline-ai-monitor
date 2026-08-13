/**
 * src/core/discipline/recoveryReward.ts
 * Recovery 奖励（V3 Phase 3）—— 纯逻辑模块（不依赖 store，可独立测试）。
 *
 * 理念：自律不是"永远不分心"，而是"分心后能回到轨道"。
 * 主动 Recovery 是正向行为 → 小额奖励强化"回来"这个动作（Recovery > Punishment）。
 * 防刷：每个 Session 仅奖励前 MAX_PER_SESSION 次恢复。
 */
import { RECOVERY } from './config'
import type { RewardCallbacks, RewardResult } from './rewardEngine'

/**
 * 是否应对本次恢复发奖（防刷：每 Session 仅奖励前 MAX_PER_SESSION 次）。
 * @param recoveryCountAfter 本次恢复后的累计恢复次数
 */
export function shouldRewardRecovery(recoveryCountAfter: number): boolean {
  return recoveryCountAfter >= 1 && recoveryCountAfter <= RECOVERY.MAX_PER_SESSION
}

/** 发放 Recovery 奖励（统一经 RewardEngine 回调；页面/Android/AI 不直接发奖） */
export function grantRecoveryReward(cb: RewardCallbacks): RewardResult {
  const reason = '恢复专注（Recovery）'
  cb.addPoints(RECOVERY.BONUS_PTS)
  if (cb.addExp) cb.addExp(RECOVERY.BONUS_XP, reason)
  else cb.addXp(RECOVERY.BONUS_XP)
  cb.addPointRecord('earn', RECOVERY.BONUS_PTS, reason)
  return { points: RECOVERY.BONUS_PTS, xp: RECOVERY.BONUS_XP, reasons: [reason] }
}
