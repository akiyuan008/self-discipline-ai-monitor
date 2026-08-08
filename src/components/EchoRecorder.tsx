import { useState, useRef, useEffect } from 'react'
import { useEchoStore } from '@/stores/echoStore'
import { startRecording, stopRecording, cancelRecording, isRecordingSupported } from '@/lib/voiceRecorder'
import { showToast } from '@/components/Toast'
import Icon from '@/components/Icons'

const CLIP = 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
const CLIP_SM = 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'

type Step = 'choose' | 'voice' | 'text' | 'trigger'

interface Props {
  context?: string
  onDone: () => void
}

export default function EchoRecorder({ context, onDone }: Props) {
  const addEcho = useEchoStore(s => s.addEcho)
  const [step, setStep] = useState<Step>('choose')
  const [recording, setRecording] = useState(false)
  const [secs, setSecs] = useState(0)
  const [voiceBase64, setVoiceBase64] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [trigger, setTrigger] = useState<'streak-break' | 'date'>('streak-break')
  const [triggerDate, setTriggerDate] = useState('')
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { cancelRecording(); if (timerRef.current) clearInterval(timerRef.current) }, [])

  async function beginRecord() {
    try {
      await startRecording()
      setRecording(true)
      setSecs(0)
      timerRef.current = setInterval(() => setSecs(s => s + 1), 1000)
    } catch (e: any) {
      showToast('无法开启麦克风：' + (e?.message || '请检查权限'))
    }
  }

  async function finishRecord() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    try {
      const b64 = await stopRecording()
      setRecording(false)
      if (!b64) { showToast('录音为空，请重试'); return }
      setVoiceBase64(b64)
      setStep('trigger')
    } catch {
      setRecording(false)
      showToast('录音保存失败')
    }
  }

  async function save() {
    setSaving(true)
    try {
      const today = new Date()
      const dateStr = triggerDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      await addEcho({
        type: voiceBase64 ? 'voice' : 'text',
        text: text.trim() || undefined,
        voiceBase64: voiceBase64 || undefined,
        context,
        trigger,
        triggerDate: trigger === 'date' ? dateStr : undefined
      })
      showToast('已封存。MOSS 会在约定时刻回放给你')
      onDone()
    } catch (e: any) {
      showToast('保存失败：' + (e?.message || '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  // 判断当前是文字还是语音（trigger 步骤复用）
  const isVoice = voiceBase64 !== null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: 'var(--card-bg)',
        border: '1px solid #45a29e', padding: 20, position: 'relative', clipPath: CLIP
      }}>
        <div className="corner-deco tl" style={{ borderColor: '#45a29e' }} />
        <div className="corner-deco br" style={{ borderColor: '#45a29e' }} />

        <div style={{ fontSize: 11, color: '#45a29e', fontFamily: 'Share Tech Mono, monospace', letterSpacing: 2, marginBottom: 4 }}>
          ABYSS ECHO
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", marginBottom: 4 }}>
          深渊回响
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 16 }}>
          刚完成深渊挑战。给未来的自己留一段话——当你松懈时，MOSS 会把它回放给你。
        </div>

        {/* 步骤一：选择方式 */}
        {step === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isRecordingSupported() && (
              <button onClick={() => setStep('voice')} style={btnPrimary}>
                <Icon.Camera size={16} color="#fff" /> 录一段语音
              </button>
            )}
            <button onClick={() => setStep('text')} style={btnSecondary}>
              写一段话
            </button>
            <button onClick={onDone} style={btnGhost}>跳过</button>
          </div>
        )}

        {/* 步骤二：录音 */}
        {step === 'voice' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 84, height: 84, borderRadius: '50%', margin: '8px auto 12px',
              background: recording ? 'rgba(255,69,0,0.15)' : 'var(--bg-alt)',
              border: `2px solid ${recording ? '#ff4500' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: recording ? '0 0 20px rgba(255,69,0,0.4)' : 'none'
            }}>
              <Icon.Camera size={30} color={recording ? '#ff4500' : 'var(--muted)'} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Teko, sans-serif', color: recording ? '#ff4500' : 'var(--fg)' }}>
              {String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>
              {recording ? '正在录音…再次点击结束' : '点击下方开始录音'}
            </div>
            {!recording ? (
              <button onClick={beginRecord} style={btnPrimary}>开始录音</button>
            ) : (
              <button onClick={finishRecord} style={{ ...btnPrimary, background: '#ff4500', borderColor: '#ff4500' }}>结束并保存</button>
            )}
            <button onClick={() => { cancelRecording(); if (timerRef.current) clearInterval(timerRef.current); setRecording(false); setStep('choose') }} style={{ ...btnGhost, marginTop: 8 }}>返回</button>
          </div>
        )}

        {/* 步骤二：文字 */}
        {step === 'text' && (
          <div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="写给未来自己的一句话…（此刻的决心、方法、提醒）"
              rows={4}
              style={{
                width: '100%', padding: 12, background: 'var(--bg-alt)', color: 'var(--fg)',
                border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none',
                boxSizing: 'border-box', resize: 'vertical', marginBottom: 12,
                fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif"
              }}
            />
            <button onClick={() => { if (!text.trim()) { showToast('先写点什么'); return } setStep('trigger') }} style={btnPrimary}>下一步</button>
            <button onClick={() => setStep('choose')} style={{ ...btnGhost, marginTop: 8 }}>返回</button>
          </div>
        )}

        {/* 步骤三：触发时机 */}
        {step === 'trigger' && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>什么时候回放给未来的你？</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setTrigger('streak-break')} style={trigger === 'streak-break' ? btnTriggerOn : btnTriggerOff}>
                断签时 · 在我中断连续打卡时提醒我
              </button>
              <button onClick={() => setTrigger('date')} style={trigger === 'date' ? btnTriggerOn : btnTriggerOff}>
                指定日期 · 到那一天再回放
              </button>
              {trigger === 'date' && (
                <input type="date" value={triggerDate} onChange={e => setTriggerDate(e.target.value)}
                  style={{
                    width: '100%', padding: 10, background: 'var(--bg-alt)', color: 'var(--fg)',
                    border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box'
                  }} />
              )}
            </div>
            <button onClick={save} disabled={saving || (trigger === 'date' && !triggerDate)}
              style={{ ...btnPrimary, opacity: saving || (trigger === 'date' && !triggerDate) ? 0.5 : 1 }}>
              {saving ? '封存中…' : (isVoice ? '封存语音' : '封存这句话')}
            </button>
            <button onClick={() => setStep(isVoice ? 'voice' : 'text')} style={{ ...btnGhost, marginTop: 8 }}>返回</button>
          </div>
        )}
      </div>
    </div>
  )
}

const btnBase: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", border: '1px solid transparent', clipPath: CLIP_SM
}
const btnPrimary: React.CSSProperties = { ...btnBase, background: '#45a29e', color: '#fff', borderColor: '#45a29e' }
const btnSecondary: React.CSSProperties = { ...btnBase, background: 'var(--bg-alt)', color: 'var(--fg)', borderColor: 'var(--border)' }
const btnGhost: React.CSSProperties = { ...btnBase, background: 'transparent', color: 'var(--muted)', borderColor: 'var(--border)' }
const btnTriggerOn: React.CSSProperties = { ...btnBase, background: 'rgba(69,162,158,0.15)', color: '#45a29e', borderColor: '#45a29e', textAlign: 'left', justifyContent: 'flex-start' }
const btnTriggerOff: React.CSSProperties = { ...btnBase, background: 'var(--bg-alt)', color: 'var(--muted)', borderColor: 'var(--border)', textAlign: 'left', justifyContent: 'flex-start' }
