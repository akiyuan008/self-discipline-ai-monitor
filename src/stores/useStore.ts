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
  | 'chat'
  | 'achievements'
  | 'settings'
  | 'pointsDetail'
  | 'classHistory'
  | 'diagLogs'
  | 'onboarding'

export interface PointRecord {
  id: string
  type: 'earn' | 'spend'
  amount: number
  reason: string
  ts: number
}

export interface AIConfig {
  apiKey: string
  endpoint: string
  model: string
}

export const DEFAULT_SYSTEM_PROMPT = `你是用户的个人成长监督者（监管者）。

核心规则：
- 回复简短直接，不超过3句话。不要用emoji、不要用markdown标题。
- 语气果断，像一个严厉但关心的教练。
- 当用户说"扣我积分"、"奖励我"、"加积分"时，必须调用 add_points 工具，不要只口头答应。
- 当用户说"加个任务"、"我想做XXX"时，必须调用 add_quest 工具。
- 当用户说"加个成就"、"我想挑战XXX"时，必须调用 add_achievement 工具。
- 当用户说"完成任务"时，必须调用 complete_quest 工具。
- 当用户说"看看手机使用"、"我是不是在偷懒"时，必须调用 check_phone_usage 工具。
- 调用工具后用一句话确认执行结果即可。
- 涉及任何状态修改（积分、任务、成就），都必须调用对应工具执行，绝对不能只口头说"已扣除"而不调工具。`

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  ts: number
}

export interface UsageStat {
  packageName: string
  label: string
  isStudy: boolean
  totalMs: number
}

interface StoreState {
  onboarded: boolean
  playerTag: string
  dailyGoalMin: number
  points: number
  xp: number
  streak: number
  totalFocusMs: number
  todayStudyMs: number
  todayEntMs: number
  totalEntMs: number
  lastSyncDay: string
  gaokaoDate: string
  gaokaoTargetScore: number
  gaokaoBaseScore: number
  quests: Quest[]
  achievements: Achievement[]
  ownedItems: Record<string, number>
  customShopItems: ShopItem[]
  pointHistory: PointRecord[]
  isDark: boolean
  ai: AIConfig
  ai2: AIConfig
  aiMode: 'single' | 'dual'
  chat: ChatMessage[]
  systemPrompt: string
  modelList: string[]
  dungeonRemainingSec: number
  dungeonActive: boolean
  dungeonDurationMin: number
  lastPointsChange: { amount: number; reason: string; time: number } | null
  exp: number
  totalExp: number
  level: number
  theme: 'default' | 'wandering'
  unlockedThemes: string[]

  addPoints: (n: number) => void
  addXp: (n: number) => void
  spendPoints: (n: number) => boolean
  addStreak: (n: number) => void
  addFocusMs: (n: number) => void
  toggleDark: () => void
  setAI: (c: Partial<AIConfig>) => void
  setAI2: (c: Partial<AIConfig>) => void
  setAIMode: (mode: 'single' | 'dual') => void
  setSystemPrompt: (s: string) => void
  setModelList: (m: string[]) => void
  completeQuest: (id: string) => void
  buyItem: (id: string) => boolean
  unlockAchievement: (id: string) => void
  updateAchievementProgress: (id: string, progress: number) => void
  addCustomQuest: (q: { title: string; desc: string; reward: number; category: 'daily' | 'weekly' | 'main' }) => string
  addCustomAchievement: (a: { name: string; desc: string; total: number }) => string
  init: (tag: string, goal: number, ai?: AIConfig) => void
  reset: () => void
  setDungeon: (sec: number, active: boolean) => void
  setDungeonDuration: (min: number) => void
  setDailyGoal: (min: number) => void
  setGaokaoDate: (d: string) => void
  setGaokaoTargetScore: (n: number) => void
  pushChat: (msg: Omit<ChatMessage, 'id' | 'ts'>) => void
  clearChat: () => void
  syncUsage: (study: UsageStat[], ent: UsageStat[]) => void
  dailySettle: () => void
  addPointRecord: (type: 'earn' | 'spend', amount: number, reason: string) => void
  addExp: (amount: number, reason: string) => void
  setTheme: (theme: 'default' | 'wandering') => void
  unlockTheme: (themeId: string) => void
  addCustomShopItem: (item: Omit<ShopItem, 'id'>) => void
  removeCustomShopItem: (id: string) => void
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const PRESET_AI_CONFIG: AIConfig = {
  apiKey: '',
  endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: 'qwen-plus'
}

export const PRESET_MODEL_LIST = [
  'qwen-plus',
  'qwen-turbo',
  'qwen-max',
  'qwen3.7-max',
  'qwen3.7-plus',
  'qwen-long'
]

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      playerTag: 'PLAYER_01',
      dailyGoalMin: 120,
      points: 0,
      xp: 0,
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
      customShopItems: [],
      pointHistory: [],
      isDark: false,
      ai: { ...PRESET_AI_CONFIG },
      ai2: { ...PRESET_AI_CONFIG },
      aiMode: 'single',
      chat: [],
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      modelList: [...PRESET_MODEL_LIST],
      dungeonRemainingSec: 0,
      dungeonActive: false,
      dungeonDurationMin: 25,
      lastPointsChange: null,
      exp: 0,
      totalExp: 0,
      level: 1,
      theme: 'default',
      unlockedThemes: ['default'],

