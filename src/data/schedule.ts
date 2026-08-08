export interface ClassPeriod {
  period: number        // 第几节 1-12
  startTime: string     // "08:00"
  endTime: string       // "09:00"
}

export interface ClassSchedule {
  dayOfWeek: number     // 0=周日, 1=周一...6=周六
  period: number
  subject: string
  difficulty: 'easy' | 'medium' | 'hard'
  baseReward: number
  penalty: number
}

// 时间段定义
export const PERIODS: ClassPeriod[] = [
  { period: 1, startTime: '08:00', endTime: '09:00' },
  { period: 2, startTime: '09:00', endTime: '10:00' },
  { period: 3, startTime: '10:10', endTime: '11:10' },
  { period: 4, startTime: '11:10', endTime: '11:40' },
  { period: 5, startTime: '13:40', endTime: '14:40' },
  { period: 6, startTime: '14:40', endTime: '15:40' },
  { period: 7, startTime: '15:50', endTime: '16:50' },
  { period: 8, startTime: '16:50', endTime: '17:50' },
  { period: 9, startTime: '18:00', endTime: '19:00' },
  { period: 10, startTime: '19:00', endTime: '20:00' },
  { period: 11, startTime: '21:00', endTime: '22:00' },
  { period: 12, startTime: '22:00', endTime: '22:30' },
]

// 周一到周六的课程表（周日全部自习）
export const SCHEDULE: ClassSchedule[] = [
  // ========== 周一 ==========
  { dayOfWeek: 1, period: 1, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 1, period: 2, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 1, period: 3, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 1, period: 4, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 1, period: 5, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 1, period: 6, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 1, period: 7, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 1, period: 8, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 1, period: 9, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 1, period: 10, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 1, period: 11, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 1, period: 12, subject: '语文', difficulty: 'easy', baseReward: 30, penalty: 50 },

  // ========== 周二 ==========
  { dayOfWeek: 2, period: 1, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 2, period: 2, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 2, period: 3, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 2, period: 4, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 2, period: 5, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 2, period: 6, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 2, period: 7, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 2, period: 8, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 2, period: 9, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 2, period: 10, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 2, period: 11, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 2, period: 12, subject: '英语', difficulty: 'easy', baseReward: 30, penalty: 50 },

  // ========== 周三 ==========
  { dayOfWeek: 3, period: 1, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 3, period: 2, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 3, period: 3, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 3, period: 4, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 3, period: 5, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 3, period: 6, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 3, period: 7, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 3, period: 8, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 3, period: 9, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 3, period: 10, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 3, period: 11, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 3, period: 12, subject: '语文', difficulty: 'easy', baseReward: 30, penalty: 50 },

  // ========== 周四 ==========
  { dayOfWeek: 4, period: 1, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 4, period: 2, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 4, period: 3, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 4, period: 4, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 4, period: 5, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 4, period: 6, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 4, period: 7, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 4, period: 8, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 4, period: 9, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 4, period: 10, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 4, period: 11, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 4, period: 12, subject: '英语', difficulty: 'easy', baseReward: 30, penalty: 50 },

  // ========== 周五 ==========
  { dayOfWeek: 5, period: 1, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 5, period: 2, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 5, period: 3, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 5, period: 4, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 5, period: 5, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 5, period: 6, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 5, period: 7, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 5, period: 8, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 5, period: 9, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 5, period: 10, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 5, period: 11, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 5, period: 12, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },

  // ========== 周六 ==========
  { dayOfWeek: 6, period: 1, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 6, period: 2, subject: '数学', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 6, period: 3, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 6, period: 4, subject: '生物', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 6, period: 5, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 6, period: 6, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 6, period: 7, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 6, period: 8, subject: '化学', difficulty: 'medium', baseReward: 40, penalty: 50 },
  { dayOfWeek: 6, period: 9, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 6, period: 10, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 6, period: 11, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },
  { dayOfWeek: 6, period: 12, subject: '物理', difficulty: 'hard', baseReward: 50, penalty: 50 },

  // ========== 周日（全部自习）==========
  { dayOfWeek: 0, period: 1, subject: '自习', difficulty: 'easy', baseReward: 20, penalty: 50 },
  { dayOfWeek: 0, period: 2, subject: '自习', difficulty: 'easy', baseReward: 20, penalty: 50 },
  { dayOfWeek: 0, period: 3, subject: '自习', difficulty: 'easy', baseReward: 20, penalty: 50 },
  { dayOfWeek: 0, period: 4, subject: '自习', difficulty: 'easy', baseReward: 20, penalty: 50 },
  { dayOfWeek: 0, period: 5, subject: '自习', difficulty: 'easy', baseReward: 20, penalty: 50 },
  { dayOfWeek: 0, period: 6, subject: '自习', difficulty: 'easy', baseReward: 20, penalty: 50 },
  { dayOfWeek: 0, period: 7, subject: '自习', difficulty: 'easy', baseReward: 20, penalty: 50 },
  { dayOfWeek: 0, period: 8, subject: '自习', difficulty: 'easy', baseReward: 20, penalty: 50 },
  { dayOfWeek: 0, period: 9, subject: '自习', difficulty: 'easy', baseReward: 20, penalty: 50 },
  { dayOfWeek: 0, period: 10, subject: '自习', difficulty: 'easy', baseReward: 20, penalty: 50 },
  { dayOfWeek: 0, period: 11, subject: '自习', difficulty: 'easy', baseReward: 20, penalty: 50 },
  { dayOfWeek: 0, period: 12, subject: '自习', difficulty: 'easy', baseReward: 20, penalty: 50 },
]

