/**
 * src/core/discipline/runtime.ts
 * Discipline 运行时 —— 初始化核心、产 BehaviorEvent、接线干预。
 * 由 main.tsx 调用 initDiscipline() 启动。
 */
import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { useMissionStore } from './missionStore'
import { generateTodayMissions, pickCurrentMission } from './scheduleToMissions'
import {
  handleEvent, setInterventionHandlers, scanMissedMissions, tryComplete
} from './disciplineEngine'
import { aiSupervise } from './aiSupervisor'
import { ensureDayPlan, finalizeDailyReview } from './reviewService'
import { migrateCourseVerifications, migrateLegacyCourseRewards, migrateCourseCompletionStatus } from './courseMigration'
import { useReviewStore } from './reviewStore'
import { localDateStr, yesterdayDateStr } from '@/lib/dateUtils'
import { fetchUsageStats } from '@/lib/usageStats'
import { classifyApp } from './appCategories'
import { logger } from '@/lib/logger'
import type { Mission } from './types'

/** 原生自律插件（Android MonitorService 通过它回传 BehaviorEvent / 接收镜像同步） */
const SelfDiscipline = registerPlugin<any>('SelfDiscipline')

let sampleTimer: ReturnType<typeof setInterval> | null = null
let missedTimer: ReturnType<typeof setInterval> | null = null
let lastSampleTs = 0

/** 订阅原生 MonitorService 产出的 BehaviorEvent（APP_FOREGROUND），喂给 DisciplineEngine */
function subscribeNativeBehaviorEvents() {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    void SelfDiscipline.addListener('behaviorEvent', (event: any) => {
      if (!event || !event.type) return
      handleEvent({
        type: event.type,
        ts: typeof event.ts === 'number' ? event.ts : Date.now(),
        packageName: event.packageName,
        appCategory: event.appCategory
      })
    })
    logger.info('discipline', '已订阅原生 BehaviorEvent')
  } catch (e) {
    logger.warn('discipline', '订阅原生 BehaviorEvent 失败', { error: String(e) })
  }
}

/** 采样窗口：从当前 Mission 开始（或上次采样）到当前 */
async function sampleUsageForCurrentMission() {
  const store = useMissionStore.getState()
  const m = store.getCurrentMission()
  if (!m) return
  // 只对"已开始且未结束"的激活任务采样：READY/IDLE 未开始不计，COMPLETED/MISSED 已结束不计
  const ACTIVE: string[] = ['FOCUSING', 'RECOVERING', 'DISTRACTED', 'INTERVENTION']
  if (!ACTIVE.includes(m.status)) return

  const now = Date.now()
  const windowStart = Math.max(m.startedAt ?? m.plannedStart, lastSampleTs || m.startedAt || m.plannedStart)
  if (now <= windowStart) return

  try {
    const { study, ent } = await fetchUsageStats(windowStart, now)
    const windowLen = Math.max(1, now - windowStart)
    // 学习时长收敛到窗口内（防止聚合/mock 数据超出窗口）
    const studyMs = Math.min(study.reduce((s, x) => s + x.totalMs, 0), windowLen)
    // 分心 = 娱乐 + 社交（同样收敛到窗口剩余部分）
    const distractionMs = Math.min(
      ent
        .filter(x => {
          const cat = classifyApp(x.packageName, x.label)
          return cat === 'entertainment' || cat === 'social'
        })
        .reduce((s, x) => s + x.totalMs, 0),
      windowLen - studyMs
    )

    lastSampleTs = now
    handleEvent({ type: 'USAGE_SAMPLE', ts: now, windowStart, studyMs, distractionMs })
  } catch (e) {
    logger.warn('discipline', 'UsageStats 采样失败', { error: String(e) })
  }
}

/** 前台 App 变化时产 APP_FOREGROUND 事件（这里用轮询兜底检测） */
let lastForegroundPkg = ''
async function detectForegroundApp() {
  const m = useMissionStore.getState().getCurrentMission()
  if (!m || m.status === 'COMPLETED' || m.status === 'MISSED') return
  try {
    const now = Date.now()
    const { study, ent } = await fetchUsageStats(now - 60_000, now)
    const all = [...study, ...ent].sort((a, b) => b.totalMs - a.totalMs)
    const top = all[0]
    if (top && top.packageName !== lastForegroundPkg) {
      lastForegroundPkg = top.packageName
      handleEvent({
        type: 'APP_FOREGROUND',
        ts: now,
        packageName: top.packageName,
        appCategory: classifyApp(top.packageName, top.label)
      })
    }
  } catch { /* ignore */ }
}

/** 干预回调：通知 + 锁屏遮罩（分级，Recovery > Punishment） */
async function notifyLevel1(m: Mission) {
  try {
    await LocalNotifications.schedule({
      notifications: [{
        title: 'MOSS · 回到任务',
        body: `现在应该${m.subject ? '学习' + m.subject : '专注'}：${m.title}`,
        id: Date.now() % 100000,
        schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true }
      }]
    })
  } catch { /* ignore */ }
}

