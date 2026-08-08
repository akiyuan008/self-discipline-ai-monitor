import { useState, useMemo, useEffect, useRef } from 'react'
import { useStore } from '@/stores/useStore'
import { useEchoStore } from '@/stores/echoStore'
import { readVoiceBase64, type EchoRecord } from '@/lib/echoStorage'
import { showToast } from '@/components/Toast'
import { useClassTaskStore } from '@/stores/classTaskStore'
import { fmtMs } from '@/lib/usageStats'
import Icon from '@/components/Icons'

interface Props {
  onBack: () => void
}

const CLIP = 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
const CLIP_SM = 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'

type Tab = 'moments' | 'voyage' | 'abyss' | 'medals' | 'echoes'

export default function Legacy({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>('moments')
  const [preview, setPreview] = useState<string | null>(null)

  const streak = useStore(s => s.streak)
  const totalFocusMs = useStore(s => s.totalFocusMs)
  const points = useStore(s => s.points)
  const achievements = useStore(s => s.achievements)

  const verifyHistory = useClassTaskStore(s => s.verifyHistory)
  const taskHistory = useClassTaskStore(s => s.taskHistory)
  const abyssRecords = useClassTaskStore(s => s.abyssRecords)

  const totalCheckins = verifyHistory.filter(v => v.passed).length
  const unlockedCount = achievements.filter(a => a.unlocked).length

  // 照片墙：按时间倒序
  const moments = useMemo(() => [...verifyHistory].sort((a, b) => b.verifiedAt - a.verifiedAt), [verifyHistory])
  // 每日航程：按日期倒序
  const voyages = useMemo(() => [...taskHistory].sort((a, b) => b.date.localeCompare(a.date)), [taskHistory])
  // 深渊：按时间倒序
  const abyss = useMemo(() => [...abyssRecords].sort((a, b) => b.timestamp - a.timestamp), [abyssRecords])

  // 深渊回响
  const echoInit = useEchoStore(s => s.init)
  const echoes = useEchoStore(s => s.echoes)
  useEffect(() => { echoInit() }, [echoInit])

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
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 2 }}>
            航迹档案
          </div>
        </div>
      </div>

      {/* 总览数据条 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: '12px 16px' }}>
        <StatBlock label="累计专注" value={totalFocusMs > 0 ? fmtMs(totalFocusMs).replace(' ', '') : '0'} color="#ff4500" />
        <StatBlock label="连签" value={`${streak}D`} color="#45a29e" />
        <StatBlock label="核验通过" value={`${totalCheckins}`} color="#22c55e" />
        <StatBlock label="勋章" value={`${unlockedCount}`} color="#f59e0b" />
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px' }}>
        {([
          { id: 'moments', label: '努力瞬间', icon: <Icon.Camera size={13} /> },
          { id: 'voyage', label: '每日航程', icon: <Icon.Chart size={13} /> },
          { id: 'abyss', label: '深渊远征', icon: <Icon.Flame size={13} /> },
          { id: 'medals', label: '勋章', icon: <Icon.Medal size={13} /> },
          { id: 'echoes', label: '深渊回响', icon: <Icon.Chat size={13} /> },
        ] as Array<{ id: Tab; label: string; icon: React.ReactNode }>).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '8px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            background: tab === t.id ? 'rgba(69,162,158,0.15)' : 'var(--bg-alt)',
            border: `1px solid ${tab === t.id ? '#45a29e' : 'var(--border)'}`,
            color: tab === t.id ? '#45a29e' : 'var(--muted)',
            fontFamily: 'Share Tech Mono, monospace', fontSize: 11, letterSpacing: 1,
            cursor: 'pointer', clipPath: CLIP_SM
          }}>{t.icon}{t.label}</button>
        ))}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 100px' }}>
        {tab === 'moments' && <MomentsGrid moments={moments} onPreview={setPreview} />}
        {tab === 'voyage' && <VoyageList voyages={voyages} />}
        {tab === 'abyss' && <AbyssList records={abyss} />}
        {tab === 'medals' && <MedalList achievements={achievements} />}
        {tab === 'echoes' && <EchoLibrary echoes={echoes} />}
      </div>

      {/* 照片预览弹层 */}
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

function StatBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      padding: '10px 6px', textAlign: 'center', clipPath: CLIP_SM
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 1, marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ── 努力瞬间：照片墙 ──
function MomentsGrid({ moments, onPreview }: { moments: any[]; onPreview: (p: string) => void }) {
  if (moments.length === 0) return <Empty text="还没有努力瞬间" sub="完成课程拍照核验后，这里会记录你的每一次专注" />
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", marginBottom: 10 }}>
        共 {moments.length} 条 · 每一张都是你努力的证据
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {moments.map((m, i) => (
          <div key={i} onClick={() => m.photoUrl && onPreview(m.photoUrl)} style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            clipPath: CLIP_SM, overflow: 'hidden', cursor: m.photoUrl ? 'pointer' : 'default'
          }}>
            {m.photoUrl ? (
              <img src={m.photoUrl.startsWith('data:') ? m.photoUrl : `data:image/jpeg;base64,${m.photoUrl}`}
                style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} alt={m.subject} />
            ) : (
              <div style={{ width: '100%', height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-alt)' }}>
                <Icon.Camera size={24} color="var(--muted)" />
              </div>
            )}
            <div style={{ padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 1 }}>{m.subject}</span>
                <span style={{
                  fontSize: 9, padding: '1px 5px', fontFamily: 'Share Tech Mono, monospace',
                  background: m.passed ? 'rgba(34,197,94,0.12)' : 'rgba(255,68,68,0.12)',
                  color: m.passed ? '#22c55e' : '#ff4444', border: `1px solid ${m.passed ? '#22c55e' : '#ff4444'}40`
                }}>{m.aiScore}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", marginTop: 3 }}>
                {fmtDate(m.date)}
              </div>
              {m.aiReview && (
                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {m.aiReview}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 每日航程 ──
function VoyageList({ voyages }: { voyages: any[] }) {
  if (voyages.length === 0) return <Empty text="还没有航程记录" sub="完成一天的课程后，这里会沉淀你的每日战绩" />
  return (
    <div>
      {voyages.map((v, i) => {
        const done = v.tasks.filter((t: any) => t.status === 'completed').length
        const total = v.tasks.length
        const rate = total > 0 ? Math.round((done / total) * 100) : 0
        return (
          <div key={i} style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            padding: '12px 14px', marginBottom: 10, clipPath: CLIP_SM, position: 'relative'
          }}>
            <div className="corner-deco tl" style={{ width: 7, height: 7, borderWidth: 1 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 1 }}>
                {fmtDate(v.date)}
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 10, fontFamily: 'Share Tech Mono, monospace' }}>
                {v.fullAttendance && <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }}><Icon.Medal size={11} color="#f59e0b" />全勤</span>}
                <span style={{ color: '#22c55e' }}>+{v.totalReward}</span>
                {v.totalPenalty > 0 && <span style={{ color: '#ff4444' }}>-{v.totalPenalty}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 5, background: 'var(--bg-alt)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${rate}%`, height: '100%', background: rate >= 100 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ff4500', transition: 'width 0.5s' }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', whiteSpace: 'nowrap' }}>
                {done}/{total} · {rate}%
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 深渊远征 ──
function AbyssList({ records }: { records: any[] }) {
  if (records.length === 0) return <Empty text="还没有深渊远征" sub="进入深渊专注后，这里会记录你的每次作战" />
  return (
    <div>
      {records.map((r, i) => (
        <div key={i} style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          padding: '12px 14px', marginBottom: 8, clipPath: CLIP_SM,
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{
            width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: r.completed ? 'rgba(255,69,0,0.12)' : 'var(--bg-alt)',
            border: `1px solid ${r.completed ? '#ff4500' : 'var(--border)'}`, clipPath: CLIP_SM
          }}>
            <Icon.Flame size={18} color={r.completed ? '#ff4500' : 'var(--muted)'} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 1 }}>
              {r.subject || '深渊专注'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", marginTop: 1 }}>
              {fmtDateTime(r.timestamp)} · {r.duration}分钟
            </div>
          </div>
          <span style={{
            fontSize: 10, padding: '2px 8px', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif",
            background: r.completed ? 'rgba(34,197,94,0.12)' : 'rgba(255,68,68,0.12)',
            color: r.completed ? '#22c55e' : '#ff4444', border: `1px solid ${r.completed ? '#22c55e' : '#ff4444'}40`
          }}>{r.completed ? '成功' : '中断'}</span>
        </div>
      ))}
    </div>
  )
}

// ── 勋章 ──
function MedalList({ achievements }: { achievements: any[] }) {
  const unlocked = achievements.filter(a => a.unlocked)
  const locked = achievements.filter(a => !a.unlocked)
  if (achievements.length === 0) return <Empty text="还没有勋章" sub="与 MOSS 互动、完成任务会解锁勋章" />
  return (
    <div>
      {unlocked.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#f59e0b', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 1, marginBottom: 8 }}>已解锁 · {unlocked.length}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {unlocked.map((a, i) => <MedalCard key={i} a={a} unlocked />)}
          </div>
        </div>
      )}
      {locked.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 1, marginBottom: 8 }}>未解锁 · {locked.length}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {locked.map((a, i) => <MedalCard key={i} a={a} unlocked={false} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function MedalCard({ a, unlocked }: { a: any; unlocked: boolean }) {
  return (
    <div style={{
      background: unlocked ? 'rgba(245,158,11,0.06)' : 'var(--bg-alt)',
      border: `1px solid ${unlocked ? '#f59e0b' : 'var(--border)'}`,
      padding: '12px', clipPath: CLIP_SM, opacity: unlocked ? 1 : 0.5, textAlign: 'center'
    }}>
      <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}>
        {unlocked ? <Icon.Medal size={22} color="#f59e0b" /> : <Icon.Lock size={22} color="var(--muted)" />}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 1 }}>{a.name}</div>
      <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{a.desc}</div>
      {!unlocked && a.total > 0 && (
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", marginTop: 4 }}>{a.progress}/{a.total}</div>
      )}
    </div>
  )
}

function Empty({ text, sub }: { text: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Icon.Book size={32} color="var(--muted)" /></div>
      <div style={{ fontSize: 14, fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif" }}>{text}</div>
      <div style={{ fontSize: 11, marginTop: 8, opacity: 0.6, lineHeight: 1.5 }}>{sub}</div>
    </div>
  )
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateStr === today) return '今天'
  if (dateStr === yesterday) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function fmtDateTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── 深渊回响：记录库 ──
function EchoLibrary({ echoes }: { echoes: EchoRecord[] }) {
  const removeEcho = useEchoStore(s => s.removeEcho)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  async function playVoice(rec: EchoRecord) {
    if (playingId === rec.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    const b64 = await readVoiceBase64(rec)
    if (!b64) { showToast('语音读取失败'); return }
    audioRef.current?.pause()
    const audio = new Audio(`data:audio/webm;base64,${b64}`)
    audioRef.current = audio
    audio.onended = () => setPlayingId(null)
    setPlayingId(rec.id)
    audio.play()
  }

  if (echoes.length === 0) return <Empty text="还没有深渊回响" sub="完成深渊挑战后，可以录一段语音或写一句话封存，到约定时刻 MOSS 会回放给你" />

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
              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                {rec.trigger === 'streak-break' ? '断签时回放' : `到期 ${rec.triggerDate || ''}`}
                {rec.played ? ' · 已回放' : ''}
              </div>
              {rec.type === 'text' && (
                <div style={{ fontSize: 13, color: 'var(--fg)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rec.text}
                </div>
              )}
              {rec.context && (
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{rec.context}</div>
              )}
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
            }}>
              <Icon.Close size={12} color="var(--muted)" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
