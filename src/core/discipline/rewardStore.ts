/**
 * src/core/discipline/rewardStore.ts
 * RewardTransaction 存储（V3 Phase 10A）。
 *
 * 硬规则：
 *   - recordReward 只落流水记录，**不改 PTS/XP 余额**（余额由 RewardEngine 调 addPoints/addXp）。
 *   - 幂等基于稳定 eventId（hasRewardByEvent），不依据当前余额。
 *   - Legacy marker（LEGACY_ACCEPTED）只 recordReward、不调 callback → 不再触发发奖，
 *     仅用于 reconciliation / dedup / migration barrier。
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { RewardTransaction } from './types'
import { isAlreadyIssued } from './rewardCore'

interface RewardState {
  transactions: RewardTransaction[]
  /** 仅记录流水（不改余额） */
  recordReward: (txn: RewardTransaction) => void
  /** 幂等判断：该 eventId 是否已有流水 */
  hasRewardByEvent: (eventId: string) => boolean
  getRewardsByMission: (missionId: string) => RewardTransaction[]
}

export const useRewardStore = create<RewardState>()(
  persist(
    (set, get) => ({
      transactions: [],

      recordReward: (txn) => {
        set(s => ({ transactions: [...s.transactions, txn].slice(-500) }))
      },

      hasRewardByEvent: (eventId) => isAlreadyIssued(get().transactions, eventId),

      getRewardsByMission: (missionId) =>
        get().transactions.filter(t => t.missionId === missionId)
    }),
    {
      name: 'discipline-reward-store',
      version: 1,
      storage: createJSONStorage(() => localStorage)
    }
  )
)
