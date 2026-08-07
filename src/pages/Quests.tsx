import { useState, useEffect } from 'react'
import { useStore, type PageId } from '@/stores/useStore'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { getPeriodTime, canStartClass, canCheckInClass, timeToMinutes } from '@/data/schedule'
import { verifyClassPhoto, reportToWarden } from '@/lib/verifyAI'
import { showToast } from '@/components/Toast'

interface Props {
  onNavigate?: (p: PageId) => void
}

function getCourseStatus(task: any, now: Date) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const period = getPeriodTime(task.period)
  if (!period) return { status: 'unknown', label: 'UNKNOWN', color: '#888', blink: false }

  const startMin = timeToMinutes(period.startTime)
  const endMin = timeToMinutes(period.endTime)

  if (task.status === 'completed') return { status: 'completed', label: 'COMPLETE', color: '#45a29e', blink: false }
  if (task.status === 'absent') return { status: 'absent', label: 'FAILED', color: '#ff4444', blink: false }
  if (task.status === 'overdue') return { status: 'overdue', label: 'OVERDUE', color: '#ff4444', blink: false }
  if (task.status === 'started') return { status: 'started', label: 'ACTIVE', color: '#ff4500', blink: true }

  if (nowMin < startMin) {
    const minsLeft = startMin - nowMin
    return { status: 'pending', label: `T-${minsLeft}MIN`, color: '#5a6a7a', blink: false }
  }
  if (nowMin >= startMin && nowMin <= endMin) {
    return { status: 'ongoing', label: 'IGNITION', color: '#ff4500', blink: true }
  }
  return { status: 'missed', label: 'MISSED', color: '#ff4444', blink: false }
}

