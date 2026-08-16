/**
 * src/components/growth/GrClassHistory.tsx
 * Growth Mode ClassHistory — 学习档案。温暖、中文为主。
 * 复用现有 store 数据（taskHistory, verifyHistory, abyssRecords, echoes, monitorHistory）。
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { useStore } from '@/stores/useStore'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { useEchoStore } from '@/stores/echoStore'
import { readVoiceBase64, type EchoRecord } from '@/lib/echoStorage'
import { getPeriodTime } from '@/data/schedule'
import { fmtMs } from '@/lib/usageStats'
import { showToast } from '@/components/Toast'
import Icon from '@/components/Icons'
import { loadPhoto } from '@/lib/photoStorage'
import { localDateStr, yesterdayDateStr } from '@/lib/dateUtils'

interface Props { onBack: () => void }

type Tab = 'tasks' | 'photos' | 'abyss' | 'echoes' | 'monitor'

export default function GrClassHistory({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>('tasks')
  const [preview, setPreview] = useState<string | null>(null)

  const taskHistory = useClassTaskStore(s => s.taskHistory)
  const verifyHistory = useClassTaskStore(s => s.verifyHistory)
  const monitorHistory = useClassTaskStore(s => s.monitorHistory)
  const abyssRecords = useClassTaskStore(s => s.abyssRecords)

  const streak = useStore(s => s.streak)
  const totalFocusMs = useStore(s => s.totalFocusMs)

  const echoInit = useEchoStore(s => s.init)
  const echoes = useEchoStore(s => s.echoes)
  useEffect(() => { echoInit() }, [echoInit])

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
    <div style={{ position: 'fixed', inset: 0, background: 'var(--growth-bg)', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      {/* 头部 */}
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'flex-end', gap: 12, borderBottom: '1px solid var(--growth-border)' }}>
        <button onClick={onBack} style={{ width: 34, height: 34, background: 'var(--growth-surface)', border: '1px solid var(--growth-border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon.Back size={16} color="var(--growth-text)" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: 'var(--growth-text-secondary)', marginBottom: 2 }}>学习档案</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--growth-text)' }}>成长记录</div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--growth-warm)', fontWeight: 700, fontSize: 14 }}>{totalFocusMs > 0 ? fmtMs(totalFocusMs).replace(' ', '') : '0'}</div>
            <div style={{ color: 'var(--growth-text-secondary)', fontSize: 9 }}>专注</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: 14 }}>{streak}天</div>
            <div style={{ color: 'var(--growth-text-secondary)', fontSize: 9 }}>连签</div>
          </div>
        </div>
      </div>

      {/* Tab 栏 */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 16px 10px', overflowX: 'auto' }} className="scrollbar-hide">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
            background: tab === t.id ? 'var(--growth-primary)' : 'var(--growth-surface-alt)',
            color: tab === t.id ? '#fff' : 'var(--growth-text-secondary)',
            border: 'none', borderRadius: 100, fontSize: 12, cursor: 'pointer',
          }}>{t.icon}{t.label} {t.count > 0 && <span style={{ fontSize: 9, opacity: 0.7 }}>{t.count}</span>}</button>
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
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'pointer' }}>
          <img src={preview.startsWith('data:') ? preview : `data:image/jpeg;base64,${preview}`}
            style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 'var(--growth-radius)', border: '1px solid var(--growth-border)' }} alt="moment" />
        </div>
      )}
    </div>
  )
}

