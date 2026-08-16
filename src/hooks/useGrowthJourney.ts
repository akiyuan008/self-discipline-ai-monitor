/**
 * src/hooks/useGrowthJourney.ts
 * Growth Mode 派生层：把共享的 Session/Mission 数据，派生成"成长旅程"视角。
 *
 * 核心原则：
 *   - 不修改 Core。Session/Mission 是共享事实源，这里只做只读派生。
 *   - 能力指标 = 真实投入（专注时长 / 次数 / 天数），不是游戏数值。
 *   - Normal 看"任务完成"，Growth 看"能力累积 + 旅程轨迹"。
 */
import { useMemo } from 'react'
import { useMissionStore, useSessionStore } from '@/core/discipline'
import { useStore } from '@/stores/useStore'
import { META_ABILITIES, type AbilityGrowth, type AbilityDimension } from '@/stores/growthStore'
import { localDateStr } from '@/lib/dateUtils'

export interface TrajectoryPoint {
  date: string
  focusMs: number
}

export interface GrowthJourney {
  /** 学科能力（按投入时长降序） */
  subjectAbilities: AbilityGrowth[]
  /** 底层能力：专注力 + 坚持 */
  metaAbilities: AbilityGrowth[]
  /** 累计真实专注毫秒 */
  totalFocusMs: number
  /** 有效专注会话数 */
  sessionCount: number
  /** 有成长的不同天数 */
  daysGrowing: number
  /** 第一次成长时间（无则 null） */
  firstGrowthAt: number | null
  /** 连续坚持（来自共享 store） */
  streak: number
  /** 每日专注轨迹（按日期升序） */
  trajectory: TrajectoryPoint[]
}

export function useGrowthJourney(): GrowthJourney {
  const sessions = useSessionStore(s => s.sessions)
  const missions = useMissionStore(s => s.missions)
  const streak = useStore(s => s.streak)

  return useMemo(() => {
    const missionById = new Map(missions.map(m => [m.id, m]))

    // 有效专注会话：focusDurationMs > 0
    const focusSessions = sessions.filter(s => (s.focusDurationMs || 0) > 0)

    // ── 学科能力归因：Session → Mission.subject ──
    const subjectAgg = new Map<string, { focusMs: number; count: number; last: number }>()
    // ── 每日轨迹 + 成长天数 ──
    const daily = new Map<string, number>()
    let totalFocusMs = 0
    let firstGrowthAt: number | null = null

    for (const s of focusSessions) {
      const ms = s.focusDurationMs || 0
      totalFocusMs += ms

      if (firstGrowthAt === null || s.startedAt < firstGrowthAt) firstGrowthAt = s.startedAt

      const dayKey = localDateStr(new Date(s.startedAt))
      daily.set(dayKey, (daily.get(dayKey) || 0) + ms)

      const subj = missionById.get(s.missionId)?.subject?.trim()
      if (subj) {
        const agg = subjectAgg.get(subj) || { focusMs: 0, count: 0, last: 0 }
        agg.focusMs += ms
        agg.count += 1
        agg.last = Math.max(agg.last, s.startedAt)
        subjectAgg.set(subj, agg)
      }
    }

    const subjectAbilities: AbilityGrowth[] = Array.from(subjectAgg.entries())
      .map(([name, agg]) => ({
        dimension: { id: `subj-${name}`, name, type: 'subject' as const },
        totalFocusMs: agg.focusMs,
        sessionCount: agg.count,
        lastGrowthAt: agg.last || null,
      }))
      .sort((a, b) => b.totalFocusMs - a.totalFocusMs)

    // ── 底层能力 ──
    const daysGrowing = daily.size
    const metaAbilities: AbilityGrowth[] = [
      {
        dimension: META_ABILITIES.find(a => a.id === 'meta-focus') as AbilityDimension,
        totalFocusMs,
        sessionCount: focusSessions.length,
        lastGrowthAt: firstGrowthAt,
      },
      {
        dimension: META_ABILITIES.find(a => a.id === 'meta-consistency') as AbilityDimension,
        // 坚持用"成长天数"度量，放在 sessionCount 字段承载，UI 侧按天数解释
        totalFocusMs: 0,
        sessionCount: daysGrowing,
        lastGrowthAt: firstGrowthAt,
      },
    ]

    // ── 轨迹（按日期升序）──
    const trajectory: TrajectoryPoint[] = Array.from(daily.entries())
      .map(([date, focusMs]) => ({ date, focusMs }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      subjectAbilities,
      metaAbilities,
      totalFocusMs,
      sessionCount: focusSessions.length,
      daysGrowing,
      firstGrowthAt,
      streak,
      trajectory,
    }
  }, [sessions, missions, streak])
}
