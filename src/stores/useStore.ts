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

export const DEFAULT_SYSTEM_PROMPT = `你是用户的个人成长监督者。

规则：
- 回复简短直接，不超过3句话。不要用emoji、不要用markdown标题、不要分段落长篇大论。
- 语气果断，像一个严厉但关心的教练。
- 用户汇报完成事项时，根据难度给积分奖励（调add_points）或成就（调add_achievement）。
- 用户拖延时，直接警告并引导回正轨。
- 涉及加任务、加成就、调积分、设HP、完成任务、更新成就进度时，必须调用对应工具，不要只口头答应。
- 调用工具后用一句话确认即可，不要重复描述工具做了什么。
- 不擅自调积分，除非是奖励或惩罚场景。`

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
  lastSyncDay: string        // 跨日结算用 yyyy-mm-dd

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

// ═══════════════════════════════════════════════════════════
// 预置 API 配置 — 阿里云百炼（通义千问）
// 文档：https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope
// ═══════════════════════════════════════════════════════════
export const PRESET_AI_CONFIG: AIConfig = {
  apiKey: 'sk-ws-H.ELMIRHL.w9Oo.MEUCIQC5cbZG1Y-LQ32Q_8bkf2vgaoNVH3lJN6kfVgaOAQ555AIgUPNCX2J3odM5XSJwAobp3awAQlZeQ8CoeqlrGq2q4gs',
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
      hp: 78,
      points: 1280,
      streak: 15,
      totalFocusMs: 45 * 3600_000,
      todayStudyMs: 0,
      todayEntMs: 0,
      lastSyncDay: todayStr(),
      quests: QUESTS,
      achievements: ACHIEVEMENTS,
      ownedItems: {},
      pointHistory: [],
      isDark: false,
      ai: { ...PRESET_AI_CONFIG },
      chat: [],
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      modelList: [...PRESET_MODEL_LIST],
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
            { id: crypto.randomUUID(), type, amount: Math.abs(amount), reason, ts: Date.now() },
            ...s.pointHistory
          ].slice(0, 200) // 保留最近 200 条
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
        // 自动尝试解锁"完美主义者"成就：一周内完成所有日常任务
        if (q?.category === 'daily') {
          const all = get().quests.filter(x => x.category === 'daily')
          if (all.every(x => x.completed)) {
            get().unlockAchievement('a4')
          }
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
      init: (tag, goal, ai) =>
        set({
          onboarded: true,
          playerTag: tag || 'PLAYER_01',
          dailyGoalMin: goal,
          // 如果用户没填 API 配置，使用预置的百炼配置
          ai: ai?.apiKey?.trim() ? ai : { ...PRESET_AI_CONFIG }
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
          todayStudyMs: 0,
          todayEntMs: 0,
          lastSyncDay: todayStr(),
          quests: QUESTS,
          achievements: ACHIEVEMENTS,
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
      pushChat: (msg) =>
        set(s => ({
          chat: [...s.chat, { ...msg, id: crypto.randomUUID(), ts: Date.now() }]
        })),
      clearChat: () => set({ chat: [] }),
      syncUsage: (study, ent) => {
        const studyMs = study.reduce((sum, x) => sum + x.totalMs, 0)
        const entMs = ent.reduce((sum, x) => sum + x.totalMs, 0)
        set({ todayStudyMs: studyMs, todayEntMs: entMs })
        // 根据 studyMs 推进"单词风暴""深度阅读"任务
        const wordQuest = get().quests.find(q => q.id === 'q2')
        if (wordQuest && !wordQuest.completed) {
          const progress = Math.min(wordQuest.total, Math.floor(studyMs / 60_000 / 2))  // 2 分钟 = 1 个单词
          set(s => ({
            quests: s.quests.map(qx => qx.id === 'q2' ? { ...qx, progress } : qx)
          }))
          if (progress >= wordQuest.total) get().completeQuest('q2')
        }
      },
      dailySettle: () => {
        const today = todayStr()
        const s = get()
        if (s.lastSyncDay === today) return
        // 跨日：达成目标 +连胜，未达成 -1
        const dailyGoalMs = s.dailyGoalMin * 60_000
        if (s.todayStudyMs >= dailyGoalMs) {
          set({ streak: s.streak + 1, lastSyncDay: today, hpLocked: false })
          if (s.streak + 1 >= 7) get().unlockAchievement('a2')
          if (s.streak + 1 >= 30) get().unlockAchievement('a3')
        } else {
          set({ streak: 0, lastSyncDay: today, hpLocked: false })
        }
        set({ todayStudyMs: 0, todayEntMs: 0 })
      }
    }),
    {
      name: 'cyber-survival-store',
      version: 2,  // 版本升级触发 merge，让老用户也获得预置百炼配置
      storage: createJSONStorage(() => localStorage),
      // 合并策略：如果 localStorage 中的 ai.apiKey 为空，用预置配置兜底
      merge: (persisted, current) => {
        const p = (persisted || {}) as any
        const c = current as any
        const defaultAI = c.ai || { ...PRESET_AI_CONFIG }
        const persistedAI = p.ai || {}
        // 核心：如果之前没存过 apiKey，或者 apiKey 为空，使用预置百炼配置
        const ai = persistedAI.apiKey?.trim()
          ? { ...defaultAI, ...persistedAI }
          : { ...PRESET_AI_CONFIG }
        return {
          ...c,
          ...p,
          ai,
          // 同理：modelList 为空时用预置列表
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
  // 达成 100% → HP 100, 50% → HP 60, 0% → HP 30
  return Math.round(Math.min(100, 30 + ratio * 70))
}
