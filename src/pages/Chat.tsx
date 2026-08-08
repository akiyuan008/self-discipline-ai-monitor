import { memo, useCallback, useEffect, useRef, useState, type CompositionEvent, type KeyboardEvent } from 'react'
import { App } from '@capacitor/app'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { chatWithAI } from '@/lib/ai'
import { hasUsageAccess, openUsageAccessSettings } from '@/lib/usageStats'

interface Props {
  onNavigateSettings?: () => void
}

interface StatusBarProps {
  onClearChat?: () => void
  onToggleHistory?: () => void
  showHistory: boolean
  onNavigateSettings?: () => void
}

const StatusBar = memo(function StatusBar({ onClearChat, onToggleHistory, showHistory, onNavigateSettings }: StatusBarProps) {
  const ai = useStore(s => s.ai)
  const points = useStore(s => s.points)
  const streak = useStore(s => s.streak)
  const messages = useStore(s => s.chat)

  return (
    <div style={{
      padding: '16px 20px 12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexShrink: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: ai.apiKey ? 'var(--success)' : 'var(--muted)',
              display: 'inline-block'
            }} />
            AI_WARDEN · {ai.apiKey ? 'ONLINE' : 'OFFLINE'}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, margin: 0 }}>监管者</h1>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: 2 }}>
            {points} PTS · 连签 {streak}天
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onToggleHistory?.()} style={{
          padding: '6px 10px', borderRadius: 100, background: showHistory ? 'var(--fg)' : 'var(--bg-alt)',
          border: '1px solid var(--border)',
          fontSize: 11, color: showHistory ? 'var(--bg)' : 'var(--muted)', cursor: 'pointer'
        }}>历史</button>
        {messages.length > 0 && (
          <button onClick={() => onClearChat?.()} style={{
            padding: '6px 10px', borderRadius: 100, background: 'var(--bg-alt)',
            border: '1px solid var(--border)',
            fontSize: 11, color: 'var(--muted)', cursor: 'pointer'
          }}>清空</button>
        )}
        {onNavigateSettings && (
          <button onClick={() => onNavigateSettings()} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--fg)'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
})

const Bubble = memo(function Bubble({ role, text }: { role: string; text: string }) {
  const isUser = role === 'user'
  const isSystem = role === 'system'

  // system 消息：居中灰色小卡片，区别于 AI 回复
  if (isSystem) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <div className="bubble-in" style={{
          maxWidth: '90%',
          padding: '6px 12px',
          borderRadius: 100,
          background: 'var(--bg-alt)',
          color: 'var(--muted)',
          fontSize: 11,
          lineHeight: 1.4,
          textAlign: 'center',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}>{text}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      <div className="bubble-in" style={{
        maxWidth: '78%',
        padding: '10px 14px',
        borderRadius: 16,
        borderBottomRightRadius: isUser ? 4 : 16,
        borderBottomLeftRadius: isUser ? 16 : 4,
        background: isUser ? 'var(--fg)' : 'var(--card-bg)',
        color: isUser ? 'var(--bg)' : 'var(--fg)',
        fontSize: 14,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>{text}</div>
    </div>
  )
})

const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
      <div style={{
        padding: '10px 14px', borderRadius: 16, borderBottomLeftRadius: 4,
        background: 'var(--card-bg)', display: 'flex', gap: 4, alignItems: 'center'
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)',
            animation: `typingDot 1.2s ease-in-out ${i * 0.15}s infinite`
          }} />
        ))}
      </div>
    </div>
  )
})

