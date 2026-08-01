import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { QUESTS, type Quest } from '@/data/quests'
import { SHOP_ITEMS, type ShopItem } from '@/data/shop'
import { ACHIEVEMENTS, type Achievement } from '@/data/achievements'

export type PageId =
  | 'home'
  | 'dungeon'
  | 'quests'
  | 'shop'
  | 'profile'
  | 'achievements'
  | 'settings'
  | 'onboarding'

export interface AIConfig {
  apiKey: string
  endpoint: string
  model: string
}

interface StoreState {
  // 引导
  onboarded: boolean
  playerTag: string   // PLAYER_01 这种
  dailyGoalMin: number

  // 资源
  hp: number          // 精神力 0-100
  points: number      // 积分
  streak: number      // 连胜天数
  totalFocusMs: number

  // 任务/成就/商品（持久化副本）
  quests: Quest[]
  achievements: Achievement[]
  ownedItems: Record<string, number>   // itemId -> count

  // 深色模式
  isDark: boolean

  // AI 配置
  ai: AIConfig

  // 深渊状态
  dungeonRemainingSec: number
  dungeonActive: boolean

  // 操作
  setHp: (n: number) => void
  hitHp: (n: number) => void   // 扣血
  addPoints: (n: number) => void
  spendPoints: (n: number) => boolean
  addStreak: (n: number) => void
  addFocusMs: (n: number) => void
  toggleDark: () => void
  setAI: (c: Partial<AIConfig>) => void
  completeQuest: (id: string) => void
  buyItem: (id: string) => boolean
  unlockAchievement: (id: string) => void
  init: (tag: string, goal: number, ai?: AIConfig) => void
  reset: () => void
  setDungeon: (sec: number, active: boolean) => void
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      playerTag: 'PLAYER_01',
      dailyGoalMin: 120,
      hp: 78,
      points: 1280,
      streak: 15,
      totalFocusMs: 45 * 3600_000,
      quests: QUESTS,
      achievements: ACHIEVEMENTS,
      ownedItems: {},
      isDark: false,
      ai: { apiKey: '', endpoint: '', model: 'glm-4-plus' },
      dungeonRemainingSec: 0,
      dungeonActive: false,

      setHp: (n) => set(s => ({ hp: Math.max(0, Math.min(100, n)) })),
      hitHp: (n) => set(s => ({ hp: Math.max(0, s.hp - n) })),
      addPoints: (n) => set(s => ({ points: s.points + n })),
      spendPoints: (cost) => {
        if (get().points < cost) return false
        set(s => ({ points: s.points - cost }))
        return true
      },
      addStreak: (n) => set(s => ({ streak: Math.max(0, s.streak + n) })),
      addFocusMs: (n) => set(s => ({ totalFocusMs: s.totalFocusMs + n })),
      toggleDark: () => set(s => ({ isDark: !s.isDark })),
      setAI: (c) => set(s => ({ ai: { ...s.ai, ...c } })),
      completeQuest: (id) =>
        set(s => ({
          quests: s.quests.map(q => q.id === id ? { ...q, progress: q.total, completed: true } : q)
        })),
      buyItem: (id) => {
        const item = SHOP_ITEMS.find(i => i.id === id)
        if (!item) return false
        if (item.lockLevel && get().streak < item.lockLevel) return false
        if (!get().spendPoints(item.cost)) return false
        set(s => ({ ownedItems: { ...s.ownedItems, [id]: (s.ownedItems[id] || 0) + 1 } }))
        return true
      },
      unlockAchievement: (id) =>
        set(s => ({
          achievements: s.achievements.map(a =>
            a.id === id ? { ...a, unlocked: true, progress: a.total } : a
          )
        })),
      init: (tag, goal, ai) =>
        set({
          onboarded: true,
          playerTag: tag || 'PLAYER_01',
          dailyGoalMin: goal,
          ai: ai ?? { apiKey: '', endpoint: '', model: 'glm-4-plus' }
        }),
      reset: () =>
        set({
          onboarded: false,
          playerTag: 'PLAYER_01',
          dailyGoalMin: 120,
          hp: 78,
          points: 1280,
          streak: 15,
          totalFocusMs: 45 * 3600_000,
          quests: QUESTS,
          achievements: ACHIEVEMENTS,
          ownedItems: {},
          isDark: false,
          ai: { apiKey: '', endpoint: '', model: 'glm-4-plus' }
        }),
      setDungeon: (sec, active) => set({ dungeonRemainingSec: sec, dungeonActive: active })
    }),
    { name: 'cyber-survival-store', storage: createJSONStorage(() => localStorage) }
  )
)