/**
 * 获取今天的课程
 */
export function getTodaySchedule(): ClassSchedule[] {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=周日
  return SCHEDULE.filter(s => s.dayOfWeek === dayOfWeek)
}

/**
 * 获取某节课的时间段
 */
export function getPeriodTime(period: number): ClassPeriod | undefined {
  return PERIODS.find(p => p.period === period)
}

/**
 * 将时间字符串转为分钟数（用于比较）
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * 获取当前进行中的课程
 */
export function getCurrentClass(): ClassSchedule | null {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const today = SCHEDULE.filter(s => s.dayOfWeek === dayOfWeek)
  for (const cls of today) {
    const period = getPeriodTime(cls.period)
    if (!period) continue
    const startMin = timeToMinutes(period.startTime)
    const endMin = timeToMinutes(period.endTime)
    if (currentMinutes >= startMin && currentMinutes <= endMin) {
      return cls
    }
  }
  return null
}

/**
 * 获取下一节课
 */
export function getNextClass(): ClassSchedule | null {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const today = SCHEDULE.filter(s => s.dayOfWeek === dayOfWeek)
  for (const cls of today) {
    const period = getPeriodTime(cls.period)
    if (!period) continue
    const startMin = timeToMinutes(period.startTime)
    if (startMin > currentMinutes) {
      return cls
    }
  }
  return null
}

/**
 * 判断当前是否可以开始某节课（课前15分钟到课后10分钟）
 */
export function canStartClass(period: number): { can: boolean; reason?: string } {
  const now = new Date()
  const currentMin = now.getHours() * 60 + now.getMinutes()
  const p = getPeriodTime(period)
  if (!p) return { can: false, reason: '课程不存在' }

  const startMin = timeToMinutes(p.startTime)
  const endMin = timeToMinutes(p.endTime)

  // 课前15分钟到课后10分钟可以开始
  if (currentMin < startMin - 15) {
    return { can: false, reason: `还未到上课时间，${p.startTime}开始` }
  }
  if (currentMin > endMin + 10) {
    return { can: false, reason: '课程已结束' }
  }
  return { can: true }
}

/**
 * 判断当前是否可以打卡某节课（课程进行中或刚结束）
 */
export function canCheckInClass(period: number): { can: boolean; reason?: string } {
  const now = new Date()
  const currentMin = now.getHours() * 60 + now.getMinutes()
  const p = getPeriodTime(period)
  if (!p) return { can: false, reason: '课程不存在' }

  const startMin = timeToMinutes(p.startTime)
  const endMin = timeToMinutes(p.endTime)

  // 课程开始后到课后30分钟内可以打卡
  if (currentMin < startMin) {
    return { can: false, reason: `课程还未开始，${p.startTime}开始` }
  }
  if (currentMin > endMin + 30) {
    return { can: false, reason: '已超过打卡时限' }
  }
  return { can: true }
}

