import { useState, useEffect, useRef } from 'react'
import { readVoiceBase64, type EchoRecord } from '@/lib/echoStorage'
import Icon from '@/components/Icons'

const CLIP = 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
const CLIP_SM = 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'

interface Props {
  echo: EchoRecord
  onClose: () => void
}

export default function EchoPlayer({ echo, onClose }: Props) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (echo.type === 'voice') {
      readVoiceBase64(echo).then(b64 => {
        if (b64) setAudioUrl(`data:audio/webm;base64,${b64}`)
      })
    }
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null } }
  }, [echo])

  function togglePlay() {
    if (!audioUrl) return
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
      audioRef.current.onended = () => setPlaying(false)
    }
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  const dateStr = new Date(echo.createdAt).toLocaleDateString('zh-CN')

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: 'var(--card-bg)',
        border: '1px solid #ff4500', padding: 22, position: 'relative', clipPath: CLIP
      }}>
        <div className="corner-deco tl" style={{ borderColor: '#ff4500' }} />
        <div className="corner-deco br" style={{ borderColor: '#ff4500' }} />

        <div style={{ fontSize: 11, color: '#ff4500', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 2, marginBottom: 6 }}>
          ECHO PLAYBACK
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", marginBottom: 6 }}>
          来自过去的你
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
          {echo.trigger === 'streak-break' ? '你中断了连续打卡。' : '到了你约定的日子。'}
          这是你在{echo.context ? `「${echo.context}」` : '深渊挑战后'}留下的话。
        </div>

        {/* 内容区 */}
        {echo.type === 'text' && (
          <div style={{
            background: 'var(--bg-alt)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 16, marginBottom: 16,
            fontSize: 15, lineHeight: 1.6, color: 'var(--fg)',
            fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif"
          }}>
            {echo.text}
          </div>
        )}

        {echo.type === 'voice' && (
          <div style={{ marginBottom: 16 }}>
            {audioUrl ? (
              <button onClick={togglePlay} style={{
                width: '100%', padding: '16px', borderRadius: 8,
                background: playing ? 'rgba(255,69,0,0.15)' : 'var(--bg-alt)',
                border: `1px solid ${playing ? '#ff4500' : 'var(--border)'}`,
                color: playing ? '#ff4500' : 'var(--fg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                fontSize: 15, fontWeight: 600, cursor: 'pointer', clipPath: CLIP_SM,
                fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif"
              }}>
                {playing ? <Icon.Pause size={18} color="#ff4500" /> : <Icon.Play size={18} color={playing ? '#ff4500' : 'var(--fg)'} />}
                {playing ? '播放中…点击暂停' : '播放这段语音'}
              </button>
            ) : (
              <div style={{ padding: 14, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>语音加载中…</div>
            )}
          </div>
        )}

        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 16 }}>
          封存于 {dateStr}
        </div>

        <button onClick={onClose} style={{
          width: '100%', padding: '12px', borderRadius: 8,
          background: '#ff4500', color: '#fff', border: 'none',
          fontSize: 14, fontWeight: 600, cursor: 'pointer', clipPath: CLIP_SM,
          fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif"
        }}>
          收到，继续前进
        </button>
      </div>
    </div>
  )
}
