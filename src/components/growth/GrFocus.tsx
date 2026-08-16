/**
 * src/components/growth/GrFocus.tsx
 * Growth Mode Focus — 成长专注空间。
 * 不是计时器，是进入专注的成长空间。
 * 展示：当前成长目标 / 专注时间 / 保持状态。
 * 复用 disciplineEngine 的 FocusEvidence（submitDungeonFocus），不重新实现业务逻辑。
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { App as CapApp } from '@capacitor/app'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import Icon from '@/components/Icons'
import { useMissionStore, submitDungeonFocus } from '@/core/discipline'
import type { Mission } from '@/core/discipline'

interface Props { onExit: () => void }

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function GrFocus({ onExit }: Props) {
  const addFocusMs = useStore(s => s.addFocusMs)
  const dungeonDurationMin = useStore(s => s.dungeonDurationMin)

  const missions = useMissionStore(s => s.missions)
  const currentMissionId = useMissionStore(s => s.currentMissionId)
  const currentMission: Mission | undefined = missions.find(m => m.id === currentMissionId)

  // 默认时长：若有当前任务用其目标时长，否则用 dungeonDurationMin
  const defaultMin = currentMission?.targetMinutes || dungeonDurationMin

  const [timeLeft, setTimeLeft] = useState(defaultMin * 60)
  const [totalTime, setTotalTime] = useState(defaultMin * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const focusStartRef = useRef<number | null>(null)
  const isRunningRef = useRef(false)

  useEffect(() => { isRunningRef.current = isRunning }, [isRunning])

  // ── Focus Runtime：开关 DUNGEON 专注区间（FocusEvidence）──
  const openFocusInterval = useCallback(() => {
    if (focusStartRef.current == null) focusStartRef.current = Date.now()
  }, [])

  const closeFocusInterval = useCallback(() => {
    if (focusStartRef.current == null) return
    const startedAt = focusStartRef.current
    const endedAt = Date.now()
    focusStartRef.current = null
    const dur = endedAt - startedAt
    if (dur <= 0) return
    const store = useMissionStore.getState()
    const m = store.getCurrentMission()
    if (m) submitDungeonFocus(m.id, startedAt, endedAt, 'focus')
    addFocusMs(dur)
  }, [addFocusMs])

  // App 切后台 → 关闭专注区间；回到前台且仍在计时 → 重新打开
  useEffect(() => {
    const subPause = CapApp.addListener('pause', () => { closeFocusInterval() })
    const subResume = CapApp.addListener('resume', () => { if (isRunningRef.current) openFocusInterval() })
    return () => { void subPause.then(s => s.remove()); void subResume.then(s => s.remove()) }
  }, [closeFocusInterval, openFocusInterval])

  const toggleFocus = useCallback(() => {
    if (isRunning) {
      if (timerRef.current) clearInterval(timerRef.current)
      setIsRunning(false)
      closeFocusInterval()
    } else {
      setIsRunning(true)
      setIsComplete(false)
      startTimeRef.current = Date.now()
      // 若任务 READY，启动时转入 FOCUSING
      const store = useMissionStore.getState()
      const cur = store.getCurrentMission()
      if (cur && cur.status === 'READY') {
        store.updateMission(cur.id, { status: 'FOCUSING', startedAt: Date.now() })
      }
      openFocusInterval()
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => (prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
  }, [isRunning, openFocusInterval, closeFocusInterval])

  // 计时完成 → 提交证据 → 判完成
  useEffect(() => {
    if (timeLeft === 0 && isRunning) {
      if (timerRef.current) clearInterval(timerRef.current)
      setIsRunning(false)
      closeFocusInterval()
      const missionAfter = useMissionStore.getState().getCurrentMission()
      const missionCompleted = missionAfter?.status === 'COMPLETED'
      setIsComplete(true)
      showToast(missionCompleted ? '专注完成！成长值已结算' : '专注时长已记录')
    }
  }, [timeLeft, isRunning, closeFocusInterval])

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const requestExit = useCallback(() => {
    if (showQuitConfirm) { setShowQuitConfirm(false); return }
    if (isRunning) { setShowQuitConfirm(true); return }
    onExit()
  }, [isRunning, showQuitConfirm, onExit])

  const requestExitRef = useRef(requestExit)
  requestExitRef.current = requestExit
  useEffect(() => {
    const sub = CapApp.addListener('backButton', () => { requestExitRef.current() })
    return () => { void sub.then(s => s.remove()) }
  }, [])

  const confirmQuit = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRunning(false)
    setShowQuitConfirm(false)
    closeFocusInterval()
    onExit()
  }

  const progressPct = totalTime > 0 ? Math.min(100, ((totalTime - timeLeft) / totalTime) * 100) : 0
  const missionPct = currentMission && currentMission.targetMinutes > 0
    ? Math.min(100, Math.round((currentMission.actualStudyMs / (currentMission.targetMinutes * 60000)) * 100))
    : 0

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--growth-bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '40px 24px', position: 'relative'
    }}>
      {/* 退出确认弹窗 */}
      {showQuitConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
        }}>
          <div className="gr-card" style={{ width: '100%', maxWidth: 320 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--growth-text)', marginBottom: 8 }}>
              要结束专注吗？
            </div>
            <div style={{ fontSize: 13, color: 'var(--growth-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
              你的专注时长会被记录，但任务尚未完成。休息一下也是一种成长。
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="gr-btn gr-btn-outline" onClick={() => setShowQuitConfirm(false)} style={{ flex: 1 }}>
                继续专注
              </button>
              <button className="gr-btn" onClick={confirmQuit} style={{ flex: 1, background: 'var(--danger)', color: '#fff' }}>
                结束
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 完成状态 */}
      {isComplete && (
        <div className="gr-card" style={{ width: '100%', maxWidth: 400, textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--success)', marginBottom: 6 }}>
            专注完成
          </div>
          <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', lineHeight: 1.6 }}>
            你的努力已被记录，成长值已结算。
          </div>
        </div>
      )}

      {/* 当前成长目标 */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', letterSpacing: 2, marginBottom: 6 }}>
          当前成长目标
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--growth-text)' }}>
          {currentMission?.title || '自由专注'}
        </div>
        {currentMission && (
          <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginTop: 4 }}>
            目标 {currentMission.targetMinutes} 分钟
          </div>
        )}
      </div>

      {/* 专注时间环形/数字 */}
      <div style={{
        width: 220, height: 220, borderRadius: '50%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        border: `3px solid ${isRunning ? 'var(--growth-primary)' : 'var(--growth-border)'}`,
        background: 'var(--growth-surface)',
        boxShadow: isRunning ? '0 0 30px rgba(124, 108, 171, 0.15)' : 'none',
        marginBottom: 24, transition: 'all 0.3s'
      }}>
        <div style={{ fontSize: 48, fontWeight: 200, color: 'var(--growth-text)', fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(timeLeft)}
        </div>
        <div style={{ fontSize: 11, color: isRunning ? 'var(--growth-primary)' : 'var(--growth-text-secondary)', letterSpacing: 2, marginTop: 4 }}>
          {isRunning ? '保持专注' : isComplete ? '已完成' : '准备就绪'}
        </div>
      </div>

      {/* 任务进度 */}
      {currentMission && (
        <div style={{ width: '100%', maxWidth: 400, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>任务进度</span>
            <span style={{ fontSize: 11, color: 'var(--growth-primary)' }}>{missionPct}%</span>
          </div>
          <div className="gr-progress">
            <div className="gr-progress-fill" style={{ width: `${missionPct}%`, background: 'var(--growth-primary)' }} />
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="gr-btn gr-btn-primary" onClick={toggleFocus} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px' }}>
          {isRunning ? <><Icon.Pause size={16} color="#fff" /> 暂停</> : <><Icon.Play size={16} color="#fff" /> {isComplete ? '再来一次' : '开始专注'}</>}
        </button>
        <button className="gr-btn gr-btn-outline" onClick={requestExit} style={{ width: '100%' }}>
          退出专注空间
        </button>
      </div>
    </div>
  )
}
