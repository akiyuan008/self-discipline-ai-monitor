export type ShopEffect = 'potion' | 'shield' | 'doubler' | 'reset' | 'skin' | 'snack'

export interface ShopItem {
  id: string
  name: string
  desc: string
  cost: number
  iconBg: string
  iconColor: string
  iconPath: string
  effect: ShopEffect
  badge?: string
  lockLevel?: number
}

/* 积分体系：10 积分 = 1 元 */
export const SHOP_ITEMS: ShopItem[] = [
  // ===== 功能性道具 =====
  {
    id: 'potion',
    name: '体力药水',
    desc: '恢复 30 HP',
    cost: 50,
    iconBg: 'rgba(22, 163, 74, 0.1)',
    iconColor: '#16a34a',
    iconPath: 'M12 2C10.9 2 10 2.9 10 4V6H8C6.9 6 6 6.9 6 8V20C6 21.1 6.9 22 8 22H16C17.1 22 18 21.1 18 20V8C18 6.9 17.1 6 16 6H14V4C14 2.9 13.1 2 12 2Z',
    effect: 'potion',
  },
  {
    id: 'shield',
    name: '免罚卡',
    desc: '断签时抵消一次',
    cost: 200,
    iconBg: 'rgba(0, 120, 255, 0.1)',
    iconColor: '#0078ff',
    iconPath: 'M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1Z',
    effect: 'shield',
  },
  {
    id: 'doubler',
    name: '双倍卡',
    desc: '下次积分翻倍',
    cost: 300,
    iconBg: 'rgba(245, 158, 11, 0.1)',
    iconColor: '#f59e0b',
    iconPath: 'M12 2L2 7L12 12L22 7L12 2M2 17L12 22L22 17M2 12L12 17L22 12',
    effect: 'doubler',
  },
  {
    id: 'reset',
    name: '记忆重置',
    desc: 'HP 恢复至 80',
    cost: 150,
    iconBg: 'rgba(139, 92, 246, 0.1)',
    iconColor: '#8b5cf6',
    iconPath: 'M12 5V1L7 6L12 11V7C15.31 7 18 9.69 18 13C18 16.31 15.31 19 12 19C8.69 19 6 16.31 6 13H4C4 17.42 7.58 21 12 21C16.42 21 20 17.42 20 13C20 8.58 16.42 5 12 5Z',
    effect: 'reset',
  },
  {
    id: 'skin',
    name: '神秘皮肤',
    desc: '解锁隐藏外观',
    cost: 500,
    iconBg: 'rgba(236, 72, 153, 0.1)',
    iconColor: '#ec4899',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20ZM12.5 7H11V13L16.2 16.2L17 14.9L12.5 12.2V7Z',
    effect: 'skin',
    lockLevel: 7,
  },

  // ===== 零食兑换 =====
  {
    id: 'snack_spite',
    name: '雪碧',
    desc: '清爽解渴',
    cost: 100,
    iconBg: 'rgba(34, 197, 94, 0.1)',
    iconColor: '#22c55e',
    iconPath: 'M7 2V4H4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V4H17V2H7ZM12 18C10.9 18 10 17.1 10 16C10 14.9 10.9 14 12 14C13.1 14 14 14.9 14 16C14 17.1 13.1 18 12 18Z',
    effect: 'snack',
  },
  {
    id: 'snack_haoliyou',
    name: '好丽友薯片',
    desc: '经典零食',
    cost: 120,
    iconBg: 'rgba(234, 179, 8, 0.1)',
    iconColor: '#eab308',
    iconPath: 'M2 12C2 6.48 6.48 2 12 2S22 6.48 22 12 17.52 22 12 22 2 17.52 2 12ZM12 18C15.31 18 18 15.31 18 12C18 8.69 15.31 6 12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18Z',
    effect: 'snack',
  },
  {
    id: 'snack_toast',
    name: '吐司面包',
    desc: '泓一/提子吐司',
    cost: 80,
    iconBg: 'rgba(217, 119, 6, 0.1)',
    iconColor: '#d97706',
    iconPath: 'M4 19H20V8H4V19ZM6 6H18V4H6V6ZM2 8V19C2 20.1 2.9 21 4 21H20C21.1 21 22 20.1 22 19V8C22 6.9 21.1 6 20 6H18V4C18 2.9 17.1 2 16 2H8C6.9 2 6 2.9 6 4V6H4C2.9 6 2 6.9 2 8Z',
    effect: 'snack',
  },
  {
    id: 'snack_xianggu',
    name: '仲景香菇酱',
    desc: '下饭神器',
    cost: 90,
    iconBg: 'rgba(120, 53, 15, 0.1)',
    iconColor: '#78350f',
    iconPath: 'M12 2C8.5 2 5.5 4.5 4.5 8C4.5 11.5 7 14 9 16C10 17 10.5 18 11 20H13C13.5 18 14 17 15 16C17 14 19.5 11.5 19.5 8C18.5 4.5 15.5 2 12 2ZM12 6C13.1 6 14 6.9 14 8C14 9.1 13.1 10 12 10C10.9 10 10 9.1 10 8C10 6.9 10.9 6 12 6Z',
    effect: 'snack',
  },
  {
    id: 'snack_weilong',
    name: '卫龙系列',
    desc: '辣条/魔芋爽',
    cost: 60,
    iconBg: 'rgba(239, 68, 68, 0.1)',
    iconColor: '#ef4444',
    iconPath: 'M2 6H22V18H2V6ZM4 8V16H20V8H4ZM6 10H8V14H6V10ZM10 10H12V14H10V10ZM14 10H16V14H14V10ZM18 10H20V14H18V10Z',
    effect: 'snack',
  },
  {
    id: 'snack_mofashi',
    name: '魔法士干脆面',
    desc: '童年味道',
    cost: 130,
    iconBg: 'rgba(249, 115, 22, 0.1)',
    iconColor: '#f97316',
    iconPath: 'M3 4H21V6H3V4ZM3 8H21V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V8ZM5 10V20H19V10H5Z',
    effect: 'snack',
  },
  {
    id: 'snack_shanzha',
    name: '山楂卷系列',
    desc: '每果时光/老式',
    cost: 80,
    iconBg: 'rgba(220, 38, 38, 0.1)',
    iconColor: '#dc2626',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM12 20C7.58 20 4 16.42 4 12S7.58 4 12 4 20 7.58 20 12 16.42 20 12 20ZM12 6C9.5 6 7.5 8 7.5 10.5C7.5 13 9.5 15 12 15C14.5 15 16.5 13 16.5 10.5C16.5 8 14.5 6 12 6Z',
    effect: 'snack',
  },
  {
    id: 'snack_guaiwei',
    name: '怪味胡豆',
    desc: '重庆风味',
    cost: 50,
    iconBg: 'rgba(168, 85, 2, 0.1)',
    iconColor: '#a85502',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18ZM12 8C9.79 8 8 9.79 8 12H10C10 10.9 10.9 10 12 10V8Z',
    effect: 'snack',
  },
  {
    id: 'snack_jinzai',
    name: '劲仔小鱼',
    desc: '香辣可口',
    cost: 150,
    iconBg: 'rgba(239, 68, 68, 0.1)',
    iconColor: '#ef4444',
    iconPath: 'M2 12C2 12 5 6 12 6C19 6 22 12 22 12C22 12 19 18 12 18C5 18 2 12 2 12ZM12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14Z',
    effect: 'snack',
  },
  {
    id: 'snack_weilong_bing',
    name: '伟龙香葱鸡片',
    desc: '薄脆鲜香',
    cost: 90,
    iconBg: 'rgba(251, 191, 36, 0.1)',
    iconColor: '#fbbf24',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20ZM11 7H13V13H11V7ZM11 15H13V17H11V15Z',
    effect: 'snack',
  },
  {
    id: 'snack_kdv',
    name: 'KDV紫皮糖',
    desc: '俄罗斯进口',
    cost: 320,
    iconBg: 'rgba(147, 51, 234, 0.1)',
    iconColor: '#9333ea',
    iconPath: 'M12 2L2 7L12 12L22 7L12 2M2 17L12 22L22 17M2 12L12 17L22 12',
    effect: 'snack',
  },
  {
    id: 'snack_chenpi',
    name: '宏源陈皮糖',
    desc: '酸甜开胃',
    cost: 40,
    iconBg: 'rgba(249, 115, 22, 0.1)',
    iconColor: '#f97316',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM12 20C7.58 20 4 16.42 4 12S7.58 4 12 4 20 7.58 20 12 16.42 20 12 20ZM12 6C9 6 7 8.5 7 11C7 13.5 8.5 15.5 11 16.5V18H13V16.5C15.5 15.5 17 13.5 17 11C17 8.5 15 6 12 6Z',
    effect: 'snack',
  },
]