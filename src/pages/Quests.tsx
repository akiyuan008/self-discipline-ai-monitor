import { useState, useEffect, useMemo } from 'react'
import { useStore, type PageId } from '@/stores/useStore'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { getPeriodTime, resolveTaskState, reconcileOverdue, type TaskUIState } from '@/data/schedule'
import { verifyClassPhoto, reportToWarden } from '@/lib/verifyAI'
import { savePhoto } from '@/lib/photoStorage'
import { showToast } from '@/components/Toast'
import { logger } from '@/lib/logger'
import Icon from '@/components/Icons'
import { localDateStr } from '@/lib/dateUtils'
import { useMissionStore, startMission, useSessionStore, useDayPlanStore, buildUnifiedMissionView, submitRejectedCoursePhotoEvidenceForTask } from '@/core/discipline'
import type { MissionView, MissionViewStatus } from '@/core/discipline'

interface Props {
  onNavigate?: (p: PageId) => void
}

const CLIP = 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
const CLIP_SM = 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'

// 分钟 → 小时+分钟 显示
function fmtDur(mins: number): string {
  const m = Math.max(0, Math.round(mins))
  if (m < 60) return `${m}分钟`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}小时${rem}分` : `${h}小时`
}

// 时间戳 → HH:MM
function fmtClock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Quests({ onNavigate }: Props) {
  const points = useStore(s => s.points)
  const setDungeonDuration = useStore(s => s.setDungeonDuration)
  const addPoints = useStore(s => s.addPoints)
  const addPointRecord = useStore(s => s.addPointRecord)

  const classTasks = useClassTaskStore(s => s.classTasks)
  const startClassTask = useClassTaskStore(s => s.startClassTask)
  const completeClassTask = useClassTaskStore(s => s.completeClassTask)
  const markTaskOverdue = useClassTaskStore(s => s.markTaskOverdue)

  const [now, setNow] = useState(new Date())
  const [verifying, setVerifying] = useState<string | null>(null)

  // ── 动态 Mission（source=USER）创建与展示 ──
  const missions = useMissionStore(s => s.missions)
  const currentMissionId = useMissionStore(s => s.currentMissionId)
  const sessions = useSessionStore(s => s.sessions)
  const dayPlans = useDayPlanStore(s => s.dayPlans)
  const [showDynForm, setShowDynForm] = useState(false)
  const [dynTitle, setDynTitle] = useState('')
  const [dynMinutes, setDynMinutes] = useState(45)
  const [dynStart, setDynStart] = useState('')  // HH:MM，留空 = 现在

  function handleCreateDynamic() {
    const title = dynTitle.trim()
    if (!title) { showToast('请输入任务内容') ; return }
    const minutes = Math.max(1, Math.min(480, Math.round(dynMinutes)))
    // 解析开始时间（HH:MM），留空 = 现在
    let startTs = Date.now()
    const hm = dynStart.trim().match(/^(\d{1,2}):(\d{2})$/)
    if (hm) {
      const h = Math.min(23, parseInt(hm[1], 10))
      const mi = Math.min(59, parseInt(hm[2], 10))
      startTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, mi).getTime()
    }
    const store = useMissionStore.getState()
    const m = store.createMission({
      title,
      subject: title,
      source: 'USER',
      createdBy: 'USER',
      plannedStart: startTs,
      plannedEnd: startTs + minutes * 60000,
      targetMinutes: minutes,
      requiresEvidence: false
    })
    // 若当前没有激活任务，设为当前任务（便于 Home 展示与衔接）
    const cur = store.getCurrentMission()
    const ACTIVE = ['READY', 'FOCUSING', 'DISTRACTED', 'RECOVERING', 'INTERVENTION']
    if (!cur || !ACTIVE.includes(cur.status)) store.setCurrentMission(m.id)
    setDynTitle(''); setDynStart(''); setShowDynForm(false)
    showToast('动态任务已创建')
    logger.info('mission', `动态 Mission 创建: ${title}`, { minutes, startTs })
  }

  // 30s 刷新一次时间
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  const today = localDateStr(now)
  const todayTasks = useMemo(
    () => classTasks.filter(t => t.date === today).sort((a, b) => a.period - b.period),
    [classTasks, today]
  )

  // ── 对账：把已过点的 pending 任务就地标记逾期并扣分（根除僵尸态）──
  useEffect(() => {
    const overdueIds = reconcileOverdue(todayTasks, now)
    overdueIds.forEach(id => {
      const task = todayTasks.find(t => t.id === id)
      if (!task || task.status !== 'pending') return
      const penalty = markTaskOverdue(id)
      if (penalty < 0) {
        addPoints(penalty)
        addPointRecord('spend', Math.abs(penalty), `${task.subject}课逾期`)
        logger.warn('schedule', `${task.subject} 课逾期`, { penalty })
      }
    })
  }, [todayTasks, now])

  // 每节课的解析状态
  const resolved = useMemo(
    () => todayTasks.map(task => ({ task, r: resolveTaskState(task, now) })),
    [todayTasks, now]
  )

  // ── Phase 8：统一 Mission View（Course + Dynamic + Schedule + DayPlan 去重映射）──
  const dayPlan = useMemo(() => dayPlans.find(p => p.date === today), [dayPlans, today])
  const unifiedViews = useMemo(() => buildUnifiedMissionView({
    date: today,
    missions,
    courseTasks: todayTasks.map(t => ({ id: t.id, period: t.period, date: t.date, subject: t.subject, status: t.status })),
    sessions,
    dayPlan
  }), [today, missions, todayTasks, sessions, dayPlan])
  // 课程项的 legacy 解析状态（供统一时间轴展示拍照核验/深渊动作）
  const resolvedMap = useMemo(() => {
    const map: Record<string, { task: any; r: any }> = {}
    for (const x of resolved) map[x.task.id] = x
    return map
  }, [resolved])

  // ── 当前任务（C 的核心）：按优先级挑出唯一主任务 ──
  const mission = useMemo(() => {
    const active = resolved.find(x => ['LIVE', 'VERIFY', 'GRACE'].includes(x.r.state))
    if (active) return active
    const ready = resolved.find(x => x.r.state === 'READY')
    if (ready) return ready
    const locked = resolved.find(x => x.r.state === 'LOCKED')
    if (locked) return locked
    return null // 全部结束
  }, [resolved])

  const allSettled = resolved.length > 0 && resolved.every(x => ['DONE', 'MISSED'].includes(x.r.state))
  const doneCount = resolved.filter(x => x.r.state === 'DONE').length
  const missedCount = resolved.filter(x => x.r.state === 'MISSED').length

  // ── 强制拍照核验（Option ③）──
  async function handleTakePhoto(taskId: string) {
    const task = todayTasks.find(t => t.id === taskId)
    if (!task) return
    setVerifying(taskId)
    try {
      const image = await Camera.getPhoto({ quality: 80, allowEditing: false, resultType: CameraResultType.Base64, source: CameraSource.Camera })
      showToast('MOSS 核验中…')
      const verifyResult = await verifyClassPhoto(image.base64String || '', task.subject)
      // 照片存到外部存储，localStorage 只存路径（避免配额超限）
      const photoPath = await savePhoto(image.base64String || '', taskId)
      useClassTaskStore.getState().addVerifyRecord({
        taskId, date: today, subject: task.subject,
        photoUrl: photoPath,
        aiReview: verifyResult.review,
        aiScore: verifyResult.score,
        passed: verifyResult.passed
      })
      if (!verifyResult.passed) {
        // Phase 10B：核验失败 → 持久化独立 REJECTED Evidence（≠ABANDONED、不发奖、不 tryComplete）。
        // 多次失败各留一条 REJECTED，保留完整历史（REJECTED … VERIFIED）。
        submitRejectedCoursePhotoEvidenceForTask(
          { period: task.period },
          { classTaskId: task.id, photoPath: photoPath || undefined, aiScore: verifyResult.score, aiReview: verifyResult.review }
        )
        logger.warn('schedule', `${task.subject} 核验未通过（已记 REJECTED 证据）`, { score: verifyResult.score })
        showToast(`核验未通过：${verifyResult.review}`)
        await reportToWarden(`${task.subject} 打卡核验未通过（${verifyResult.score}分）。${verifyResult.review}`)
        return
      }
      // Phase 10A：课程完成奖励由 RewardEngine 统一发放
      //（completeClassTask 内部经 Evidence→tryComplete→grantMissionReward，幂等）。
      // Quests 不再直接 addPoints/addPointRecord。
      const reward = completeClassTask(taskId, photoPath || undefined, verifyResult.review, verifyResult.score)
      if (reward > 0) {
        logger.info('schedule', `${task.subject} 核验通过（奖励由 RewardEngine 结算）`, { reward, score: verifyResult.score })
        showToast(`核验通过 +${reward} PTS`)
        if (verifyResult.score >= 90) {
          await reportToWarden(`${task.subject} 表现优秀（${verifyResult.score}分），继续保持。`)
        }
      }
    } catch (e: any) {
      if (e.message !== 'User cancelled photos app') {
        logger.error('schedule', '拍照核验失败', { error: e?.message })
        showToast('相机调用失败')
      }
    } finally {
      setVerifying(null)
    }
  }

  // ── 进入深渊：时长按真实课堂收敛 ──
  function enterAbyss(taskId: string) {
    const task = todayTasks.find(t => t.id === taskId)
    if (!task) return
    const p = getPeriodTime(task.period)
    if (!p) return
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const startMin = resolveTaskState(task, now).startMin
    const endMin = resolveTaskState(task, now).endMin
    // 时长 = 课程剩余时长（若未开始则用整节课时长），收敛到合理范围
    const remaining = Math.max(1, endMin - Math.max(nowMin, startMin))
    setDungeonDuration(Math.min(remaining, endMin - startMin))
    startClassTask(task.id)
    logger.info('schedule', `进入深渊：${task.subject}`, { duration: Math.min(remaining, endMin - startMin) })
    onNavigate?.('dungeon')
  }

  return (
    <div className="safe-top animate-in" style={{ padding: '20px 16px 140px', background: 'var(--bg)', minHeight: '100vh' }}>
      {/* 顶部标题 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(69, 162, 158, 0.2)'
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 2 }}>
            MISSION CONTROL
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Teko, sans-serif', letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>
            SCHEDULE
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace' }}>CREDITS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b', fontFamily: 'Teko, sans-serif' }}>{points}</div>
        </div>
      </div>

      {/* ═══ CURRENT MISSION 大卡（C 核心）═══ */}
      {mission ? (
        <MissionCard
          task={mission.task}
          r={mission.r}
          verifying={verifying === mission.task.id}
          onAbyss={() => enterAbyss(mission.task.id)}
          onVerify={() => handleTakePhoto(mission.task.id)}
        />
      ) : (
        <SettlementCard
          total={resolved.length}
          done={doneCount}
          missed={missedCount}
          allSettled={allSettled}
        />
      )}

      {/* ═══ 动态任务（USER/AI Mission）═══ */}
      <div style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 3, height: 14, background: '#f59e0b' }} />
          <div style={{ fontSize: 12, color: '#f59e0b', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 2 }}>
            DYNAMIC MISSIONS
          </div>
          <div style={{ flex: 1, height: 1, background: 'rgba(245,158,11,0.2)' }} />
          <button
            onClick={() => setShowDynForm(v => !v)}
            style={{
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b',
              fontSize: 12, fontWeight: 700, padding: '5px 10px', cursor: 'pointer',
              fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", clipPath: CLIP_SM
            }}
          >
            {showDynForm ? '收起' : '+ 动态任务'}
          </button>
        </div>

        {showDynForm && (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: 14, marginBottom: 10, clipPath: CLIP, position: 'relative' }}>
            <div className="corner-deco tl" style={{ width: 10, height: 10, borderWidth: 1 }} />
            <div className="corner-deco tr" style={{ width: 10, height: 10, borderWidth: 1 }} />
            <div className="corner-deco bl" style={{ width: 10, height: 10, borderWidth: 1 }} />
            <div className="corner-deco br" style={{ width: 10, height: 10, borderWidth: 1 }} />
            <input
              value={dynTitle}
              onChange={e => setDynTitle(e.target.value)}
              placeholder="任务内容，如：函数第三章 / 背单词 / 一套理综卷"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 10,
                background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--fg)',
                fontSize: 14, fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", outline: 'none'
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {[25, 40, 45, 60, 90].map(v => (
                <button key={v} onClick={() => setDynMinutes(v)} style={{
                  padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: dynMinutes === v ? 700 : 400,
                  background: dynMinutes === v ? 'rgba(245,158,11,0.18)' : 'var(--bg-alt)',
                  border: `1px solid ${dynMinutes === v ? '#f59e0b' : 'var(--border)'}`,
                  color: dynMinutes === v ? '#f59e0b' : 'var(--fg)',
                  fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", clipPath: CLIP_SM
                }}>
                  {v}分
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif" }}>开始</span>
              <input
                value={dynStart}
                onChange={e => setDynStart(e.target.value)}
                placeholder="留空=现在（或 19:00）"
                style={{
                  flex: 1, padding: '8px 12px', background: 'var(--bg-alt)', border: '1px solid var(--border)',
                  color: 'var(--fg)', fontSize: 13, fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", outline: 'none'
                }}
              />
            </div>
            <button onClick={handleCreateDynamic} style={{
              width: '100%', padding: '12px', background: '#f59e0b', border: 'none', color: '#0d1117',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: 1,
              fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", clipPath: CLIP_SM
            }}>
              创建任务
            </button>
          </div>
        )}

        {/* Phase 8：动态任务列表并入下方统一时间轴，此处仅保留创建表单 */}
      </div>

      {/* ═══ 统一时间轴（Phase 8：Course + Dynamic 单一列表，Mission 统一身份，去重）═══ */}
      <div style={{ marginTop: 20, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 14, background: '#45a29e' }} />
        <div style={{ fontSize: 12, color: '#45a29e', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 2 }}>
          UNIFIED TIMELINE
        </div>
        <div style={{ flex: 1, height: 1, background: 'rgba(69,162,158,0.2)' }} />
      </div>

      {unifiedViews.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          <div style={{ fontSize: 13 }}>NO MISSIONS ASSIGNED</div>
          <div style={{ fontSize: 10, marginTop: 6, opacity: 0.5 }}>SYSTEM IDLE</div>
        </div>
      )}

      <UnifiedTimeline
        views={unifiedViews}
        resolvedMap={resolvedMap}
        currentMissionId={currentMissionId}
        verifyingId={verifying}
        onVerify={handleTakePhoto}
        onAbyss={enterAbyss}
        onStartMission={(id) => startMission(id)}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// CURRENT MISSION 大卡
// ═══════════════════════════════════════════════════════════
function MissionCard({ task, r, verifying, onAbyss, onVerify }: {
  task: any
  r: any
  verifying: boolean
  onAbyss: () => void
  onVerify: () => void
}) {
  const period = getPeriodTime(task.period)
  const timeStr = period ? `${period.startTime} — ${period.endTime}` : ''
  const isActionable = ['LIVE', 'VERIFY', 'GRACE', 'READY'].includes(r.state)

  // 主操作按钮
  let primaryBtn: React.ReactNode = null
  if (r.state === 'LIVE') {
    primaryBtn = (
      <BigBtn color="#ff4500" onClick={onAbyss}>
        <Icon.Play size={16} color="#ff4500" /> 进入深渊 · 专注本课
      </BigBtn>
    )
  } else if (r.state === 'VERIFY' || r.state === 'GRACE') {
    primaryBtn = (
      <BigBtn color="#45a29e" onClick={onVerify} disabled={verifying}>
        <Icon.Camera size={16} color="#45a29e" /> {verifying ? 'MOSS 核验中…' : '拍照核验 · 强制'}
      </BigBtn>
    )
  } else if (r.state === 'READY') {
    primaryBtn = (
      <BigBtn color="#45a29e" onClick={onAbyss}>
        <Icon.Play size={16} color="#45a29e" /> 提前进入 · 抢占先机
      </BigBtn>
    )
  } else if (r.state === 'LOCKED') {
    primaryBtn = (
      <div style={{ textAlign: 'center', padding: '10px', color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}>
        <Icon.Clock size={14} color="var(--muted)" /> 距开始还有 {fmtDur(r.minsUntilStart)}
      </div>
    )
  }

  // 状态副信息
  let subInfo = ''
  if (r.state === 'LIVE') subInfo = `进行中 · 距打卡截止 ${fmtDur(r.minsUntilDeadline)} · 完成 +${task.baseReward}`
  else if (r.state === 'VERIFY') subInfo = `已专注 · 待拍照核验 · 完成 +${task.baseReward}`
  else if (r.state === 'GRACE') subInfo = `宽限期剩 ${fmtDur(r.minsUntilDeadline)} · 抓紧核验`
  else if (r.state === 'READY') subInfo = `${fmtDur(r.minsUntilStart)}后开始 · PERIOD ${task.period}`
  else if (r.state === 'LOCKED') subInfo = `${timeStr} · PERIOD ${task.period}`

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: `1px solid ${isActionable ? r.color : 'var(--border)'}`,
      padding: '18px 16px', position: 'relative', clipPath: CLIP,
      boxShadow: isActionable ? `0 0 20px ${r.color}25` : 'none'
    }}>
      <div className="corner-deco tl" style={{ borderColor: r.color }} />
      <div className="corner-deco tr" style={{ borderColor: r.color }} />
      <div className="corner-deco bl" style={{ borderColor: r.color }} />
      <div className="corner-deco br" style={{ borderColor: r.color }} />

      {/* 呼吸灯 */}
      {r.blink && (
        <div style={{
          position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%',
          background: r.color, boxShadow: `0 0 10px ${r.color}`,
          animation: 'breathe 2s ease-in-out infinite'
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: r.color, fontFamily: 'Share Tech Mono, monospace', letterSpacing: 2 }}>
          CURRENT MISSION
        </span>
        <span style={{
          fontSize: 10, padding: '1px 8px', background: `${r.color}15`,
          border: `1px solid ${r.color}50`, color: r.color,
          fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 1
        }}>{r.label}</span>
      </div>

      <div style={{ fontSize: 30, fontWeight: 700, fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 2, lineHeight: 1.1 }}>
        {task.subject}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 14 }}>
        {timeStr} · DIFF {task.difficulty === 'hard' ? 'HIGH' : task.difficulty === 'medium' ? 'MED' : 'LOW'}
      </div>

      {/* LIVE 进度条 */}
      {r.state === 'LIVE' && (
        <div style={{ height: 4, background: 'var(--bg-alt)', borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ width: `${r.liveProgress}%`, height: '100%', background: r.color, transition: 'width 1s' }} />
        </div>
      )}

      {primaryBtn}

      <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', marginTop: 10 }}>
        {subInfo}
      </div>
    </div>
  )
}

// 大主操作按钮
function BigBtn({ children, color, onClick, disabled }: { children: React.ReactNode; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', padding: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: `${color}12`, border: `1px solid ${color}`, color,
        fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", fontSize: 16, fontWeight: 600, letterSpacing: 2,
        cursor: disabled ? 'not-allowed' : 'pointer', clipPath: CLIP_SM, opacity: disabled ? 0.5 : 1
      }}
    >{children}</button>
  )
}

// 全部结束的结算卡
function SettlementCard({ total, done, missed, allSettled }: { total: number; done: number; missed: number; allSettled: boolean }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid #22c55e',
      padding: '24px 16px', position: 'relative', clipPath: CLIP, textAlign: 'center'
    }}>
      <div className="corner-deco tl" style={{ borderColor: '#22c55e' }} />
      <div className="corner-deco br" style={{ borderColor: '#22c55e' }} />
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
        <Icon.Trophy size={28} color="#f59e0b" />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Teko, sans-serif', letterSpacing: 2, marginBottom: 4 }}>
        {allSettled ? '今日航程完成' : '暂无进行中任务'}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace' }}>
        完成 {done}/{total} · 逾期 {missed}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 统一时间轴（Phase 8）—— Course + Dynamic 单一列表，Mission 统一身份
// ═══════════════════════════════════════════════════════════
const VIEW_STATUS: Record<MissionViewStatus, { label: string; color: string }> = {
  PLANNED: { label: '已计划', color: '#8a9bb0' },
  COMMITTED: { label: '已承诺', color: '#45a29e' },
  EXECUTING: { label: '执行中', color: '#00d4ff' },
  COMPLETED: { label: '已完成', color: '#22c55e' },
  PARTIAL: { label: '部分完成', color: '#f59e0b' },
  ABANDONED: { label: '已放弃', color: '#8a8a8a' }
}

function UnifiedTimeline({ views, resolvedMap, currentMissionId, verifyingId, onVerify, onAbyss, onStartMission }: {
  views: MissionView[]
  resolvedMap: Record<string, { task: any; r: any }>
  currentMissionId: string | null
  verifyingId: string | null
  onVerify: (classTaskId: string) => void
  onAbyss: (classTaskId: string) => void
  onStartMission: (missionId: string) => void
}) {
  return (
    <div style={{ position: 'relative', paddingLeft: 44 }}>
      {/* 脊柱 */}
      <div style={{
        position: 'absolute', left: 15, top: 8, bottom: 8, width: 2,
        background: 'linear-gradient(180deg, #22c55e, #45a29e, #ff4500, #5a6a7a)'
      }} />
      {views.map(v => {
        const courseEntry = v.classTaskId ? resolvedMap[v.classTaskId] : undefined
        if (courseEntry) {
          return (
            <CourseTimelineItem
              key={v.id} task={courseEntry.task} r={courseEntry.r}
              verifyingId={verifyingId} onVerify={onVerify} onAbyss={onAbyss}
            />
          )
        }
        return (
          <DynamicTimelineItem
            key={v.id} view={v} isCurrent={currentMissionId === v.id}
            onStart={() => onStartMission(v.id)}
          />
        )
      })}
    </div>
  )
}

/** 课程项（沿用 legacy 解析状态，保留拍照核验/深渊动作；Phase 9 再迁移 Evidence） */
function CourseTimelineItem({ task, r, verifyingId, onVerify, onAbyss }: {
  task: any; r: any; verifyingId: string | null
  onVerify: (id: string) => void; onAbyss: (id: string) => void
}) {
  const period = getPeriodTime(task.period)
  const timeStr = period ? `${period.startTime}` : ''
  const isPast = ['DONE', 'MISSED'].includes(r.state)
  const isCurrent = ['LIVE', 'VERIFY', 'GRACE'].includes(r.state)
  return (
    <div style={{ position: 'relative', marginBottom: 10 }}>
      <div style={{
        position: 'absolute', left: -36, top: 12, width: 14, height: 14, borderRadius: '50%',
        background: r.state === 'DONE' ? '#22c55e' : r.state === 'MISSED' ? '#ff4444' : 'var(--bg)',
        border: `2px solid ${r.color}`,
        boxShadow: isCurrent ? `0 0 10px ${r.color}` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {isCurrent && <div style={{ width: 5, height: 5, borderRadius: '50%', background: r.color, animation: 'breathe 2s infinite' }} />}
      </div>
      <div style={{
        position: 'absolute', left: -44, top: 32, width: 34, textAlign: 'right',
        fontSize: 9, color: isPast ? 'var(--muted)' : r.color,
        fontFamily: 'Share Tech Mono, monospace', opacity: isPast ? 0.5 : 1
      }}>{timeStr}</div>
      <div style={{
        background: 'var(--card-bg)',
        border: `1px solid ${isCurrent ? r.color : 'var(--border)'}`,
        padding: '10px 12px', clipPath: CLIP_SM,
        opacity: isPast ? 0.55 : 1,
        display: 'flex', alignItems: 'center', gap: 10
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 14, fontWeight: 700, fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 1,
              textDecoration: r.state === 'MISSED' ? 'line-through' : 'none'
            }}>{task.subject}</span>
            <span style={{
              fontSize: 9, padding: '1px 5px', background: `${r.color}12`,
              border: `1px solid ${r.color}40`, color: r.color,
              fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif"
            }}>{r.label}</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', marginTop: 1 }}>
            P{task.period} · {r.state === 'DONE' ? `+${task.baseReward + (task.bonusReward || 0)}` : r.state === 'MISSED' ? `-${task.penalty}` : `+${task.baseReward}`}
            {task.aiScore != null && r.state === 'DONE' ? ` · AI ${task.aiScore}` : ''}
          </div>
        </div>
        {isCurrent && r.state === 'LIVE' && (
          <button onClick={() => onAbyss(task.id)} style={{
            padding: '6px 10px', background: `${r.color}12`, border: `1px solid ${r.color}`, color: r.color,
            fontFamily: 'Share Tech Mono, monospace', fontSize: 10, cursor: 'pointer', clipPath: CLIP_SM,
            display: 'flex', alignItems: 'center', gap: 4
          }}><Icon.Play size={11} color={r.color} />深渊</button>
        )}
        {isCurrent && (r.state === 'VERIFY' || r.state === 'GRACE') && (
          <button onClick={() => onVerify(task.id)} disabled={verifyingId === task.id} style={{
            padding: '6px 10px', background: `${r.color}12`, border: `1px solid ${r.color}`, color: r.color,
            fontFamily: 'Share Tech Mono, monospace', fontSize: 10, cursor: 'pointer', clipPath: CLIP_SM,
            display: 'flex', alignItems: 'center', gap: 4, opacity: verifyingId === task.id ? 0.5 : 1
          }}><Icon.Camera size={11} color={r.color} />核验</button>
        )}
      </div>
    </div>
  )
}

/** 动态任务项（USER/AI Mission，统一身份） */
function DynamicTimelineItem({ view, isCurrent, onStart }: {
  view: MissionView; isCurrent: boolean; onStart: () => void
}) {
  const st = VIEW_STATUS[view.viewStatus]
  const pct = Math.min(100, Math.round(view.executionRate * 100))
  const isFinal = ['COMPLETED', 'PARTIAL', 'ABANDONED'].includes(view.viewStatus)
  const actionable = ['PLANNED', 'COMMITTED', 'EXECUTING'].includes(view.viewStatus)
  return (
    <div style={{ position: 'relative', marginBottom: 10 }}>
      <div style={{
        position: 'absolute', left: -36, top: 12, width: 14, height: 14, borderRadius: '50%',
        background: view.viewStatus === 'COMPLETED' ? '#22c55e' : view.viewStatus === 'ABANDONED' ? '#8a8a8a' : 'var(--bg)',
        border: `2px solid ${st.color}`,
        boxShadow: view.viewStatus === 'EXECUTING' ? `0 0 10px ${st.color}` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {view.viewStatus === 'EXECUTING' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: st.color, animation: 'breathe 2s infinite' }} />}
      </div>
      <div style={{
        position: 'absolute', left: -44, top: 32, width: 34, textAlign: 'right',
        fontSize: 9, color: isFinal ? 'var(--muted)' : st.color,
        fontFamily: 'Share Tech Mono, monospace', opacity: isFinal ? 0.5 : 1
      }}>{fmtClock(view.plannedStart)}</div>
      <div style={{
        background: 'var(--card-bg)',
        border: `1px solid ${isCurrent ? st.color : 'var(--border)'}`,
        padding: '10px 12px', clipPath: CLIP_SM,
        opacity: isFinal ? 0.6 : 1
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", letterSpacing: 0.5 }}>
                {view.title}
              </span>
              <span style={{
                fontSize: 9, padding: '1px 5px', background: `${st.color}12`,
                border: `1px solid ${st.color}40`, color: st.color,
                fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif"
              }}>{st.label}</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', marginTop: 1 }}>
              {fmtClock(view.plannedStart)}–{fmtClock(view.plannedEnd)} · {view.targetMinutes}min · {view.source === 'AI' ? 'AI' : view.source === 'USER' ? '手动' : '课表'}
            </div>
          </div>
          {actionable && (
            <button onClick={onStart} style={{
              padding: '6px 10px', background: `${st.color}12`, border: `1px solid ${st.color}`, color: st.color,
              fontFamily: 'Share Tech Mono, monospace', fontSize: 10, cursor: 'pointer', clipPath: CLIP_SM,
              display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
            }}><Icon.Play size={11} color={st.color} />{view.viewStatus === 'EXECUTING' ? '回到任务' : '开始'}</button>
          )}
        </div>
        {!isFinal && pct > 0 && (
          <div style={{ height: 3, background: 'var(--bg-alt)', borderRadius: 2, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: st.color, transition: 'width 0.5s' }} />
          </div>
        )}
      </div>
    </div>
  )
}
