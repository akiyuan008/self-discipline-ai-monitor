/**
 * src/components/growth/GrHome.tsx
 * Growth Mode Home — 温暖、现代、沉浸的个人成长空间。
 * 信息层级：欢迎回来 → 成长等级/今日进度 → 当前目标 → 今日成长计划 → 成长记录
 * 所有状态直接读取现有 Store/Core，不在 UI 层重新计算。
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

interface Props { onNavigate?: (p: PageId) => void }

function fmtClock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  READY: { label: '待开始', color: 'var(--muted)' },
  FOCUSING: { label: '进行中', color: 'var(--growth-primary)' },
  DISTRACTED: { label: '注意力偏离', color: 'var(--danger)' },
  INTERVENTION: { label: '需要关注', color: 'var(--danger)' },
  RECOVERING: { label: '正在恢复', color: 'var(--warning)' },
  COMPLETED: { label: '已完成', color: 'var(--success)' },
  MISSED: { label: '已错过', color: 'var(--muted)' },
  IDLE: { label: '空闲', color: 'var(--muted)' },
  PLANNED: { label: '已计划', color: 'var(--muted)' },
  COMMITTED: { label: '已承诺', color: 'var(--growth-primary)' },
  EXECUTING: { label: '进行中', color: 'var(--growth-primary)' },
  PARTIAL: { label: '部分完成', color: 'var(--warning)' },
  ABANDONED: { label: '已放弃', color: 'var(--muted)' },
}

export default function GrHome({ onNavigate }: Props) {
  const points = useStore(s => s.points)
  const streak = useStore(s => s.streak)
  const dailyGoalMin = useStore(s => s.dailyGoalMin)
  const playerTag = useStore(s => s.playerTag)
  const todayStudyMs = useStore(s => s.todayStudyMs)
  const level = useStore(s => s.level)
  const totalExp = useStore(s => s.totalExp)

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

  return (
    <div className="gr-page">
      {/* ═══ 欢迎回来 ═══ */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: 'var(--growth-text-secondary)', marginBottom: 4 }}>
          欢迎回来
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--growth-text)' }}>
            {playerTag}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', borderRadius: 20,
            background: 'var(--growth-surface-alt)',
          }}>
            <span style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>Level</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--growth-primary)' }}>
              {level}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ 今日进度 ═══ */}
      <div className="gr-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--growth-text)' }}>今日进度</span>
          <span style={{ fontSize: 12, color: 'var(--growth-text-secondary)' }}>
            {fmtMs(todayStudyMs)} / {dailyGoalMin}分钟
          </span>
        </div>
        <div className="gr-progress">
          <div className="gr-progress-fill" style={{
            width: `${studyPct}%`,
            background: 'linear-gradient(90deg, var(--growth-primary), var(--growth-warm))'
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>
            连续成长 <span style={{ fontWeight: 700, color: 'var(--success)' }}>{streak}</span> 天
          </div>
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>
            累计成长值 <span style={{ fontWeight: 700, color: 'var(--growth-warm)' }}>{totalExp}</span>
          </div>
        </div>
      </div>

      {/* 权限提示 */}
      {!hasAccess && !dismissPermission && (
        <div className="gr-card" style={{ marginBottom: 16, borderColor: 'var(--danger)', cursor: 'pointer' }} onClick={handleOpenPermissionSettings}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon.Warning size={14} color="var(--danger)" />
              <span style={{ fontSize: 13, color: 'var(--danger)' }}>需要使用权限</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setDismissPermission(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--growth-text-secondary)', padding: 0 }}>
              <Icon.Close size={14} color="var(--growth-text-secondary)" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ 当前目标 ═══ */}
      <div className="gr-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--growth-text-secondary)', marginBottom: 12 }}>
          当前目标
        </div>
        {currentMission ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--growth-text)' }}>
                  {currentMission.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginTop: 2 }}>
                  {fmtClock(currentMission.plannedStart)}–{fmtClock(currentMission.plannedEnd)} · 目标 {currentMission.targetMinutes} 分钟
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, color: (STATUS_MAP[currentMission.status] || STATUS_MAP.IDLE).color,
                padding: '2px 8px', borderRadius: 6, background: 'var(--growth-surface-alt)'
              }}>
                {(STATUS_MAP[currentMission.status] || STATUS_MAP.IDLE).label}
              </span>
            </div>
            {currentMission.targetMinutes > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div className="gr-progress">
                  <div className="gr-progress-fill" style={{
                    width: `${Math.min(100, (currentMission.actualStudyMs / (currentMission.targetMinutes * 60000)) * 100)}%`,
                    background: 'var(--growth-primary)'
                  }} />
                </div>
              </div>
            )}
            {currentMission.status === 'READY' && (
              <button className="gr-btn gr-btn-primary" onClick={() => startMission(currentMission.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Icon.Play size={16} color="#fff" /> 开始专注
              </button>
            )}
            {currentMission.status === 'FOCUSING' && (
              <button className="gr-btn gr-btn-outline" onClick={() => onNavigate?.('dungeon')} style={{ width: '100%' }}>
                进入专注空间
              </button>
            )}
            {(currentMission.status === 'DISTRACTED' || currentMission.status === 'INTERVENTION') && (
              <button className="gr-btn gr-btn-outline" onClick={() => onNavigate?.('dungeon')} style={{ width: '100%', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                回到目标
              </button>
            )}
            {currentMission.status === 'RECOVERING' && (
              <div style={{ fontSize: 12, color: 'var(--warning)', textAlign: 'center', padding: '6px 0' }}>
                重新回到目标，成长继续
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', padding: '8px 0' }}>
            暂无进行中的任务，在「计划」中查看或创建成长目标。
          </div>
        )}
      </div>

      {/* ═══ 今日成长计划 ═══ */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--growth-text-secondary)', marginBottom: 10 }}>
        今日成长计划
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>
          {doneCount} 完成 · {activeCount} 进行 · {todayViews.length - doneCount - activeCount} 待执行
        </span>
      </div>
      <div style={{ marginBottom: 16 }}>
        {todayViews.length === 0 ? (
          <div className="gr-card-alt" style={{ textAlign: 'center', color: 'var(--growth-text-secondary)', fontSize: 12 }}>
            今日暂无计划
          </div>
        ) : (
          todayViews.map(v => {
            const s = STATUS_MAP[v.viewStatus] || STATUS_MAP.IDLE
            return (
              <div key={v.id} className="gr-card-alt" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => onNavigate?.('quests')}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--growth-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)', marginTop: 1 }}>
                    {fmtClock(v.plannedStart)}–{fmtClock(v.plannedEnd)} · {v.targetMinutes}分钟
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: s.color, flexShrink: 0 }}>{s.label}</span>
              </div>
            )
          })
        )}
      </div>

      {/* ═══ 成长记录 ═══ */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--growth-text-secondary)', marginBottom: 10 }}>
        成长记录
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="gr-card-alt">
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>连续天数</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{streak}<span style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginLeft: 4 }}>天</span></div>
        </div>
        <div className="gr-card-alt">
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>成长值</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--growth-warm)' }}>{points}</div>
        </div>
      </div>
    </div>
  )
}
