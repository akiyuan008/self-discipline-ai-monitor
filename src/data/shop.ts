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
  effect: 'potion' | 'shield' | 'skin' | 'reset' | 'doubler' | 'game_time' | 'free_time' | 'mystery_box' | 'food' | 'drink'
  limit?: number  // 限量次数，undefined=不限量
  boughtCount?: number  // 已购买次数
}

export const DEFAULT_SHOP_ITEMS: ShopItem[] = [
  // ========== 实物/大额奖励 ==========
  {
    id: 'oppo_pad3',
    name: 'OPPO Pad 3',
    desc: '限量兑换，价值≈1600元',
    cost: 16000,
    iconBg: 'rgba(0, 120, 255, 0.1)',
    iconColor: '#0078ff',
    iconPath: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6zm0 4h2v2H6zm0-8h2v2H6zm4 0h8v2h-8zm0 4h8v2h-8zm0 4h8v2h-8z',
    badge: '限量',
    effect: 'skin',
    limit: 1,
    boughtCount: 0
  },
  {
    id: 'hotpot',
    name: '一顿火锅',
    desc: '≈80元，犒劳自己',
    cost: 800,
    iconBg: 'rgba(229, 77, 46, 0.1)',
    iconColor: 'var(--danger)',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
    effect: 'food'
  },
  {
    id: 'movie_ticket',
    name: '电影票',
    desc: '≈15元，放松时刻',
    cost: 150,
    iconBg: 'rgba(139, 92, 246, 0.1)',
    iconColor: '#8b5cf6',
    iconPath: 'M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z',
    effect: 'free_time'
  },

  // ========== 游戏/娱乐兑换 ==========
  {
    id: 'game_1h',
    name: '玩1小时游戏',
    desc: '兑换1小时游戏时间',
    cost: 1000,
    iconBg: 'rgba(245, 158, 11, 0.1)',
    iconColor: 'var(--warning)',
    iconPath: 'M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    effect: 'game_time'
  },
  {
    id: 'weekend_free_1h',
    name: '周末自由1小时',
    desc: '周末额外自由时间',
    cost: 500,
    iconBg: 'rgba(22, 163, 74, 0.1)',
    iconColor: 'var(--success)',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    effect: 'free_time'
  },

  // ========== 道具/功能 ==========
  {
    id: 'shield',
    name: '免罚卡',
    desc: '抵消一次惩罚',
    cost: 200,
    iconBg: 'rgba(59, 130, 246, 0.1)',
    iconColor: 'var(--info)',
    iconPath: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
    effect: 'shield'
  },
  {
    id: 'doubler',
    name: '双倍积分卡',
    desc: '下次任务双倍积分',
    cost: 300,
    iconBg: 'rgba(245, 158, 11, 0.1)',
    iconColor: 'var(--warning)',
    iconPath: 'M13 2L3 14h7l-1 8 10-12h-7l1-8z',
    effect: 'doubler'
  },
  {
    id: 'mystery_box',
    name: '神秘盲盒',
    desc: '随机奖励50-200积分',
    cost: 100,
    iconBg: 'rgba(236, 72, 153, 0.1)',
    iconColor: '#ec4899',
    iconPath: 'M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z',
    effect: 'mystery_box'
  },

  // ========== 小额奖励 ==========
  {
    id: 'milk_tea',
    name: '奶茶',
    desc: '≈5元，甜一下',
    cost: 50,
    iconBg: 'rgba(217, 119, 6, 0.1)',
    iconColor: '#d97706',
    iconPath: 'M20 3H6.5A2.5 2.5 0 0 0 4 5.5v.67A2.5 2.5 0 0 0 2 8.5v1A2.5 2.5 0 0 0 4.5 12h.3l1.27 9.5A2.5 2.5 0 0 0 8.55 23h6.9a2.5 2.5 0 0 0 2.48-1.5l1.27-9.5h.3A2.5 2.5 0 0 0 22 9.5v-1A2.5 2.5 0 0 0 20 3zM6.5 5H20v1H6.5A1.5 1.5 0 0 1 5 4.5S5 5 6.5 5zm11.55 16H8.95L7.74 12h8.52z',
    effect: 'drink'
  },
  {
    id: 'ice_cream',
    name: '雪糕',
    desc: '≈3元，清凉一下',
    cost: 30,
    iconBg: 'rgba(14, 165, 233, 0.1)',
    iconColor: '#0ea5e9',
    iconPath: 'M12 2C9.24 2 7 4.24 7 7c0 1.63.74 3.08 1.89 4.08L8 22h8l-.89-10.92C16.26 10.08 17 8.63 17 7c0-2.76-2.24-5-5-5zm0 7c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
    effect: 'food'
  },

  // ========== 原有道具 ==========
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
    cost: 500,
    iconBg: 'var(--bg-alt)',
    iconColor: 'var(--muted)',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
    lockLevel: 20,
    effect: 'skin'
  }
]

export const SHOP_ITEMS = DEFAULT_SHOP_ITEMS