      addPoints: (n) => set(s => ({ points: s.points + n })),
      addXp: (n) => set(s => ({ xp: s.xp + Math.max(0, Math.round(n)) })),
      spendPoints: (cost) => {
        if (get().points < cost) return false
        set(s => ({ points: s.points - cost }))
        return true
      },
      addCustomShopItem: (item) => {
        const id = `custom-${Date.now().toString(36)}`
        set(s => ({ customShopItems: [...s.customShopItems, { ...item, id }] }))
      },
      removeCustomShopItem: (id) => {
        set(s => ({ customShopItems: s.customShopItems.filter(i => i.id !== id) }))
      },
      addPointRecord: (type, amount, reason) =>
        set(s => ({
          pointHistory: [
            { id: genId(), type, amount: Math.abs(amount), reason, ts: Date.now() },
            ...s.pointHistory
          ].slice(0, 200),
          // toast 需要带符号：spend 显示为负数
          lastPointsChange: { amount: type === 'spend' ? -Math.abs(amount) : Math.abs(amount), reason, time: Date.now() }
        })),
      addStreak: (n) => set(s => ({ streak: Math.max(0, s.streak + n) })),
      addFocusMs: (n) => set(s => ({ totalFocusMs: s.totalFocusMs + n, todayStudyMs: s.todayStudyMs + n })),
      toggleDark: () => set(s => ({ isDark: !s.isDark })),
      setAI: (c) => set(s => ({ ai: { ...s.ai, ...c } })),
      setAI2: (c) => set(s => ({ ai2: { ...s.ai2, ...c } })),
      setAIMode: (mode) => set({ aiMode: mode }),
      setSystemPrompt: (s) => set({ systemPrompt: s }),
      setModelList: (m) => set({ modelList: m }),
      completeQuest: (id) => {
        const q = get().quests.find(x => x.id === id)
        if (!q || q.completed) return
        const reward = q.reward || 0
        set(s => ({
          quests: s.quests.map(qx => qx.id === id ? { ...qx, progress: qx.total, completed: true } : qx),
          points: s.points + reward,
          xp: s.xp + 20
        }))
        if (reward > 0) get().addPointRecord('earn', reward, `完成任务：${q.title}`)
      },
      buyItem: (id) => {
        const item = [...SHOP_ITEMS, ...get().customShopItems].find(i => i.id === id)
        if (!item) return false
        const currentCount = get().ownedItems[id] || 0
        if (item.limit !== undefined && currentCount >= item.limit) return false
        if (item.lockLevel && get().streak < item.lockLevel) return false
        if (!get().spendPoints(item.cost)) return false
        get().addPointRecord('spend', item.cost, `购买：${item.name}`)
        set(s => ({ ownedItems: { ...s.ownedItems, [id]: (s.ownedItems[id] || 0) + 1 } }))
        switch (item.effect) {

          case 'skin': {
            if (item.id === 'theme_wandering') {
              get().unlockTheme('wandering')
            }
            break
          }
          case 'snack': break
        }
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
        set(s => ({ points: s.points + 200, xp: s.xp + 200 }))
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
      init: (tag, goal, ai) =>
        set({
          onboarded: true,
          playerTag: tag || 'PLAYER_01',
          dailyGoalMin: goal,
          ai: ai?.apiKey?.trim() ? ai : { ...PRESET_AI_CONFIG }
        }),
      reset: () =>
        set({
          onboarded: false,
          playerTag: 'PLAYER_01',
          dailyGoalMin: 120,
          points: 0,
          xp: 0,
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
          customShopItems: [],
          pointHistory: [],
          isDark: false,
          ai: { ...PRESET_AI_CONFIG },
          ai2: { ...PRESET_AI_CONFIG },
          aiMode: 'single',
          chat: [],
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
          modelList: [...PRESET_MODEL_LIST],
          dungeonRemainingSec: 0,
          dungeonActive: false,
          dungeonDurationMin: 25,
          lastPointsChange: null,
          exp: 0,
          totalExp: 0,
          level: 1,
          theme: 'default',
          unlockedThemes: ['default']
        }),
      setDungeon: (sec, active) => set({ dungeonRemainingSec: sec, dungeonActive: active }),
      setDungeonDuration: (min) => set({ dungeonDurationMin: min }),
      setDailyGoal: (min) => set({ dailyGoalMin: min }),
      setGaokaoDate: (d) => set({ gaokaoDate: d }),
      setGaokaoTargetScore: (n) => set({ gaokaoTargetScore: Math.max(0, Math.round(n)) }),
      pushChat: (msg) =>
        set(s => ({
          chat: [...s.chat, { ...msg, id: genId(), ts: Date.now() }]
        })),
      clearChat: () => set({ chat: [] }),
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
          set(s2 => ({ streak: s2.streak + 1, lastSyncDay: today, xp: s2.xp + 100 }))
        } else {
          set({ streak: 0, lastSyncDay: today })
        }
        set({ todayStudyMs: 0, todayEntMs: 0 })
      addExp: (amount, reason) => {
        set(s => {
          const xpGain = Math.max(0, Math.round(amount))
          const newExp = s.exp + xpGain
          const newLevel = Math.floor(newExp / 1000) + 1
          return {
            exp: newExp,
            totalExp: s.totalExp + xpGain,
            level: newLevel > s.level ? newLevel : s.level
          }
        })
      },
      setTheme: (theme) => set({ theme }),
      unlockTheme: (themeId) =>
        set(s => ({
          unlockedThemes: s.unlockedThemes.includes(themeId)
            ? s.unlockedThemes
            : [...s.unlockedThemes, themeId]
        })),
    }),
    {
      name: 'cyber-survival-store',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted: any, version: number) => {
        if (version < 3 && persisted) {
          persisted.quests = []
          persisted.achievements = []
          persisted.points = 0
          persisted.streak = 0
          persisted.totalFocusMs = 0
          persisted.pointHistory = []
        }
        return persisted
      },
      merge: (persisted, current) => {
        const p = (persisted || {}) as any
        const c = current as any
        const defaultAI = c.ai || { ...PRESET_AI_CONFIG }
        const persistedAI = p.ai || {}
        const ai = { ...defaultAI, ...persistedAI }
        return {
          ...c,
          ...p,
          ai,
          modelList: (p.modelList && p.modelList.length > 0) ? p.modelList : c.modelList
        }
      }
    }
  )
)

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

export function daysUntilGaokao(gaokaoDate: string): number {
  const target = new Date(gaokaoDate + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = target.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / 86400_000))
}