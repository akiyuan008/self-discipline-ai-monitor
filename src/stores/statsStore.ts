import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { MOCK_USAGE_STATS, MOCK_WEEKLY_TREND, MOCK_FOCUS_CURVE, MOCK_SUBJECT_MONTHLY, MOCK_ENTERTAINMENT_BLACKHOLES, type UsageStat } from '@/data/mockUsage'

interface StatsState {
  todayStats: UsageStat[]
  weeklyTrend: typeof MOCK_WEEKLY_TREND
  focusCurve: number[]
  subjectMonthly: typeof MOCK_SUBJECT_MONTHLY
  entertainmentTop3: typeof MOCK_ENTERTAINMENT_BLACKHOLES
  lastStudyMs: number
  lastEntertainmentMs: number
  refresh: () => Promise<void>
  lockMinutes: number     // 累计强制锁屏分钟
  addLock: (min: number) => void
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      todayStats: MOCK_USAGE_STATS,
      weeklyTrend: MOCK_WEEKLY_TREND,
      focusCurve: MOCK_FOCUS_CURVE,
      subjectMonthly: MOCK_SUBJECT_MONTHLY,
      entertainmentTop3: MOCK_ENTERTAINMENT_BLACKHOLES,
      lastStudyMs: 0,
      lastEntertainmentMs: 0,
      lockMinutes: 0,

      refresh: async () => {
        // 真机环境：通过 Capacitor 桥接 UsageStatsManager 拉取；这里使用 mock
        set({ todayStats: MOCK_USAGE_STATS })
      },
      addLock: (min) => set(s => ({ lockMinutes: s.lockMinutes + min }))
    }),
    { name: 'self-discipline-stats', storage: createJSONStorage(() => localStorage) }
  )
)

// 派生数据
export function studyMinutesToday(): number {
  return useStatsStore.getState().todayStats
    .filter(s => s.isStudy)
    .reduce((sum, s) => sum + s.totalMs, 0) / 60_000
}

export function entertainmentMinutesToday(): number {
  return useStatsStore.getState().todayStats
    .filter(s => !s.isStudy)
    .reduce((sum, s) => sum + s.totalMs, 0) / 60_000
}

export function focusScoreToday(): number {
  const study = studyMinutesToday()
  const ent = entertainmentMinutesToday()
  if (study + ent === 0) return 0
  return Math.round((study / (study + ent)) * 100)
}

export function topEntertainmentApps(limit = 3): UsageStat[] {
  return [...useStatsStore.getState().todayStats]
    .filter(s => !s.isStudy)
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, limit)
}
