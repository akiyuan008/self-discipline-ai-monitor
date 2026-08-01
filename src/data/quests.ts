export interface Quest {
  id: string
  title: string
  desc: string
  reward: number
  rewardType: 'EXP' | 'GOLD'
  category: 'daily' | 'weekly' | 'main'
  accent: 'success' | 'warning' | 'info'
  progress: number
  total: number
  completed: boolean
}

export const QUESTS: Quest[] = []

export const CATEGORY_TABS = [
  { id: 'daily' as const, label: '日常任务' },
  { id: 'weekly' as const, label: '周常挑战' },
  { id: 'main' as const, label: '主线' }
]
