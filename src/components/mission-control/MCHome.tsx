/**
 * src/components/mission-control/MCHome.tsx
 * Future Industrial Mission Control — Home。
 * 不是深色 Dashboard，是真实存在的未来工业任务控制终端。
 *
 * 信息层级：SYSTEM STATUS → PRIMARY MISSION → DAILY OPERATIONS
 */
import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { App } from '@capacitor/app'
import { fetchUsageStats, hasUsageAccess, fmtMs, isLateNight, openUsageAccessSettings } from '@/lib/usageStats'
import { logger } from '@/lib/logger'
import Icon from '@/components/Icons'
import type { PageId } from '@/stores/useStore'
import { useMissionStore, startMission, buildUnifiedMissionView, useDayPlanStore, useSessionStore } from '@/core/discipline'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { localDateStr } from '@/lib/dateUtils'
import {
  MCPage, MCModule, MCInner, MCSection, MCStatus, MCProgress,
  MCDataRow, MCButton, MCMissionRow
} from '@/components/mission-control'

interface Props { onNavigate?: (p: PageId) => void }

function fmtClock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

export default function MCHome({ onNavigate }: Props) {
  const points = useStore(s => s.points)
  const streak = useStore(s => s.streak)
  const dailyGoalMin = useStore(s => s.dailyGoalMin)
  const playerTag = useStore(s => s.playerTag)
  const todayStudyMs = useStore(s => s.todayStudyMs)
  const todayEntMs = useStore(s => s.todayEntMs)
  const level = useStore(s => s.level)

  const missions = useMissionStore(s => s.missions)
  const currentMissionId = useMissionStore(s => s.currentMissionId)
  const dayPlan = useDayPlanStore(s => s.dayPlans.find(p => p.date === localDateStr()))
  const classTasks = useClassTaskStore(s => s.classTasks)
  const sessions = useSessionStore(s => s.sessions)
  const currentMission = missions.find(m => m.id === currentMissionId)

  const today = localDateStr()
  const todayClassTasks = classTasks.filter(t => t.date === today).map(t => ({
    id: t.id, period: t.period, date: t.date, subject: t.subject, status: t.status
  }))
  const todayViews = buildUnifiedMissionView({
    date: today, missions, courseTasks: todayClassTasks, sessions, dayPlan
  })

  const [hasAccess, setHasAccess] = useState(false)
  const [lateAlert, setLateAlert] = useState(false)
  const [dismissPermission, setDismissPermission] = useState(false)
  const [clock, setClock] = useState(fmtTime())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = async () => {
    try {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const stats = await fetchUsageStats(startOfDay.getTime(), now.getTime())
      useStore.getState().syncUsage(stats.study, stats.ent)
    } catch (e) { logger.warn('home', 'refresh usage stats failed', { error: String(e) }) }
  }
  const checkAndRefresh = async () => {
    try { setHasAccess(await hasUsageAccess()) } catch { setHasAccess(false) }
    refresh()
  }

  useEffect(() => {
    checkAndRefresh()
    if (isLateNight()) setLateAlert(true)
    const sub = App.addListener('resume', () => { checkAndRefresh() })
    return () => { sub.then(s => s.remove()) }
  }, [])
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(refresh, 30000)
    const clockTimer = setInterval(() => setClock(fmtTime()), 1000)
    return () => { if (pollRef.current) clearInterval(pollRef.current); clearInterval(clockTimer) }
  }, [])

  const studyPct = dailyGoalMin > 0 ? Math.min(100, Math.round((todayStudyMs / (dailyGoalMin * 60000)) * 100)) : 0
  const handleOpenPermissionSettings = async () => {
    try { showToast('正在打开系统权限设置页…'); await openUsageAccessSettings() }
    catch { showToast('请在系统设置中找到使用情况访问权限并开启') }
  }

  const doneCount = todayViews.filter(v => v.viewStatus === 'COMPLETED').length
  const activeCount = todayViews.filter(v => ['EXECUTING', 'FOCUSING'].includes(v.viewStatus)).length
  const upcomingCount = todayViews.filter(v => ['PLANNED', 'COMMITTED', 'READY'].includes(v.viewStatus)).length

  return (
    <MCPage>
      {/* ═══ 系统终端标题 ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 3, textTransform: 'uppercase' }}>
            MISSION CONTROL SYSTEM
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
            {playerTag}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mc-mono" style={{ fontSize: 13, color: 'var(--status-normal)', fontWeight: 600, letterSpacing: 1 }}>
            {clock}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2 }}>
            <span className="mc-status-dot" style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'var(--status-success)', marginRight: 4, verticalAlign: 'middle' }} />
            SYSTEM ONLINE
          </div>
        </div>
      </div>

      {/* 权限告警（非卡片，内嵌） */}
      {!hasAccess && !dismissPermission && (
        <div className="mc-module" style={{ marginBottom: 14, borderColor: 'var(--status-deviation)', cursor: 'pointer' }} onClick={handleOpenPermissionSettings}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--status-deviation)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon.Warning size={13} color="var(--status-deviation)" /> USAGE ACCESS OFFLINE
            </span>
            <button onClick={(e) => { e.stopPropagation(); setDismissPermission(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}>
              <Icon.Close size={12} color="var(--text-secondary)" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ PRIMARY MISSION ═══ */}
      <MCSection title="PRIMARY MISSION" right={currentMission ? undefined : 'STANDBY'} />
      <MCModule style={{ marginBottom: 16 }}>
        {currentMission ? (
          <div>
            {/* 任务标题行 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{currentMission.title}</div>
                <div className="mc-mono" style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {fmtClock(currentMission.plannedStart)}–{fmtClock(currentMission.plannedEnd)} · TARGET {currentMission.targetMinutes}MIN{currentMission.requiresEvidence ? ' · EVIDENCE REQUIRED' : ''}
                </div>
              </div>
              <MCStatus status={currentMission.status} />
            </div>

            {/* 进度 */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 1 }}>EXECUTION</span>
                <span className="mc-mono" style={{ fontSize: 10, color: 'var(--status-normal)' }}>
                  {Math.floor(currentMission.actualStudyMs / 60000)}/{currentMission.targetMinutes}MIN
                </span>
              </div>
              <MCProgress pct={Math.min(100, (currentMission.actualStudyMs / (currentMission.targetMinutes * 60000)) * 100)} />
            </div>

            {/* 操作 */}
            {currentMission.status === 'READY' && (
              <MCButton variant="primary" onClick={() => startMission(currentMission.id)}>
                <Icon.Play size={14} color="var(--surface-0)" /> INITIATE FOCUS
              </MCButton>
            )}
            {currentMission.status === 'FOCUSING' && (
              <MCButton onClick={() => onNavigate?.('dungeon')}>ENTER FOCUS WORKSPACE</MCButton>
            )}
            {(currentMission.status === 'DISTRACTED' || currentMission.status === 'INTERVENTION') && (
              <MCButton onClick={() => onNavigate?.('dungeon')} style={{ borderColor: 'var(--status-deviation)', color: 'var(--status-deviation)' }}>
                DEVIATION DETECTED · RETURN
              </MCButton>
            )}
            {currentMission.status === 'RECOVERING' && (
              <div style={{ fontSize: 11, color: 'var(--status-warning)', textAlign: 'center', padding: '6px 0', letterSpacing: 1 }}>RECOVERY IN PROGRESS</div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '6px 0' }}>
            NO ACTIVE MISSION · STANDBY MODE
          </div>
        )}
      </MCModule>

      {/* ═══ SYSTEM TELEMETRY ═══ */}
      <MCSection title="SYSTEM TELEMETRY" right={`${studyPct}% GOAL`} />
      <MCModule style={{ marginBottom: 16 }}>
        <MCDataRow label="FOCUS" value={fmtMs(todayStudyMs)} color="var(--status-normal)" />
        <MCDataRow label="ENTERTAIN" value={fmtMs(todayEntMs)} color={todayEntMs < 300000 ? 'var(--text-primary)' : 'var(--status-warning)'} />
        <MCDataRow label="GOAL" value={fmtMs(todayStudyMs)} unit={`/ ${dailyGoalMin}MIN`} />
        <MCDataRow label="LEVEL" value={level} />
        <MCDataRow label="CREDITS" value={points} color="var(--status-warning)" />
        <MCDataRow label="STREAK" value={streak} unit="D" color="var(--status-success)" />
        <div style={{ marginTop: 8 }}>
          <MCProgress pct={studyPct} color="var(--status-normal)" />
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-secondary)' }}>
            <span>USAGE ACCESS</span><span className="mc-mono" style={{ color: hasAccess ? 'var(--status-success)' : 'var(--status-deviation)' }}>[{hasAccess ? 'ONLINE' : 'OFFLINE'}]</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-secondary)' }}>
            <span>LATE NIGHT</span><span className="mc-mono" style={{ color: lateAlert ? 'var(--status-warning)' : 'var(--status-success)' }}>[{lateAlert ? 'ALERT' : 'NOMINAL'}]</span>
          </div>
        </div>
      </MCModule>

      {/* ═══ DAILY OPERATIONS ═══ */}
      <MCSection title="DAILY OPERATIONS" right={`${doneCount}/${todayViews.length} DONE`} />
      <div style={{ marginBottom: 16 }}>
        {todayViews.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '12px 0', textAlign: 'center' }}>NO OPERATIONS SCHEDULED</div>
        ) : (
          todayViews.map(v => (
            <MCMissionRow
              key={v.id}
              title={v.title}
              subtitle={`${fmtClock(v.plannedStart)}–${fmtClock(v.plannedEnd)} · ${v.targetMinutes}MIN`}
              status={v.viewStatus}
              progress={v.executionRate > 0 ? v.executionRate * 100 : undefined}
              onClick={() => onNavigate?.('quests')}
            />
          ))
        )}
      </div>
    </MCPage>
  )
}
