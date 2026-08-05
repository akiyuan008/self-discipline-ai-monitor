/**
 * 课程表数据
 * 从图片中提取：周一到周六有课，周日自习
 * 每节课：开始时间、结束时间、科目
 */

export interface ClassPeriod {
  id: number           // 节次 1-12
  startTime: string    // "08:00"
  endTime: string      // "09:00"
  subject: string
}

export interface DaySchedule {
  day: number          // 0=周日, 1=周一, ..., 6=周六
  dayName: string
  periods: ClassPeriod[]
}

// 课程表：周一到周六
export const WEEKLY_SCHEDULE: DaySchedule[] = [
  // 周一
  {
    day: 1, dayName: '周一',
    periods: [
      { id: 1, startTime: '08:00', endTime: '09:00', subject: '数学' },
      { id: 2, startTime: '09:00', endTime: '10:00', subject: '数学' },
      { id: 3, startTime: '10:10', endTime: '11:10', subject: '化学' },
      { id: 4, startTime: '11:10', endTime: '11:40', subject: '化学' },
      { id: 5, startTime: '13:40', endTime: '14:40', subject: '生物' },
      { id: 6, startTime: '14:40', endTime: '15:40', subject: '生物' },
      { id: 7, startTime: '15:50', endTime: '16:50', subject: '数学' },
      { id: 8, startTime: '16:50', endTime: '17:50', subject: '数学' },
      { id: 9, startTime: '18:00', endTime: '19:00', subject: '化学' },
      { id: 10, startTime: '19:00', endTime: '20:00', subject: '化学' },
      { id: 11, startTime: '21:00', endTime: '22:00', subject: '数学' },
      { id: 12, startTime: '22:00', endTime: '22:30', subject: '语文' },
    ]
  },
  // 周二
  {
    day: 2, dayName: '周二',
    periods: [
      { id: 1, startTime: '08:00', endTime: '09:00', subject: '数学' },
      { id: 2, startTime: '09:00', endTime: '10:00', subject: '数学' },
      { id: 3, startTime: '10:10', endTime: '11:10', subject: '生物' },
      { id: 4, startTime: '11:10', endTime: '11:40', subject: '生物' },
      { id: 5, startTime: '13:40', endTime: '14:40', subject: '化学' },
      { id: 6, startTime: '14:40', endTime: '15:40', subject: '化学' },
      { id: 7, startTime: '15:50', endTime: '16:50', subject: '数学' },
      { id: 8, startTime: '16:50', endTime: '17:50', subject: '数学' },
      { id: 9, startTime: '18:00', endTime: '19:00', subject: '生物' },
      { id: 10, startTime: '19:00', endTime: '20:00', subject: '生物' },
      { id: 11, startTime: '21:00', endTime: '22:00', subject: '物理' },
      { id: 12, startTime: '22:00', endTime: '22:30', subject: '英语' },
    ]
  },
  // 周三
  {
    day: 3, dayName: '周三',
    periods: [
      { id: 1, startTime: '08:00', endTime: '09:00', subject: '化学' },
      { id: 2, startTime: '09:00', endTime: '10:00', subject: '化学' },
      { id: 3, startTime: '10:10', endTime: '11:10', subject: '物理' },
      { id: 4, startTime: '11:10', endTime: '11:40', subject: '物理' },
      { id: 5, startTime: '13:40', endTime: '14:40', subject: '化学' },
      { id: 6, startTime: '14:40', endTime: '15:40', subject: '化学' },
      { id: 7, startTime: '15:50', endTime: '16:50', subject: '物理' },
      { id: 8, startTime: '16:50', endTime: '17:50', subject: '物理' },
      { id: 9, startTime: '18:00', endTime: '19:00', subject: '生物' },
      { id: 10, startTime: '19:00', endTime: '20:00', subject: '生物' },
      { id: 11, startTime: '21:00', endTime: '22:00', subject: '化学' },
      { id: 12, startTime: '22:00', endTime: '22:30', subject: '语文' },
    ]
  },
  // 周四
  {
    day: 4, dayName: '周四',
    periods: [
      { id: 1, startTime: '08:00', endTime: '09:00', subject: '生物' },
      { id: 2, startTime: '09:00', endTime: '10:00', subject: '生物' },
      { id: 3, startTime: '10:10', endTime: '11:10', subject: '化学' },
      { id: 4, startTime: '11:10', endTime: '11:40', subject: '化学' },
      { id: 5, startTime: '13:40', endTime: '14:40', subject: '物理' },
      { id: 6, startTime: '14:40', endTime: '15:40', subject: '物理' },
      { id: 7, startTime: '15:50', endTime: '16:50', subject: '生物' },
      { id: 8, startTime: '16:50', endTime: '17:50', subject: '生物' },
      { id: 9, startTime: '18:00', endTime: '19:00', subject: '物理' },
      { id: 10, startTime: '19:00', endTime: '20:00', subject: '物理' },
      { id: 11, startTime: '21:00', endTime: '22:00', subject: '生物' },
      { id: 12, startTime: '22:00', endTime: '22:30', subject: '英语' },
    ]
  },
  // 周五
  {
    day: 5, dayName: '周五',
    periods: [
      { id: 1, startTime: '08:00', endTime: '09:00', subject: '物理' },
      { id: 2, startTime: '09:00', endTime: '10:00', subject: '物理' },
      { id: 3, startTime: '10:10', endTime: '11:10', subject: '数学' },
      { id: 4, startTime: '11:10', endTime: '11:40', subject: '数学' },
      { id: 5, startTime: '13:40', endTime: '14:40', subject: '生物' },
      { id: 6, startTime: '14:40', endTime: '15:40', subject: '生物' },
      { id: 7, startTime: '15:50', endTime: '16:50', subject: '数学' },
      { id: 8, startTime: '16:50', endTime: '17:50', subject: '数学' },
      { id: 9, startTime: '18:00', endTime: '19:00', subject: '化学' },
      { id: 10, startTime: '19:00', endTime: '20:00', subject: '化学' },
      { id: 11, startTime: '21:00', endTime: '22:00', subject: '数学' },
      { id: 12, startTime: '22:00', endTime: '22:30', subject: '数学' },
    ]
  },
  // 周六
  {
    day: 6, dayName: '周六',
    periods: [
      { id: 1, startTime: '08:00', endTime: '09:00', subject: '数学' },
      { id: 2, startTime: '09:00', endTime: '10:00', subject: '数学' },
      { id: 3, startTime: '10:10', endTime: '11:10', subject: '生物' },
      { id: 4, startTime: '11:10', endTime: '11:40', subject: '生物' },
      { id: 5, startTime: '13:40', endTime: '14:40', subject: '物理' },
      { id: 6, startTime: '14:40', endTime: '15:40', subject: '物理' },
      { id: 7, startTime: '15:50', endTime: '16:50', subject: '化学' },
      { id: 8, startTime: '16:50', endTime: '17:50', subject: '化学' },
      { id: 9, startTime: '18:00', endTime: '19:00', subject: '物理' },
      { id: 10, startTime: '19:00', endTime: '20:00', subject: '物理' },
      { id: 11, startTime: '21:00', endTime: '22:00', subject: '物理' },
      { id: 12, startTime: '22:00', endTime: '22:30', subject: '物理' },
    ]
  },
  // 周日：自习
  {
    day: 0, dayName: '周日',
    periods: [
      { id: 1, startTime: '08:00', endTime: '09:00', subject: '自习' },
      { id: 2, startTime: '09:00', endTime: '10:00', subject: '自习' },
      { id: 3, startTime: '10:10', endTime: '11:10', subject: '自习' },
      { id: 4, startTime: '11:10', endTime: '11:40', subject: '自习' },
      { id: 5, startTime: '13:40', endTime: '14:40', subject: '自习' },
      { id: 6, startTime: '14:40', endTime: '15:40', subject: '自习' },
      { id: 7, startTime: '15:50', endTime: '16:50', subject: '自习' },
      { id: 8, startTime: '16:50', endTime: '17:50', subject: '自习' },
      { id: 9, startTime: '18:00', endTime: '19:00', subject: '自习' },
      { id: 10, startTime: '19:00', endTime: '20:00', subject: '自习' },
      { id: 11, startTime: '21:00', endTime: '22:00', subject: '自习' },
      { id: 12, startTime: '22:00', endTime: '22:30', subject: '自习' },
    ]
  }
]

