import { useState, useEffect, useMemo } from 'react'
import { useStore, type PageId } from '@/stores/useStore'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { getPeriodTime, resolveTaskState, reconcileOverdue, type TaskUIState } from '@/data/schedule'
import { verifyClassPhoto, reportToWarden } from '@/lib/verifyAI'
import { showToast } from '@/components/Toast'
import { logger } from '@/lib/logger'
import Icon from '@/components/Icons'
import { localDateStr, yesterdayDateStr } from '@/lib/dateUtils'

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
      useClassTaskStore.getState().addVerifyRecord({
        taskId, date: today, subject: task.subject,
        photoUrl: image.base64String || '',
        aiReview: verifyResult.review,
        aiScore: verifyResult.score,
        passed: verifyResult.passed
      })
      if (!verifyResult.passed) {
        logger.warn('schedule', `${task.subject} 核验未通过`, { score: verifyResult.score })
        showToast(`核验未通过：${verifyResult.review}`)
        await reportToWarden(`${task.subject} 打卡核验未通过（${verifyResult.score}分）。${verifyResult.review}`)
        return
      }
      const reward = completeClassTask(taskId, image.base64String || undefined, verifyResult.review, verifyResult.score)
      if (reward > 0) {
        addPoints(reward)
        addPointRecord('earn', reward, `${task.subject}课完成`)
        logger.info('schedule', `${task.subject} 核验通过`, { reward, score: verifyResult.score })
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
    <div className="safe-top" style={{ padding: '20px 16px 140px', background: 'var(--bg)', minHeight: '100vh' }}>
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

      {/* ═══ 纵向时间轴（B）═══ */}
      <div style={{ marginTop: 20, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 14, background: '#45a29e' }} />
        <div style={{ fontSize: 12, color: '#45a29e', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 2 }}>
          TODAY TIMELINE
        </div>
        <div style={{ flex: 1, height: 1, background: 'rgba(69,162,158,0.2)' }} />
      </div>

      {todayTasks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          <div style={{ fontSize: 13 }}>NO MISSIONS ASSIGNED</div>
          <div style={{ fontSize: 10, marginTop: 6, opacity: 0.5 }}>SYSTEM IDLE</div>
        </div>
      )}

      <Timeline resolved={resolved} now={now} verifyingId={verifying} onVerify={handleTakePhoto} onAbyss={enterAbyss} />
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
// 纵向时间轴（B）
// ═══════════════════════════════════════════════════════════
function Timeline({ resolved, now, verifyingId, onVerify, onAbyss }: {
  resolved: Array<{ task: any; r: any }>
  now: Date
  verifyingId: string | null
  onVerify: (id: string) => void
  onAbyss: (id: string) => void
}) {
  return (
    <div style={{ position: 'relative', paddingLeft: 44 }}>
      {/* 脊柱 */}
      <div style={{
        position: 'absolute', left: 15, top: 8, bottom: 8, width: 2,
        background: 'linear-gradient(180deg, #22c55e, #45a29e, #ff4500, #5a6a7a)'
      }} />

      {resolved.map(({ task, r }) => {
        const period = getPeriodTime(task.period)
        const timeStr = period ? `${period.startTime}` : ''
        const isPast = ['DONE', 'MISSED'].includes(r.state)
        const isCurrent = ['LIVE', 'VERIFY', 'GRACE'].includes(r.state)

        return (
          <div key={task.id} style={{ position: 'relative', marginBottom: 10 }}>
            {/* 节点圆点 */}
            <div style={{
              position: 'absolute', left: -36, top: 12, width: 14, height: 14, borderRadius: '50%',
              background: r.state === 'DONE' ? '#22c55e' : r.state === 'MISSED' ? '#ff4444' : 'var(--bg)',
              border: `2px solid ${r.color}`,
              boxShadow: isCurrent ? `0 0 10px ${r.color}` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {isCurrent && <div style={{ width: 5, height: 5, borderRadius: '50%', background: r.color, animation: 'breathe 2s infinite' }} />}
            </div>

            {/* 时间标签 */}
            <div style={{
              position: 'absolute', left: -44, top: 32, width: 34, textAlign: 'right',
              fontSize: 9, color: isPast ? 'var(--muted)' : r.color,
              fontFamily: 'Share Tech Mono, monospace', opacity: isPast ? 0.5 : 1
            }}>{timeStr}</div>

            {/* 课程条目 */}
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

              {/* 行内操作（仅当前态） */}
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
      })}
    </div>
  )
}
