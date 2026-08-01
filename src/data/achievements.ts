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

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'a1',
    name: '初出茅庐',
    desc: '完成第一次深渊挑战',
    progress: 1,
    total: 1,
    unlocked: true,
    iconColor: '#FFFFFF',
    iconBg: '#16A34A',
    iconPath: 'M5 13l4 4L19 7'
  },
  {
    id: 'a2',
    name: '深渊探索者',
    desc: '完成 10 次深渊挑战',
    progress: 7,
    total: 10,
    unlocked: false,
    iconColor: '#FFFFFF',
    iconBg: '#3B82F6',
    iconPath: 'M9 2v6h6V2H9zm10 9V7l-5-4v18l5-4v-4H9V11h10z'
  },
  {
    id: 'a3',
    name: '钢铁意志',
    desc: '连续保持 30 天 100% 完成率',
    progress: 15,
    total: 30,
    unlocked: false,
    iconColor: '#FFFFFF',
    iconBg: '#F59E0B',
    iconPath: 'M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z'
  },
  {
    id: 'a4',
    name: '完美主义者',
    desc: '一周内完成所有日常任务',
    progress: 3,
    total: 7,
    unlocked: false,
    iconColor: '#FFFFFF',
    iconBg: '#E54D2E',
    iconPath: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'
  },
  {
    id: 'a5',
    name: '夜行者',
    desc: '在凌晨 0-4 点完成 5 次专注',
    progress: 2,
    total: 5,
    unlocked: false,
    iconColor: '#FFFFFF',
    iconBg: '#8B5CF6',
    iconPath: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'
  }
]

export const ACHIEVEMENT_TABS = [
  { id: 'all' as const, label: '全部' },
  { id: 'unlocked' as const, label: '已解锁' },
  { id: 'locked' as const, label: '进行中' }
]