/**
 * 获取今天的课程表
 */
export function getTodaySchedule(): DaySchedule | null {
  const day = new Date().getDay()
  return WEEKLY_SCHEDULE.find(s => s.day === day) || null
}

/**
 * 获取下一节课
 */
export function getNextPeriod(): { period: ClassPeriod; minutesUntil: number } | null {
  const now = new Date()
  const today = getTodaySchedule()
  if (!today) return null

  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  for (const period of today.periods) {
    const [h, m] = period.startTime.split(':').map(Number)
    const startMinutes = h * 60 + m
    if (startMinutes > currentMinutes) {
      return { period, minutesUntil: startMinutes - currentMinutes }
    }
  }
  return null
}

/**
 * 获取当前正在进行的课
 */
export function getCurrentPeriod(): ClassPeriod | null {
  const now = new Date()
  const today = getTodaySchedule()
  if (!today) return null

  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  for (const period of today.periods) {
    const [sh, sm] = period.startTime.split(':').map(Number)
    const [eh, em] = period.endTime.split(':').map(Number)
    const startMinutes = sh * 60 + sm
    const endMinutes = eh * 60 + em
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return period
    }
  }
  return null
}

/**
 * 计算课程积分奖励
 * 基础：每节课按时完成 +50 积分
 * 难度加成：
 *   - 数学/物理（难）：+30 额外
 *   - 化学/生物（中）：+15 额外
 *   - 语文/英语（基础）：+10 额外
 *   - 自习：+20 额外（需要自律）
 */
export function calculateClassReward(subject: string): number {
  const base = 50
  const bonus: Record<string, number> = {
    '数学': 30, '物理': 30,
    '化学': 15, '生物': 15,
    '语文': 10, '英语': 10,
    '自习': 20
  }
  return base + (bonus[subject] || 10)
}

/**
 * 计算逾期惩罚
 * 每节课逾期：-30 积分
 * 连续逾期3节课：额外 -100 积分
 */
export function calculateOverduePenalty(consecutiveOverdue: number): number {
  const base = 30
  const extra = consecutiveOverdue >= 3 ? 100 : 0
  return -(base + extra)
}
