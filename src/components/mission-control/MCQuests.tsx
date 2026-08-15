/**
 * src/components/mission-control/MCQuests.tsx
 * Mission Control 模式的 Quests 页（Phase 2）。
 * 表现为统一的 Mission Control 列表（非游戏化 Quest 列表）。
 * 所有状态直接读取现有 Mission 数据（buildUnifiedMissionView），不在 UI 层重新计算。
 */
import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import type { PageId } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { logger } from '@/lib/logger'
import Icon from '@/components/Icons'
import {
  useMissionStore, startMission, buildUnifiedMissionView,
  useDayPlanStore, useSessionStore
} from '@/core/discipline'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { localDateStr } from '@/lib/dateUtils'
import {
  MCPage, MCCard, MCSectionHeader, MCStatusBadge, MCProgressBar, MCButton, MCMissionItem
} from '@/components/mission-control'

interface Props {
  onNavigate?: (p: PageId) => void
}

function fmtClock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const STATUS_LABEL: Record<string, string> = {
  READY: '待开始', FOCUSING: '专注中', DISTRACTED: '已分心',
  INTERVENTION: '干预中', RECOVERING: '恢复中', COMPLETED: '已完成',
  MISSED: '已错过', IDLE: '空闲', PLANNED: '已计划', COMMITTED: '已承诺',
  EXECUTING: '执行中', PARTIAL: '部分完成', ABANDONED: '已放弃'
}

