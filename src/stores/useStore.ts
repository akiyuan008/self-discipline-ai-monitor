import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { type Quest } from '@/data/quests'
import { SHOP_ITEMS, type ShopItem } from '@/data/shop'
import { type Achievement } from '@/data/achievements'

export type PageId =
  | 'home'
  | 'dungeon'
  | 'quests'
  | 'shop'
  | 'profile'
  | 'achievements'
  | 'settings'
  | 'pointsDetail'
  | 'onboarding'

export interface PointRecord {
  id: string
  type: 'earn' | 'spend'
  amount: number
  reason: string
  ts: number
}

export interface UsageStat {
  packageName: string
  label: string
  isStudy: boolean
  totalMs: number
}

interface StoreState {
  // 引导
  onboarded: boolean
  playerTag: string
  dailyGoalMin: number

  // 资源
  hp: number
  points: number
  streak: number
  totalFocusMs: number
  todayStudyMs: number       // 今日学习累计
  todayEntMs: number         // 今日娱乐累计
  totalEntMs: number         // 累计娱乐时长（高考分数扣分用）
  lastSyncDay: string        // 跨日结算用 yyyy-mm-dd

  // 高考目标
  gaokaoDate: string         // 高考日期 yyyy-mm-dd
  gaokaoTargetScore: number  // 目标分数
  gaokaoBaseScore: number    // 基础估分（起步分）

  // 任务/成就/商品
  quests: Quest[]
  achievements: Achievement[]
  ownedItems: Record<string, number>

  // 积分记录
  pointHistory: PointRecord[]

  // 深色模式
  isDark: boolean

  // HP 锁：AI 手动设置 HP 后锁定，避免被定时同步覆盖
  hpLocked: boolean

  // 深渊状态
  dungeonRemainingSec: number
  dungeonActive: boolean
  dungeonDurationMin: number // 选定的番茄钟时长（分钟）

  // 操作
  setHp: (n: number) => void
  hitHp: (n: number) => void
  addPoints: (n: number) => void
  spendPoints: (n: number) => boolean
  addStreak: (n: number) => void
  addFocusMs: (n: number) => void
  toggleDark: () => void
  completeQuest: (id: string) => void
  updateQuestProgress: (id: string, progress: number) => void
  buyItem: (id: string) => boolean
  unlockAchievement: (id: string) => void
  updateAchievementProgress: (id: string, progress: number) => void
  addCustomQuest: (q: { title: string; desc: string; reward: number; category: 'daily' | 'weekly' | 'main' }) => string
  addCustomAchievement: (a: { name: string; desc: string; total: number }) => string
  init: (tag: string, goal: number) => void
  reset: () => void
  setDungeon: (sec: number, active: boolean) => void
  setDungeonDuration: (min: number) => void
  setDailyGoal: (min: number) => void
  setGaokaoDate: (d: string) => void
  setGaokaoTargetScore: (n: number) => void
  syncUsage: (study: UsageStat[], ent: UsageStat[]) => void
  dailySettle: () => void
  addPointRecord: (type: 'earn' | 'spend', amount: number, reason: string) => void
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

// Bug 6 修复：crypto.randomUUID 在旧 WebView 中不支持，加 fallback
function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      playerTag: 'PLAYER_01',
      dailyGoalMin: 120,
      hp: 100,
      points: 0,
      streak: 0,
      totalFocusMs: 0,
      todayStudyMs: 0,
      todayEntMs: 0,
      totalEntMs: 0,
      lastSyncDay: todayStr(),
      gaokaoDate: '2027-06-07',
      gaokaoTargetScore: 680,
      gaokaoBaseScore: 400,
      quests: [],
      achievements: [],
      ownedItems: {},
      pointHistory: [],
      isDark: false,
      hpLocked: false,
      dungeonRemainingSec: 0,
      dungeonActive: false,
      dungeonDurationMin: 25,

