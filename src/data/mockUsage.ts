// 今日使用时长 mock（真机由 UsageStats API 实时拉取）
export interface UsageStat {
  packageName: string
  label: string
  category: 'study' | 'social' | 'game' | 'video' | 'other'
  isStudy: boolean
  totalMs: number      // 累计使用毫秒
  foregroundMs: number // 前台活跃毫秒
  lastTimeUsed: number // 最近一次使用的时间戳
  launchCount: number
}

export const MOCK_USAGE_STATS: UsageStat[] = [
  { packageName: 'com.xiaodao.xiaodaoapp', label: '小道背单词', category: 'study', isStudy: true, totalMs: 35_400_000, foregroundMs: 32_000_000, lastTimeUsed: Date.now() - 1_800_000, launchCount: 3 },
  { packageName: 'cn.com.moobo.kingmath', label: '可汗数学', category: 'study', isStudy: true, totalMs: 28_800_000, foregroundMs: 26_000_000, lastTimeUsed: Date.now() - 5_400_000, launchCount: 2 },
  { packageName: 'com.duolingo', label: '多邻国', category: 'study', isStudy: true, totalMs: 12_300_000, foregroundMs: 10_000_000, lastTimeUsed: Date.now() - 3_600_000, launchCount: 1 },
  { packageName: 'com.tencent.mm', label: '微信', category: 'social', isStudy: false, totalMs: 18_000_000, foregroundMs: 14_000_000, lastTimeUsed: Date.now() - 60_000, launchCount: 12 },
  { packageName: 'com.ss.android.ugc.aweme', label: '抖音', category: 'video', isStudy: false, totalMs: 47_400_000, foregroundMs: 45_000_000, lastTimeUsed: Date.now() - 600_000, launchCount: 6 },
  { packageName: 'tv.danmaku.bili', label: '哔哩哔哩', category: 'video', isStudy: false, totalMs: 22_200_000, foregroundMs: 19_800_000, lastTimeUsed: Date.now() - 3_600_000, launchCount: 4 },
  { packageName: 'com.miHoYo.YuanShen', label: '原神', category: 'game', isStudy: false, totalMs: 38_400_000, foregroundMs: 36_000_000, lastTimeUsed: Date.now() - 7_200_000, launchCount: 2 }
]

// 7 天使用时长趋势
export const MOCK_WEEKLY_TREND: { date: string; studyMs: number; entertainmentMs: number; focusScore: number }[] = [
  { date: '周一', studyMs: 2_160_0000, entertainmentMs: 4_320_0000, focusScore: 72 },
  { date: '周二', studyMs: 2_880_0000, entertainmentMs: 3_600_0000, focusScore: 78 },
  { date: '周三', studyMs: 1_800_0000, entertainmentMs: 5_400_0000, focusScore: 64 },
  { date: '周四', studyMs: 3_240_0000, entertainmentMs: 2_880_0000, focusScore: 82 },
  { date: '周五', studyMs: 1_440_0000, entertainmentMs: 6_120_0000, focusScore: 58 },
  { date: '周六', studyMs: 3_960_0000, entertainmentMs: 3_240_0000, focusScore: 86 },
  { date: '周日', studyMs: 3_600_0000, entertainmentMs: 1_800_0000, focusScore: 90 }
]

// 24h 专注度曲线（每小时一个分值 0-100）
export const MOCK_FOCUS_CURVE: number[] = [
  20, 18, 12, 8, 10, 25,    // 0-5
  35, 55, 78, 88, 92, 85,    // 6-11
  72, 60, 82, 90, 88, 75,    // 12-17
  82, 70, 58, 40, 30, 22     // 18-23
]

// 4 周各科投入时间（小时）
export const MOCK_SUBJECT_MONTHLY: { subject: string; weeks: number[]; color: string }[] = [
  { subject: '英语', weeks: [12, 14, 18, 22], color: '#2454FF' },
  { subject: '数学', weeks: [8, 11, 9, 14], color: '#16a34a' },
  { subject: '专业课', weeks: [6, 9, 12, 16], color: '#D946EF' },
  { subject: '政治', weeks: [2, 4, 5, 6], color: '#f59e0b' }
]

// 娱乐黑洞 Top3
export const MOCK_ENTERTAINMENT_BLACKHOLES: { label: string; ms: number; reason: string }[] = [
  { label: '抖音', ms: 47_400_000, reason: '21:30-23:00 高频次进入，单次停留 7+ 分钟' },
  { label: '原神', ms: 38_400_000, reason: '20:00-22:00 长时段无中断' },
  { label: '哔哩哔哩', ms: 22_200_000, reason: '通勤时段频繁切换，碎片化浪费' }
]