export default function MCQuests({ onNavigate }: Props) {
  const points = useStore(s => s.points)
  const missions = useMissionStore(s => s.missions)
  const currentMissionId = useMissionStore(s => s.currentMissionId)
  const classTasks = useClassTaskStore(s => s.classTasks)
  const sessions = useSessionStore(s => s.sessions)
  const dayPlans = useDayPlanStore(s => s.dayPlans)

  const today = localDateStr()
  const dayPlan = dayPlans.find(p => p.date === today)
  const todayClassTasks = classTasks.filter(t => t.date === today).map(t => ({
    id: t.id, period: t.period, date: t.date, subject: t.subject, status: t.status
  }))
  const todayViews = buildUnifiedMissionView({
    date: today, missions, courseTasks: todayClassTasks, sessions, dayPlan
  })

  // 动态任务创建表单
  const [showDynForm, setShowDynForm] = useState(false)
  const [dynTitle, setDynTitle] = useState('')
  const [dynMinutes, setDynMinutes] = useState(45)
  const [dynStart, setDynStart] = useState('')

  function handleCreateDynamic() {
    const title = dynTitle.trim()
    if (!title) { showToast('请输入任务内容'); return }
    const minutes = Math.max(1, Math.min(480, Math.round(dynMinutes)))
    const nowD = new Date()
    let startTs = Date.now()
    const hm = dynStart.trim().match(/^(\d{1,2}):(\d{2})$/)
    if (hm) {
      const h = Math.min(23, parseInt(hm[1], 10))
      const mi = Math.min(59, parseInt(hm[2], 10))
      startTs = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate(), h, mi).getTime()
    }
    const store = useMissionStore.getState()
    store.createMission({
      title, subject: title, source: 'USER', createdBy: 'USER',
      plannedStart: startTs, plannedEnd: startTs + minutes * 60000,
      targetMinutes: minutes, requiresEvidence: false
    })
    const cur = store.getCurrentMission()
    const ACTIVE = ['READY', 'FOCUSING', 'DISTRACTED', 'RECOVERING', 'INTERVENTION']
    if (!cur || !ACTIVE.includes(cur.status)) store.setCurrentMission(store.missions[store.missions.length - 1].id)
    setDynTitle(''); setDynStart(''); setShowDynForm(false)
    showToast('动态任务已创建')
    logger.info('mission', `动态 Mission 创建: ${title}`, { minutes, startTs })
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
            TASK LIST
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 1 }}>CREDITS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--status-warning)', fontFamily: 'var(--font-mc-mono)' }}>{points}</div>
        </div>
      </div>

      {/* DayPlan 承诺状态 */}
      {dayPlan && (
        <MCCard style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 1, marginBottom: 2 }}>DAY PLAN</div>
              <MCStatusBadge status={dayPlan.status} label={dayPlan.status === 'COMMITTED' ? '已承诺' : dayPlan.status === 'EXECUTING' ? '执行中' : dayPlan.status === 'RESULT' ? '已结算' : '已计划'} />
            </div>
            {dayPlan.status === 'PLANNED' && (
              <MCButton onClick={() => useDayPlanStore.getState().commitDayPlan(today)} style={{ width: 'auto', padding: '8px 16px' }}>
                Commit Today
              </MCButton>
            )}
          </div>
        </MCCard>
      )}

      {/* 统计概览 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
        <MCCard style={{ padding: '12px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--status-success)', fontFamily: 'var(--font-mc-mono)' }}>{doneCount}</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 1 }}>COMPLETED</div>
        </MCCard>
        <MCCard style={{ padding: '12px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--status-focus)', fontFamily: 'var(--font-mc-mono)' }}>{activeCount}</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 1 }}>ACTIVE</div>
        </MCCard>
        <MCCard style={{ padding: '12px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mc-mono)' }}>{upcomingCount}</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 1 }}>UPCOMING</div>
        </MCCard>
      </div>

      {/* 动态任务创建 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <MCButton onClick={() => setShowDynForm(v => !v)} style={{ width: 'auto', padding: '8px 16px' }}>
          {showDynForm ? '收起' : '+ 动态任务'}
        </MCButton>
      </div>

      {showDynForm && (
        <MCCard style={{ marginBottom: 20 }}>
          <input
            value={dynTitle}
            onChange={e => setDynTitle(e.target.value)}
            placeholder="任务内容，如：函数第三章 / 背单词 / 一套理综卷"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 10,
              background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-primary)',
              fontSize: 14, outline: 'none', borderRadius: 'var(--radius-sm)'
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {[25, 40, 45, 60, 90].map(v => (
              <button key={v} onClick={() => setDynMinutes(v)} style={{
                padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                fontWeight: dynMinutes === v ? 700 : 400,
                background: dynMinutes === v ? 'rgba(74,158,255,0.15)' : 'var(--surface-3)',
                border: `1px solid ${dynMinutes === v ? 'var(--status-focus)' : 'var(--border)'}`,
                color: dynMinutes === v ? 'var(--status-focus)' : 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)'
              }}>
                {v}分
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>开始</span>
            <input
              value={dynStart}
              onChange={e => setDynStart(e.target.value)}
              placeholder="留空=现在（或 19:00）"
              style={{
                flex: 1, padding: '8px 12px', background: 'var(--surface-3)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none', borderRadius: 'var(--radius-sm)'
              }}
            />
          </div>
          <MCButton variant="primary" onClick={handleCreateDynamic}>创建任务</MCButton>
        </MCCard>
      )}

      {/* ═══ 统一 Mission Control 列表 ═══ */}
      <MCSectionHeader title="MISSIONS" right={
        <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mc-mono)' }}>
          {todayViews.length} 项
        </span>
      } />
      <div>
        {todayViews.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
            今日暂无任务
          </div>
        ) : (
          todayViews.map(v => {
            const isCurrent = v.id === currentMissionId
            const actionable = ['READY', 'COMMITTED', 'PLANNED'].includes(v.viewStatus)
            return (
              <MCMissionItem
                key={v.id}
                title={v.title}
                subtitle={`${fmtClock(v.plannedStart)}–${fmtClock(v.plannedEnd)} · ${v.targetMinutes}min${v.requiresEvidence ? ' · 需凭证' : ''}`}
                status={v.viewStatus}
                statusLabel={STATUS_LABEL[v.viewStatus] || v.viewStatus}
                progress={v.executionRate > 0 ? v.executionRate * 100 : undefined}
                onClick={actionable && !isCurrent ? () => startMission(v.id) : undefined}
                right={actionable && !isCurrent ? (
                  <button onClick={(e) => { e.stopPropagation(); startMission(v.id) }} style={{
                    padding: '6px 10px', background: 'rgba(74,158,255,0.1)', border: '1px solid var(--status-focus)',
                    color: 'var(--status-focus)', fontSize: 11, cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                  }}>
                    <Icon.Play size={11} color="var(--status-focus)" /> 开始
                  </button>
                ) : isCurrent ? (
                  <button onClick={() => onNavigate?.('dungeon')} style={{
                    padding: '6px 10px', background: 'rgba(74,158,255,0.1)', border: '1px solid var(--status-focus)',
                    color: 'var(--status-focus)', fontSize: 11, cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                  }}>
                    进入
                  </button>
                ) : undefined}
              />
            )
          })
        )}
      </div>
    </MCPage>
  )
}
