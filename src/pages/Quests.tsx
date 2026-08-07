import { useState } from 'react'
import { useStore, type PageId } from '@/stores/useStore'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { getPeriodTime, canStartClass, canCheckInClass } from '@/data/schedule'
import { verifyClassPhoto, reportToWarden } from '@/lib/verifyAI'
import { showToast } from '@/components/Toast'
import { logger } from '@/lib/logger'

interface Props {
  onNavigate?: (p: PageId) => void
}

export default function Quests({ onNavigate }: Props) {

  // 任务相关
  const points = useStore(s => s.points)

  // 课程相关
  const classTasks = useClassTaskStore(s => s.classTasks)
  const currentTask = useClassTaskStore(s => s.currentTask)
  const startClassTask = useClassTaskStore(s => s.startClassTask)
  const completeClassTask = useClassTaskStore(s => s.completeClassTask)
  const addPoints = useStore(s => s.addPoints)
  const addPointRecord = useStore(s => s.addPointRecord)

  const today = new Date().toISOString().slice(0, 10)
  const todayTasks = classTasks.filter(t => t.date === today).sort((a, b) => a.period - b.period)


  async function handleTakePhoto(taskId: string) {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      })

      const task = todayTasks.find(t => t.id === taskId)
      if (!task) return

      const check = canCheckInClass(task.period)
      if (!check.can) {
        showToast(check.reason || '无法打卡')
        return
      }

      showToast('验证官审查中...')
      logger.info('checkin', `${task.subject} 课拍照打卡，等待 AI 验证`)
      const verifyResult = await verifyClassPhoto(image.base64String || '', task.subject)

      useClassTaskStore.getState().addVerifyRecord({
        taskId,
        date: today,
        subject: task.subject,
        photoUrl: image.base64String || '',
        aiReview: verifyResult.review,
        aiScore: verifyResult.score,
        passed: verifyResult.passed
      })

      if (!verifyResult.passed) {
        logger.warn('checkin', `${task.subject} 课打卡验证未通过`, { score: verifyResult.score, review: verifyResult.review })
        showToast(`验证未通过：${verifyResult.review}`)
        await reportToWarden(`${task.subject}课打卡未通过（${verifyResult.score}分）。${verifyResult.review}`)
        return
      }

      const reward = completeClassTask(taskId, image.base64String || undefined, verifyResult.review, verifyResult.score)
      if (reward > 0) {
        addPoints(reward)
        addPointRecord('earn', reward, '课程打卡完成')
        logger.info('checkin', `${task.subject} 课打卡成功`, { reward, score: verifyResult.score })
        showToast(`验证通过！${verifyResult.score}分`)
        if (verifyResult.score >= 90) {
          await reportToWarden(`${task.subject}课打卡优秀！${verifyResult.score}分。${verifyResult.review}`)
        }
      }
    } catch (e: any) {
      if (e.message !== 'User cancelled photos app') {
        logger.error('checkin', '拍照打卡失败', { error: e?.message })
        showToast('拍照失败：' + (e.message || '未知错误'))
      }
    }
  }

  return (
    <div className="safe-top" style={{ padding: '24px 20px 140px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
            QUEST_CENTER
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 0 }}>
            任务中心
          </h1>
        </div>
        <button
          onClick={() => onNavigate?.('pointsDetail')}
          style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 100, padding: '6px 14px',
            display: 'flex', alignItems: 'center', gap: 4,
            cursor: 'pointer', color: 'var(--fg)'
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>{points}</span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>PTS ›</span>
        </button>
      </div>

      {/* 今日课程 */}
      {todayTasks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📚</div>
          <div style={{ fontSize: 14 }}>今日暂无课程</div>
        </div>
      )}
      {todayTasks.map(task => {
        const period = getPeriodTime(task.period)
        const timeStr = period ? `${period.startTime}-${period.endTime}` : ''
        const isCurrent = currentTask?.id === task.id
        const startCheck = canStartClass(task.period)

        return (
          <div key={task.id} className="card" style={{ padding: 16, borderRadius: 16, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{task.subject}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {timeStr} · {task.status === 'pending' ? '待开始' :
                    task.status === 'started' ? '进行中' :
                    task.status === 'completed' ? '✓ 已完成' :
                    task.status === 'overdue' ? '已逾期' : '缺课'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>+{task.baseReward}</div>
                {task.bonusReward > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--warning)' }}>+{task.bonusReward} bonus</div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {task.status === 'pending' && (
                <button
                  onClick={() => {
                    if (!startCheck.can) {
                      showToast(startCheck.reason || '无法开始')
                      return
                    }
                    startClassTask(task.id)
                  }}
                  disabled={!startCheck.can}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10,
                    background: startCheck.can ? 'var(--fg)' : 'var(--bg-alt)',
                    color: startCheck.can ? 'var(--bg)' : 'var(--muted)',
                    border: 'none', fontSize: 13, fontWeight: 600,
                    cursor: startCheck.can ? 'pointer' : 'not-allowed'
                  }}
                >
                  {startCheck.can ? '开始上课' : startCheck.reason}
                </button>
              )}
              {task.status === 'started' && (
                <button
                  onClick={() => handleTakePhoto(task.id)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10,
                    background: 'var(--info)', color: '#fff',
                    border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  📷 拍照打卡
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}