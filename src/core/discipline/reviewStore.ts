/**
 * src/core/discipline/reviewStore.ts
 * DailyReview 快照 + AI Insight 存储（V3 Phase 6）。
 *
 * DailyReview 是 Day End 的确定性聚合事实快照（不含 AI），保存后即为事实。
 * AI Insight 按需生成、按 (baseDate, range) 去重缓存（已存在则直接读取）。
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { DailyReview, AiInsight, InsightRange } from './types'

interface ReviewState {
  dailyReviews: DailyReview[]
  aiInsights: AiInsight[]

  saveDailyReview: (review: DailyReview) => void
  getDailyReviewByDate: (date: string) => DailyReview | undefined
  /** 取某区间内的 Review（按日期升序） */
  getReviewsInRange: (startDate: string, endDate: string) => DailyReview[]

  saveAiInsight: (insight: AiInsight) => void
  getAiInsight: (baseDate: string, range: InsightRange) => AiInsight | undefined
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      dailyReviews: [],
      aiInsights: [],

      saveDailyReview: (review) => {
        set(s => ({
          dailyReviews: [...s.dailyReviews.filter(r => r.date !== review.date), review].slice(-120)
        }))
      },

      getDailyReviewByDate: (date) => get().dailyReviews.find(r => r.date === date),

      getReviewsInRange: (startDate, endDate) =>
        get()
          .dailyReviews.filter(r => r.date >= startDate && r.date <= endDate)
          .sort((a, b) => (a.date < b.date ? -1 : 1)),

      saveAiInsight: (insight) => {
        set(s => ({
          aiInsights: [
            ...s.aiInsights.filter(i => !(i.baseDate === insight.baseDate && i.range === insight.range)),
            insight
          ].slice(-120)
        }))
      },

      getAiInsight: (baseDate, range) =>
        get().aiInsights.find(i => i.baseDate === baseDate && i.range === range)
    }),
    {
      name: 'discipline-review-store',
      version: 1,
      storage: createJSONStorage(() => localStorage)
    }
  )
)
