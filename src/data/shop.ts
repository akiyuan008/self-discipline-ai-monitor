export interface ShopItem {
  id: string
  name: string
  desc: string
  cost: number
  iconBg: string
  iconColor: string
  iconPath: string
  badge?: string
  lockLevel?: number
  effect: 'potion' | 'shield' | 'skin' | 'reset' | 'doubler' | 'reward' | 'game'
  limit?: number        // 限购次数，undefined=不限量
  boughtCount?: number   // 已购买次数
}

export const DEFAULT_SHOP_ITEMS: ShopItem[] = [
  // 原有道具
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
  // 新增：学习奖励
  {
    id: 'oppo_pad3',
    name: 'OPPO Pad 3',
    desc: '学习神器，限量兑换',
    cost: 16000,
    iconBg: 'rgba(0, 150, 255, 0.1)',
    iconColor: '#0096FF',
    iconPath: 'M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 14H5V6h14v12z',
    badge: '限量',
    effect: 'reward',
    limit: 1,
    boughtCount: 0
  },
  {
    id: 'icecream',
    name: '雪糕',
    desc: '学习累了来一根',
    cost: 30,
    iconBg: 'rgba(255, 183, 77, 0.1)',
    iconColor: '#FFB74D',
    iconPath: 'M12 2C9.5 2 7.2 3.2 6 5.2 4.8 3.2 2.5 2 0 2v2c2.5 0 4.8 1.2 6 3.2 1.2-2 3.5-3.2 6-3.2s4.8 1.2 6 3.2c1.2-2 3.5-3.2 6-3.2V2c-2.5 0-4.8 1.2-6 3.2C16.8 3.2 14.5 2 12 2zm0 4c-2.5 0-4.8 1.2-6 3.2-1.2-2-3.5-3.2-6-3.2v2c2.5 0 4.8 1.2 6 3.2 1.2-2 3.5-3.2 6-3.2s4.8 1.2 6 3.2c1.2-2 3.5-3.2 6-3.2V6c-2.5 0-4.8 1.2-6 3.2C16.8 7.2 14.5 6 12 6z',
    effect: 'reward'
  },
  {
    id: 'game_1h',
    name: '游戏1小时',
    desc: '兑换1小时游戏时间',
    cost: 1000,
    iconBg: 'rgba(156, 39, 176, 0.1)',
    iconColor: '#9C27B0',
    iconPath: 'M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    effect: 'game'
  },
  {
    id: 'milk_tea',
    name: '奶茶',
    desc: '奖励自己一杯奶茶',
    cost: 150,
    iconBg: 'rgba(121, 85, 72, 0.1)',
    iconColor: '#795548',
    iconPath: 'M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z',
    effect: 'reward'
  },
  {
    id: 'movie_ticket',
    name: '电影票',
    desc: '周末看场电影放松',
    cost: 500,
    iconBg: 'rgba(233, 30, 99, 0.1)',
    iconColor: '#E91E63',
    iconPath: 'M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z',
    effect: 'reward'
  },
  {
    id: 'weekend_brunch',
    name: '周末大餐',
    desc: '连续7天全勤奖励',
    cost: 800,
    iconBg: 'rgba(255, 87, 34, 0.1)',
    iconColor: '#FF5722',
    iconPath: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z',
    lockLevel: 7,
    effect: 'reward'
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

export const SHOP_ITEMS = DEFAULT_SHOP_ITEMS
