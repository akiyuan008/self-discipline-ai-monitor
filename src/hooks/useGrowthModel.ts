/**
 * src/hooks/useGrowthModel.ts
 * Growth Mode 派生入口：从共享 Session/Mission/store 只读派生整套成长产品数据。
 * 不修改 Core。Normal 看任务，Growth 看"我正在成为谁"。
 */
import { useMemo } from 'react'
import { useSessionStore, useMissionStore } from '@/core/discipline'
import { useStore } from '@/stores/useStore'
import {
  deriveAbilityTrends, deriveGrowthIdentity, deriveGrowthMemory,
  deriveNextStep, deriveGrowthDirection,
  type AbilityTrend, type GrowthIdentity, type GrowthMoment, type NextStep, type GrowthDirection,
} from '@/lib/growthModel'
import { localDateStr } from '@/lib/dateUtils'

export interface TrendPoint { date: string; focusMs: number }

export interface GrowthModel {
  trends: AbilityTrend[]
  identity: GrowthIdentity
  memory: GrowthMoment[]
  nextStep: NextStep
  direction: GrowthDirection
  streak: number
  grewToday: boolean
  hasAnyGrowth: boolean
  /** 每日专注轨迹（升序），供成长趋势层使用 */
  trajectory: TrendPoint[]
}

export function useGrowthModel(): GrowthModel {
  const sessions = useSessionStore(s => s.sessions)
  const missions = useMissionStore(s => s.missions)
  const streak = useStore(s => s.streak)
  const todayStudyMs = useStore(s => s.todayStudyMs)

  return useMemo(() => {
    const now = Date.now()
    const trends = deriveAbilityTrends(sessions, now)
    const identity = deriveGrowthIdentity(trends, sessions, now)
    const memory = deriveGrowthMemory(sessions, now)
    const grewToday = todayStudyMs > 0
    const nextStep = deriveNextStep(trends, streak, grewToday)
    const direction = deriveGrowthDirection(sessions, missions)
    const hasAnyGrowth = sessions.some(s => (s.focusDurationMs || 0) > 0)
    // 每日专注轨迹（从 Session 只读派生）
    const daily = new Map<string, number>()
    for (const s of sessions) {
      const fm = s.focusDurationMs || 0
      if (fm <= 0) continue
      const key = localDateStr(new Date(s.startedAt))
      daily.set(key, (daily.get(key) || 0) + fm)
    }
    const trajectory: TrendPoint[] = Array.from(daily.entries())
      .map(([date, focusMs]) => ({ date, focusMs }))
      .sort((a, b) => a.date.localeCompare(b.date))
    return { trends, identity, memory, nextStep, direction, streak, grewToday, hasAnyGrowth, trajectory }
  }, [sessions, missions, streak, todayStudyMs])
}
