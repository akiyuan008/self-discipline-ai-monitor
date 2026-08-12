/**
 * src/core/discipline/focusMath.ts
 * 专注时间区间数学 —— FocusEvidence 的统一去重/合并。
 *
 * 核心保证：DUNGEON 与 APP_USAGE 两种来源的专注区间，
 * 在这里做重叠合并（union），重叠部分只计一次，杜绝双重计算。
 *
 * 例：19:00-19:20 DUNGEON、19:20-19:25 分心、19:25-19:50 DUNGEON
 *     → 合并后专注 = 20 + 25 = 45min（而不是 45 + UsageStats 重复累加）。
 */
import type { FocusInterval } from './types'

/**
 * 合并一组时间区间，返回去重后的总毫秒数。
 * 经典区间合并：排序后逐个吸收重叠。
 */
export function mergeIntervalsMs(
  intervals: Array<Pick<FocusInterval, 'startedAt' | 'endedAt'>>
): number {
  if (!intervals.length) return 0
  const valid = intervals.filter(iv => iv.endedAt > iv.startedAt)
  if (!valid.length) return 0

  const sorted = [...valid].sort((a, b) => a.startedAt - b.startedAt)
  let total = 0
  let curStart = sorted[0].startedAt
  let curEnd = sorted[0].endedAt

  for (let i = 1; i < sorted.length; i++) {
    const iv = sorted[i]
    if (iv.startedAt <= curEnd) {
      // 重叠或相邻 → 吸收，扩展右端
      if (iv.endedAt > curEnd) curEnd = iv.endedAt
    } else {
      total += curEnd - curStart
      curStart = iv.startedAt
      curEnd = iv.endedAt
    }
  }
  total += curEnd - curStart
  return total
}

/** 从一组 FocusInterval 派生去重后的总专注毫秒数 */
export function computeFocusMs(intervals: FocusInterval[]): number {
  return mergeIntervalsMs(intervals)
}

/** 截至 upTo 时刻的已合并专注毫秒数（用于实时显示进度） */
export function computeFocusMsUpTo(intervals: FocusInterval[], upTo: number): number {
  const clipped = intervals.map(iv => ({
    startedAt: iv.startedAt,
    endedAt: Math.min(iv.endedAt, upTo)
  }))
  return mergeIntervalsMs(clipped)
}
