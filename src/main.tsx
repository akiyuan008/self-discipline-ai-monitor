import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as CapApp } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import './styles/index.css'
import App from '@/App'
import { autoBackup, startAutoBackup } from '@/lib/backup'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { useStore } from '@/stores/useStore'
import { fetchUsageStats, startMonitorService, hasUsageAccess } from '@/lib/usageStats'
import { SCHEDULE, getPeriodTime, timeToMinutes } from '@/data/schedule'
import { logger, installGlobalErrorHandlers } from '@/lib/logger'
import { localDateStr, yesterdayDateStr } from '@/lib/dateUtils'
import { initDiscipline, generateTodayMissions, recordMonitorCommitmentBreak } from '@/core/discipline'

CapApp.addListener('pause', () => { autoBackup().catch(() => {}) })
startAutoBackup()
installGlobalErrorHandlers()

let monitorInterval: ReturnType<typeof setInterval> | null = null
let overdueInterval: ReturnType<typeof setInterval> | null = null
let fullAttendanceInterval: ReturnType<typeof setInterval> | null = null

async function requestNotificationPermission() {
  try {
    const result = await LocalNotifications.requestPermissions()
    return result.display === 'granted'
  } catch { return false }
}

function getTodaySchedule() {
  const dayOfWeek = new Date().getDay()
  return SCHEDULE.filter(s => s.dayOfWeek === dayOfWeek)
}

// ── 学习经验增量发放：记录今日已发放经验对应的学习分钟数，避免重复累加 ──
const STUDY_EXP_KEY = 'study-exp-granted'

function getGrantedStudyMinutes(): number {
  try {
    const raw = localStorage.getItem(STUDY_EXP_KEY)
    if (!raw) return 0
    const obj = JSON.parse(raw)
    const today = localDateStr()
    return obj.date === today ? (obj.minutes || 0) : 0
  } catch { return 0 }
}

function setGrantedStudyMinutes(minutes: number) {
  try {
    localStorage.setItem(STUDY_EXP_KEY, JSON.stringify({
      date: localDateStr(),
      minutes
    }))
  } catch { /* ignore */ }
}

async function scheduleClassNotifications() {
  const granted = await requestNotificationPermission()
  if (!granted) return

  const todaySchedule = getTodaySchedule()
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  // 清除所有旧通知
  try {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending)
    }
  } catch (e) {
    logger.warn('notify', '清除旧通知失败', { error: String(e) })
  }

  const notifSetting = useClassTaskStore.getState().notificationSetting
  const notifications: any[] = []

  for (const s of todaySchedule) {
    const period = getPeriodTime(s.period)
    if (!period) continue

    const startMin = timeToMinutes(period.startTime)
    const remindMin = startMin - 4

    // 只设置未来时间的通知
    if (remindMin <= nowMin) continue

    const remindDate = new Date()
    remindDate.setHours(Math.floor(remindMin / 60), remindMin % 60, 0, 0)

    // 使用唯一ID避免冲突: 月份*10000+日期*100+节次
    const notifyId = (now.getMonth() + 1) * 10000 + now.getDate() * 100 + s.period

    notifications.push({
      title: '⏰ 即将上课',
      body: `${s.subject} 还有4分钟开始（${period.startTime}），请做好准备`,
      id: notifyId,
      schedule: { at: remindDate, allowWhileIdle: true },
      sound: notifSetting.sound ? 'default' : undefined,
      attachments: []
    })
  }

  if (notifications.length > 0) {
    try {
      await LocalNotifications.schedule({ notifications })
      logger.info('notify', `已安排 ${notifications.length} 条课程提醒`, { ids: notifications.map(n => n.id) })
    } catch (e) {
      logger.error('notify', '课程提醒安排失败', { error: String(e) })
    }
  }
}

function generateTodayTasks() {
  const store = useClassTaskStore.getState()
  const today = localDateStr()
  const hasTodayTasks = store.classTasks.some(t => t.date === today)
  if (!hasTodayTasks) store.generateTodayTasks()
}

