/**
 * src/stores/growthStore.ts
 * Growth Mode 数据模型（App Mode，不是主题）。
 *
 * Growth 是同一 App 内的第二套产品逻辑：个人成长系统。
 * 用户目标 = 培养能力，看见自己的长期变化。
 *
 * 一期数据模型（本版实现）：
 *   1. AbilityDimension  能力维度 —— 把成长拆成"可累积的能力"，而非任务完成
 *   2. GrowthSnapshot    成长快照 —— 长期轨迹的取样点，支撑"看见变化"
 *
 * GrowthIntention（成长意向）暂缓，二期再做。
 *
 * 边界：能力指标从共享的 Session/Mission 派生（见 useGrowthJourney），
 *       不修改 Core（Mission/Session/Reward/Evidence/ResultEvaluator）。
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { localDateStr } from '@/lib/dateUtils'

/* ═══ 能力维度定义 ═══ */
export type AbilityType = 'subject' | 'meta'

export interface AbilityDimension {
  id: string
  name: string
  type: AbilityType
}

/**
 * 底层能力（meta）：不随科目变化，是"成长"的通用底座。
 * 用真实指标度量（投入时长 / 坚持天数），不是游戏数值。
 */
export const META_ABILITIES: AbilityDimension[] = [
  { id: 'meta-focus', name: '专注力', type: 'meta' },
  { id: 'meta-consistency', name: '坚持', type: 'meta' },
]

/** 某能力维度当前的成长状态（派生自 Session/Mission，非持久化的游戏数值） */
export interface AbilityGrowth {
  dimension: AbilityDimension
  /** 累计投入时长（真实专注毫秒） */
  totalFocusMs: number
  /** 投入次数（专注段/会话数） */
  sessionCount: number
  /** 最近一次投入时间（无则 null） */
  lastGrowthAt: number | null
}

/* ═══ 成长快照（长期轨迹取样点）═══ */
export interface GrowthSnapshot {
  /** 取样日期 yyyy-mm-dd */
  date: string
  level: number
  totalExp: number
  totalFocusMs: number
  streak: number
  sessionCount: number
  /** 取样时间戳 */
  takenAt: number
}

/* ═══ Store ═══ */
interface GrowthState {
  snapshots: GrowthSnapshot[]
  /**
   * 确保今天已取样。每天最多一条快照，重复调用幂等。
   * current 由调用方从 useStore/useSessionStore 读取传入，保持本 store 对 Core 解耦。
   */
  ensureTodaySnapshot: (current: {
    level: number
    totalExp: number
    totalFocusMs: number
    streak: number
    sessionCount: number
  }) => void
}

export const useGrowthStore = create<GrowthState>()(
  persist(
    (set, get) => ({
      snapshots: [],
      ensureTodaySnapshot: (current) => {
        const today = localDateStr()
        const { snapshots } = get()
        if (snapshots.some(s => s.date === today)) return
        const snap: GrowthSnapshot = {
          date: today,
          level: current.level,
          totalExp: current.totalExp,
          totalFocusMs: current.totalFocusMs,
          streak: current.streak,
          sessionCount: current.sessionCount,
          takenAt: Date.now(),
        }
        set({ snapshots: [...snapshots, snap] })
      },
    }),
    {
      name: 'growth-mode-store',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    }
  )
)
