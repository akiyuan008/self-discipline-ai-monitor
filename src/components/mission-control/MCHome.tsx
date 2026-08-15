/**
 * src/components/mission-control/MCHome.tsx
 * Mission Control 模式的 Home 页（Phase 2）。
 * 信息层级：TODAY Execution → CURRENT MISSION → TODAY'S MISSIONS → SYSTEM STATUS。
 * 所有状态直接读取现有 Store/Core，不在 UI 层重新计算。
 */
import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { App } from '@capacitor/app'
import { fetchUsageStats, hasUsageAccess, fmtMs, isLateNight, openUsageAccessSettings } from '@/lib/usageStats'
import { logger } from '@/lib/logger'
import GaokaoProgress from '@/components/GaokaoProgress'
import Icon from '@/components/Icons'
import type { PageId } from '@/stores/useStore'
import { useMissionStore, startMission, buildUnifiedMissionView, useDayPlanStore, useSessionStore } from '@/core/discipline'
import type { Mission } from '@/core/discipline'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { localDateStr } from '@/lib/dateUtils'
import {
  MCPage, MCCard, MCSectionHeader, MCStatusBadge, MCProgressBar,
  MCDataBlock, MCButton, MCMissionItem
} from '@/components/mission-control'

interface Props {
  onNavigate?: (p: PageId) => void
}

function fmtClock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function missionPct(m: Mission): number {
  if (m.targetMinutes <= 0) return 0
  return Math.min(100, Math.round((m.actualStudyMs / (m.targetMinutes * 60000)) * 100))
}