async function monitorUsage() {
  const classStore = useClassTaskStore.getState()
  const mainStore = useStore.getState()

  const now = Date.now()
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  try {
    const { study, ent } = await fetchUsageStats(start.getTime(), now)
    const studyMs = study.reduce((sum, x) => sum + x.totalMs, 0)
    const entMs = ent.reduce((sum, x) => sum + x.totalMs, 0)

    const justPunished = classStore.updateMonitorState(studyMs, entMs)
    mainStore.syncUsage(study, ent)

    // 学习奖励经验值：只发放增量（避免每次轮询把累计时长重复计入）
    const studyMinutes = Math.floor(studyMs / 60000)
    const grantedMinutes = getGrantedStudyMinutes()
    if (studyMinutes > grantedMinutes) {
      const incrementMin = studyMinutes - grantedMinutes
      mainStore.addExp(incrementMin, '专注学习')
      // 增量学习时长计入总专注时长(解决学习时长成就只算深渊的问题)
      mainStore.addStudyMs(incrementMin * 60000)
      setGrantedStudyMinutes(studyMinutes)
    }

    // Phase 7：移除"-50 扣分"。entertainment>study 进入 punished 时，
    // 只记录 CommitmentBreak 事实（不扣 PTS，Recovery > Punishment）。
    if (justPunished) {
      recordMonitorCommitmentBreak('检测到长时间娱乐（娱乐时长超过学习时长）')
    }
  } catch (e) {
    logger.error('monitor', '使用统计拉取失败', { error: String(e) })
  }
}

function checkOverdue() {
  const store = useClassTaskStore.getState()
  const mainStore = useStore.getState()
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  store.classTasks.forEach(task => {
    if (task.status !== 'pending') return
    const period = getPeriodTime(task.period)
    if (!period) return
    const endMin = timeToMinutes(period.endTime)
    // 与打卡宽限期一致：课后30分钟内仍可打卡，逾期判定也用 endMin+30
    if (nowMin > endMin + 30) {
      const penalty = store.markTaskOverdue(task.id)
      if (penalty < 0) {
        mainStore.addPoints(penalty)
        mainStore.addPointRecord('spend', Math.abs(penalty), `${task.subject}课逾期`)
      }
    }
  })
}

function checkFullAttendance() {
  const store = useClassTaskStore.getState()
  const mainStore = useStore.getState()
  const bonus = store.checkFullAttendance()
  if (bonus > 0) {
    mainStore.addPoints(bonus)
    mainStore.addPointRecord('earn', bonus, `连续全勤奖励`)
    mainStore.addExp(100, '全勤奖励')
  }
}

function startScheduler() {
  // 连签结算：检测跨天，更新 streak
  useStore.getState().dailySettle()
  generateTodayTasks()
  scheduleClassNotifications()

  // 自律核心：生成今日 Missions + 启动采样/干预/错过扫描（第三阶段接入）
  initDiscipline()

  // 权限就绪后启动监工前台服务（后台持续监测）
  hasUsageAccess().then(granted => {
    if (granted) startMonitorService()
  }).catch(() => {})

  if (monitorInterval) clearInterval(monitorInterval)
  monitorInterval = setInterval(monitorUsage, 5 * 60 * 1000)
  monitorUsage()

  if (overdueInterval) clearInterval(overdueInterval)
  overdueInterval = setInterval(checkOverdue, 60 * 1000)
  checkOverdue()

  const now = new Date()
  const checkTime = new Date()
  checkTime.setHours(23, 50, 0, 0)
  if (checkTime <= now) checkTime.setDate(checkTime.getDate() + 1)
  const msUntilCheck = checkTime.getTime() - now.getTime()
  setTimeout(() => {
    checkFullAttendance()
    if (fullAttendanceInterval) clearInterval(fullAttendanceInterval)
    fullAttendanceInterval = setInterval(checkFullAttendance, 24 * 60 * 60 * 1000)
  }, msUntilCheck)
}

startScheduler()

CapApp.addListener('resume', () => {
  useStore.getState().dailySettle()
  generateTodayTasks()
  generateTodayMissions()
  scheduleClassNotifications()
  checkOverdue()
  checkFullAttendance()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)