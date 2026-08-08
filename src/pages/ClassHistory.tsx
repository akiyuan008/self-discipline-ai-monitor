import { useState, useRef, useEffect, useMemo } from 'react'
import { useStore } from '@/stores/useStore'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { useEchoStore } from '@/stores/echoStore'
import { readVoiceBase64, type EchoRecord } from '@/lib/echoStorage'
import { getPeriodTime } from '@/data/schedule'
import { fmtMs } from '@/lib/usageStats'
import { showToast } from '@/components/Toast'
import Icon from '@/components/Icons'
import { localDateStr, yesterdayDateStr } from '@/lib/dateUtils'

interface Props {
  onBack: () => void
}

const CLIP = 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
const CLIP_SM = 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
const BODY = "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif"

type Tab = 'tasks' | 'photos' | 'abyss' | 'echoes' | 'monitor'

export default function ClassHistory({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>('tasks')
  const [preview, setPreview] = useState<string | null>(null)

  const taskHistory = useClassTaskStore(s => s.taskHistory)
  const verifyHistory = useClassTaskStore(s => s.verifyHistory)
  const monitorHistory = useClassTaskStore(s => s.monitorHistory)
  const abyssRecords = useClassTaskStore(s => s.abyssRecords)

  const streak = useStore(s => s.streak)
  const totalFocusMs = useStore(s => s.totalFocusMs)
  const points = useStore(s => s.points)

  const echoInit = useEchoStore(s => s.init)
  const echoes = useEchoStore(s => s.echoes)
  useEffect(() => { echoInit() }, [echoInit])

  const totalCheckins = verifyHistory.filter(v => v.passed).length

  const sortedHistory = useMemo(() => [...taskHistory].sort((a, b) => b.date.localeCompare(a.date)), [taskHistory])
  const moments = useMemo(() => [...verifyHistory].sort((a, b) => b.verifiedAt - a.verifiedAt), [verifyHistory])
  const abyss = useMemo(() => [...abyssRecords].sort((a, b) => b.timestamp - a.timestamp), [abyssRecords])

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'tasks', label: '课程', icon: <Icon.Book size={13} />, count: sortedHistory.length },
    { id: 'photos', label: '打卡', icon: <Icon.Camera size={13} />, count: moments.length },
    { id: 'abyss', label: '深渊', icon: <Icon.Flame size={13} />, count: abyss.length },
    { id: 'echoes', label: '回响', icon: <Icon.Chat size={13} />, count: echoes.length },
    { id: 'monitor', label: '监测', icon: <Icon.Radar size={13} />, count: monitorHistory.length },
  ]

  return (
    <div className="safe-top safe-bottom" style={{
      position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 500,
      display: 'flex', flexDirection: 'column'
    }}>
      {/* 头部 */}
      <div style={{
        padding: '16px 16px 12px', display: 'flex', alignItems: 'flex-end', gap: 12,
        borderBottom: '1px solid rgba(69,162,158,0.2)'
      }}>
        <button onClick={onBack} style={{
          width: 34, height: 34, background: 'var(--bg-alt)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg)',
          clipPath: CLIP_SM
        }}>
          <Icon.Back size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 2 }}>
            VOYAGE ARCHIVE
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: BODY, letterSpacing: -0.5 }}>
            学习档案
          </div>
        </div>
        {/* 总览 */}
        <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'Share Tech Mono, monospace' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#ff4500', fontWeight: 700, fontSize: 14, fontFamily: 'Teko, sans-serif' }}>{totalFocusMs > 0 ? fmtMs(totalFocusMs).replace(' ', '') : '0'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 9 }}>FOCUS</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#45a29e', fontWeight: 700, fontSize: 14, fontFamily: 'Teko, sans-serif' }}>{streak}D</div>
            <div style={{ color: 'var(--muted)', fontSize: 9 }}>STREAK</div>
          </div>
        </div>
      </div>

      {/* Tab 栏 */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 16px 10px', overflowX: 'auto' }} className="scrollbar-hide">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
            background: tab === t.id ? 'rgba(69,162,158,0.15)' : 'var(--bg-alt)',
            border: `1px solid ${tab === t.id ? '#45a29e' : 'var(--border)'}`,
            color: tab === t.id ? '#45a29e' : 'var(--muted)',
            fontFamily: BODY, fontSize: 12, cursor: 'pointer', clipPath: CLIP_SM
          }}>{t.icon}{t.label} {t.count > 0 && <span style={{ fontSize: 9, opacity: 0.6 }}>{t.count}</span>}</button>
        ))}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 100px' }}>
        {tab === 'tasks' && <TasksTab data={sortedHistory} />}
        {tab === 'photos' && <PhotosTab data={moments} onPreview={setPreview} />}
        {tab === 'abyss' && <AbyssTab data={abyss} />}
        {tab === 'echoes' && <EchoesTab echoes={echoes} />}
        {tab === 'monitor' && <MonitorTab data={monitorHistory} />}
      </div>

      {/* 照片预览 */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'pointer'
        }}>
          <img src={preview.startsWith('data:') ? preview : `data:image/jpeg;base64,${preview}`}
            style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8, border: '1px solid #45a29e' }} alt="moment" />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 课程记录