      setHp: (n) => set(s => ({ hp: Math.max(0, Math.min(100, Math.round(n))), hpLocked: true })),
      hitHp: (n) => set(s => ({ hp: Math.max(0, s.hp - n) })),
      addPoints: (n) => set(s => ({ points: s.points + n })),
      spendPoints: (cost) => {
        if (get().points < cost) return false
        set(s => ({ points: s.points - cost }))
        return true
      },
      addPointRecord: (type, amount, reason) =>
        set(s => ({
          pointHistory: [
            { id: genId(), type, amount: Math.abs(amount), reason, ts: Date.now() },
            ...s.pointHistory
          ].slice(0, 200)
        })),
      addStreak: (n) => set(s => ({ streak: Math.max(0, s.streak + n) })),
      addFocusMs: (n) => set(s => ({ totalFocusMs: s.totalFocusMs + n, todayStudyMs: s.todayStudyMs + n })),
      toggleDark: () => set(s => ({ isDark: !s.isDark })),
      completeQuest: (id) => {
        const q = get().quests.find(x => x.id === id)
        if (!q || q.completed) return
        const reward = q.reward || 0
        set(s => ({
          quests: s.quests.map(qx => qx.id === id ? { ...qx, progress: qx.total, completed: true } : qx),
          points: s.points + reward
        }))
        if (reward > 0) get().addPointRecord('earn', reward, `完成任务：${q.title}`)
      },
      updateQuestProgress: (id, progress) => {
        const q = get().quests.find(x => x.id === id)
        if (!q) return
        const newProgress = Math.max(0, Math.min(q.total, Math.round(progress)))
        set(s => ({
          quests: s.quests.map(qx => qx.id === id ? { ...qx, progress: newProgress, completed: newProgress >= qx.total } : qx)
        }))
        if (newProgress >= q.total) {
          get().completeQuest(id)
        }
      },
      buyItem: (id) => {
        const item = SHOP_ITEMS.find(i => i.id === id)
        if (!item) return false
        if (item.lockLevel && get().streak < item.lockLevel) return false
        if (!get().spendPoints(item.cost)) return false
        get().addPointRecord('spend', item.cost, `购买：${item.name}`)
        set(s => ({ ownedItems: { ...s.ownedItems, [id]: (s.ownedItems[id] || 0) + 1 } }))
        // 体力药水立即回血
        if (item.effect === 'potion') get().setHp(get().hp + 30)
        return true
      },
      unlockAchievement: (id) => {
        const a = get().achievements.find(x => x.id === id)
        if (!a || a.unlocked) return
        set(s => ({
          achievements: s.achievements.map(ax =>
            ax.id === id ? { ...ax, unlocked: true, progress: ax.total } : ax
          )
        }))
        // 解锁成就奖励积分
        set(s => ({ points: s.points + 200 }))
        get().addPointRecord('earn', 200, `解锁成就：${a.name}`)
      },
      updateAchievementProgress: (id, progress) => {
        const a = get().achievements.find(x => x.id === id)
        if (!a || a.unlocked) return
        const newProgress = Math.max(0, Math.min(a.total, Math.round(progress)))
        set(s => ({
          achievements: s.achievements.map(ax =>
            ax.id === id ? { ...ax, progress: newProgress } : ax
          )
        }))
        // 进度满了自动解锁
        if (newProgress >= a.total) {
          get().unlockAchievement(id)
        }
      },
      addCustomQuest: ({ title, desc, reward, category }) => {
        const id = `q-ai-${Date.now().toString(36)}`
        set(s => ({
          quests: [
            ...s.quests,
            {
              id, title, desc,
              reward: Math.max(10, Math.min(2000, Math.round(reward))),
              rewardType: 'EXP',
              category,
              accent: 'info',
              progress: 0,
              total: 1,
              completed: false
            }
          ]
        }))
        return id
      },
      addCustomAchievement: ({ name, desc, total }) => {
        const id = `a-ai-${Date.now().toString(36)}`
        set(s => ({
          achievements: [
            ...s.achievements,
            {
              id, name, desc,
              progress: 0,
              total: Math.max(1, Math.min(999, Math.round(total))),
              unlocked: false,
              iconColor: '#FFFFFF',
              iconBg: '#1a1a1a',
              iconPath: 'M5 13l4 4L19 7'
            }
          ]
        }))
        return id
      },
      init: (tag, goal) =>
        set({
          onboarded: true,
          playerTag: tag || 'PLAYER_01',
          dailyGoalMin: goal
        }),
      reset: () =>
        set({
          onboarded: false,
          playerTag: 'PLAYER_01',
          dailyGoalMin: 120,
          hp: 100,
          points: 0,
          streak: 0,
          totalFocusMs: 0,
          todayStudyMs: 0,
          todayEntMs: 0,
          totalEntMs: 0,
          lastSyncDay: todayStr(),
          gaokaoDate: '2027-06-07',
          gaokaoTargetScore: 680,
          gaokaoBaseScore: 400,
          quests: [],
          achievements: [],
          ownedItems: {},
          isDark: false,
          hpLocked: false,
          dungeonRemainingSec: 0,
          dungeonActive: false,
          dungeonDurationMin: 25
        }),
      setDungeon: (sec, active) => set({ dungeonRemainingSec: sec, dungeonActive: active }),
      setDungeonDuration: (min) => set({ dungeonDurationMin: min }),
      setDailyGoal: (min) => set({ dailyGoalMin: min }),
      setGaokaoDate: (d) => set({ gaokaoDate: d }),
      setGaokaoTargetScore: (n) => set({ gaokaoTargetScore: Math.max(0, Math.round(n)) }),
      syncUsage: (study, ent) => {
        const studyMs = study.reduce((sum, x) => sum + x.totalMs, 0)
        const entMs = ent.reduce((sum, x) => sum + x.totalMs, 0)
        const prevEnt = get().todayEntMs
        const entDelta = Math.max(0, entMs - prevEnt)
        set({
          todayStudyMs: studyMs,
          todayEntMs: entMs,
          totalEntMs: get().totalEntMs + entDelta
        })
      },
      dailySettle: () => {
        const today = todayStr()
        const s = get()
        if (s.lastSyncDay === today) return
        const dailyGoalMs = s.dailyGoalMin * 60_000
        if (s.todayStudyMs >= dailyGoalMs) {
          set({ streak: s.streak + 1, lastSyncDay: today, hpLocked: false })
        } else {
          set({ streak: 0, lastSyncDay: today, hpLocked: false })
        }
        set({ todayStudyMs: 0, todayEntMs: 0 })
      }
    }),
    {
      name: 'cyber-survival-store',
      version: 3,  // 版本升级：清除旧预置数据
      storage: createJSONStorage(() => localStorage),
      // 迁移：旧版本用户清除预置的成就/任务/积分
      migrate: (persisted: any, version: number) => {
        if (version < 3 && persisted) {
          // 清除旧版本的预置数据
          persisted.quests = []
          persisted.achievements = []
          persisted.points = 0
          persisted.hp = 100
          persisted.streak = 0
          persisted.totalFocusMs = 0
          persisted.pointHistory = []
        }
        return persisted
      },
      merge: (persisted, current) => ({
        ...current,
        ...(persisted || {})
      })
    }
  )
)

// 派生
export function hpFromStudy(studyMs: number, goalMs: number): number {
  if (goalMs <= 0) return 0
  const ratio = studyMs / goalMs
  return Math.round(Math.min(100, 30 + ratio * 70))
}

// ═══════════════════════════════════════════════════════════
// 高考估分计算
// ═══════════════════════════════════════════════════════════
export function calcGaokaoScore(state: {
  gaokaoBaseScore: number
  totalFocusMs: number
  totalEntMs: number
  quests: Quest[]
}): number {
  const studyHours = state.totalFocusMs / 3_600_000
  const entHours = state.totalEntMs / 3_600_000
  const completedQuests = state.quests.filter(q => q.completed).length

  const score = state.gaokaoBaseScore
    + studyHours * 5
    - entHours * 3
    + completedQuests * 3

  return Math.round(Math.max(200, Math.min(750, score)))
}

// 距高考剩余天数
export function daysUntilGaokao(gaokaoDate: string): number {
  const target = new Date(gaokaoDate + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = target.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / 86400_000))
}
