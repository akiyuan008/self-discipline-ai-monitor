import { useState, useEffect } from 'react'
import { useStore, type PageId } from '@/stores/useStore'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { getPeriodTime, canStartClass, canCheckInClass, timeToMinutes, PERIODS } from '@/data/schedule'
import { verifyClassPhoto, reportToWarden } from '@/lib/verifyAI'
import { showToast } from '@/components/Toast'
import { logger } from '@/lib/logger'

interface Props {
  onNavigate?: (p: PageId) => void
}

function getCourseStatus(task: any) {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const period = getPeriodTime(task.period)
  if (!period) return { status: 'unknown', label: '未知', color: '#888' }

  const startMin = timeToMinutes(period.startTime)
  const endMin = timeToMinutes(period.endTime)

  // 用户已操作的状态优先
  if (task.status === 'completed') return { status: 'completed', label: '已完成', color: '#16A34A', bg: 'rgba(22,163,74,0.1)' }
  if (task.status === 'absent') return { status: 'absent', label: '缺课', color: '#E54D2E', bg: 'rgba(229,77,46,0.1)' }
  if (task.status === 'overdue') return { status: 'overdue', label: '已逾期', color: '#E54D2E', bg: 'rgba(229,77,46,0.1)' }
  if (task.status === 'started') return { status: 'started', label: '进行中', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' }

  // 自动判断
  if (nowMin < startMin) {
    const minsLeft = startMin - nowMin
    return { status: 'pending', label: `还有 ${minsLeft} 分钟`, color: '#8a8a8a', bg: 'rgba(0,0,0,0.03)' }
  }
  if (nowMin >= startMin && nowMin <= endMin) {
    return { status: 'ongoing', label: '正在上课', color: '#ff4500', bg: 'rgba(255,69,0,0.1)' }
  }
  return { status: 'missed', label: '已错过', color: '#E54D2E', bg: 'rgba(229,77,46,0.1)' }
}

export default function Quests({ onNavigate }: Props) {
  const points = useStore(s => s.points)
  const theme = useStore(s => s.theme)
  const setDungeonDuration = useStore(s => s.setDungeonDuration)
  const isWandering = true

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

  async function handleTakePhoto(taskId: string) {
    try {
      const image = await Camera.getPhoto({
        quality: 80, allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      })
      const task = todayTasks.find(t => t.id === taskId)
      if (!task) return
      const check = canCheckInClass(task.period)
      if (!check.can) { showToast(check.reason || '无法打卡'); return }

      showToast('验证官审查中...')
      const verifyResult = await verifyClassPhoto(image.base64String || '', task.subject)
      useClassTaskStore.getState().addVerifyRecord({
        taskId, date: today, subject: task.subject,
        photoUrl: image.base64String || '',
        aiReview: verifyResult.review,
        aiScore: verifyResult.score,
        passed: verifyResult.passed
      })

      if (!verifyResult.passed) {
        showToast(`验证未通过：${verifyResult.review}`)
        await reportToWarden(`${task.subject}课打卡未通过（${verifyResult.score}分）。${verifyResult.review}`)
        return
      }
      const reward = completeClassTask(taskId, image.base64String || undefined, verifyResult.review, verifyResult.score)
      if (reward > 0) {
        addPoints(reward)
        addPointRecord('earn', reward, '课程打卡完成')
        showToast(`验证通过！${verifyResult.score}分`)
        if (verifyResult.score >= 90) {
          await reportToWarden(`${task.subject}课打卡优秀！${verifyResult.score}分。${verifyResult.review}`)
        }
      }
    } catch (e: any) {
      if (e.message !== 'User cancelled photos app') {
        showToast('拍照失败：' + (e.message || '未知错误'))
      }
    }
  }

  function enterAbyss(task: any) {
    const period = getPeriodTime(task.period)
    if (!period) return
    const startMin = timeToMinutes(period.startTime)
    const endMin = timeToMinutes(period.endTime)
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const remainingMin = Math.max(1, endMin - nowMin)

    setDungeonDuration(remainingMin)
    startClassTask(task.id)
    onNavigate?.('dungeon')
  }

  return (
    <div className="safe-top" style={{ padding: '24px 20px 140px', background: 'var(--bg)', minHeight: '100vh' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: isWandering ? 'Share Tech Mono, monospace' : 'DM Mono, monospace', letterSpacing: 1 }}>
            {isWandering ? 'UEG QUEST CENTER' : 'QUEST_CENTER'}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, margin: '4px 0 0', fontFamily: isWandering ? 'Teko, sans-serif' : 'inherit' }}>
            {isWandering ? 'MISSION CONTROL' : '任务中心'}
          </h1>
        </div>
        <button onClick={() => onNavigate?.('pointsDetail')} style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: 100, padding: '6px 14px',
          display: 'flex', alignItems: 'center', gap: 4,
          cursor: 'pointer', color: 'var(--fg)'
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>{points}</span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>PTS ›</span>
        </button>
      </div>

      {/* 今日概览 */}
      {todayTasks.length > 0 && (
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '14px 16px', marginBottom: 16,
          display: 'flex', justifyContent: 'space-around', textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>
              {todayTasks.filter(t => t.status === 'completed').length}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>已完成</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warning)' }}>
              {todayTasks.filter(t => t.status === 'pending' || t.status === 'started').length}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>待完成</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--danger)' }}>
              {todayTasks.filter(t => t.status === 'overdue' || t.status === 'absent').length}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>失败</div>
          </div>
        </div>
      )}

      {/* 课程列表 */}
      {todayTasks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 14, opacity: 0.4 }}>今日暂无课程</div>
          <div style={{ fontSize: 12, marginTop: 8, opacity: 0.3 }}>好好休息，明天再战</div>
        </div>
      )}

      {todayTasks.map(task => {
        const period = getPeriodTime(task.period)
        const timeStr = period ? `${period.startTime}-${period.endTime}` : ''
        const statusInfo = getCourseStatus(task)
        const isCurrent = currentTask?.id === task.id
        const startCheck = canStartClass(task.period)
        const nowMin = now.getHours() * 60 + now.getMinutes()
        const endMin = period ? timeToMinutes(period.endTime) : 0
        const progress = period && nowMin >= timeToMinutes(period.startTime) && nowMin <= endMin
          ? ((nowMin - timeToMinutes(period.startTime)) / (endMin - timeToMinutes(period.startTime))) * 100
          : task.status === 'completed' ? 100 : 0

        return (
          <div key={task.id} style={{
            background: 'var(--card-bg)',
            border: `2px solid ${statusInfo.status === 'ongoing' || statusInfo.status === 'started' ? statusInfo.color : 'var(--border)'}`,
            borderRadius: 16, padding: 16, marginBottom: 12,
            position: 'relative', overflow: 'hidden',
            boxShadow: statusInfo.status === 'ongoing' || statusInfo.status === 'started'
              ? `0 0 20px ${statusInfo.bg}` : 'none'
          }}>
            {/* 呼吸灯效果 - 进行中课程 */}
            {(statusInfo.status === 'ongoing' || statusInfo.status === 'started') && (
              <div style={{
                position: 'absolute', top: 12, right: 12,
                width: 8, height: 8, borderRadius: '50%',
                background: statusInfo.color,
                animation: 'breathe 2s ease-in-out infinite',
                boxShadow: `0 0 10px ${statusInfo.color}`
              }} />
            )}

            {/* 进度条 */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: 3, background: 'var(--bg-alt)', borderRadius: '0 0 14px 14px'
            }}>
              <div style={{
                width: `${progress}%`, height: '100%',
                background: statusInfo.color,
                borderRadius: '0 0 14px 14px',
                transition: 'width 1s linear'
              }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              {/* 状态图标 */}
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: statusInfo.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0
              }}>
                {task.status === 'completed' ? '✓' :
                 task.status === 'absent' || task.status === 'overdue' ? '✕' :
                 statusInfo.status === 'ongoing' || statusInfo.status === 'started' ? '▶' :
                 '○'}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{task.subject}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px',
                    borderRadius: 100, background: statusInfo.bg, color: statusInfo.color
                  }}>
                    {statusInfo.label}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                  {timeStr} · 第{task.period}节 · {task.difficulty === 'hard' ? '困难' : task.difficulty === 'medium' ? '中等' : '简单'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>+{task.baseReward}</div>
                {task.bonusReward > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--warning)' }}>+{task.bonusReward} bonus</div>
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: 8 }}>
              {(statusInfo.status === 'pending' || statusInfo.status === 'ongoing') && task.status !== 'started' && task.status !== 'completed' && (
                <button onClick={() => enterAbyss(task)} style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  background: isWandering ? 'rgba(255,69,0,0.15)' : 'var(--fg)',
                  color: isWandering ? '#ff4500' : 'var(--bg)',
                  border: isWandering ? '1px solid #ff4500' : 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: isWandering ? 'Teko, sans-serif' : 'inherit',
                  letterSpacing: 1, textTransform: 'uppercase',
                  clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
                }}>
                  {isWandering ? 'ENTER ABYSS' : '进入深渊'}
                </button>
              )}

              {task.status === 'started' && (
                <>
                  <button onClick={() => handleTakePhoto(task.id)} style={{
                    flex: 1, padding: '10px', borderRadius: 10,
                    background: 'var(--info)', color: '#fff',
                    border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}>
                    拍照打卡
                  </button>
                  <button onClick={() => onNavigate?.('dungeon')} style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: 'var(--bg-alt)', color: 'var(--fg)',
                    border: '1px solid var(--border)', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer'
                  }}>
                    返回深渊
                  </button>
                </>
              )}

              {task.status === 'completed' && (
                <div style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  background: 'rgba(22,163,74,0.1)', color: '#16A34A',
                  textAlign: 'center', fontSize: 13, fontWeight: 600
                }}>
                  ✓ 已完成 · {task.aiScore ?? '--'}分
                </div>
              )}

              {(task.status === 'overdue' || task.status === 'absent') && (
                <div style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  background: 'rgba(229,77,46,0.1)', color: '#E54D2E',
                  textAlign: 'center', fontSize: 13, fontWeight: 600
                }}>
                  ✕ {task.status === 'overdue' ? '已逾期' : '缺课'} · -{task.penalty}分
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
