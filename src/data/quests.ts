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

export const QUESTS: Quest[] = [
  {
    id: 'q1',
    title: '早起打卡',
    desc: '在 8:00 前开始专注',
    reward: 50,
    rewardType: 'EXP',
    category: 'daily',
    accent: 'success',
    progress: 1,
    total: 1,
    completed: true
  },
  {
    id: 'q2',
    title: '单词风暴',
    desc: '完成 30 个单词的记忆',
    reward: 150,
    rewardType: 'GOLD',
    category: 'daily',
    accent: 'warning',
    progress: 24,
    total: 30,
    completed: false
  },
  {
    id: 'q3',
    title: '深渊探索者',
    desc: '完成一次深渊挑战',
    reward: 200,
    rewardType: 'EXP',
    category: 'daily',
    accent: 'info',
    progress: 0,
    total: 1,
    completed: false
  },
  {
    id: 'q4',
    title: '深度阅读',
    desc: '本周累计阅读 5 小时',
    reward: 500,
    rewardType: 'EXP',
    category: 'weekly',
    accent: 'info',
    progress: 3,
    total: 5,
    completed: false
  },
  {
    id: 'q5',
    title: '连续七日',
    desc: '连续 7 天达成所有日目标',
    reward: 800,
    rewardType: 'GOLD',
    category: 'main',
    accent: 'warning',
    progress: 3,
    total: 7,
    completed: false
  }
]

export const CATEGORY_TABS = [
  { id: 'daily' as const, label: '日常任务' },
  { id: 'weekly' as const, label: '周常挑战' },
  { id: 'main' as const, label: '主线' }
]
