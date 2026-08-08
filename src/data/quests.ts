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
