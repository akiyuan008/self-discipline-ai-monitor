import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { STORES, dbPut, dbGetAll, dbBulkPut } from '@/lib/indexedDB'

// ═══════════════════════════════════════════════════════════
// 数据模型
// ═══════════════════════════════════════════════════════════

export interface SubjectScore {
  name: string
  currentScore: number
  targetScore: number
  fullScore: number   // 满分（如语数英150，理综300）
}

export interface ErrorQuestion {
  id: string
  subject: string
  tag: string          // 知识点标签，如"函数图像"
  desc: string         // 错题描述
  ts: number           // 时间戳
  resolved: boolean    // 是否已解决
}

export interface WeeklyPlanTask {
  id: string
  subject: string
  content: string
  estimatedMinutes: number
  completed: boolean
  priority: 'high' | 'medium' | 'low'
}

export interface WeeklyGoal {
  subject: string
  targetHours: number
  completedHours: number
}

export interface GaoKaoProfile {
  // 基础信息
  nickname: string
  targetUniversity: string
  targetTotalScore: number
  currentTotalScore: number
  subjects: SubjectScore[]

  // 分析字段
  weakSubjects: string[]              // 薄弱科目细分，如 "数学-函数"
  errorQuestions: ErrorQuestion[]
  weeklyGoals: WeeklyGoal[]

  // 行为数据
  studyStreak: number
  lastStudyDate: string
  generatedPlan: WeeklyPlanTask[]

  // 版本控制
  dbVersion: number
}

// ═══════════════════════════════════════════════════════════
// 默认数据
// ═══════════════════════════════════════════════════════════

const DEFAULT_SUBJECTS: SubjectScore[] = []

const DEFAULT_PROFILE: GaoKaoProfile = {
  nickname: '',
  targetUniversity: '',
  targetTotalScore: 0,
  currentTotalScore: 0,
  subjects: [],
  weakSubjects: [],
  errorQuestions: [],
  weeklyGoals: [],
  studyStreak: 0,
  lastStudyDate: '',
  generatedPlan: [],
  dbVersion: 1,
}

// ═══════════════════════════════════════════════════════════
// Store
// ═══════════════════════════════════════════════════════════

interface GaoKaoState {
  profile: GaoKaoProfile

  // Actions
  updateProfile: (partial: Partial<GaoKaoProfile>) => void
  addSubject: (subject: SubjectScore) => void
  updateSubject: (name: string, partial: Partial<SubjectScore>) => void
  addErrorQuestion: (q: Omit<ErrorQuestion, 'id' | 'ts' | 'resolved'>) => void
  removeErrorQuestion: (id: string) => void
  resolveErrorQuestion: (id: string) => void
  generateWeeklyPlan: () => void
  togglePlanTask: (id: string) => void
  syncToIndexedDB: () => Promise<void>
  loadFromIndexedDB: () => Promise<void>
  resetProfile: () => void
}

export const useGaoKaoStore = create<GaoKaoState>()(
  persist(
    (set, get) => ({
      profile: { ...DEFAULT_PROFILE },

      updateProfile: (partial) =>
        set((s) => ({ profile: { ...s.profile, ...partial } })),

      addSubject: (subject) =>
        set((s) => ({
          profile: { ...s.profile, subjects: [...s.profile.subjects, subject] }
        })),

      updateSubject: (name, partial) =>
        set((s) => ({
          profile: {
            ...s.profile,
            subjects: s.profile.subjects.map(sub =>
              sub.name === name ? { ...sub, ...partial } : sub
            )
          }
        })),

      addErrorQuestion: (q) =>
        set((s) => ({
          profile: {
            ...s.profile,
            errorQuestions: [
              {
                ...q,
                id: `eq-${Date.now().toString(36)}`,
                ts: Date.now(),
                resolved: false
              },
              ...s.profile.errorQuestions
            ].slice(0, 500) // 最多保留500条
          }
        })),

      removeErrorQuestion: (id) =>
        set((s) => ({
          profile: {
            ...s.profile,
            errorQuestions: s.profile.errorQuestions.filter(q => q.id !== id)
          }
        })),

      resolveErrorQuestion: (id) =>
        set((s) => ({
          profile: {
            ...s.profile,
            errorQuestions: s.profile.errorQuestions.map(q =>
              q.id === id ? { ...q, resolved: true } : q
            )
          }
        })),

      generateWeeklyPlan: () => {
        const { profile } = get()
        const tasks: WeeklyPlanTask[] = []

        // 基于薄弱科目生成高优先级任务
        for (const weak of profile.weakSubjects) {
          const [subject, topic] = weak.split('-')
          tasks.push({
            id: `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            subject: subject || '通用',
            content: `专项突破：${topic || '薄弱知识点'}`,
            estimatedMinutes: 60,
            completed: false,
            priority: 'high'
          })
        }

        // 基于错题标签生成中优先级复习任务
        const tagCount: Record<string, number> = {}
        for (const q of profile.errorQuestions.filter(q => !q.resolved)) {
          tagCount[q.tag] = (tagCount[q.tag] || 0) + 1
        }
        const topTags = Object.entries(tagCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)

        for (const [tag, count] of topTags) {
          tasks.push({
            id: `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            subject: '通用',
            content: `错题复习：${tag}（${count}题）`,
            estimatedMinutes: 45,
            completed: false,
            priority: 'medium'
          })
        }

        // 基于 weeklyGoals 生成常规任务
        for (const goal of profile.weeklyGoals) {
          if (goal.completedHours < goal.targetHours) {
            tasks.push({
              id: `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
              subject: goal.subject,
              content: `${goal.subject}日常练习（目标${goal.targetHours}h，已完成${goal.completedHours}h）`,
              estimatedMinutes: 90,
              completed: false,
              priority: 'low'
            })
          }
        }

        set((s) => ({ profile: { ...s.profile, generatedPlan: tasks } }))
      },

      togglePlanTask: (id) =>
        set((s) => ({
          profile: {
            ...s.profile,
            generatedPlan: s.profile.generatedPlan.map(t =>
              t.id === id ? { ...t, completed: !t.completed } : t
            )
          }
        })),

      syncToIndexedDB: async () => {
        try {
          const { profile } = get()
          await dbPut(STORES.gaokaoProfile, { id: 'main', ...profile })
          if (profile.errorQuestions.length > 0) {
            await dbBulkPut(STORES.errorQuestions, profile.errorQuestions)
          }
        } catch (e) {
          console.warn('[gaoKaoStore] syncToIndexedDB failed:', e)
        }
      },

      loadFromIndexedDB: async () => {
        try {
          const data = await dbGetAll<GaoKaoProfile & { id: string }>(STORES.gaokaoProfile)
          if (data && data.length > 0) {
            const { id, ...profile } = data[0]
            set((s) => ({ profile: { ...s.profile, ...profile } }))
          }
        } catch (e) {
          console.warn('[gaoKaoStore] loadFromIndexedDB failed:', e)
        }
      },

      resetProfile: () =>
        set({ profile: { ...DEFAULT_PROFILE } }),
    }),
    {
      name: 'gaokao-profile-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
