import { useState } from 'react'
import { useStore, type PageId } from '@/stores/useStore'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { getPeriodTime, canStartClass, canCheckInClass } from '@/data/schedule'
import { verifyClassPhoto, reportToWarden } from '@/lib/verifyAI'
import { showToast } from '@/components/Toast'
import { CATEGORY_TABS } from '@/data/quests'
import GaokaoProgress from '@/components/GaokaoProgress'

const ACCENT_COLOR: Record<string, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  info: 'var(--info)'
}

interface Props {
  onNavigate?: (p: PageId) => void
}

export default function Quests({ onNavigate }: Props) {
  const [tab, setTab] = useState<'tasks' | 'classes'>('tasks')
  const [taskTab, setTaskTab] = useState<'daily' | 'weekly' | 'main'>('daily')

  // 任务相关
  const quests = useStore(s => s.quests)
  const completeQuest = useStore(s => s.completeQuest)
  const points = useStore(s => s.points)

  // 课程相关
  const classTasks = useClassTaskStore(s => s.classTasks)
  const currentTask = useClassTaskStore(s => s.currentTask)
  const startClassTask = useClassTaskStore(s => s.startClassTask)
  const completeClassTask = useClassTaskStore(s => s.completeClassTask)
  const generateTodayTasks = useClassTaskStore(s => s.generateTodayTasks)
  const addPoints = useStore(s => s.addPoints)
  const addPointRecord = useStore(s => s.addPointRecord)

  const today = new Date().toISOString().slice(0, 10)
  const todayTasks = classTasks.filter(t => t.date === today).sort((a, b) => a.period - b.period)

  const taskList = quests.filter(q => q.category === taskTab)

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

  return (
    <div className="safe-top" style={{ padding: '24px 20px 140px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
            QUEST_CENTER
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginBottom: 0 }}>
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

      <GaokaoProgress variant="compact" />

      {/* 主Tab：任务 / 课程 */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 16,
        padding: 4, background: 'var(--card-bg)', borderRadius: 100,
        border: '1px solid var(--border)'
      }}>
        <button onClick={() => setTab('tasks')} style={{
          flex: 1, padding: '8px', borderRadius: 100,
          background: tab === 'tasks' ? 'var(--fg)' : 'transparent',
          color: tab === 'tasks' ? 'var(--bg)' : 'var(--muted)',
          border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer'
        }}>任务</button>
        <button onClick={() => setTab('classes')} style={{
          flex: 1, padding: '8px', borderRadius: 100,
          background: tab === 'classes' ? 'var(--fg)' : 'transparent',
          color: tab === 'classes' ? 'var(--bg)' : 'var(--muted)',
          border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer'
        }}>课程打卡</button>
      </div>

      {/* 任务列表 */}
      {tab === 'tasks' && (
        <>
          <div style={{
            display: 'flex', gap: 6, marginBottom: 12,
            padding: 4, background: 'var(--card-bg)', borderRadius: 100,
            border: '1px solid var(--border)'
          }}>
            {CATEGORY_TABS.map(c => (
              <button key={c.id} onClick={() => setTaskTab(c.id as any)} style={{
                flex: 1, padding: '6px 10px', borderRadius: 100,
                background: taskTab === c.id ? 'var(--fg)' : 'transparent',
                color: taskTab === c.id ? 'var(--bg)' : 'var(--muted)',
                border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}>{c.label}</button>
            ))}
          </div>

          {taskList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📋</div>
              <div style={{ fontSize: 14 }}>暂无{taskTab === 'daily' ? '每日' : taskTab === 'weekly' ? '每周' : '主线'}任务</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>和监管者说"加个任务"来创建</div>
            </div>
          )}

          {taskList.map(q => (
            <div key={q.id} className="card" style={{
              padding: 14, borderRadius: 12, marginBottom: 10,
              borderLeft: `3px solid ${ACCENT_COLOR[q.accent] || 'var(--fg)'}`,
              opacity: q.completed ? 0.6 : 1
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{q.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>{q.desc}</div>
                  <div style={{
                    height: 4, borderRadius: 2, background: 'var(--bg-alt)', overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%', width: `${Math.min(100, (q.progress / q.total) * 100)}%`,
                      background: ACCENT_COLOR[q.accent] || 'var(--fg)', borderRadius: 2,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, fontFamily: 'DM Mono, monospace' }}>
                    {q.progress}/{q.total} · {q.reward} {q.rewardType}
                  </div>
                </div>
                {!q.completed && (
                  <button onClick={() => completeQuest(q.id)} style={{
                    marginLeft: 10, padding: '6px 14px', borderRadius: 100,
                    background: 'var(--fg)', color: 'var(--bg)',
                    border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}>完成</button>
                )}
                {q.completed && (
                  <span style={{ marginLeft: 10, fontSize: 20 }}>✓</span>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* 课程列表 */}
      {tab === 'classes' && (
        <div>
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
              <div key={task.id} className="card" style={{ padding: 14, borderRadius: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: task.status === 'completed' ? 'rgba(22, 163, 74, 0.1)' :
                      task.status === 'overdue' || task.status === 'absent' ? 'rgba(229, 77, 46, 0.1)' :
                      isCurrent ? 'rgba(0, 120, 255, 0.1)' : 'var(--bg-alt)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    color: task.status === 'completed' ? 'var(--success)' :
                      task.status === 'overdue' || task.status === 'absent' ? 'var(--danger)' :
                      isCurrent ? '#0078ff' : 'var(--muted)'
                  }}>
                    {task.period}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{task.subject}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {timeStr} · {task.status === 'pending' ? '待开始' :
                        task.status === 'started' ? '进行中' :
                        task.status === 'completed' ? '已完成' :
                        task.status === 'overdue' ? '已逾期' : '缺课'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>+{task.baseReward}</div>
                    {task.bonusReward > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--warning)' }}>+{task.bonusReward} bonus</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
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
                        flex: 1, padding: '8px', borderRadius: 8,
                        background: startCheck.can ? 'var(--fg)' : 'var(--bg-alt)',
                        color: startCheck.can ? 'var(--bg)' : 'var(--muted)',
                        border: 'none', fontSize: 12, fontWeight: 600,
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
                        flex: 1, padding: '8px', borderRadius: 8,
                        background: '#0078ff', color: '#fff',
                        border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      拍照打卡
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}