export default function Quests({ onNavigate }: Props) {
  const points = useStore(s => s.points)
  const setDungeonDuration = useStore(s => s.setDungeonDuration)

  const classTasks = useClassTaskStore(s => s.classTasks)
  const currentTask = useClassTaskStore(s => s.currentTask)
  const startClassTask = useClassTaskStore(s => s.startClassTask)
  const completeClassTask = useClassTaskStore(s => s.completeClassTask)
  const addPoints = useStore(s => s.addPoints)
  const addPointRecord = useStore(s => s.addPointRecord)

  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  const today = now.toISOString().slice(0, 10)
  const todayTasks = classTasks.filter(t => t.date === today).sort((a, b) => a.period - b.period)

  const completed = todayTasks.filter(t => t.status === 'completed').length
  const pending = todayTasks.filter(t => t.status === 'pending' || t.status === 'started').length
  const failed = todayTasks.filter(t => t.status === 'overdue' || t.status === 'absent').length

  async function handleTakePhoto(taskId: string) {
    try {
      const image = await Camera.getPhoto({ quality: 80, allowEditing: false, resultType: CameraResultType.Base64, source: CameraSource.Camera })
      const task = todayTasks.find(t => t.id === taskId)
      if (!task) return
      const check = canCheckInClass(task.period)
      if (!check.can) { showToast(check.reason || '无法打卡'); return }

      showToast('VERIFYING...')
      const verifyResult = await verifyClassPhoto(image.base64String || '', task.subject)
      useClassTaskStore.getState().addVerifyRecord({
        taskId, date: today, subject: task.subject,
        photoUrl: image.base64String || '',
        aiReview: verifyResult.review,
        aiScore: verifyResult.score,
        passed: verifyResult.passed
      })

      if (!verifyResult.passed) {
        showToast(`REJECTED: ${verifyResult.review}`)
        await reportToWarden(`${task.subject} CHECK FAILED (${verifyResult.score}). ${verifyResult.review}`)
        return
      }
      const reward = completeClassTask(taskId, image.base64String || undefined, verifyResult.review, verifyResult.score)
      if (reward > 0) {
        addPoints(reward)
        addPointRecord('earn', reward, 'COURSE COMPLETE')
        showToast(`VERIFIED: ${verifyResult.score} PTS`)
        if (verifyResult.score >= 90) {
          await reportToWarden(`${task.subject} EXCELLENT! ${verifyResult.score} PTS.`)
        }
      }
    } catch (e: any) {
      if (e.message !== 'User cancelled photos app') showToast('CAMERA ERROR')
    }
  }

  function enterAbyss(task: any) {
    const period = getPeriodTime(task.period)
    if (!period) return
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const endMin = timeToMinutes(period.endTime)
    const remainingMin = Math.max(1, endMin - nowMin)
    setDungeonDuration(remainingMin)
    startClassTask(task.id)
    onNavigate?.('dungeon')
  }

  return (
    <div className="safe-top" style={{ padding: '20px 16px 140px', background: 'var(--bg)', minHeight: '100vh' }}>
      {/* 顶部 */}
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
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b', fontFamily: 'Teko, sans-serif' }}>
            {points}
          </div>
        </div>
      </div>

      {/* 概览面板 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16
      }}>
        {[
          { label: 'COMPLETE', value: completed, color: '#45a29e' },
          { label: 'PENDING', value: pending, color: '#ff4500' },
          { label: 'FAILED', value: failed, color: '#ff4444' },
        ].map(item => (
          <div key={item.label} style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            padding: '10px', textAlign: 'center', position: 'relative',
            clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
          }}>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 1 }}>{item.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: item.color, fontFamily: 'Teko, sans-serif' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* 课程列表 */}
      {todayTasks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          <div style={{ fontSize: 14 }}>NO MISSIONS ASSIGNED</div>
          <div style={{ fontSize: 11, marginTop: 8, opacity: 0.5 }}>SYSTEM IDLE</div>
        </div>
      )}

      {todayTasks.map(task => {
        const period = getPeriodTime(task.period)
        const timeStr = period ? `${period.startTime}-${period.endTime}` : ''
        const status = getCourseStatus(task, now)
        const nowMin = now.getHours() * 60 + now.getMinutes()
        const startMin = period ? timeToMinutes(period.startTime) : 0
        const endMin = period ? timeToMinutes(period.endTime) : 0
        const progress = period && nowMin >= startMin && nowMin <= endMin
          ? ((nowMin - startMin) / (endMin - startMin)) * 100
          : task.status === 'completed' ? 100 : 0

        return (
          <div key={task.id} style={{
            background: 'var(--card-bg)',
            border: `1px solid ${status.blink ? status.color : 'var(--border)'}`,
            padding: '14px', marginBottom: 10, position: 'relative',
            clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
            boxShadow: status.blink ? `0 0 15px ${status.color}30` : 'none'
          }}>
            <div className="corner-deco tl" style={{ width: 8, height: 8, borderWidth: 1, borderColor: status.color }} />
            <div className="corner-deco tr" style={{ width: 8, height: 8, borderWidth: 1, borderColor: status.color }} />
            <div className="corner-deco bl" style={{ width: 8, height: 8, borderWidth: 1, borderColor: status.color }} />
            <div className="corner-deco br" style={{ width: 8, height: 8, borderWidth: 1, borderColor: status.color }} />

            {/* 呼吸灯 */}
            {status.blink && (
              <div style={{
                position: 'absolute', top: 10, right: 10,
                width: 6, height: 6, borderRadius: '50%',
                background: status.color,
                animation: 'breathe 2s ease-in-out infinite',
                boxShadow: `0 0 8px ${status.color}`
              }} />
            )}

            {/* 进度条 */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--bg-alt)' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: status.color, transition: 'width 1s' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 40, height: 40,
                background: `${status.color}15`, border: `1px solid ${status.color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontFamily: 'Share Tech Mono, monospace',
                clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
              }}>
                {task.status === 'completed' ? '✓' : task.status === 'absent' || task.status === 'overdue' ? '✕' : status.blink ? '▶' : '○'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Teko, sans-serif', letterSpacing: 1 }}>{task.subject.toUpperCase()}</span>
                  <span style={{ fontSize: 9, fontFamily: 'Share Tech Mono, monospace', padding: '1px 6px', background: `${status.color}15`, color: status.color, border: `1px solid ${status.color}40` }}>
                    {status.label}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', marginTop: 2 }}>
                  {timeStr} // PERIOD {task.period} // DIFF: {task.difficulty === 'hard' ? 'HIGH' : task.difficulty === 'medium' ? 'MED' : 'LOW'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', fontFamily: 'Teko, sans-serif' }}>+{task.baseReward}</div>
                {task.bonusReward > 0 && <div style={{ fontSize: 9, color: '#ff4500', fontFamily: 'Share Tech Mono, monospace' }}>+{task.bonusReward} BONUS</div>}
              </div>
            </div>

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: 6, position: 'relative', zIndex: 1 }}>
              {(status.status === 'pending' || status.status === 'ongoing') && task.status !== 'started' && task.status !== 'completed' && (
                <>
                  {status.status === 'pending' && (
                    <button onClick={() => {
                      // 立即准备：设置提醒并显示准备中
                      showToast(`${task.subject} 准备模式已启动`)
                    }} style={{
                      flex: 1, padding: '8px', background: 'rgba(69,162,158,0.1)',
                      border: '1px solid #45a29e', color: '#45a29e',
                      fontFamily: 'Share Tech Mono, monospace', fontSize: 11,
                      cursor: 'pointer', letterSpacing: 1,
                      clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
                    }}>
                      PREPARE
                    </button>
                  )}
                  <button onClick={() => enterAbyss(task)} style={{
                    flex: 1, padding: '8px', background: 'rgba(255,69,0,0.1)',
                    border: '1px solid #ff4500', color: '#ff4500',
                    fontFamily: 'Teko, sans-serif', fontSize: 13, letterSpacing: 1,
                    cursor: 'pointer', textTransform: 'uppercase',
                    clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
                  }}>
                    ENTER ABYSS
                  </button>
                </>
              )}
              {task.status === 'started' && (
                <>
                  <button onClick={() => handleTakePhoto(task.id)} style={{
                    flex: 1, padding: '8px', background: 'rgba(69,162,158,0.1)',
                    border: '1px solid #45a29e', color: '#45a29e',
                    fontFamily: 'Share Tech Mono, monospace', fontSize: 11,
                    cursor: 'pointer', letterSpacing: 1,
                    clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
                  }}>
                    VERIFY
                  </button>
                  <button onClick={() => onNavigate?.('dungeon')} style={{
                    padding: '8px 12px', background: 'var(--bg-alt)',
                    border: '1px solid var(--border)', color: 'var(--fg)',
                    fontFamily: 'Share Tech Mono, monospace', fontSize: 11,
                    cursor: 'pointer',
                    clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
                  }}>
                    RETURN
                  </button>
                </>
              )}
              {task.status === 'completed' && (
                <div style={{
                  flex: 1, padding: '8px', background: 'rgba(69,162,158,0.08)',
                  color: '#45a29e', textAlign: 'center',
                  fontFamily: 'Share Tech Mono, monospace', fontSize: 11, letterSpacing: 1,
                  border: '1px solid rgba(69,162,158,0.2)',
                  clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
                }}>
                  ✓ COMPLETE // {task.aiScore ?? '--'} PTS
                </div>
              )}
              {(task.status === 'overdue' || task.status === 'absent') && (
                <div style={{
                  flex: 1, padding: '8px', background: 'rgba(255,68,68,0.08)',
                  color: '#ff4444', textAlign: 'center',
                  fontFamily: 'Share Tech Mono, monospace', fontSize: 11, letterSpacing: 1,
                  border: '1px solid rgba(255,68,68,0.2)',
                  clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
                }}>
                  ✕ {task.status === 'overdue' ? 'OVERDUE' : 'ABSENT'} // -{task.penalty}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