// ═══════════════════════════════════════════════════════════
function TasksTab({ data }: { data: any[] }) {
  if (data.length === 0) return <Empty text="暂无课程记录" sub="开始打卡后这里会记录你的每日课程" />
  return (
    <div>
      {data.map(day => {
        const done = day.tasks.filter((t: any) => t.status === 'completed').length
        const total = day.tasks.length
        const rate = total > 0 ? Math.round((done / total) * 100) : 0
        return (
          <div key={day.date} style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            padding: '12px 14px', marginBottom: 8, clipPath: CLIP_SM, position: 'relative'
          }}>
            <div className="corner-deco tl" style={{ width: 7, height: 7, borderWidth: 1 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: BODY, letterSpacing: 1 }}>{fmtDate(day.date)}</div>
              <div style={{ display: 'flex', gap: 8, fontSize: 10, fontFamily: 'Share Tech Mono, monospace' }}>
                {day.fullAttendance && <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }}><Icon.Medal size={11} color="#f59e0b" />全勤</span>}
                <span style={{ color: '#22c55e' }}>+{day.totalReward}</span>
                {day.totalPenalty > 0 && <span style={{ color: '#ff4444' }}>-{day.totalPenalty}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 5, background: 'var(--bg-alt)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${rate}%`, height: '100%', background: rate >= 100 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ff4500' }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', whiteSpace: 'nowrap' }}>{done}/{total}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              {day.tasks.map((task: any) => {
                const period = getPeriodTime(task.period)
                const timeStr = period ? `${period.startTime}-${period.endTime}` : ''
                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                      background: task.status === 'completed' ? 'rgba(34,197,94,0.12)' : task.status === 'overdue' || task.status === 'absent' ? 'rgba(255,68,68,0.12)' : 'var(--bg-alt)',
                      border: `1px solid ${task.status === 'completed' ? '#22c55e' : task.status === 'overdue' || task.status === 'absent' ? '#ff4444' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700,
                      color: task.status === 'completed' ? '#22c55e' : task.status === 'overdue' || task.status === 'absent' ? '#ff4444' : 'var(--muted)',
                      fontFamily: 'Share Tech Mono, monospace', clipPath: CLIP_SM
                    }}>{task.period}</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontFamily: BODY, fontWeight: 600 }}>{task.subject}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6, fontFamily: 'Share Tech Mono, monospace' }}>{timeStr}</span>
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'Share Tech Mono, monospace', color: task.status === 'completed' ? '#22c55e' : '#ff4444' }}>
                      {task.status === 'completed' ? `+${task.baseReward + task.bonusReward}` : task.status === 'overdue' || task.status === 'absent' ? `-${task.penalty}` : '待完成'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 打卡照片
// ═══════════════════════════════════════════════════════════
function PhotosTab({ data, onPreview }: { data: any[]; onPreview: (p: string) => void }) {
  if (data.length === 0) return <Empty text="还没有打卡照片" sub="完成课程拍照核验后，这里会记录每一次专注" />
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 10 }}>
        {data.length} RECORDS · 每一张都是你努力的证据
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {data.map((m, i) => (
          <div key={i} onClick={() => m.photoUrl && onPreview(m.photoUrl)} style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            clipPath: CLIP_SM, overflow: 'hidden', cursor: m.photoUrl ? 'pointer' : 'default'
          }}>
            {m.photoUrl ? (
              <img src={m.photoUrl.startsWith('data:') ? m.photoUrl : `data:image/jpeg;base64,${m.photoUrl}`}
                style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} alt={m.subject} />
            ) : (
              <div style={{ width: '100%', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-alt)' }}>
                <Icon.Camera size={22} color="var(--muted)" />
              </div>
            )}
            <div style={{ padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: BODY }}>{m.subject}</span>
                <span style={{
                  fontSize: 9, padding: '1px 5px', fontFamily: 'Share Tech Mono, monospace',
                  background: m.passed ? 'rgba(34,197,94,0.12)' : 'rgba(255,68,68,0.12)',
                  color: m.passed ? '#22c55e' : '#ff4444', border: `1px solid ${m.passed ? '#22c55e' : '#ff4444'}40`
                }}>{m.aiScore}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: BODY, marginTop: 3 }}>{fmtDate(m.date)}</div>
              {m.aiReview && <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{m.aiReview}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 深渊远征
// ═══════════════════════════════════════════════════════════
function AbyssTab({ data }: { data: any[] }) {
  if (data.length === 0) return <Empty text="还没有深渊远征记录" sub="进入深渊专注后，这里会记录每次作战" />
  return (
    <div>
      {data.map((r, i) => (
        <div key={i} style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          padding: '12px 14px', marginBottom: 8, clipPath: CLIP_SM,
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            background: r.completed ? 'rgba(255,69,0,0.12)' : 'var(--bg-alt)',
            border: `1px solid ${r.completed ? '#ff4500' : 'var(--border)'}`, clipPath: CLIP_SM
          }}>
            <Icon.Flame size={18} color={r.completed ? '#ff4500' : 'var(--muted)'} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: BODY }}>{r.subject || '深渊专注'}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: BODY, marginTop: 1 }}>{fmtDateTime(r.timestamp)} · {r.duration}分钟</div>
          </div>
          <span style={{
            fontSize: 9, padding: '2px 8px', fontFamily: 'Share Tech Mono, monospace',
            background: r.completed ? 'rgba(34,197,94,0.12)' : 'rgba(255,68,68,0.12)',
            color: r.completed ? '#22c55e' : '#ff4444', border: `1px solid ${r.completed ? '#22c55e' : '#ff4444'}40`
          }}>{r.completed ? 'SUCCESS' : 'ABORT'}</span>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 深渊回响
// ═══════════════════════════════════════════════════════════
function EchoesTab({ echoes }: { echoes: EchoRecord[] }) {
  const removeEcho = useEchoStore(s => s.removeEcho)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  async function playVoice(rec: EchoRecord) {
    if (playingId === rec.id) { audioRef.current?.pause(); setPlayingId(null); return }
    const b64 = await readVoiceBase64(rec)
    if (!b64) { showToast('语音读取失败'); return }
    audioRef.current?.pause()
    const audio = new Audio(`data:audio/webm;base64,${b64}`)
    audioRef.current = audio
    audio.onended = () => setPlayingId(null)
    setPlayingId(rec.id)
    audio.play()
  }

  if (echoes.length === 0) return <Empty text="还没有深渊回响" sub="完成深渊挑战后可以录一段语音或写一句话封存" />
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 10 }}>
        {echoes.length} ECHOES · 存储在 APP 外部，卸载不丢
      </div>
      {echoes.map(rec => (
        <div key={rec.id} style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          padding: '12px 14px', marginBottom: 8, clipPath: CLIP_SM, position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: rec.type === 'voice' ? 'rgba(255,69,0,0.12)' : 'rgba(69,162,158,0.12)',
              border: `1px solid ${rec.type === 'voice' ? '#ff4500' : '#45a29e'}`, clipPath: CLIP_SM
            }}>
              {rec.type === 'voice' ? <Icon.Camera size={16} color="#ff4500" /> : <Icon.Chat size={16} color="#45a29e" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                {rec.trigger === 'streak-break' ? '断签时回放' : `到期 ${rec.triggerDate || ''}`}
                {rec.played ? ' · 已回放' : ''}
              </div>
              {rec.type === 'text' && <div style={{ fontSize: 13, fontFamily: BODY, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.text}</div>}
              {rec.context && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{rec.context}</div>}
            </div>
            {rec.type === 'voice' && (
              <button onClick={() => playVoice(rec)} style={{
                padding: '6px 10px', background: playingId === rec.id ? 'rgba(255,69,0,0.15)' : 'var(--bg-alt)',
                border: `1px solid ${playingId === rec.id ? '#ff4500' : 'var(--border)'}`,
                color: playingId === rec.id ? '#ff4500' : 'var(--fg)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, clipPath: CLIP_SM
              }}>
                {playingId === rec.id ? <Icon.Pause size={12} color="#ff4500" /> : <Icon.Play size={12} color="var(--fg)" />}
                {playingId === rec.id ? '停' : '播放'}
              </button>
            )}
            <button onClick={() => { removeEcho(rec.id); showToast('已删除') }} style={{
              padding: '6px 8px', background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', clipPath: CLIP_SM
            }}><Icon.Close size={12} color="var(--muted)" /></button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 监测记录
// ═══════════════════════════════════════════════════════════
function MonitorTab({ data }: { data: any[] }) {
  if (data.length === 0) return <Empty text="暂无监测记录" sub="授权使用情况访问后，MOSS 会记录你的每日学习/娱乐时长" />
  return (
    <div>
      {[...data].reverse().map((m, i) => (
        <div key={i} style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          padding: '12px 14px', marginBottom: 8, clipPath: CLIP_SM
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: BODY }}>{fmtDate(m.date)}</span>
            {m.isPunished && <span style={{ fontSize: 11, color: '#ff4444', fontWeight: 600 }}>[被警告]</span>}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, fontFamily: BODY }}>
            <div>
              <div style={{ fontSize: 10, color: '#22c55e' }}>学习</div>
              <div style={{ fontWeight: 600 }}>{Math.floor(m.studyMs / 60000)}分钟</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#ff4444' }}>娱乐</div>
              <div style={{ fontWeight: 600 }}>{Math.floor(m.entMs / 60000)}分钟</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#f59e0b' }}>警告</div>
              <div style={{ fontWeight: 600 }}>{m.warningCount}次</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 辅助
// ═══════════════════════════════════════════════════════════
function Empty({ text, sub }: { text: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Icon.Book size={32} color="var(--muted)" /></div>
      <div style={{ fontSize: 14, fontFamily: BODY }}>{text}</div>
      <div style={{ fontSize: 11, marginTop: 8, opacity: 0.6, lineHeight: 1.5, fontFamily: BODY }}>{sub}</div>
    </div>
  )
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr)
  const today = localDateStr()
  const yesterday = yesterdayDateStr()
  if (dateStr === today) return '今天'
  if (dateStr === yesterday) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function fmtDateTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