// ═══════════════════════════════════════════════════════════
// 统一状态机：单一事实来源，根治「双状态源死卡」问题
// ═══════════════════════════════════════════════════════════

/** 课程在 UI 上的 7 个互斥状态 */
export type TaskUIState =
  | 'LOCKED'   // 太早，还没到预热窗口
  | 'READY'    // 开课前 15 分钟内，可准备
  | 'LIVE'     // 上课中
  | 'GRACE'    // 已结束但仍在打卡宽限期（课后 30 分钟内）
  | 'VERIFY'   // 已专注(started)，等待拍照核验
  | 'DONE'     // 已完成
  | 'MISSED'   // 逾期未完成

export interface ResolvedTask {
  state: TaskUIState
  label: string
  color: string
  blink: boolean
  startMin: number
  endMin: number
  /** 距开始还剩多少分钟（LOCKED/READY 用） */
  minsUntilStart: number
  /** 距打卡截止还剩多少分钟（LIVE/GRACE/VERIFY 用） */
  minsUntilDeadline: number
  /** 课中进度 0-100（LIVE 用） */
  liveProgress: number
}

const STATE_META: Record<TaskUIState, { label: string; color: string; blink: boolean }> = {
  LOCKED: { label: 'STANDBY', color: '#5a6a7a', blink: false },
  READY:  { label: 'READY',   color: '#45a29e', blink: true },
  LIVE:   { label: 'LIVE',    color: '#ff4500', blink: true },
  GRACE:  { label: 'GRACE',   color: '#f59e0b', blink: true },
  VERIFY: { label: 'VERIFY',  color: '#45a29e', blink: true },
  DONE:   { label: 'DONE',    color: '#22c55e', blink: false },
  MISSED: { label: 'MISSED',  color: '#ff4444', blink: false },
}

/**
 * 核心状态解析：给定任务与当前时间，输出唯一 UI 状态。
 * 这是页面显示与按钮渲染的唯一依据，杜绝死卡。
 */
export function resolveTaskState(
  task: { status: string; period: number },
  now: Date = new Date()
): ResolvedTask {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const p = getPeriodTime(task.period)
  const startMin = p ? timeToMinutes(p.startTime) : nowMin
  const endMin = p ? timeToMinutes(p.endTime) : nowMin

  const base = {
    startMin, endMin,
    minsUntilStart: startMin - nowMin,
    minsUntilDeadline: endMin + 30 - nowMin,
    liveProgress: 0,
  }

  const meta = (s: TaskUIState) => ({ ...base, state: s, ...STATE_META[s] })

  // 终态（来自持久化 store，优先级最高）
  if (task.status === 'completed') return meta('DONE')
  if (task.status === 'overdue' || task.status === 'absent') return meta('MISSED')

  // 已专注、待核验
  if (task.status === 'started') {
    if (nowMin <= endMin + 30) return meta('VERIFY')
    return meta('MISSED') // 超时未核验
  }

  // pending：按时间推导
  if (nowMin < startMin - 15) return meta('LOCKED')
  if (nowMin < startMin) return meta('READY')
  if (nowMin <= endMin) {
    const prog = endMin > startMin ? ((nowMin - startMin) / (endMin - startMin)) * 100 : 0
    return { ...meta('LIVE'), liveProgress: Math.min(100, Math.max(0, prog)) }
  }
  if (nowMin <= endMin + 30) return meta('GRACE')
  return meta('MISSED')
}

/**
 * 对账：把已过点但仍是 pending 的任务就地标记为 overdue。
 * 在页面渲染时调用，替代依赖 main.tsx 前台轮询，根除僵尸态。
 * 返回被标记逾期的任务 id 列表（供调用方扣分）。
 */
export function reconcileOverdue(
  tasks: Array<{ id: string; status: string; period: number }>,
  now: Date = new Date()
): string[] {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const overdueIds: string[] = []
  for (const t of tasks) {
    if (t.status !== 'pending') continue
    const p = getPeriodTime(t.period)
    if (!p) continue
    const endMin = timeToMinutes(p.endTime)
    if (nowMin > endMin + 30) overdueIds.push(t.id)
  }
  return overdueIds
}