function TasksTab({ data }: { data: any[] }) {
  if (data.length === 0) return <Empty text="暂无课程记录" sub="开始打卡后这里会记录你的每日课程" />
  return (
    <div>
      {data.map(day => {
        const done = day.tasks.filter((t: any) => t.status === 'completed').length
        const total = day.tasks.length
        const rate = total > 0 ? Math.round((done / total) * 100) : 0
        return (
          <div key={day.date} className="gr-card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--growth-text)' }}>{fmtDate(day.date)}</div>
              <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                {day.fullAttendance && <span style={{ color: 'var(--growth-warm)', display: 'flex', alignItems: 'center', gap: 3 }}><Icon.Medal size={11} color="var(--growth-warm)" />全勤</span>}
                <span style={{ color: 'var(--success)' }}>+{day.totalReward}</span>
                {day.totalPenalty > 0 && <span style={{ color: 'var(--danger)' }}>-{day.totalPenalty}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="gr-progress" style={{ flex: 1 }}>
                <div className="gr-progress-fill" style={{ width: `${rate}%`, background: rate >= 100 ? 'var(--success)' : rate >= 50 ? 'var(--warning)' : 'var(--danger)' }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--growth-text-secondary)', whiteSpace: 'nowrap' }}>{done}/{total}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              {day.tasks.map((task: any) => {
                const period = getPeriodTime(task.period)
                const timeStr = period ? `${period.startTime}-${period.endTime}` : ''
                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--growth-border)' }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 'var(--growth-radius-sm)', flexShrink: 0,
                      background: task.status === 'completed' ? 'rgba(91,160,112,0.1)' : task.status === 'overdue' || task.status === 'absent' ? 'rgba(214,90,74,0.1)' : 'var(--growth-surface-alt)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700,
                      color: task.status === 'completed' ? 'var(--success)' : task.status === 'overdue' || task.status === 'absent' ? 'var(--danger)' : 'var(--growth-text-secondary)',
                    }}>{task.period}</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--growth-text)' }}>{task.subject}</span>
                      <span style={{ fontSize: 10, color: 'var(--growth-text-secondary)', marginLeft: 6 }}>{timeStr}</span>
                    </div>
                    <div style={{ fontSize: 11, color: task.status === 'completed' ? 'var(--success)' : 'var(--danger)' }}>
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

function PhotosTab({ data, onPreview }: { data: any[]; onPreview: (p: string) => void }) {
  if (data.length === 0) return <Empty text="还没有打卡照片" sub="完成课程拍照核验后，这里会记录每一次专注" />
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)', marginBottom: 10 }}>{data.length} 张照片 · 每一张都是你努力的证据</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {data.map((m, i) => (
          <div key={i} onClick={() => m.photoUrl && onPreview(m.photoUrl)} className="gr-card" style={{ padding: 0, overflow: 'hidden', cursor: m.photoUrl ? 'pointer' : 'default' }}>
            <PhotoImage path={m.photoUrl} subject={m.subject} />
            <div style={{ padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--growth-text)' }}>{m.subject}</span>
                <span style={{
                  fontSize: 9, padding: '2px 6px', borderRadius: 100,
                  background: m.passed ? 'rgba(91,160,112,0.1)' : 'rgba(214,90,74,0.1)',
                  color: m.passed ? 'var(--success)' : 'var(--danger)',
                }}>{m.aiScore}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)', marginTop: 3 }}>{fmtDate(m.date)}</div>
              {m.aiReview && <div style={{ fontSize: 9, color: 'var(--growth-text-secondary)', marginTop: 4, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{m.aiReview}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AbyssTab({ data }: { data: any[] }) {
  if (data.length === 0) return <Empty text="还没有深渊记录" sub="进入深渊专注后，这里会记录每次挑战" />
  return (
    <div>
      {data.map((r, i) => (
        <div key={i} className="gr-card" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--growth-radius-sm)', flexShrink: 0,
            background: r.completed ? 'rgba(232,160,106,0.15)' : 'var(--growth-surface-alt)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon.Flame size={18} color={r.completed ? 'var(--growth-warm)' : 'var(--growth-text-secondary)'} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--growth-text)' }}>{r.subject || '深渊专注'}</div>
            <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)', marginTop: 1 }}>{fmtDateTime(r.timestamp)} · {r.duration}分钟</div>
          </div>
          <span style={{
            fontSize: 9, padding: '3px 10px', borderRadius: 100,
            background: r.completed ? 'rgba(91,160,112,0.1)' : 'rgba(214,90,74,0.1)',
            color: r.completed ? 'var(--success)' : 'var(--danger)',
          }}>{r.completed ? '成功' : '失败'}</span>
        </div>
      ))}
    </div>
  )
}

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

  if (echoes.length === 0) return <Empty text="还没有回响" sub="完成深渊挑战后可以录一段语音或写一句话" />
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)', marginBottom: 10 }}>{echoes.length} 条回响</div>
      {echoes.map(rec => (
        <div key={rec.id} className="gr-card" style={{ marginBottom: 8, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 'var(--growth-radius-sm)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: rec.type === 'voice' ? 'rgba(232,160,106,0.1)' : 'rgba(124,108,171,0.1)',
            }}>
              {rec.type === 'voice' ? <Icon.Camera size={16} color="var(--growth-warm)" /> : <Icon.Chat size={16} color="var(--growth-primary)" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)' }}>
                {rec.trigger === 'streak-break' ? '断签时回放' : `到期 ${rec.triggerDate || ''}`}
                {rec.played ? ' · 已回放' : ''}
              </div>
              {rec.type === 'text' && <div style={{ fontSize: 13, color: 'var(--growth-text)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.text}</div>}
              {rec.context && <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)', marginTop: 1 }}>{rec.context}</div>}
            </div>
            {rec.type === 'voice' && (
              <button onClick={() => playVoice(rec)} style={{
                padding: '6px 10px', background: playingId === rec.id ? 'rgba(232,160,106,0.15)' : 'var(--growth-surface-alt)',
                border: 'none', borderRadius: 100, color: playingId === rec.id ? 'var(--growth-warm)' : 'var(--growth-text)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
              }}>
                {playingId === rec.id ? <Icon.Pause size={12} color="var(--growth-warm)" /> : <Icon.Play size={12} color="var(--growth-text)" />}
                {playingId === rec.id ? '停止' : '播放'}
              </button>
            )}
            <button onClick={() => { removeEcho(rec.id); showToast('已删除') }} style={{
              padding: '6px 8px', background: 'transparent', border: '1px solid var(--growth-border)',
              borderRadius: 100, cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}><Icon.Close size={12} color="var(--growth-text-secondary)" /></button>
          </div>
        </div>
      ))}
    </div>
  )
}

function MonitorTab({ data }: { data: any[] }) {
  if (data.length === 0) return <Empty text="暂无监测记录" sub="授权使用情况访问后，会记录每日学习/娱乐时长" />
  return (
    <div>
      {[...data].reverse().map((m, i) => (
        <div key={i} className="gr-card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--growth-text)' }}>{fmtDate(m.date)}</span>
            {m.isPunished && <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>被警告</span>}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--success)' }}>学习</div>
              <div style={{ fontWeight: 600, color: 'var(--growth-text)' }}>{Math.floor(m.studyMs / 60000)}分钟</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--danger)' }}>娱乐</div>
              <div style={{ fontWeight: 600, color: 'var(--growth-text)' }}>{Math.floor(m.entMs / 60000)}分钟</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--warning)' }}>警告</div>
              <div style={{ fontWeight: 600, color: 'var(--growth-text)' }}>{m.warningCount}次</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Empty({ text, sub }: { text: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--growth-text-secondary)' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Icon.Book size={32} color="var(--growth-text-secondary)" /></div>
      <div style={{ fontSize: 14, color: 'var(--growth-text)' }}>{text}</div>
      <div style={{ fontSize: 11, marginTop: 8, opacity: 0.6, lineHeight: 1.5 }}>{sub}</div>
    </div>
  )
}

function PhotoImage({ path, subject }: { path: string; subject: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (!path) return
    if (path.startsWith('data:')) { setSrc(path) }
    else if (path.startsWith('MOSS_Photos/')) { loadPhoto(path).then(b64 => { if (b64) setSrc(`data:image/jpeg;base64,${b64}`) }) }
    else { setSrc(`data:image/jpeg;base64,${path}`) }
  }, [path])

  if (!src) {
    return <div style={{ width: '100%', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--growth-surface-alt)' }}><Icon.Camera size={22} color="var(--growth-text-secondary)" /></div>
  }
  return <img src={src} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} alt={subject} />
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
