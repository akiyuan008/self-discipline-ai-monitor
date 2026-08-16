/**
 * src/components/growth/GrQuests.tsx
 * Growth Mode Quests — 成长计划页。
 * 不是游戏 Quest，是个人成长目标。所有状态直接读取现有 Mission 数据。
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

export default function GrQuests({ onNavigate }: Props) {
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
    showToast('成长目标已创建')
    logger.info('mission', `动态 Mission 创建: ${title}`, { minutes, startTs })
  }

  const doneCount = todayViews.filter(v => v.viewStatus === 'COMPLETED').length
  const activeCount = todayViews.filter(v => ['EXECUTING', 'FOCUSING'].includes(v.viewStatus)).length

  return (
    <div className="gr-page">
      {/* 标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 14, color: 'var(--growth-text-secondary)', marginBottom: 2 }}>成长计划</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--growth-text)' }}>今日目标</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>成长值</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--growth-warm)' }}>{points}</div>
        </div>
      </div>

      {/* 进度摘要 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div className="gr-card-alt" style={{ flex: 1, textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{doneCount}</div>
          <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)' }}>已完成</div>
        </div>
        <div className="gr-card-alt" style={{ flex: 1, textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--growth-primary)' }}>{activeCount}</div>
          <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)' }}>进行中</div>
        </div>
        <div className="gr-card-alt" style={{ flex: 1, textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--growth-text)' }}>{todayViews.length}</div>
          <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)' }}>总计</div>
        </div>
      </div>

      {/* 新增成长目标 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="gr-btn gr-btn-primary" onClick={() => setShowDynForm(v => !v)} style={{ padding: '8px 16px', fontSize: 13 }}>
          {showDynForm ? '收起' : '＋ 新增成长目标'}
        </button>
      </div>

      {showDynForm && (
        <div className="gr-card" style={{ marginBottom: 16 }}>
          <input
            value={dynTitle}
            onChange={e => setDynTitle(e.target.value)}
            placeholder="目标内容，如：数学训练 / 背单词 / 一套理综卷"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 10,
              background: 'var(--growth-surface-alt)', border: '1px solid var(--growth-border)',
              color: 'var(--growth-text)', fontSize: 14, outline: 'none', borderRadius: 'var(--growth-radius-sm)'
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {[25, 40, 45, 60, 90].map(v => (
              <button key={v} onClick={() => setDynMinutes(v)} style={{
                padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                fontWeight: dynMinutes === v ? 700 : 400,
                background: dynMinutes === v ? 'var(--growth-primary)' : 'var(--growth-surface-alt)',
                color: dynMinutes === v ? '#fff' : 'var(--growth-text-secondary)',
                border: 'none', borderRadius: 8
              }}>{v}分钟</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--growth-text-secondary)' }}>开始</span>
            <input
              value={dynStart}
              onChange={e => setDynStart(e.target.value)}
              placeholder="留空=现在（或 19:00）"
              style={{
                flex: 1, padding: '8px 12px', background: 'var(--growth-surface-alt)',
                border: '1px solid var(--growth-border)', color: 'var(--growth-text)',
                fontSize: 13, outline: 'none', borderRadius: 'var(--growth-radius-sm)'
              }}
            />
          </div>
          <button className="gr-btn gr-btn-primary" onClick={handleCreateDynamic} style={{ width: '100%' }}>
            创建成长目标
          </button>
        </div>
      )}

      {/* 成长目标列表 */}
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--growth-text-secondary)' }}>目标列表</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{todayViews.length} 项</span>
      </div>
      <div>
        {todayViews.length === 0 ? (
          <div className="gr-card-alt" style={{ textAlign: 'center', color: 'var(--growth-text-secondary)', fontSize: 12, padding: '24px 0' }}>
            暂无成长目标，点击上方「新增成长目标」开始
          </div>
        ) : (
          todayViews.map(v => {
            const s = STATUS_MAP[v.viewStatus] || STATUS_MAP.IDLE
            const isCurrent = v.id === currentMissionId
            const actionable = ['READY', 'COMMITTED', 'PLANNED'].includes(v.viewStatus)
            return (
              <div key={v.id} className="gr-card-alt" style={{
                marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12,
                cursor: actionable && !isCurrent ? 'pointer' : 'default'
              }} onClick={actionable && !isCurrent ? () => startMission(v.id) : undefined}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--growth-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)', marginTop: 1 }}>
                    {fmtClock(v.plannedStart)}–{fmtClock(v.plannedEnd)} · 目标 {v.targetMinutes} 分钟
                    {v.requiresEvidence ? ' · 需凭证' : ''}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: s.color, flexShrink: 0 }}>{s.label}</span>
                {actionable && !isCurrent && (
                  <button onClick={(e) => { e.stopPropagation(); startMission(v.id) }} style={{
                    padding: '6px 12px', background: 'var(--growth-primary)', color: '#fff',
                    border: 'none', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', flexShrink: 0
                  }}>
                    <Icon.Play size={11} color="#fff" /> 开始
                  </button>
                )}
                {isCurrent && (
                  <button onClick={() => onNavigate?.('dungeon')} style={{
                    padding: '6px 12px', background: 'var(--growth-surface-alt)', color: 'var(--growth-primary)',
                    border: '1px solid var(--growth-primary)', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', flexShrink: 0
                  }}>
                    进入
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
