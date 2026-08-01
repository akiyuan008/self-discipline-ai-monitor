// 自律世界养成：地图 + 宠物 + 悔悟机制
export interface WorldMap {
  id: string
  name: string
  emoji: string
  unlockCost: number   // 解锁所需自律能量
  desc: string
  unlocked: boolean
}

export const WORLD_MAPS: WorldMap[] = [
  { id: 'study_room', name: '深夜自习室', emoji: '🕯️', unlockCost: 0, desc: '你的起点。一张旧木桌，一盏台灯。', unlocked: true },
  { id: 'library', name: '城市图书馆', emoji: '📚', unlockCost: 200, desc: '解锁更高级的学习氛围和-3%娱乐时长门槛。', unlocked: false },
  { id: 'mountain', name: '雪山禅修所', emoji: '🏔️', unlockCost: 800, desc: '专注度+5%加成，远离网络诱惑。', unlocked: false },
  { id: 'space', name: '空间站自习舱', emoji: '🛰️', unlockCost: 2000, desc: '解锁深度学习模式，强制番茄钟不可中断。', unlocked: false },
  { id: 'astral', name: '星海观想台', emoji: '🌌', unlockCost: 5000, desc: '终极境界：连续 30 天高专注将触发"自我超越"。', unlocked: false }
]

export interface Pet {
  id: string
  name: string
  emoji: string
  desc: string
  unlockCost: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export const PETS: Pet[] = [
  { id: 'dustbunny', name: '灰兔', emoji: '🐰', desc: '入门伙伴。会盯着你别玩手机。', unlockCost: 50, rarity: 'common' },
  { id: 'owl', name: '夜枭', emoji: '🦉', desc: '陪伴熬夜学习，专注+3。', unlockCost: 150, rarity: 'common' },
  { id: 'fox', name: '墨狐', emoji: '🦊', desc: '智略加成，遇难题有概率提示。', unlockCost: 400, rarity: 'rare' },
  { id: 'koi', name: '锦鲤', emoji: '🐟', desc: '积分暴击概率+10%。', unlockCost: 800, rarity: 'rare' },
  { id: 'dragon', name: '青衫龙', emoji: '🐉', desc: '一周不摸鱼即解锁，养成终极伙伴。', unlockCost: 2500, rarity: 'epic' },
  { id: 'phoenix', name: '涅槃凤凰', emoji: '🔥', desc: '失败 30 天后连续 7 天满分解锁，象征悔悟与重生。', unlockCost: 5000, rarity: 'legendary' }
]

export const RARITY_META: Record<Pet['rarity'], { label: string; color: string }> = {
  common: { label: '普通', color: '#838A95' },
  rare: { label: '稀有', color: '#2454FF' },
  epic: { label: '史诗', color: '#8b5cf6' },
  legendary: { label: '传说', color: '#f59e0b' }
}

// 奖励商店
export interface RewardItem {
  id: string
  name: string
  desc: string
  cost: number
  type: 'voice' | 'skin' | 'pardon' | 'share' | 'boost'
  emoji: string
}

export const REWARD_SHOP: RewardItem[] = [
  { id: 'v1', name: '深夜温柔音色', desc: '解锁监工的深夜低音色声线。', cost: 120, type: 'voice', emoji: '🎙️' },
  { id: 'v2', name: '元气少女音色', desc: '让监工语气更明亮活泼。', cost: 200, type: 'voice', emoji: '🌸' },
  { id: 'v3', name: '机械AI声色', desc: '赛博朋克风，搭配未来地图使用。', cost: 500, type: 'voice', emoji: '🤖' },
  { id: 's1', name: '雪夜皮肤', desc: '深夜学习的雪景主题。', cost: 100, type: 'skin', emoji: '❄️' },
  { id: 's2', name: '禅意皮肤', desc: '黑白水墨风格，仪式感拉满。', cost: 300, type: 'skin', emoji: '⛩️' },
  { id: 's3', name: '霓虹皮肤', desc: '复古未来风。', cost: 600, type: 'skin', emoji: '🌃' },
  { id: 'p1', name: '免罚卡×1', desc: '一次错过目标自动免扣分。', cost: 80, type: 'pardon', emoji: '🛡️' },
  { id: 'p2', name: '免罚卡×5', desc: '5 次免罚机会（推荐）。', cost: 360, type: 'pardon', emoji: '🛡️' },
  { id: 'p3', name: '锁屏豁免', desc: '今日不被强制锁屏（每月限购 1 次）。', cost: 240, type: 'pardon', emoji: '🔑' },
  { id: 'g1', name: '学霸战绩图', desc: '一键生成可分享的学霸海报。', cost: 60, type: 'share', emoji: '📊' },
  { id: 'g2', name: '专注双倍卡', desc: '1 小时内积分×2。', cost: 150, type: 'boost', emoji: '⚡' },
  { id: 'g3', name: '悔悟钥匙', desc: '弥补一个失败日，重置部分惩罚。', cost: 280, type: 'boost', emoji: '🗝️' }
]

// 成就
export interface Achievement {
  id: string
  name: string
  desc: string
  emoji: string
  unlocked: boolean
  progress?: number
  total?: number
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'a1', name: '初心', desc: '完成第一次学习打卡。', emoji: '🌱', unlocked: true },
  { id: 'a2', name: '七天不辍', desc: '连续 7 天达成目标。', emoji: '🔥', unlocked: true, progress: 7, total: 7 },
  { id: 'a3', name: '专注之星', desc: '单日专注度≥90。', emoji: '⭐', unlocked: true },
  { id: 'a4', name: '三十日铁人', desc: '连续 30 天达成目标。', emoji: '🗿', unlocked: false, progress: 12, total: 30 },
  { id: 'a5', name: '悔悟者', desc: '用悔悟钥匙弥补一次失败日。', emoji: '🗝️', unlocked: false },
  { id: 'a6', name: '涅槃凤凰', desc: '失败后连续 7 天满分。', emoji: '🔥', unlocked: false, progress: 2, total: 7 },
  { id: 'a7', name: '锦鲤之友', desc: '解锁 3 只稀有以上宠物。', emoji: '🐟', unlocked: false, progress: 1, total: 3 },
  { id: 'a8', name: '星海彼岸', desc: '解锁全部 5 张地图。', emoji: '🌌', unlocked: false, progress: 1, total: 5 }
]
