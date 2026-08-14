/**
 * src/core/discipline/scheduleToMissions.ts
 * 固定课表 → Mission 生成器（source: SCHEDULE）。
 * 动态 Mission（USER/AI）由用户/AI 通过 createMission 创建，最终都进入同一个 Mission 系统。
 */
import { SCHEDULE, getPeriodTime } from '@/data/schedule'
import { useMissionStore } from './missionStore'
import { localDateStr } from '@/lib/dateUtils'
import type { Mission } from './types'

/**
 * 为今天生成 SCHEDULE Missions（幂等：已生成过则跳过）。
 * @returns 今天的 Missions
 */
export function generateTodayMissions(): Mission[] {
  const store = useMissionStore.getState()
  const today = localDateStr()
  const existing = store.getMissionsByDate(today)
  const hasScheduleMission = existing.some(m => m.source === 'SCHEDULE')
  if (hasScheduleMission) return existing

  const dayOfWeek = new Date().getDay()
  const todayClasses = SCHEDULE.filter(s => s.dayOfWeek === dayOfWeek)
  const created: Mission[] = []

  for (const cls of todayClasses) {
    const period = getPeriodTime(cls.period)
    if (!period) continue
    const [sh, sm] = period.startTime.split(':').map(Number)
    const [eh, em] = period.endTime.split(':').map(Number)
    const base = new Date()
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), sh, sm).getTime()
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), eh, em).getTime()
    const targetMinutes = Math.max(1, Math.round((end - start) / 60_000))

    const mission = store.createMission({
      title: `${cls.subject} · 第${cls.period}节`,
      subject: cls.subject,
      source: 'SCHEDULE',
      createdBy: 'SYSTEM',
      plannedStart: start,
      plannedEnd: end,
      targetMinutes,
      // Phase 9：课程完成需拍照核验证据（OUTCOME），Evidence 为统一 SoT
      requiresEvidence: true
    })
    created.push(mission)
  }
  return store.getMissionsByDate(today)
}

/** 获取当前"应该做"的 Mission（READY 且窗口已到/进行中，按 plannedStart 排序取第一个） */
export function pickCurrentMission(): Mission | undefined {
  const store = useMissionStore.getState()
  const today = localDateStr()
  const now = Date.now()
  const missions = store.getMissionsByDate(today)
  return missions
    .filter(m => m.status === 'READY' || m.status === 'FOCUSING' || m.status === 'DISTRACTED' || m.status === 'RECOVERING' || m.status === 'INTERVENTION')
    .filter(m => m.plannedStart <= now + 15 * 60_000) // 提前 15 分钟可开始
    .sort((a, b) => a.plannedStart - b.plannedStart)[0]
}
