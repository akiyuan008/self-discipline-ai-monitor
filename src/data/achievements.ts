/** 成就系统数据 · 流浪地球主题 */

export type Rarity = 'diamond' | 'gold' | 'silver' | 'bronze' | 'negative'
export type AchievementCategory = 'abyss' | 'study-time' | 'streak' | 'special' | 'negative'

export interface Achievement {
  id: string
  name: string
  desc: string
  category: AchievementCategory
  rarity: Rarity
  progress: number
  total: number
  unlocked: boolean
  /** 洗白状态：null=未洗白, string=洗白后标注文案 */
  redeemed?: string | null
  iconPath: string     // SVG path
  /** 触发条件描述（钻石级未解锁也显示） */
  hint?: string
}

// ═══════════════════════════════════════════════════════════
// 正面成就 · 深渊挑战类
// ═══════════════════════════════════════════════════════════
const ABYSS_ACHIEVEMENTS: Omit<Achievement, 'progress' | 'unlocked'>[] = [
  { id: 'abyss_first', name: '行星发动机点火', desc: '地球开始移动了', category: 'abyss', rarity: 'bronze', total: 1, iconPath: 'M12 2L2 7l10 5 10-5-10-5z', hint: '第一次完成深渊挑战' },
  { id: 'abyss_noquit', name: '饱和式专注', desc: '没有冗余，每一秒都在做功', category: 'abyss', rarity: 'bronze', total: 1, iconPath: 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4', hint: '单次深渊全程不中断' },
  { id: 'abyss_bounce', name: '引力弹弓', desc: '借一次失败的引力，甩向更远轨道', category: 'abyss', rarity: 'bronze', total: 1, iconPath: 'M12 2a10 10 0 1 0 10 10', hint: '中断后当天再次完成' },
  { id: 'abyss_steel', name: '思想钢印', desc: '你的信念被刻入了钢印，不可动摇', category: 'abyss', rarity: 'silver', total: 1, iconPath: 'M9 12l2 2 4-4M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z', hint: '全程未触碰紧急停机' },
  { id: 'abyss_4x', name: '多线推进', desc: '四台发动机同时满载运行', category: 'abyss', rarity: 'silver', total: 4, iconPath: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', hint: '连续4次深渊不休息' },
  { id: 'abyss_deep', name: '深空潜航', desc: '远离太阳，进入星际空间', category: 'abyss', rarity: 'silver', total: 1, iconPath: 'M12 2a10 10 0 0 0-10 10 10 10 0 0 0 10 10 10 10 0 0 0 10-10 10 10 0 0 0-10-10zM2 12h20', hint: '完成一次60分钟深渊' },
  { id: 'abyss_7day', name: '面壁者', desc: '你的计划不需要向任何人解释', category: 'abyss', rarity: 'gold', total: 7, iconPath: 'M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z', hint: '连续7天每天至少1次深渊' },
  { id: 'abyss_50', name: '轨道稳定', desc: '推力恒定，偏移率低于0.003%', category: 'abyss', rarity: 'gold', total: 50, iconPath: 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4', hint: '累计完成50次深渊' },
  { id: 'abyss_500', name: '点燃木星', desc: '你用自己的方式，推动了整颗星球', category: 'abyss', rarity: 'diamond', total: 500, iconPath: 'M12 2C8 6 4 8 4 14a8 8 0 0 0 16 0c0-6-4-8-8-12z', hint: '累计完成500次深渊' },
]

// ═══════════════════════════════════════════════════════════
// 正面成就 · 学习时长类
// ═══════════════════════════════════════════════════════════
const STUDY_TIME_ACHIEVEMENTS: Omit<Achievement, 'progress' | 'unlocked'>[] = [
  { id: 'st_1h', name: '今日启航', desc: '地球离开了太阳，你也离开了舒适区', category: 'study-time', rarity: 'bronze', total: 60, iconPath: 'M5 3l14 9-14 9V3z', hint: '单日学习1小时' },
  { id: 'st_4h', name: '半程轨道', desc: '已脱离近地轨道，进入深空巡航', category: 'study-time', rarity: 'bronze', total: 240, iconPath: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20', hint: '单日学习4小时' },
  { id: 'st_8h', name: '全功率推进', desc: '一万座发动机全部满载', category: 'study-time', rarity: 'silver', total: 480, iconPath: 'M3 12h18M12 3v18', hint: '单日学习8小时' },
  { id: 'st_12h', name: '过载极限', desc: '结构应力接近临界值，但你还撑得住', category: 'study-time', rarity: 'silver', total: 720, iconPath: 'M12 2L2 12l10 10 10-10L12 2z', hint: '单日学习12小时' },
  { id: 'st_16h', name: '智子封锁', desc: '你封锁了自己的一切退路', category: 'study-time', rarity: 'gold', total: 960, iconPath: 'M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z', hint: '单日学习16小时' },
  { id: 'st_500h', name: '光年之外', desc: '五百小时，你已飞出太阳系', category: 'study-time', rarity: 'gold', total: 30000, iconPath: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM12 7v5l3 3', hint: '累计学习500小时' },
  { id: 'st_3000h', name: '二向箔', desc: '你的知识维度，已将平庸降维', category: 'study-time', rarity: 'diamond', total: 180000, iconPath: 'M3 3h18v18H3zM7 7h10v10H7z', hint: '累计学习3000小时' },
  { id: 'st_10000h', name: '万年流浪', desc: '两万五千年的航程，你走完了第一站', category: 'study-time', rarity: 'diamond', total: 600000, iconPath: 'M12 2C8 6 4 8 4 14a8 8 0 0 0 16 0c0-6-4-8-8-12zM12 8v8', hint: '累计学习10000小时' },
]

// ═══════════════════════════════════════════════════════════
// 正面成就 · 坚持打卡类
// ═══════════════════════════════════════════════════════════
const STREAK_ACHIEVEMENTS: Omit<Achievement, 'progress' | 'unlocked'>[] = [
  { id: 'streak_first', name: '首次点火', desc: '所有旅程都从一次点火开始', category: 'streak', rarity: 'bronze', total: 1, iconPath: 'M5 3l14 9-14 9V3z', hint: '完成第一次学习记录' },
  { id: 'streak_3', name: '恒纪元', desc: '三日凌空结束，恒纪元到来', category: 'streak', rarity: 'bronze', total: 3, iconPath: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM12 6v6l4 2', hint: '连续3天有学习记录' },
  { id: 'streak_revive', name: '冬眠苏醒', desc: '冬眠结束，你重新睁开了眼睛', category: 'streak', rarity: 'bronze', total: 3, iconPath: 'M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4zM6 12a6 6 0 0 0 12 0', hint: '断签7天后恢复连续3天' },
  { id: 'streak_7', name: '稳定纪', desc: '进入稳定纪元，文明开始繁荣', category: 'streak', rarity: 'silver', total: 7, iconPath: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM12 7v5l3 3', hint: '连续7天有学习记录' },
  { id: 'streak_15', name: '半月恒星际', desc: '半个月恒星际航行，引擎良好', category: 'streak', rarity: 'silver', total: 15, iconPath: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM2 12h20', hint: '连续15天有学习记录' },
  { id: 'streak_month', name: '月度全勤', desc: '本月推力输出100%，零停机', category: 'streak', rarity: 'silver', total: 30, iconPath: 'M3 3h18v18H3zM7 7h10v10H7z', hint: '自然月内每天都有学习记录' },
  { id: 'streak_30', name: '地下城建设者', desc: '别人在休息，你在建造未来', category: 'streak', rarity: 'gold', total: 30, iconPath: 'M3 21V8l9-5 9 5v13M9 21V12h6v9', hint: '假期期间连续30天打卡' },
  { id: 'streak_100', name: '跨越世代', desc: '一百天，足够一代人完成交接', category: 'streak', rarity: 'gold', total: 100, iconPath: 'M12 2L2 12l10 10 10-10L12 2zM12 7v10', hint: '连续100天有学习记录' },
  { id: 'streak_365', name: '星环号', desc: '你造出了自己的星环号，光速出发', category: 'streak', rarity: 'diamond', total: 365, iconPath: 'M12 2C8 6 4 8 4 14a8 8 0 0 0 16 0c0-6-4-8-8-12zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z', hint: '连续365天有学习记录' },
]

// ═══════════════════════════════════════════════════════════
// 正面成就 · 特殊时段/彩蛋类
// ═══════════════════════════════════════════════════════════
const SPECIAL_ACHIEVEMENTS: Omit<Achievement, 'progress' | 'unlocked'>[] = [
  { id: 'sp_dawn', name: '近日点', desc: '最靠近太阳的时刻，光线最先到达', category: 'special', rarity: 'bronze', total: 1, iconPath: 'M12 1v2M3 12H1M23 12h-2M5 5L3.5 3.5M18.5 3.5L17 5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', hint: '早上6:00前开始学习' },
  { id: 'sp_night', name: '远日点', desc: '远离太阳，但发动机没有熄灭', category: 'special', rarity: 'bronze', total: 1, iconPath: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z', hint: '晚上23:00后仍在学习' },
  { id: 'sp_3am', name: '宇宙闪烁', desc: '你看到了宇宙为你闪烁', category: 'special', rarity: 'silver', total: 1, iconPath: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM12 7l1.5 4.5L18 13l-4.5 1.5L12 19l-1.5-4.5L6 13l4.5-1.5L12 7z', hint: '凌晨3-4点完成学习' },
  { id: 'sp_routine', name: '射手与农场主', desc: '你以为这是巧合，但规律已经出现', category: 'special', rarity: 'gold', total: 10, iconPath: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM12 6v6l4 2', hint: '连续10天同一时段开始学习' },
  { id: 'sp_cny', name: '除夕点火', desc: '新年快乐，地球仍在飞行', category: 'special', rarity: 'gold', total: 1, iconPath: 'M12 2L2 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zM12 8l2 2 4-4', hint: '除夕或大年初一完成学习' },
]

// ═══════════════════════════════════════════════════════════
// 负面成就 · 统一暗灰色裂纹质感
// ═══════════════════════════════════════════════════════════
const NEGATIVE_ACHIEVEMENTS: Omit<Achievement, 'progress' | 'unlocked'>[] = [
  // 深渊中断类
  { id: 'neg_quit', name: '发动机熄火', desc: '三号发动机停机，推力下降', category: 'negative', total: 1, iconPath: 'M12 2L2 12l10 10 10-10L12 2zM9 9l6 6M15 9l-6 6', rarity: 'negative', hint: '第一次中途退出深渊', redeemed: null },
  { id: 'neg_quit10', name: '多次停机', desc: '发动机组故障率超标，建议检修', category: 'negative', total: 10, iconPath: 'M12 2L2 12l10 10 10-10L12 2zM9 9l6 6M15 9l-6 6', rarity: 'negative', hint: '累计中途退出10次', redeemed: null },
  { id: 'neg_quit1m', name: '点火失败', desc: '点火序列异常，发动机关闭', category: 'negative', total: 1, iconPath: 'M12 2L2 12l10 10 10-10L12 2zM9 9l6 6M15 9l-6 6', rarity: 'negative', hint: '深渊开始1分钟内退出', redeemed: null },
  { id: 'neg_quit90', name: '破壁人', desc: '胜利就在眼前，但你自己打碎了一切', category: 'negative', total: 1, iconPath: 'M12 2L2 12l10 10 10-10L12 2zM9 9l6 6M15 9l-6 6', rarity: 'negative', hint: '深渊90%以上时退出', redeemed: null },
  // 断签/懈怠类
  { id: 'neg_gap3', name: '乱纪元', desc: '三日凌空，气候混乱，文明陷入危机', category: 'negative', total: 3, iconPath: 'M12 2L2 12l10 10 10-10L12 2zM9 9l6 6M15 9l-6 6', rarity: 'negative', hint: '连续3天无学习记录', redeemed: null },
  { id: 'neg_gap7', name: '脱水', desc: '你把自己卷起来，扔进了仓库', category: 'negative', total: 7, iconPath: 'M12 2L2 12l10 10 10-10L12 2zM9 9l6 6M15 9l-6 6', rarity: 'negative', hint: '连续7天无学习记录', redeemed: null },
  { id: 'neg_gap14', name: '黑暗森林', desc: '宇宙很大，但没有人知道你还活着', category: 'negative', total: 14, iconPath: 'M12 2L2 12l10 10 10-10L12 2zM9 9l6 6M15 9l-6 6', rarity: 'negative', hint: '连续14天无学习记录', redeemed: null },
  // 低效学习类
  { id: 'neg_short10', name: '空转', desc: '发动机在转，但没有推力', category: 'negative', total: 1, iconPath: 'M12 2L2 12l10 10 10-10L12 2zM9 9l6 6M15 9l-6 6', rarity: 'negative', hint: '单次学习不足10分钟', redeemed: null },
  { id: 'neg_low5', name: '推力不足', desc: '输出低于最低阈值，无法维持轨道', category: 'negative', total: 5, iconPath: 'M12 2L2 12l10 10 10-10L12 2zM9 9l6 6M15 9l-6 6', rarity: 'negative', hint: '连续5次学习不足15分钟', redeemed: null },
  { id: 'neg_2d', name: '质子展开', desc: '你把自己二维化了，然后被风吹散', category: 'negative', total: 1, iconPath: 'M12 2L2 12l10 10 10-10L12 2zM9 9l6 6M15 9l-6 6', rarity: 'negative', hint: '学习不足5分钟就关闭', redeemed: null },
]

/** 洗白条件映射 */
export const REDEEM_CONDITIONS: Record<string, string> = {
  neg_quit: '连续完成10次深渊挑战不中断',
  neg_quit10: '连续完成10次深渊挑战不中断',
  neg_quit1m: '连续完成10次深渊挑战不中断',
  neg_quit90: '连续完成10次深渊挑战不中断',
  neg_gap3: '恢复连续打卡7天',
  neg_gap7: '恢复连续打卡7天',
  neg_gap14: '恢复连续打卡7天',
  neg_short10: '完成一次1小时以上的学习',
  neg_low5: '完成一次1小时以上的学习',
  neg_2d: '完成一次1小时以上的学习',
}

export const REDEEM_LABELS: Record<string, string> = {
  neg_quit: '已修复',
  neg_gap3: '恒纪元已恢复',
  neg_gap7: '已浸泡复活',
  neg_short10: '推力恢复',
  neg_quit10: '已修复',
  neg_quit1m: '已修复',
  neg_quit90: '已修复',
  neg_gap14: '恒纪元已恢复',
  neg_low5: '推力恢复',
  neg_2d: '推力恢复',
}

/** 全部成就（初始化用） */
export const ALL_ACHIEVEMENTS: Achievement[] = [
  ...ABYSS_ACHIEVEMENTS, ...STUDY_TIME_ACHIEVEMENTS,
  ...STREAK_ACHIEVEMENTS, ...SPECIAL_ACHIEVEMENTS,
  ...NEGATIVE_ACHIEVEMENTS,
].map(a => ({ ...a, progress: 0, unlocked: false, redeemed: (a as any).redeemed ?? null }))

/** 稀有度排序与样式 */
export const RARITY_ORDER: Rarity[] = ['diamond', 'gold', 'silver', 'bronze', 'negative']

export const RARITY_META: Record<Rarity, { label: string; color: string; glow: string; iconColor: string; iconBg: string }> = {
  diamond: { label: '钻石', color: '#b3e5fc', glow: '0 0 12px rgba(100,200,255,0.4)', iconColor: '#80d8ff', iconBg: 'rgba(100,200,255,0.1)' },
  gold:    { label: '金',   color: '#ffd54f', glow: '0 0 10px rgba(255,193,7,0.3)',  iconColor: '#ffb300', iconBg: 'rgba(255,193,7,0.1)' },
  silver:  { label: '银',   color: '#cfd8dc', glow: 'none',                            iconColor: '#90a4ae', iconBg: 'rgba(144,164,174,0.1)' },
  bronze:  { label: '铜',   color: '#bcaaa4', glow: 'none',                            iconColor: '#a1887f', iconBg: 'rgba(161,136,127,0.1)' },
  negative:{ label: '负面', color: '#616161', glow: 'none',                            iconColor: '#757575', iconBg: 'rgba(97,97,97,0.1)' },
}

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  'abyss': '深渊挑战',
  'study-time': '学习时长',
  'streak': '坚持打卡',
  'special': '特殊/彩蛋',
  'negative': '航行事故',
}

export const ACHIEVEMENT_TABS = [
  { id: 'all' as const, label: '全部' },
  { id: 'unlocked' as const, label: '已解锁' },
  { id: 'locked' as const, label: '未解锁' },
]
