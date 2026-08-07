import { create } from 'zustand'
import { useStore } from '@/stores/useStore'
import { persist, createJSONStorage } from 'zustand/middleware'
import { SCHEDULE, getPeriodTime, timeToMinutes, canStartClass, canCheckInClass } from '@/data/schedule'

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

export interface ClassTaskHistory {
  date: string
  tasks: ClassTask[]
  totalReward: number
  totalPenalty: number
  fullAttendance: boolean
}

export interface VerifyRecord {
  taskId: string
  date: string
  subject: string
  photoUrl: string
  aiReview: string
  aiScore: number
  verifiedAt: number
  passed: boolean
}

export interface MonitorHistory {
  date: string
  studyMs: number
  entMs: number
  warningCount: number
  isPunished: boolean
  checkTime: number
}

export interface AbyssRecord {
  date: string
  subject: string
  duration: number
  completed: boolean
  quitReason?: string
  timestamp: number
}

export interface PointsChange {
  amount: number
  reason: string
  time: number
}

export interface NotificationSetting {
  enabled: boolean
  remindMinutes: number
  sound: boolean
  vibration: boolean
}

export interface MonitorState {
  lastCheckTime: number
  warningCount: number
  entertainmentMs: number
  studyMs: number
  isPunished: boolean
}

interface ClassTaskState {
  classTasks: ClassTask[]
  currentTask: ClassTask | null
  notificationSetting: NotificationSetting
  monitorState: MonitorState
  fullAttendanceDays: number
  lastAttendanceDate: string
  lastPointsChange: PointsChange | null

  // 历史记录
  taskHistory: ClassTaskHistory[]
  verifyHistory: VerifyRecord[]
  monitorHistory: MonitorHistory[]
  abyssRecords: AbyssRecord[]

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
  addVerifyRecord: (record: Omit<VerifyRecord, 'verifiedAt'>) => void
  addMonitorHistory: (record: MonitorHistory) => void
  addAbyssRecord: (record: AbyssRecord) => void
  getTaskHistory: (date?: string) => ClassTaskHistory | undefined
  getVerifyHistory: (taskId?: string) => VerifyRecord[]
  getMonitorHistory: (date?: string) => MonitorHistory | undefined
  reset: () => void
}

