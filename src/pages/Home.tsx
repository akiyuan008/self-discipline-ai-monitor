import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { App } from '@capacitor/app'
import { fetchUsageStats, hasUsageAccess, fmtMs, isLateNight, openUsageAccessSettings } from '@/lib/usageStats'
import { logger } from '@/lib/logger'
import GaokaoProgress from '@/components/GaokaoProgress'
import Icon from '@/components/Icons'
import type { PageId } from '@/stores/useStore'
import { useMissionStore, startMission } from '@/core/discipline'
import type { Mission } from '@/core/discipline'
import { useWandering } from '@/hooks/useWandering'
import MCHome from '@/components/mission-control/MCHome'

interface Props {
  onNavigate?: (p: PageId) => void
}

function DataBlock({ label, value, unit, color = 'var(--success)' }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      padding: '12px 14px', position: 'relative',
      clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'
    }}>
      <div className="corner-deco tl" style={{ width: 10, height: 10, borderWidth: 1 }} />
      <div className="corner-deco tr" style={{ width: 10, height: 10, borderWidth: 1 }} />
      <div className="corner-deco bl" style={{ width: 10, height: 10, borderWidth: 1 }} />
      <div className="corner-deco br" style={{ width: 10, height: 10, borderWidth: 1 }} />
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'Teko, sans-serif', lineHeight: 1.1, marginTop: 2 }}>
        {value}<span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  )
}

function StatusLine({ label, status, ok, onClick }: { label: string; status: string; ok: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace' }}>{label}</span>
      <span style={{ fontSize: 11, color: ok ? '#45a29e' : '#ff4500', fontFamily: 'Share Tech Mono, monospace', fontWeight: ok ? 400 : 700 }}>
        [{status}]
      </span>
    </div>
  )
}

function fmtClock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function missionPct(m: Mission): number {
  if (m.targetMinutes <= 0) return 0
  return Math.min(100, Math.round((m.actualStudyMs / (m.targetMinutes * 60000)) * 100))
}

const MISSION_STATUS_META: Record<string, { label: string; color: string }> = {
  READY: { label: 'READY 待开始', color: '#45a29e' },
  FOCUSING: { label: 'FOCUSING 专注中', color: '#00d4ff' },
  DISTRACTED: { label: 'DISTRACTED 已分心', color: '#ff4500' },
  INTERVENTION: { label: 'INTERVENTION 干预中', color: '#ff4500' },
  RECOVERING: { label: 'RECOVERING 恢复中', color: '#f59e0b' },
  COMPLETED: { label: 'COMPLETED 已完成', color: '#45a29e' },
  MISSED: { label: 'MISSED 已错过', color: '#8a8a8a' },
  IDLE: { label: 'IDLE 空闲', color: '#8a8a8a' }
}

export default function Home({ onNavigate }: Props) {
  const isMC = useWandering()
  if (isMC) return <MCHome onNavigate={onNavigate} />
  return <NormalHome onNavigate={onNavigate} />
}

