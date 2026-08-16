/**
 * src/components/mission-control/MCQuests.tsx
 * Future Industrial Mission Control — Mission List。
 * 不是游戏化 Quest 列表，是工业任务模块清单。
 * 每个 Mission 表现为系统模块（ID / TITLE / STATUS / PROGRESS / SCHEDULE）。
 */
import { useState } from 'react'
import { useStore } from '@/stores/useStore'
import type { PageId } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { logger } from '@/lib/logger'
import Icon from '@/components/Icons'
import {
  useMissionStore, startMission, buildUnifiedMissionView, useDayPlanStore, useSessionStore
} from '@/core/discipline'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { localDateStr } from '@/lib/dateUtils'
import {
  MCPage, MCModule, MCSection, MCStatus, MCProgress, MCButton, MCMissionRow
} from '@/components/mission-control'

interface Props { onNavigate?: (p: PageId) => void }

function fmtClock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
  const partialCount = todayViews.filter(v => v.viewStatus === 'PARTIAL').length

  return (
    <MCPage>
      {/* ═══ 终端标题 ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 3, textTransform: 'uppercase' }}>
            MISSION MODULE
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
            OPERATIONS
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 1 }}>CREDITS</div>
          <div className="mc-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--status-warning)' }}>{points}</div>
        </div>
      </div>

      {/* ═══ 状态摘要（内嵌行，非卡片） ═══ */}
      <div className="mc-module" style={{ marginBottom: 14, display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mc-status-dot" style={{ background: 'var(--status-success)' }} />
          <span className="mc-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--status-success)' }}>{doneCount}</span>
          <span style={{ fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 1 }}>COMPLETED</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mc-status-dot" style={{ background: 'var(--status-focus)' }} />
          <span className="mc-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--status-focus)' }}>{activeCount}</span>
          <span style={{ fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 1 }}>ACTIVE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mc-status-dot" style={{ background: 'var(--status-warning)' }} />
          <span className="mc-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--status-warning)' }}>{partialCount}</span>
          <span style={{ fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 1 }}>PARTIAL</span>
        </div>
      </div>

      {/* DayPlan 承诺状态 */}
      {dayPlan && (
        <div className="mc-module" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 1 }}>DAY PLAN</span>
            <MCStatus status={dayPlan.status} />
          </div>
          {dayPlan.status === 'PLANNED' && (
            <MCButton onClick={() => useDayPlanStore.getState().commitDayPlan(today)} style={{ width: 'auto', padding: '6px 14px' }}>
              COMMIT
            </MCButton>
          )}
        </div>
      )}

      {/* ═══ 任务操作终端 ═══ */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <MCButton onClick={() => setShowDynForm(v => !v)} style={{ width: 'auto', padding: '6px 14px' }}>
          {showDynForm ? 'CANCEL' : '+ NEW MISSION'}
        </MCButton>
      </div>

      {showDynForm && (
        <div className="mc-module" style={{ marginBottom: 16 }}>
          <input
            value={dynTitle}
            onChange={e => setDynTitle(e.target.value)}
            placeholder="MISSION TITLE"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 10,
              background: 'var(--surface-3)', border: 'none', borderLeft: '1px solid var(--border-line)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'var(--font-mc)'
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {[25, 40, 45, 60, 90].map(v => (
              <button key={v} onClick={() => setDynMinutes(v)} style={{
                padding: '5px 10px', fontSize: 11, cursor: 'pointer',
                fontWeight: dynMinutes === v ? 700 : 400,
                background: dynMinutes === v ? 'rgba(126,182,232,0.1)' : 'transparent',
                border: `1px solid ${dynMinutes === v ? 'var(--status-normal)' : 'var(--border-line)'}`,
                color: dynMinutes === v ? 'var(--status-normal)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-mc-mono)', borderRadius: 0
              }}>{v}M</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 1 }}>START</span>
            <input
              value={dynStart}
              onChange={e => setDynStart(e.target.value)}
              placeholder="NOW OR HH:MM"
              style={{
                flex: 1, padding: '8px 12px', background: 'var(--surface-3)', border: 'none',
                borderLeft: '1px solid var(--border-line)', color: 'var(--text-primary)',
                fontSize: 12, outline: 'none', fontFamily: 'var(--font-mc-mono)'
              }}
            />
          </div>
          <MCButton variant="primary" onClick={handleCreateDynamic}>CREATE MISSION</MCButton>
        </div>
      )}

      {/* ═══ 任务模块清单 ═══ */}
      <MCSection title="MISSION QUEUE" right={`${todayViews.length} ITEMS`} />
      <div>
        {todayViews.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '20px 0', textAlign: 'center' }}>
            QUEUE EMPTY · NO MISSIONS SCHEDULED
          </div>
        ) : (
          todayViews.map(v => {
            const isCurrent = v.id === currentMissionId
            const actionable = ['READY', 'COMMITTED', 'PLANNED'].includes(v.viewStatus)
            return (
              <MCMissionRow
                key={v.id}
                title={v.title}
                subtitle={`${fmtClock(v.plannedStart)}–${fmtClock(v.plannedEnd)} · ${v.targetMinutes}MIN${v.requiresEvidence ? ' · EVIDENCE' : ''}`}
                status={v.viewStatus}
                progress={v.executionRate > 0 ? v.executionRate * 100 : undefined}
                onClick={actionable && !isCurrent ? () => startMission(v.id) : undefined}
                right={actionable && !isCurrent ? (
                  <button onClick={(e) => { e.stopPropagation(); startMission(v.id) }} style={{
                    padding: '5px 10px', background: 'transparent', border: '1px solid var(--status-normal)',
                    color: 'var(--status-normal)', fontSize: 10, cursor: 'pointer', borderRadius: 0,
                    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', letterSpacing: 1,
                    fontFamily: 'var(--font-mc-mono)'
                  }}>
                    <Icon.Play size={10} color="var(--status-normal)" /> INIT
                  </button>
                ) : isCurrent ? (
                  <button onClick={() => onNavigate?.('dungeon')} style={{
                    padding: '5px 10px', background: 'transparent', border: '1px solid var(--status-focus)',
                    color: 'var(--status-focus)', fontSize: 10, cursor: 'pointer', borderRadius: 0,
                    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', letterSpacing: 1,
                    fontFamily: 'var(--font-mc-mono)'
                  }}>
                    ENTER
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