function ChatHistory({ onClose }: { onClose: () => void }) {
  const messages = useStore(s => s.chat)
  const grouped = messages.reduce((acc, msg) => {
    const date = new Date(msg.ts).toLocaleDateString('zh-CN')
    if (!acc[date]) acc[date] = []
    acc[date].push(msg)
    return acc
  }, {} as Record<string, typeof messages>)

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 260,
      background: 'var(--card-bg)', borderLeft: '1px solid var(--border)',
      zIndex: 50, display: 'flex', flexDirection: 'column',
      animation: 'slideInRight 0.2s ease'
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>对话历史</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--muted)' }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {Object.entries(grouped).map(([date, msgs]) => (
          <div key={date} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, fontFamily: 'DM Mono, monospace' }}>{date}</div>
            {msgs.slice(-3).map((msg, i) => (
              <div key={i} style={{
                fontSize: 11, padding: '6px 8px', borderRadius: 8,
                background: msg.role === 'user' ? 'var(--bg-alt)' : 'transparent',
                marginBottom: 4, color: 'var(--muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {msg.role === 'user' ? '你' : 'AI'}: {msg.text.slice(0, 30)}{msg.text.length > 30 ? '...' : ''}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

interface InputBarProps {
  sending: boolean
  onSend: (text: string) => void
}

const QUICK_PROMPTS = [
  '查看今日表现',
  '奖励我50积分',
  '扣我10积分',
  '加个任务：复习数学',
  '我是不是在偷懒',
]

function InputBar({ sending, onSend }: InputBarProps) {
  const [displayValue, setDisplayValue] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sendingRef = useRef(sending)
  sendingRef.current = sending

  const handleSend = () => {
    const domValue = inputRef.current?.value ?? displayValue
    const text = domValue.trim()
    if (!text || sendingRef.current) return
    onSend(text)
    setDisplayValue('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isComposing && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleCompositionStart = () => setIsComposing(true)
  const handleCompositionEnd = (e: CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false)
    const finalValue = e.currentTarget.value
    setDisplayValue(finalValue)
  }

  // 定时同步DOM值到state（支持语音输入等不触发onChange的情况）
  useEffect(() => {
    const interval = setInterval(() => {
      if (inputRef.current && inputRef.current.value !== displayValue) {
        setDisplayValue(inputRef.current.value)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [displayValue])

  return (
    <div style={{
      padding: '6px 14px 10px',
      borderTop: '1px solid var(--border)',
      background: 'var(--card-bg)',
      display: 'flex', gap: 8,
      flexShrink: 0,
      position: 'relative', zIndex: 1
    }}>
      <input
        ref={inputRef}
        defaultValue={displayValue}
        onChange={e => setDisplayValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        placeholder="告诉监管者…"
        inputMode="text"
        enterKeyHint="send"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck="false"
        style={{
          flex: 1,
          padding: '10px 14px',
          borderRadius: 100,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          color: 'var(--fg)',
          fontSize: 14,
          outline: 'none',
          WebkitUserSelect: 'text',
          userSelect: 'text'
        }}
      />
      <button
        onClick={handleSend}
        disabled={sending}
        style={{
          padding: '10px 18px', borderRadius: 100,
          background: 'var(--fg)', color: 'var(--bg)',
          border: 'none', fontSize: 13, fontWeight: 600,
          cursor: sending ? 'not-allowed' : 'pointer',
          opacity: sending ? 0.5 : 1
        }}
      >发送</button>
    </div>
  )
}

export default function Chat({ onNavigateSettings }: Props) {
  const messages = useStore(s => s.chat)
  const pushChat = useStore(s => s.pushChat)
  const clearChat = useStore(s => s.clearChat)
  const ai = useStore(s => s.ai)

  const [sending, setSending] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [usageAccess, setUsageAccess] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamingRef = useRef('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollRafRef = useRef<number>(0)
  const sendingRef = useRef(sending)
  const greetingDone = useRef(false)

  useEffect(() => {
    hasUsageAccess().then(setUsageAccess).catch(() => setUsageAccess(false))
    const sub = App.addListener('resume', () => {
      hasUsageAccess().then(setUsageAccess).catch(() => setUsageAccess(false))
    })
    return () => {
      sub.then(s => s.remove())
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  sendingRef.current = sending
  const configured = !!(ai.apiKey?.trim() && ai.endpoint?.trim() && ai.model?.trim())

  const scrollToBottom = useCallback(() => {
    if (scrollRafRef.current) return
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      }
    })
  }, [])

  useEffect(() => {
    if (greetingDone.current) return
    if (configured && messages.length === 0) {
      greetingDone.current = true
      const state = useStore.getState()
      const studyMin = Math.floor(state.todayStudyMs / 60_000)
      const goalPct = state.dailyGoalMin > 0 ? Math.min(100, Math.round(studyMin / state.dailyGoalMin * 100)) : 0
      let greeting = `今日学习 ${studyMin} 分钟，达成 ${goalPct}%。连签 ${state.streak} 天。进度有点慢，说吧。`
      if (goalPct < 30) greeting = `状态拉响：今日学习仅 ${studyMin} 分钟，达成 ${goalPct}%。连签 ${state.streak} 天——别断在这里。`
      else if (goalPct >= 100) greeting = `今日目标已达成。连签 ${state.streak} 天。状态不错，有什么打算？`
      else if (goalPct >= 50) greeting = `今日学习 ${studyMin} 分钟（${goalPct}%）。连签 ${state.streak} 天。势头还行，继续推。`
      pushChat({ role: 'assistant', text: greeting })
    }
    scrollToBottom()
  }, [configured, messages, pushChat, scrollToBottom])

  useEffect(() => { scrollToBottom() }, [messages.length, streamingText, scrollToBottom])

  const handleClearChat = useCallback(() => {
    clearChat()
    greetingDone.current = false
    showToast('已清空对话')
  }, [clearChat])

  const handleSend = useCallback(async (text: string) => {
    if (!configured) { showToast('请先配置 AI'); onNavigateSettings?.(); return }
    pushChat({ role: 'user', text })
    setSending(true)
    streamingRef.current = ''

    try {
      const reply = await chatWithAI(text, (chunk) => {
        streamingRef.current += chunk
        setStreamingText(streamingRef.current)
      })
      const finalText = streamingRef.current || reply
      pushChat({ role: 'assistant', text: finalText })
    } catch (e: any) {
      pushChat({ role: 'assistant', text: `发送失败：${e?.message || '网络错误'}` })
      showToast('发送失败，请重试')
    } finally {
      streamingRef.current = ''
      setStreamingText('')
      setSending(false)
    }
  }, [configured, onNavigateSettings, pushChat])

  return (
    <div className="safe-top" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      maxHeight: '100dvh',
      background: 'var(--bg)',
      position: 'relative',
      overflow: 'hidden',
      paddingBottom: 70
    }}>
      <StatusBar
        onClearChat={handleClearChat}
        onToggleHistory={() => setShowHistory(!showHistory)}
        showHistory={showHistory}
        onNavigateSettings={onNavigateSettings}
      />

      {showHistory && <ChatHistory onClose={() => setShowHistory(false)} />}

      <div ref={scrollRef} className="scrollbar-hide" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px 14px 6px',
        minHeight: 0
      }}>
        {!configured && (
          <div style={{
            margin: '0 0 12px', padding: '16px 14px', borderRadius: 12,
            background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>⚠</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>监管者未上线</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
              {!ai.apiKey?.trim() ? '· 缺少 API Key\n' : ''}
              {!ai.endpoint?.trim() ? '· 缺少 Base URL\n' : ''}
              {!ai.model?.trim() ? '· 缺少模型名称\n' : ''}
              请前往设置完成配置。
            </div>
            <button onClick={() => onNavigateSettings?.()} style={{
              padding: '8px 28px', borderRadius: 100, background: 'var(--fg)',
              color: 'var(--bg)', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer'
            }}>去设置 →</button>
          </div>
        )}

        {configured && !usageAccess && (
          <div style={{
            margin: '0 0 10px', padding: '10px 14px', borderRadius: 12,
            background: 'rgba(229, 77, 46, 0.08)', border: '1px solid rgba(229, 77, 46, 0.2)',
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>缺少使用情况访问权限</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>监管者需要此权限查阅你的真实学习/娱乐时长</div>
            </div>
            <button onClick={async () => {
              try {
                await openUsageAccessSettings()
                showToast('已跳转到设置页面')
                if (pollRef.current) clearInterval(pollRef.current)
                pollRef.current = setInterval(() => {
                  hasUsageAccess().then(granted => {
                    setUsageAccess(granted)
                    if (granted && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
                  }).catch(() => {})
                }, 2000)
              } catch (err: any) { showToast(err?.message || '无法打开设置') }
            }} style={{
              padding: '6px 12px', borderRadius: 100, background: 'var(--danger)',
              color: 'var(--bg)', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer'
            }}>去授权</button>
          </div>
        )}

        {messages.length === 0 && configured && (
          <div style={{
            padding: '14px 14px', borderRadius: 16, background: 'var(--card-bg)',
            border: '1px solid var(--border)', marginBottom: 12, color: 'var(--muted)', fontSize: 13
          }}>
            现在可以直接和监管者交流，要求、惩罚、奖励、任务和成就都会同步到你的状态里。
          </div>
        )}

        {messages.map(message => <Bubble key={message.id} role={message.role} text={message.text} />)}
        {sending && streamingText && <Bubble role="assistant" text={streamingText} />}
        {sending && !streamingText && <TypingIndicator />}
      </div>

      <div className="scrollbar-hide" style={{
        padding: '4px 14px', display: 'flex', gap: 6,
        overflowX: 'auto', flexShrink: 0
      }}>
        {QUICK_PROMPTS.map(prompt => (
          <button key={prompt} onClick={() => handleSend(prompt)} disabled={sending} style={{
            padding: '5px 10px', borderRadius: 100, background: 'var(--bg-alt)',
            border: '1px solid var(--border)', fontSize: 11, color: 'var(--fg)',
            whiteSpace: 'nowrap', cursor: sending ? 'not-allowed' : 'pointer',
            opacity: sending ? 0.5 : 1
          }}>{prompt}</button>
        ))}
      </div>

      <InputBar sending={sending} onSend={handleSend} />
    </div>
  )
}