export const useClassTaskStore = create<ClassTaskState>()(
  persist(
    (set, get) => ({
      classTasks: [],
      currentTask: null,
      notificationSetting: { enabled: true, remindMinutes: 4, sound: true, vibration: true },
      monitorState: { lastCheckTime: 0, warningCount: 0, entertainmentMs: 0, studyMs: 0, isPunished: false },
      fullAttendanceDays: 0,
      lastAttendanceDate: '',
      lastPointsChange: null,
      taskHistory: [],
      verifyHistory: [],
      monitorHistory: [],

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
        const task = get().classTasks.find(t => t.id === taskId)
        if (!task) return
        const { can, reason } = canStartClass(task.period)
        if (!can) {
          get().addPointsWithToast(0, reason || '无法开始')
          return
        }
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

        // XP 奖励：打卡 +50，AI 评分 >=90 额外 +30
        let xpGain = 50
        if (aiScore && aiScore >= 90) xpGain += 30

        const totalReward = task.baseReward + bonus
        const completedTask: ClassTask = {
          ...task,
          status: 'completed',
          endTime: now,
          photoUrl,
          aiReview,
          aiScore,
          bonusReward: bonus
        }

        const newTasks = state.classTasks.map(t => t.id === taskId ? completedTask : t)

        // 更新今日历史
        const today = task.date
        const todayTasks = newTasks.filter(t => t.date === today)
        const totalR = todayTasks.reduce((sum, t) => sum + (t.status === 'completed' ? t.baseReward + t.bonusReward : 0), 0)
        const totalP = todayTasks.reduce((sum, t) => sum + (t.status === 'overdue' || t.status === 'absent' ? t.penalty : 0), 0)
        const allDone = todayTasks.length > 0 && todayTasks.every(t => t.status === 'completed')

        const newHistory: ClassTaskHistory = {
          date: today,
          tasks: todayTasks,
          totalReward: totalR,
          totalPenalty: totalP,
          fullAttendance: allDone
        }

        const otherHistory = state.taskHistory.filter(h => h.date !== today)

        set({
          classTasks: newTasks,
          currentTask: null,
          lastPointsChange: { amount: totalReward, reason: `完成${task.subject}课`, time: now },
          taskHistory: [...otherHistory, newHistory]
        })

        // XP 跨 store 更新
        useStore.getState().addXp(xpGain)

        return totalReward
      },

      markTaskOverdue: (taskId: string) => {
        const state = get()
        const task = state.classTasks.find(t => t.id === taskId)
        if (!task || task.status !== 'pending') return 0
        set({
          classTasks: state.classTasks.map(t => t.id === taskId ? { ...t, status: 'overdue' as const } : t),
          lastPointsChange: { amount: -task.penalty, reason: `${task.subject}课未按时完成`, time: Date.now() }
        })
        return -task.penalty
      },

      markTaskAbsent: (taskId: string) => {
        const state = get()
        const task = state.classTasks.find(t => t.id === taskId)
        if (!task) return 0
        set({
          classTasks: state.classTasks.map(t => t.id === taskId ? { ...t, status: 'absent' as const } : t),
          lastPointsChange: { amount: -task.penalty, reason: `${task.subject}课缺课`, time: Date.now() }
        })
        return -task.penalty
      },

      addPointsWithToast: (amount: number, reason: string) => {
        set({ lastPointsChange: { amount, reason, time: Date.now() } })
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

        const today = new Date().toISOString().slice(0, 10)
        const newMonitor: MonitorState = {
          lastCheckTime: now,
          warningCount,
          entertainmentMs: entMs,
          studyMs,
          isPunished
        }

        // 保存监测历史
        const otherMonitor = state.monitorHistory.filter(m => m.date !== today)
        const monitorRecord: MonitorHistory = {
          date: today,
          studyMs,
          entMs,
          warningCount,
          isPunished,
          checkTime: now
        }

        set({
          monitorState: newMonitor,
          lastPointsChange: pointsChange,
          monitorHistory: [...otherMonitor, monitorRecord]
        })
      },

      setNotification: (setting: Partial<NotificationSetting>) => {
        set(s => ({ notificationSetting: { ...s.notificationSetting, ...setting } }))
      },

      addVerifyRecord: (record) => {
        const fullRecord: VerifyRecord = { ...record, verifiedAt: Date.now() }
        set(s => ({ verifyHistory: [...s.verifyHistory, fullRecord] }))
      },

      addMonitorHistory: (record) => {
        set(s => {
          const filtered = s.monitorHistory.filter(m => m.date !== record.date)
          return { monitorHistory: [...filtered, record] }
        })
      },

      getTaskHistory: (date) => {
        const d = date || new Date().toISOString().slice(0, 10)
        return get().taskHistory.find(h => h.date === d)
      },

      getVerifyHistory: (taskId) => {
        if (taskId) return get().verifyHistory.filter(v => v.taskId === taskId)
        return get().verifyHistory
      },

      getMonitorHistory: (date) => {
        const d = date || new Date().toISOString().slice(0, 10)
        return get().monitorHistory.find(m => m.date === d)
      },

      reset: () => set({
        classTasks: [],
        currentTask: null,
        notificationSetting: { enabled: true, remindMinutes: 4, sound: true, vibration: true },
        monitorState: { lastCheckTime: 0, warningCount: 0, entertainmentMs: 0, studyMs: 0, isPunished: false },
        fullAttendanceDays: 0,
        lastAttendanceDate: '',
        lastPointsChange: null,
        taskHistory: [],
        verifyHistory: [],
        monitorHistory: []
      })
    }),
    {
      name: 'class-task-store',
      storage: createJSONStorage(() => localStorage)
    }
  )
)