const STATUS_LABEL: Record<string, string> = {
  READY: '待开始', FOCUSING: '专注中', DISTRACTED: '已分心',
  INTERVENTION: '干预中', RECOVERING: '恢复中', COMPLETED: '已完成',
  MISSED: '已错过', IDLE: '空闲', PLANNED: '已计划', COMMITTED: '已承诺',
  EXECUTING: '执行中', PARTIAL: '部分完成', ABANDONED: '已放弃'
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
    date: today, missions,
    courseTasks: todayClassTasks, sessions, dayPlan
  })

  const [hasAccess, setHasAccess] = useState(false)
  const [lateAlert, setLateAlert] = useState(false)
  const [dismissPermission, setDismissPermission] = useState(false)
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
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
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
      {/* 顶部标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 2, textTransform: 'uppercase' }}>
            MISSION CONTROL
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)', letterSpacing: 1 }}>
            {playerTag}
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 1 }}>TODAY FOCUS</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--status-focus)', fontFamily: 'var(--font-mc-mono)' }}>
            {studyPct}%
          </div>
        </div>
      </div>

      {/* 权限提示 */}
      {!hasAccess && !dismissPermission && (
        <MCCard style={{ marginBottom: 16, borderColor: 'var(--status-deviation)', cursor: 'pointer' }} onClick={handleOpenPermissionSettings}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--status-deviation)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon.Warning size={15} color="var(--status-deviation)" /> 未授予使用情况访问权限
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>点击开启权限以获取真实时长</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setDismissPermission(true) }} aria-label="关闭"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex' }}>
              <Icon.Close size={14} color="var(--text-secondary)" />
            </button>
          </div>
        </MCCard>
      )}

      {/* ═══ TODAY EXECUTION ═══ */}
      <MCSectionHeader title="TODAY EXECUTION" />
      <MCCard style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <MCDataBlock label="FOCUS TIME" value={fmtMs(todayStudyMs)} color="var(--status-focus)" />
          <MCDataBlock label="ENTERTAINMENT" value={fmtMs(todayEntMs)} color={todayEntMs < 300000 ? 'var(--text-primary)' : 'var(--status-warning)'} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>DAILY GOAL</span>
            <span style={{ fontSize: 10, color: 'var(--status-focus)', fontFamily: 'var(--font-mc-mono)' }}>
              {fmtMs(todayStudyMs)} / {dailyGoalMin}min
            </span>
          </div>
          <MCProgressBar pct={studyPct} />
        </div>
      </MCCard>

      {/* ═══ CURRENT MISSION ═══ */}
      <MCSectionHeader title="CURRENT MISSION" right={currentMission ? <MCStatusBadge status={currentMission.status} label={STATUS_LABEL[currentMission.status]} /> : undefined} />
      <MCCard style={{ marginBottom: 20 }}>
        {currentMission ? (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              {currentMission.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mc-mono)', marginBottom: 12 }}>
              {fmtClock(currentMission.plannedStart)} – {fmtClock(currentMission.plannedEnd)} · 目标 {currentMission.targetMinutes} min
              {currentMission.requiresEvidence ? ' · 需凭证' : ''}
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>PROGRESS</span>
                <span style={{ fontSize: 10, color: 'var(--status-focus)', fontFamily: 'var(--font-mc-mono)' }}>
                  {Math.floor(currentMission.actualStudyMs / 60000)}/{currentMission.targetMinutes} min
                </span>
              </div>
              <MCProgressBar pct={missionPct(currentMission)} />
            </div>

            {currentMission.status === 'READY' && (
              <MCButton variant="primary" onClick={() => startMission(currentMission.id)}>
                <Icon.Play size={16} color="#0a0d12" /> 开始专注
              </MCButton>
            )}
            {currentMission.status === 'FOCUSING' && (
              <MCButton onClick={() => onNavigate?.('dungeon')}>进入专注监控</MCButton>
            )}
            {(currentMission.status === 'DISTRACTED' || currentMission.status === 'INTERVENTION') && (
              <MCButton onClick={() => onNavigate?.('dungeon')} style={{ borderColor: 'var(--status-deviation)', color: 'var(--status-deviation)' }}>
                检测到分心 · 回到任务
              </MCButton>
            )}
            {currentMission.status === 'RECOVERING' && (
              <div style={{ fontSize: 12, color: 'var(--status-warning)', textAlign: 'center', padding: '8px 0' }}>正在恢复专注…</div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 0' }}>
            暂无进行中的任务。课表任务将按时段自动生成，也可在「任务」中动态创建。
          </div>
        )}
      </MCCard>

      {/* ═══ TODAY'S MISSIONS ═══ */}
      <MCSectionHeader title="TODAY'S MISSIONS" right={
        <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mc-mono)' }}>
          {doneCount} 完成 · {activeCount} 进行 · {upcomingCount} 待执行
        </span>
      } />
      <div style={{ marginBottom: 20 }}>
        {todayViews.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>今日暂无任务</div>
        ) : (
          todayViews.map(v => (
            <MCMissionItem
              key={v.id}
              title={v.title}
              subtitle={`${fmtClock(v.plannedStart)}–${fmtClock(v.plannedEnd)} · ${v.targetMinutes}min`}
              status={v.viewStatus}
              statusLabel={STATUS_LABEL[v.viewStatus] || v.viewStatus}
              progress={v.executionRate > 0 ? v.executionRate * 100 : undefined}
              onClick={() => onNavigate?.('quests')}
            />
          ))
        )}
      </div>

      {/* ═══ SYSTEM STATUS ═══ */}
      <MCSectionHeader title="SYSTEM STATUS" />
      <MCCard style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <MCDataBlock label="LEVEL" value={level} />
          <MCDataBlock label="POINTS" value={points} color="var(--status-warning)" />
          <MCDataBlock label="STREAK" value={streak} unit="天" color="var(--status-success)" />
          <MCDataBlock label="ACCESS" value={hasAccess ? 'ON' : 'OFF'} color={hasAccess ? 'var(--status-success)' : 'var(--status-deviation)'} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <StatusRow label="USAGE ACCESS" ok={hasAccess} status={hasAccess ? 'ONLINE' : 'OFFLINE'} onClick={!hasAccess ? handleOpenPermissionSettings : undefined} />
          <StatusRow label="STUDY MODULE" ok={todayStudyMs > 0} status={todayStudyMs > 0 ? 'ACTIVE' : 'STANDBY'} />
          <StatusRow label="ENT MONITOR" ok={todayEntMs < 300000} status={todayEntMs < 300000 ? 'NOMINAL' : 'WARNING'} />
          <StatusRow label="LATE NIGHT" ok={!lateAlert} status={lateAlert ? 'ALERT' : 'NORMAL'} />
        </div>
      </MCCard>

      {/* 高考倒计时 */}
      <GaokaoProgress />
    </MCPage>
  )
}

function StatusRow({ label, status, ok, onClick }: { label: string; status: string; ok: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 11, color: ok ? 'var(--status-success)' : 'var(--status-deviation)', fontFamily: 'var(--font-mc-mono)', fontWeight: ok ? 400 : 700 }}>
        [{status}]
      </span>
    </div>
  )
}