async function lockOverlay(m: Mission, level: number) {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    // LEVEL2: 短遮罩(可恢复)；LEVEL3: 更长恢复模式
    const minutes = level >= 3 ? 5 : 1
    await SelfDiscipline.lockScreen({
      minutes,
      text: level >= 3 ? '进入恢复模式，回到你的任务' : '现在是学习时间，回来继续'
    })
  } catch (e) {
    logger.warn('discipline', '锁屏遮罩失败', { error: String(e) })
  }
}

function wireInterventionHandlers() {
  setInterventionHandlers({
    onLevel1: (m) => { void notifyLevel1(m) },
    onLevel2: (m) => { void lockOverlay(m, 2); void notifyAiSupervision(m, 'DISTRACTED') },
    onLevel3: (m) => { void lockOverlay(m, 3); void notifyAiSupervision(m, 'DISTRACTED') },
    onCompleted: (m, points) => {
      logger.info('discipline', `任务完成 ${m.title} +${points}`)
    },
    onMissed: (m) => {
      logger.info('discipline', `任务错过 ${m.title}`)
      void notifyAiSupervision(m, 'AT_RISK')
    },
    onRecovered: (m, points) => { void notifyRecovered(m, points) }
  })
}

/** Recovery 正向反馈：把"回来了"的肯定以通知送达（强化回归行为） */
async function notifyRecovered(m: Mission, points: number) {
  try {
    await LocalNotifications.schedule({
      notifications: [{
        title: 'MOSS · 恢复专注',
        body: `很好，你回到了「${m.title}」。+${points} PTS`,
        id: (Date.now() % 100000) + 2,
        schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true }
      }]
    })
  } catch { /* ignore */ }
}

/** AI 监督：干预升级/任务错过时，把 MOSS 的一句监督话语以通知送达 */
async function notifyAiSupervision(m: Mission, reason: 'DISTRACTED' | 'AT_RISK') {
  try {
    const r = await aiSupervise(m, reason)
    if (!r?.message) return
    await LocalNotifications.schedule({
      notifications: [{
        title: 'MOSS · 监督',
        body: r.message,
        id: (Date.now() % 100000) + 1,
        schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true }
      }]
    })
  } catch { /* AI 监督失败不阻断干预 */ }
}

/** 初始化自律核心（main.tsx 调用） */
export function initDiscipline() {
  // 1. 生成今日 Missions
  generateTodayMissions()

  // 1.5 DayPlan / DailyReview（Phase 6）：
  //     - 跨天：为昨天生成确定性 DailyReview 快照（若尚未生成）
  //     - 当日：确保 DayPlan 存在并与今日 Mission 同步（默认 PLANNED，需用户 Commitment）
  const yd = yesterdayDateStr()
  if (!useReviewStore.getState().getDailyReviewByDate(yd)) {
    finalizeDailyReview(yd)
  }
  ensureDayPlan(localDateStr())

  // 1.6 Phase 9：幂等迁移旧课程核验记录 → 统一 Evidence（不改完成态）
  migrateCourseVerifications()

  // 1.7 Phase 10A：Legacy 课程奖励 reconciliation（LEGACY_ACCEPTED marker，防三次发放，不改余额）
  //     须在证据迁移之后（aiScore 读既有 Recommendation）
  migrateLegacyCourseRewards()

  // 1.8 Phase 10C：课程完成态 Source of Truth 迁到 Mission.status（不再读 classTask.status）
  migrateCourseCompletionStatus()

  // 2. 接线干预
  wireInterventionHandlers()

  // 2.5 订阅原生 MonitorService 的 BehaviorEvent（APP_FOREGROUND）
  subscribeNativeBehaviorEvents()

  // 3. 自动指向"当前该做的 Mission"（若尚未设置）
  const store = useMissionStore.getState()
  if (!store.getCurrentMission()) {
    const current = pickCurrentMission()
    if (current) store.setCurrentMission(current.id)
  }

  // 4. 采样器：每 60s 产 USAGE_SAMPLE + 检测前台 App
  if (sampleTimer) clearInterval(sampleTimer)
  lastSampleTs = 0
  sampleTimer = setInterval(() => {
    void sampleUsageForCurrentMission()
    // Android 原生 MonitorService 已产 APP_FOREGROUND；仅非 Android（Web 预览）兜底检测
    if (Capacitor.getPlatform() !== 'android') void detectForegroundApp()
    // 采样后若已达标则尝试完成
    const m = useMissionStore.getState().getCurrentMission()
    if (m) tryComplete(m.id)
  }, 60_000)

  // 5. 错过扫描：每 60s
  if (missedTimer) clearInterval(missedTimer)
  missedTimer = setInterval(scanMissedMissions, 60_000)
  scanMissedMissions()

  logger.info('discipline', 'Discipline 核心已初始化', {
    missionsToday: store.getMissionsByDate().length,
    currentMissionId: store.currentMissionId
  })
}
