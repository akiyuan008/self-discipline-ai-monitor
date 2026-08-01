export interface Achievement {
  id: string
  name: string
  desc: string
  progress: number
  total: number
  unlocked: boolean
  iconColor: string
  iconBg: string
  iconPath: string  // SVG path d
}

export const ACHIEVEMENTS: Achievement[] = []

export const ACHIEVEMENT_TABS = [
  { id: 'all' as const, label: '全部' },
  { id: 'unlocked' as const, label: '已解锁' },
  { id: 'locked' as const, label: '进行中' }
]
