import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { SCHEDULE, getPeriodTime, timeToMinutes } from '@/data/schedule'

export interface ClassTask {
  id: string
  dayOfWeek: number
  period: number
  subject: string
  difficulty: 'easy' | 'medium' | 'hard'
  baseReward: number
  penalty: number
  status: 'pending' | 'started' | 'completed' | 'overdue' | 'absent'
  startTime?: number
  endTime?: number
  photoUrl?: string
  aiReview?: string
  aiScore?: number
  bonusReward: number
  date: string
}

export interface PointsChange {
  amount: number
  reason: string
  time: number
}

export interface NotificationSetting {
  enabled: boolean
  remindMinutes: number
}

export interface MonitorState {
  lastCheckTime: number
  warningCount: number
  entertainmentMs: number
  studyMs: number
  isPunished: boolean
}

interface ClassTaskState {
  // 课程任务
  classTasks: ClassTask[]
  currentTask: ClassTask | null

  // 通知
  notificationSetting: NotificationSetting

  // 监测
  monitorState: MonitorState

  // 连胜
  fullAttendanceDays: number
  lastAttendanceDate: string

  // 积分变动
  lastPointsChange: PointsChange | null

  // Actions
  generateTodayTasks: () => void
  startClassTask: (taskId: string) => void
  completeClassTask: (taskId: string, photoUrl?: string, aiReview?: string, aiScore?: number) => number
  markTaskOverdue: (taskId: string) => number
  markTaskAbsent: (taskId: string) => number
  addPointsWithToast: (amount: number, reason: string) => void
  checkFullAttendance: () => number
  updateMonitorState: (studyMs: number, entMs: number) => void
  setNotification: (setting: Partial<NotificationSetting>) => void
  reset: () => void
}

export const useClassTaskStore = create<ClassTaskState>()(
  persist(
    (set, get) => ({
      classTasks: [],
      currentTask: null,
      notificationSetting: { enabled: true, remindMinutes: 4 },
      monitorState: { lastCheckTime: 0, warningCount: 0, entertainmentMs: 0, studyMs: 0, isPunished: false },
      fullAttendanceDays: 0,
      lastAttendanceDate: '',
      lastPointsChange: null,

      generateTodayTasks: () => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const dateStr = today.toISOString().slice(0, 10)

        const tasks: ClassTask[] = SCHEDULE
          .filter(s => s.dayOfWeek === dayOfWeek)
          .map(s => ({
            id: `${dateStr}-${s.period}`,
            dayOfWeek: s.dayOfWeek,
            period: s.period,
            subject: s.subject,
            difficulty: s.difficulty,
            baseReward: s.baseReward,
            penalty: s.penalty,
            status: 'pending',
            bonusReward: 0,
            date: dateStr
          }))

        set({ classTasks: tasks })
      },

      startClassTask: (taskId: string) => {
        set(s => ({
          classTasks: s.classTasks.map(t =>
            t.id === taskId ? { ...t, status: 'started' as const, startTime: Date.now() } : t
          ),
          currentTask: s.classTasks.find(t => t.id === taskId) || null
        }))
      },

      completeClassTask: (taskId: string, photoUrl?: string, aiReview?: string, aiScore?: number) => {
        const now = Date.now()
        const state = get()
        const task = state.classTasks.find(t => t.id === taskId)
        if (!task) return 0

        let bonus = 0
        const period = getPeriodTime(task.period)
        if (period) {
          const endMin = timeToMinutes(period.endTime)
          const currentMin = new Date().getHours() * 60 + new Date().getMinutes()
          if (currentMin <= endMin) bonus += 10
        }
        if (aiScore && aiScore >= 80) bonus += 20

        const totalReward = task.baseReward + bonus

        set({
          classTasks: state.classTasks.map(t =>
            t.id === taskId ? { ...t, status: 'completed' as const, endTime: now, photoUrl, aiReview, aiScore, bonusReward: bonus } : t
          ),
          currentTask: null,
          lastPointsChange: { amount: totalReward, reason: `完成${task.subject}课`, time: now }
        })

        return totalReward
      },

      markTaskOverdue: (taskId: string) => {
        const state = get()
        const task = state.classTasks.find(t => t.id === taskId)
        if (!task || task.status !== 'pending') return 0

        set({
          classTasks: state.classTasks.map(t =>
            t.id === taskId ? { ...t, status: 'overdue' as const } : t
          ),
          lastPointsChange: { amount: -task.penalty, reason: `${task.subject}课未按时完成`, time: Date.now() }
        })

        return -task.penalty
      },

      markTaskAbsent: (taskId: string) => {
        const state = get()
        const task = state.classTasks.find(t => t.id === taskId)
        if (!task) return 0

        set({
          classTasks: state.classTasks.map(t =>
            t.id === taskId ? { ...t, status: 'absent' as const } : t
          ),
          lastPointsChange: { amount: -task.penalty, reason: `${task.subject}课缺课`, time: Date.now() }
        })

        return -task.penalty
      },

      addPointsWithToast: (amount: number, reason: string) => {
        set({
          lastPointsChange: { amount, reason, time: Date.now() }
        })
      },

      checkFullAttendance: () => {
        const state = get()
        const today = new Date().toISOString().slice(0, 10)
        if (state.lastAttendanceDate === today) return 0

        const todayTasks = state.classTasks.filter(t => t.date === today)
        const allCompleted = todayTasks.length > 0 && todayTasks.every(t => t.status === 'completed')

        if (allCompleted) {
          const newStreak = state.fullAttendanceDays + 1
          let bonus = 0
          if (newStreak >= 30) bonus = 1000
          else if (newStreak >= 7) bonus = 200

          set({
            fullAttendanceDays: newStreak,
            lastAttendanceDate: today,
            lastPointsChange: bonus > 0 ? { amount: bonus, reason: `连续全勤${newStreak}天奖励`, time: Date.now() } : state.lastPointsChange
          })
          return bonus
        }
        set({ fullAttendanceDays: 0, lastAttendanceDate: today })
        return 0
      },

      updateMonitorState: (studyMs: number, entMs: number) => {
        const state = get()
        const monitor = state.monitorState
        const now = Date.now()

        let warningCount = monitor.warningCount
        let isPunished = monitor.isPunished
        let pointsChange = state.lastPointsChange

        if (entMs > studyMs && entMs > 2 * 60 * 1000) {
          warningCount += 1
          if (warningCount >= 2 && !isPunished) {
            isPunished = true
            pointsChange = { amount: -50, reason: '检测到长时间娱乐', time: now }
          }
        } else if (studyMs > entMs) {
          warningCount = 0
          isPunished = false
        }

        set({
          monitorState: {
            lastCheckTime: now,
            warningCount,
            entertainmentMs: entMs,
            studyMs,
            isPunished
          },
          lastPointsChange: pointsChange
        })
      },

      setNotification: (setting: Partial<NotificationSetting>) => {
        set(s => ({
          notificationSetting: { ...s.notificationSetting, ...setting }
        }))
      },

      reset: () => set({
        classTasks: [],
        currentTask: null,
        notificationSetting: { enabled: true, remindMinutes: 4 },
        monitorState: { lastCheckTime: 0, warningCount: 0, entertainmentMs: 0, studyMs: 0, isPunished: false },
        fullAttendanceDays: 0,
        lastAttendanceDate: '',
        lastPointsChange: null
      })
    }),
    {
      name: 'class-task-store',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
