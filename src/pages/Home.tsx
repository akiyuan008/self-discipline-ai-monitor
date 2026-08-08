import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { App } from '@capacitor/app'
import { fetchUsageStats, hasUsageAccess, fmtMs, isLateNight, openUsageAccessSettings } from '@/lib/usageStats'
import { logger } from '@/lib/logger'
import GaokaoProgress from '@/components/GaokaoProgress'
import type { PageId } from '@/stores/useStore'

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
      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 1, textTransform: 'uppercase' }}>
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

export default function Home({ onNavigate }: Props) {
  const points = useStore(s => s.points)
  const streak = useStore(s => s.streak)
  const dailyGoalMin = useStore(s => s.dailyGoalMin)
  const playerTag = useStore(s => s.playerTag)
  const todayStudyMs = useStore(s => s.todayStudyMs)
  const todayEntMs = useStore(s => s.todayEntMs)
  const level = useStore(s => s.level)
  const exp = useStore(s => s.exp)

  const [hasAccess, setHasAccess] = useState(false)
  const [lateAlert, setLateAlert] = useState(false)
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
      const studyMs = stats.study.reduce((sum, x) => sum + x.totalMs, 0)
      const entMs = stats.ent.reduce((sum, x) => sum + x.totalMs, 0)
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
    <div className="safe-top" style={{ padding: '20px 16px 140px', background: 'var(--bg)', minHeight: '100vh' }}>
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

      {/* 权限提示横幅 */}
      {!hasAccess && (
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
            cursor: 'pointer'
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
              ⚠ 未授予使用情况访问权限
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              点击此处跳转设置页开启权限，以获取真实时长
            </div>
          </div>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#ef4444',
            border: '1px solid #ef4444',
            padding: '4px 8px',
            borderRadius: 4
          }}>
            去开启
          </div>
        </div>
      )}

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
          <DataBlock label="LEVEL" value={level} />
          <DataBlock label="EXP" value={exp % 1000} unit="/1000" />
          <DataBlock label="STREAK" value={streak} unit="D" color="#45a29e" />
          <DataBlock label="POINTS" value={points} color="#f59e0b" />
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
            fontFamily: 'Teko, sans-serif', fontSize: 16, letterSpacing: 1,
            cursor: 'pointer', textTransform: 'uppercase',
            clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
          }}>
            <div style={{ fontSize: 20, marginBottom: 2 }}>▶</div>
            启动引擎
          </button>
          <button onClick={() => onNavigate?.('quests')} style={{
            padding: '14px', background: 'rgba(69,162,158,0.1)',
            border: '1px solid #45a29e', color: '#45a29e',
            fontFamily: 'Teko, sans-serif', fontSize: 16, letterSpacing: 1,
            cursor: 'pointer', textTransform: 'uppercase',
            clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
          }}>
            <div style={{ fontSize: 20, marginBottom: 2 }}>☰</div>
            任务列表
          </button>
          <button onClick={() => onNavigate?.('chat')} style={{
            padding: '12px', background: 'var(--bg-alt)',
            border: '1px solid var(--border)', color: 'var(--fg)',
            fontFamily: 'Share Tech Mono, monospace', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', letterSpacing: 1,
            clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
          }}>
            通讯终端
          </button>
          <button onClick={() => onNavigate?.('shop')} style={{
            padding: '12px', background: 'var(--bg-alt)',
            border: '1px solid var(--border)', color: 'var(--fg)',
            fontFamily: 'Share Tech Mono, monospace', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', letterSpacing: 1,
            clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
          }}>
            补给大楼
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
