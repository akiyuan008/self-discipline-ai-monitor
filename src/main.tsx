import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as CapApp } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import './styles/index.css'
import App from '@/App'
import { autoBackup, startAutoBackup } from '@/lib/backup'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { useStore } from '@/stores/useStore'
import { fetchUsageStats } from '@/lib/usageStats'
import { SCHEDULE, getPeriodTime, timeToMinutes } from '@/data/schedule'

CapApp.addListener('pause', () => { autoBackup().catch(() => {}) })
startAutoBackup()

let monitorInterval: ReturnType<typeof setInterval> | null = null
let overdueInterval: ReturnType<typeof setInterval> | null = null

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
    console.warn('[Notify] cancel failed', e)
  }

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

    // 使用唯一ID避免冲突: 日期+节次
    const notifyId = parseInt(`${now.getDate()}${s.period}`)

    notifications.push({
      title: '⏰ 即将上课',
      body: `${s.subject} 还有4分钟开始（${period.startTime}），请做好准备`,
      id: notifyId,
      schedule: { at: remindDate, allowWhileIdle: true },
      sound: 'default',
      smallIcon: 'ic_notification',
      attachments: []
    })
  }

  if (notifications.length > 0) {
    try {
      await LocalNotifications.schedule({ notifications })
      console.log('[Notify] scheduled', notifications.length, 'notifications')
    } catch (e) {
      console.warn('[Notify] schedule failed', e)
    }
  }
}

function generateTodayTasks() {
  const store = useClassTaskStore.getState()
  const today = new Date().toISOString().slice(0, 10)
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

    classStore.updateMonitorState(studyMs, entMs)
    mainStore.syncUsage(study, ent)

    const monitor = classStore.monitorState
    if (monitor.isPunished && monitor.warningCount >= 2) {
      const lastChange = mainStore.lastPointsChange
      const alreadyPunished = lastChange &&
        lastChange.reason === '检测到长时间娱乐' &&
        (Date.now() - lastChange.time < 10 * 60 * 1000)
      if (!alreadyPunished) {
        mainStore.addPoints(-50)
        mainStore.addPointRecord('spend', 50, '检测到长时间娱乐')
      }
    }
  } catch (e) {
    console.warn('[Monitor] usage stats failed', e)
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
    if (nowMin > endMin) {
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
  }
}

function startScheduler() {
  generateTodayTasks()
  scheduleClassNotifications()

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
    setInterval(checkFullAttendance, 24 * 60 * 60 * 1000)
  }, msUntilCheck)
}

startScheduler()

CapApp.addListener('resume', () => {
  generateTodayTasks()
  scheduleClassNotifications()
  checkOverdue()
  checkFullAttendance()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)