function NormalHome({ onNavigate }: Props) {
  const points = useStore(s => s.points)
  const streak = useStore(s => s.streak)
  const dailyGoalMin = useStore(s => s.dailyGoalMin)
  const playerTag = useStore(s => s.playerTag)
  const todayStudyMs = useStore(s => s.todayStudyMs)
  const todayEntMs = useStore(s => s.todayEntMs)
  const level = useStore(s => s.level)
  const exp = useStore(s => s.exp)

  // 自律核心：当前 Mission（第三阶段接入）
  const missions = useMissionStore(s => s.missions)
  const currentMissionId = useMissionStore(s => s.currentMissionId)
  const currentMission = missions.find(m => m.id === currentMissionId)

  const [hasAccess, setHasAccess] = useState(false)
  const [lateAlert, setLateAlert] = useState(false)
  const [dismissPermission, setDismissPermission] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkAndRefresh = async () => {
    try {
      const access = await hasUsageAccess()
      setHasAccess(access)
    } catch {
      setHasAccess(false)
    }
    refresh()
  }

  useEffect(() => {
    checkAndRefresh()
    if (isLateNight()) setLateAlert(true)
    const sub = App.addListener('resume', () => { checkAndRefresh() })
    return () => { sub.then(s => s.remove()) }
  }, [])

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(refresh, 30000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  async function refresh() {
    try {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const stats = await fetchUsageStats(startOfDay.getTime(), now.getTime())
      useStore.getState().syncUsage(stats.study, stats.ent)
    } catch (e) { logger.warn('home', 'refresh usage stats failed', { error: String(e) }) }
  }

  const studyPct = dailyGoalMin > 0 ? Math.min(100, Math.round((todayStudyMs / (dailyGoalMin * 60000)) * 100)) : 0
  const thrust = Math.min(100, Math.floor((todayStudyMs / Math.max(1, dailyGoalMin * 60000)) * 100))

  const handleOpenPermissionSettings = async () => {
    try {
      showToast('正在打开系统权限设置页…')
      await openUsageAccessSettings()
    } catch {
      showToast('请在系统设置中找到使用情况访问权限并开启')
    }
  }

  return (
    <div className="safe-top animate-in" style={{ padding: '20px 16px 140px', background: 'var(--bg)', minHeight: '100vh' }}>
      {/* 顶部控制台标题 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid rgba(69, 162, 158, 0.2)'
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 2 }}>
            UEG CONTROL SYSTEM
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Teko, sans-serif', letterSpacing: 2, textTransform: 'uppercase', margin: 0, color: 'var(--fg)' }}>
            {playerTag}
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace' }}>THRUST</div>
          <div className="thrust-text" style={{ fontSize: 24, fontWeight: 700, color: '#ff4500', fontFamily: 'Teko, sans-serif' }}>
            {thrust}%
          </div>
        </div>
      </div>

      {/* 权限提示横幅（可关闭，本次会话不再显示） */}
      {!hasAccess && !dismissPermission && (
        <div
          onClick={handleOpenPermissionSettings}
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            position: 'relative'
          }}
        >
          <div style={{ paddingRight: 26 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon.Warning size={15} color="#ef4444" /> 未授予使用情况访问权限
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              点击此处跳转设置页开启权限，以获取真实时长
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#ef4444',
              border: '1px solid #ef4444',
              padding: '4px 8px',
              borderRadius: 4,
              whiteSpace: 'nowrap'
            }}>
              去开启
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setDismissPermission(true) }}
              aria-label="关闭"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', padding: 4, display: 'flex', alignItems: 'center'
              }}
            >
              <Icon.Close size={14} color="var(--muted)" />
            </button>
          </div>
        </div>
      )}

      {/* 当前任务（自律核心 Mission，第三阶段接入） */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        padding: '16px', marginBottom: 16, position: 'relative',
        clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)'
      }}>
        <div className="corner-deco tl" />
        <div className="corner-deco tr" />
        <div className="corner-deco bl" />
        <div className="corner-deco br" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 12, fontFamily: 'Share Tech Mono, monospace', color: '#45a29e', letterSpacing: 1 }}>
            CURRENT MISSION
          </div>
          {currentMission && (
            <div style={{ fontSize: 10, fontFamily: 'Share Tech Mono, monospace', color: MISSION_STATUS_META[currentMission.status]?.color, fontWeight: 700 }}>
              [{MISSION_STATUS_META[currentMission.status]?.label}]
            </div>
          )}
        </div>

        {currentMission ? (
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--fg)', fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", marginBottom: 4 }}>
              {currentMission.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 12 }}>
              {fmtClock(currentMission.plannedStart)} – {fmtClock(currentMission.plannedEnd)} · 目标 {currentMission.targetMinutes} min
              {currentMission.requiresEvidence ? ' · 需完成凭证' : ''}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace' }}>PROGRESS</span>
                <span style={{ fontSize: 10, color: '#45a29e', fontFamily: 'Share Tech Mono, monospace' }}>
                  {Math.floor(currentMission.actualStudyMs / 60000)}/{currentMission.targetMinutes} min
                </span>
              </div>
              <div style={{ height: 6, background: '#1a2332', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${missionPct(currentMission)}%`, height: '100%',
                  background: 'linear-gradient(90deg, #45a29e, #00d4ff)',
                  borderRadius: 3, transition: 'width 0.5s',
                  boxShadow: '0 0 10px rgba(69,162,158,0.5)'
                }} />
              </div>
            </div>

            {currentMission.status === 'READY' && (
              <button onClick={() => startMission(currentMission.id)} style={{
                width: '100%', padding: '13px', background: '#ff4500',
                border: 'none', color: '#fff',
                fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 2,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
              }}>
                <Icon.Play size={18} color="#fff" /> 开始专注
              </button>
            )}
            {currentMission.status === 'FOCUSING' && (
              <button onClick={() => onNavigate?.('dungeon')} style={{
                width: '100%', padding: '13px', background: 'rgba(0,212,255,0.12)',
                border: '1px solid #00d4ff', color: '#00d4ff',
                fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 2,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
              }}>
                进入专注监控
              </button>
            )}
            {(currentMission.status === 'DISTRACTED' || currentMission.status === 'INTERVENTION') && (
              <button onClick={() => onNavigate?.('dungeon')} style={{
                width: '100%', padding: '13px', background: 'rgba(255,69,0,0.12)',
                border: '1px solid #ff4500', color: '#ff4500',
                fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 2,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
              }}>
                检测到分心 · 回到任务
              </button>
            )}
            {currentMission.status === 'RECOVERING' && (
              <div style={{ fontSize: 12, color: '#f59e0b', fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", textAlign: 'center', padding: '8px 0' }}>
                正在恢复专注…
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--muted)', position: 'relative', zIndex: 1, padding: '10px 0', fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif" }}>
            暂无进行中的任务。课表任务将按时段自动生成，也可在「任务」中动态创建。
          </div>
        )}
      </div>

      {/* 主数据面板 */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        padding: '16px', marginBottom: 16, position: 'relative',
        clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)'
      }}>
        <div className="corner-deco tl" />
        <div className="corner-deco tr" />
        <div className="corner-deco bl" />
        <div className="corner-deco br" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 12, fontFamily: 'Share Tech Mono, monospace', color: '#45a29e', letterSpacing: 1 }}>
            SYSTEM STATUS
          </div>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: '#45a29e',
            boxShadow: '0 0 8px #45a29e', animation: 'breathe 2s ease-in-out infinite'
          }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, position: 'relative', zIndex: 1 }}>
          <DataBlock label="等级" value={level} />
          <DataBlock label="经验" value={exp % 1000} unit="/1000" />
          <DataBlock label="连签" value={streak} unit="天" color="#45a29e" />
          <DataBlock label="积分" value={points} color="#f59e0b" />
        </div>

        {/* 今日专注进度条 */}
        <div style={{ marginTop: 14, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace' }}>TODAY FOCUS</span>
            <span style={{ fontSize: 10, color: '#ff4500', fontFamily: 'Share Tech Mono, monospace' }}>{fmtMs(todayStudyMs)} / {dailyGoalMin}min</span>
          </div>
          <div style={{ height: 6, background: '#1a2332', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              width: `${studyPct}%`, height: '100%',
              background: 'linear-gradient(90deg, #ff4500, #f59e0b)',
              borderRadius: 3, transition: 'width 0.5s',
              boxShadow: '0 0 10px rgba(255,69,0,0.5)'
            }} />
          </div>
        </div>
      </div>

      {/* 快捷操作面板 */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        padding: '14px', marginBottom: 16, position: 'relative',
        clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
      }}>
        <div className="corner-deco tl" style={{ width: 10, height: 10, borderWidth: 1 }} />
        <div className="corner-deco tr" style={{ width: 10, height: 10, borderWidth: 1 }} />
        <div className="corner-deco bl" style={{ width: 10, height: 10, borderWidth: 1 }} />
        <div className="corner-deco br" style={{ width: 10, height: 10, borderWidth: 1 }} />

        <div style={{ fontSize: 11, color: '#45a29e', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 1, marginBottom: 10, position: 'relative', zIndex: 1 }}>
          QUICK ACTIONS
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, position: 'relative', zIndex: 1 }}>
          <button onClick={() => onNavigate?.('dungeon')} style={{
            padding: '14px', background: 'rgba(255,69,0,0.1)',
            border: '1px solid #ff4500', color: '#ff4500',
            fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 1,
            cursor: 'pointer',
            clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <Icon.Play size={20} color="#ff4500" /> 启动引擎
          </button>
          <button onClick={() => onNavigate?.('classHistory')} style={{
            padding: '14px', background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b',
            fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 1,
            cursor: 'pointer',
            clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <Icon.Book size={18} color="#f59e0b" /> 学习档案
          </button>
        </div>
      </div>

      {/* 系统状态列表 */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        padding: '14px 16px', position: 'relative',
        clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
      }}>
        <div className="corner-deco tl" style={{ width: 10, height: 10, borderWidth: 1 }} />
        <div className="corner-deco tr" style={{ width: 10, height: 10, borderWidth: 1 }} />
        <div className="corner-deco bl" style={{ width: 10, height: 10, borderWidth: 1 }} />
        <div className="corner-deco br" style={{ width: 10, height: 10, borderWidth: 1 }} />

        <div style={{ fontSize: 11, color: '#45a29e', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 1, marginBottom: 8, position: 'relative', zIndex: 1 }}>
          SUBSYSTEMS
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <StatusLine
            label="USAGE ACCESS"
            status={hasAccess ? 'ONLINE' : 'OFFLINE (点击去开启)'}
            ok={hasAccess}
            onClick={!hasAccess ? handleOpenPermissionSettings : undefined}
          />
          <StatusLine label="STUDY MODULE" status={todayStudyMs > 0 ? 'ACTIVE' : 'STANDBY'} ok={todayStudyMs > 0} />
          <StatusLine label="ENT MONITOR" status={todayEntMs < 300000 ? 'NOMINAL' : 'WARNING'} ok={todayEntMs < 300000} />
          <StatusLine label="LATE NIGHT" status={lateAlert ? 'ALERT' : 'NORMAL'} ok={!lateAlert} />
        </div>
      </div>

      {/* 高考倒计时 */}
      <div style={{ marginTop: 16 }}>
        <GaokaoProgress />
      </div>
    </div>
  )
}
