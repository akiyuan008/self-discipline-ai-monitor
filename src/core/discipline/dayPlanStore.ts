/**
 * src/core/discipline/dayPlanStore.ts
 * DayPlan 存储（V3 Phase 6）。
 *
 * DayPlan 状态机：PLANNED → COMMITTED → EXECUTING → RESULT
 *   - Mission 自动进入 DayPlan，默认 PLANNED（不自动视为 COMMITTED）。
 *   - Commitment 必须是真实用户意愿（Commit Today's Plan 一次性确认，
 *     或单个 Mission Commit / Skip / Reschedule），否则 Commitment Rate 无意义。
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { DayPlan, DayPlanStatus, CommitmentAction, MissionCommitment } from './types'

interface DayPlanState {
  dayPlans: DayPlan[]

  createDayPlan: (p: { date: string; missionIds: string[] }) => DayPlan
  getDayPlanByDate: (date: string) => DayPlan | undefined
  updateDayPlan: (id: string, patch: Partial<DayPlan>) => void
  /** 同步当日 Mission 列表（新增的并入，不覆盖已有承诺） */
  syncMissions: (date: string, missionIds: string[]) => void

  /** Commit Today's Plan：一次性确认，未单独操作的 Mission 记 COMMITTED */
  commitDayPlan: (date: string) => void
  /** 单个 Mission 的 Commit / Skip / Reschedule */
  setMissionCommitment: (date: string, missionId: string, action: CommitmentAction) => void
  /** 某 Mission 开始执行 → DayPlan 进入 EXECUTING */
  markExecuting: (date: string) => void
  /** Day End 生成 Review 后 → RESULT */
  markResult: (date: string) => void
  /** 某 Mission 的有效承诺（无单独记录且计划已提交 → COMMITTED） */
  effectiveCommitment: (date: string, missionId: string) => CommitmentAction | 'PLANNED'
}

function genDayPlanId(): string {
  return `dp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export const useDayPlanStore = create<DayPlanState>()(
  persist(
    (set, get) => ({
      dayPlans: [],

      createDayPlan: ({ date, missionIds }) => {
        const plan: DayPlan = {
          id: genDayPlanId(),
          date,
          missionIds,
          commitments: [],
          status: 'PLANNED',
          createdAt: Date.now()
        }
        set(s => ({ dayPlans: [...s.dayPlans, plan] }))
        return plan
      },

      getDayPlanByDate: (date) => get().dayPlans.find(p => p.date === date),

      updateDayPlan: (id, patch) => {
        set(s => ({ dayPlans: s.dayPlans.map(p => (p.id === id ? { ...p, ...patch } : p)) }))
      },

      syncMissions: (date, missionIds) => {
        const plan = get().getDayPlanByDate(date)
        if (!plan) {
          get().createDayPlan({ date, missionIds })
          return
        }
        const merged = Array.from(new Set([...plan.missionIds, ...missionIds]))
        get().updateDayPlan(plan.id, { missionIds: merged })
      },

      commitDayPlan: (date) => {
        const plan = get().getDayPlanByDate(date)
        if (!plan) return
        const now = Date.now()
        const existing = new Map(plan.commitments.map(c => [c.missionId, c]))
        const commitments: MissionCommitment[] = [...plan.commitments]
        // 未单独操作的 Mission → COMMITTED（已有 Skip/Reschedule/Commit 的保持不变）
        for (const mid of plan.missionIds) {
          if (!existing.has(mid)) commitments.push({ missionId: mid, action: 'COMMITTED', ts: now })
        }
        get().updateDayPlan(plan.id, {
          status: plan.status === 'PLANNED' ? 'COMMITTED' : plan.status,
          committedAt: plan.committedAt ?? now,
          commitments
        })
      },

      setMissionCommitment: (date, missionId, action) => {
        const plan = get().getDayPlanByDate(date)
        if (!plan) return
        const now = Date.now()
        const others = plan.commitments.filter(c => c.missionId !== missionId)
        get().updateDayPlan(plan.id, { commitments: [...others, { missionId, action, ts: now }] })
      },

      markExecuting: (date) => {
        const plan = get().getDayPlanByDate(date)
        if (!plan) return
        if (plan.status === 'PLANNED' || plan.status === 'COMMITTED') {
          get().updateDayPlan(plan.id, { status: 'EXECUTING' })
        }
      },

      markResult: (date) => {
        const plan = get().getDayPlanByDate(date)
        if (!plan) return
        get().updateDayPlan(plan.id, { status: 'RESULT' })
      },

      effectiveCommitment: (date, missionId) => {
        const plan = get().getDayPlanByDate(date)
        if (!plan) return 'PLANNED'
        const c = plan.commitments.find(x => x.missionId === missionId)
        if (c) return c.action
        // 计划已提交且无单独记录 → 视为 COMMITTED
        if (plan.status !== 'PLANNED') return 'COMMITTED'
        return 'PLANNED'
      }
    }),
    {
      name: 'discipline-dayplan-store',
      version: 1,
      storage: createJSONStorage(() => localStorage)
    }
  )
)
