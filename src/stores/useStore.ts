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
  endpoint: string   // 例如 https://api.deepseek.com
  model: string      // 例如 deepseek-v4-flash
}

export const DEFAULT_SYSTEM_PROMPT = `你是用户的个人成长监督者（监管者）。

核心规则：
- 回复简短直接，不超过3句话。不要用emoji、不要用markdown标题。
- 语气果断，像一个严厉但关心的教练。
- 当用户说"扣我积分"、"奖励我"、"加积分"时，必须调用 add_points 工具，不要只口头答应。
- 当用户说"加个任务"、"我想做XXX"时，必须调用 add_quest 工具。
- 当用户说"加个成就"、"我想挑战XXX"时，必须调用 add_achievement 工具。
- 当用户说"设HP"、"扣HP"时，必须调用 set_hp 工具。
- 当用户说"完成任务"时，必须调用 complete_quest 工具。
- 当用户说"看看手机使用"、"我是不是在偷懒"时，必须调用 check_phone_usage 工具。
- 调用工具后用一句话确认执行结果即可。
- 涉及任何状态修改（积分、HP、任务、成就），都必须调用对应工具执行，绝对不能只口头说"已扣除"而不调工具。`

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

  // AI
  ai: AIConfig
  chat: ChatMessage[]
  systemPrompt: string          // 系统提示词（存 localStorage）
  modelList: string[]           // 从 API 拉取的模型列表

  // HP 锁：AI 手动设置 HP 后锁定，避免被定时同步覆盖
  hpLocked: boolean

  // 道具效果
  shields: number        // 免罚卡剩余数量
  doublerActive: boolean // 双倍卡是否激活

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
  setAI: (c: Partial<AIConfig>) => void
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

// ═══════════════════════════════════════════════════════════
// 预置 API 配置 — 阿里云百炼（通义千问）
// ═══════════════════════════════════════════════════════════
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
      ai: { ...PRESET_AI_CONFIG },
      chat: [],
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      modelList: [...PRESET_MODEL_LIST],
      hpLocked: false,
      shields: 0,
      doublerActive: false,
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
      setAI: (c) => set(s => ({ ai: { ...s.ai, ...c } })),
      setSystemPrompt: (s) => set({ systemPrompt: s }),
      setModelList: (m) => set({ modelList: m }),
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
      buyItem: (id) => {
        const item = SHOP_ITEMS.find(i => i.id === id)
        if (!item) return false
        if (item.lockLevel && get().streak < item.lockLevel) return false
        if (!get().spendPoints(item.cost)) return false
        get().addPointRecord('spend', item.cost, `购买：${item.name}`)
        set(s => ({ ownedItems: { ...s.ownedItems, [id]: (s.ownedItems[id] || 0) + 1 } }))
        // 道具效果
        switch (item.effect) {
          case 'potion': get().setHp(get().hp + 30); break
          case 'shield': set(s => ({ shields: s.shields + 1 })); break
          case 'doubler': set({ doublerActive: true }); break
          case 'reset': get().setHp(80); break
          case 'skin': break // 皮肤仅标记拥有
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
          ai: { ...PRESET_AI_CONFIG },
          chat: [],
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
          modelList: [...PRESET_MODEL_LIST],
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
          set({ streak: s.streak + 1, lastSyncDay: today, hpLocked: false })
        } else {
          // 免罚卡：消耗一个 shield 保留连胜
          if ((s.shields || 0) > 0) {
            set({ shields: s.shields - 1, lastSyncDay: today, hpLocked: false })
          } else {
            set({ streak: 0, lastSyncDay: today, hpLocked: false })
          }
        }
        set({ todayStudyMs: 0, todayEntMs: 0, doublerActive: false })
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
