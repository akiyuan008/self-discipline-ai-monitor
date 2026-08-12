/**
 * src/core/discipline/runtime.ts
 * Discipline 运行时 —— 初始化核心、产 BehaviorEvent、接线干预。
 * 由 main.tsx 调用 initDiscipline() 启动。
 */
import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'
import { useMissionStore } from './missionStore'
import { generateTodayMissions, pickCurrentMission } from './scheduleToMissions'
import {
  handleEvent, setInterventionHandlers, scanMissedMissions, tryComplete
} from './disciplineEngine'
import { fetchUsageStats } from '@/lib/usageStats'
import { classifyApp } from './appCategories'
import { logger } from '@/lib/logger'
import type { Mission } from './types'

let sampleTimer: ReturnType<typeof setInterval> | null = null
let missedTimer: ReturnType<typeof setInterval> | null = null
let lastSampleTs = 0

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
    const studyMs = study.reduce((s, x) => s + x.totalMs, 0)
    // 分心 = 娱乐 + 社交
    const distractionMs = ent
      .filter(x => {
        const cat = classifyApp(x.packageName, x.label)
        return cat === 'entertainment' || cat === 'social'
      })
      .reduce((s, x) => s + x.totalMs, 0)

    lastSampleTs = now
    handleEvent({ type: 'USAGE_SAMPLE', ts: now, studyMs, distractionMs })
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
    const plugin: any = (Capacitor as any).Plugins?.SelfDiscipline
    if (!plugin?.lockScreen) return
    // LEVEL2: 短遮罩(可恢复)；LEVEL3: 更长恢复模式
    const minutes = level >= 3 ? 5 : 1
    await plugin.lockScreen({ minutes, text: level >= 3 ? '进入恢复模式，回到你的任务' : '现在是学习时间，回来继续' })
  } catch (e) {
    logger.warn('discipline', '锁屏遮罩失败', { error: String(e) })
  }
}

function wireInterventionHandlers() {
  setInterventionHandlers({
    onLevel1: (m) => { void notifyLevel1(m) },
    onLevel2: (m) => { void lockOverlay(m, 2) },
    onLevel3: (m) => { void lockOverlay(m, 3) },
    onCompleted: (m, points) => {
      logger.info('discipline', `任务完成 ${m.title} +${points}`)
    },
    onMissed: (m) => {
      logger.info('discipline', `任务错过 ${m.title}`)
    }
  })
}

/** 初始化自律核心（main.tsx 调用） */
export function initDiscipline() {
  // 1. 生成今日 Missions
  generateTodayMissions()

  // 2. 接线干预
  wireInterventionHandlers()

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
    void detectForegroundApp()
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
