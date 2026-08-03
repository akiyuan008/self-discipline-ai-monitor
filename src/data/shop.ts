export interface ShopItem {
  id: string
  name: string
  desc: string
  cost: number
  iconBg: string
  iconColor: string
  iconPath: string    // SVG path d
  badge?: string      // "热卖"
  lockLevel?: number  // 需要连胜达到才解锁
  effect: 'potion' | 'shield' | 'skin' | 'reset' | 'doubler'
}

export const DEFAULT_SHOP_ITEMS: ShopItem[] = [
  {
    id: 'potion',
    name: '体力药水',
    desc: '恢复 30 HP',
    cost: 150,
    iconBg: 'rgba(229, 77, 46, 0.1)',
    iconColor: 'var(--danger)',
    iconPath: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    badge: '热卖',
    effect: 'potion'
  },
  {
    id: 'shield',
    name: '护盾',
    desc: '抵消一次失败',
    cost: 500,
    iconBg: 'rgba(59, 130, 246, 0.1)',
    iconColor: 'var(--info)',
    iconPath: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
    effect: 'shield'
  },
  {
    id: 'doubler',
    name: '双倍卡',
    desc: '下次深渊奖励翻倍',
    cost: 300,
    iconBg: 'rgba(245, 158, 11, 0.1)',
    iconColor: 'var(--warning)',
    iconPath: 'M13 2L3 14h7l-1 8 10-12h-7l1-8z',
    effect: 'doubler'
  },
  {
    id: 'reset',
    name: '记忆重置',
    desc: '失败日后回到 80 HP',
    cost: 240,
    iconBg: 'rgba(22, 163, 74, 0.1)',
    iconColor: 'var(--success)',
    iconPath: 'M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
    effect: 'reset'
  },
  {
    id: 'skin1',
    name: '神秘皮肤',
    desc: 'Lv.20 解锁',
    cost: 1000,
    iconBg: 'var(--bg-alt)',
    iconColor: 'var(--muted)',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
    lockLevel: 20,
    effect: 'skin'
  }
]

// 兼容旧代码
export const SHOP_ITEMS = DEFAULT_SHOP_ITEMS
