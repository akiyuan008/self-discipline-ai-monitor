import { memo, useCallback, useEffect, useRef, useState, type CompositionEvent, type FocusEvent, type KeyboardEvent } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { chatWithAI } from '@/lib/ai'
import { hasUsageAccess, openUsageAccessSettings } from '@/lib/usageStats'

interface Props {
  onNavigateSettings?: () => void
}

const QUICK_PROMPTS = [
  '帮我加个25分钟背单词的日常任务',
  '我刚偷偷刷了30分钟短视频，扣我50积分',
  '奖励我100积分，今天表现不错',
  '帮我加个成就：连续早起7天'
]

interface StatusBarProps {
  onClearChat?: () => void
}

const StatusBar = memo(function StatusBar({ onClearChat }: StatusBarProps) {
  const ai = useStore(s => s.ai)
  const hp = useStore(s => s.hp)
  const points = useStore(s => s.points)
  const messages = useStore(s => s.chat)

  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--card-bg)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: ai.apiKey ? 'var(--success)' : 'var(--muted)',
          flexShrink: 0
        }} className={ai.apiKey ? 'pulse-ring' : ''} />
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
            AI_WARDEN · {ai.apiKey ? 'ONLINE' : 'OFFLINE'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>监管者</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--muted)' }}>
        <span style={{
          padding: '3px 8px',
          borderRadius: 100,
          background: hp < 30 ? 'rgba(229,77,46,0.1)' : 'var(--bg-alt)',
          color: hp < 30 ? 'var(--danger)' : 'var(--muted)'
        }}>HP {hp}</span>
        <span style={{ padding: '3px 8px', borderRadius: 100, background: 'var(--bg-alt)' }}>{points} PTS</span>
      </div>

      {messages.length > 0 && (
        <button
          onClick={() => onClearChat?.()}
          style={{
            padding: '6px 10px',
            borderRadius: 100,
            background: 'var(--bg-alt)',
            border: 'none',
            fontSize: 11,
            color: 'var(--muted)',
            cursor: 'pointer'
          }}
        >清空</button>
      )}
    </div>
  )
})

const Bubble = memo(function Bubble({ role, text }: { role: string; text: string }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      <div
        className="bubble-in"
        style={{
          maxWidth: '78%',
          padding: '10px 16px',
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
        }}
      >{text}</div>
    </div>
  )
})

const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
      <div style={{
        padding: '12px 16px',
        borderRadius: 16,
        borderBottomLeftRadius: 4,
        background: 'var(--card-bg)',
        display: 'flex',
        gap: 4,
        alignItems: 'center'
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--muted)',
            animation: `typingDot 1.2s ease-in-out ${i * 0.15}s infinite`
          }} />
        ))}
      </div>
    </div>
  )
})

interface InputBarProps {
  sending: boolean
  onSend: (text: string) => void
}

const QUICK_PROMPTS = [
  '查看今日表现',
  '奖励我50积分',
  '扣我10积分',
  '加个任务：复习数学',
  '设HP为80',
]

function InputBar({ sending, onSend }: InputBarProps) {
  const [input, setInput] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sendingRef = useRef(sending)
  sendingRef.current = sending

  const handleSend = () => {
    // 优先从 DOM 读取最新值，解决中文输入法 composition 期间 state 不同步
    const domValue = inputRef.current?.value ?? input
    const text = domValue.trim()
    if (!text || sendingRef.current) return
    onSend(text)
    setInput('')
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
    // 从 DOM 读取最终确认的值，避免 React 事件对象被重用导致值丢失
    const finalValue = inputRef.current?.value ?? e.currentTarget.value
    setInput(finalValue)
  }

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--fg)'
  }

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--border)'
  }

  return (
    <div style={{
      padding: '8px 16px 8px',
      borderTop: '1px solid var(--border)',
      background: 'var(--card-bg)',
      display: 'flex',
      gap: 8,
      flexShrink: 0,
      position: 'relative',
      zIndex: 1
    }}>
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
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
          transition: 'border-color 0.2s'
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <button
        onClick={handleSend}
        disabled={sending}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => {
          e.preventDefault()
          e.stopPropagation()
          handleSend()
        }}
        style={{
          padding: '10px 20px',
          borderRadius: 100,
          background: 'var(--fg)',
          color: 'var(--bg)',
          border: 'none',
          fontSize: 13,
          fontWeight: 600,
          cursor: sending ? 'not-allowed' : 'pointer',
          opacity: sending ? 0.5 : 1,
          transition: 'opacity 0.2s, transform 0.1s',
          touchAction: 'manipulation',
          WebkitUserSelect: 'none',
          userSelect: 'none'
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
  const streamingRef = useRef('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollRafRef = useRef<number>(0)
  const sendingRef = useRef(sending)
  const greetingDone = useRef(false)

  // 清理 RAF，防止内存泄漏
  useEffect(() => {
    return () => {
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current)
      }
    }
  }, [])

  sendingRef.current = sending

  useEffect(() => {
    hasUsageAccess().then(setUsageAccess).catch(() => setUsageAccess(false))
  }, [])

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

      let greeting = `HP ${state.hp}，今日学习 ${studyMin} 分钟，达成 ${goalPct}%。\n连胜 ${state.streak} 天。进度有点慢，说吧。`
      if (state.hp < 30) {
        greeting = `状态拉响：HP ${state.hp}，精神力告急。\n今日学习 ${studyMin} 分钟，达成 ${goalPct}%。\n连胜 ${state.streak} 天——别断在这里。`
      } else if (goalPct >= 100) {
        greeting = `今日目标已达成，HP ${state.hp}。\n连胜 ${state.streak} 天。状态不错，有什么打算？`
      } else if (goalPct >= 50) {
        greeting = `HP ${state.hp}，今日学习 ${studyMin} 分钟（${goalPct}%）。\n势头还行，继续推。`
      }

      pushChat({ role: 'assistant', text: greeting })
    }

    }

    scrollToBottom()
  }, [configured, messages, clearChat, pushChat, scrollToBottom])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, streamingText, scrollToBottom])

  const handleClearChat = useCallback(() => {
    clearChat()
    greetingDone.current = false
    showToast('已清空对话')
  }, [clearChat])

  const handleSend = useCallback(async (text: string) => {
    if (sendingRef.current) return
    if (!configured) {
      showToast('请先完成 API 配置')
      onNavigateSettings?.()
      return
    }

    setSending(true)
    streamingRef.current = ''
    setStreamingText('')

    try {
      pushChat({ role: 'user', text })
      const reply = await chatWithAI(
        text,
        chunk => {
          streamingRef.current += chunk
          setStreamingText(streamingRef.current)
        },
        () => {
          streamingRef.current = ''
          setStreamingText('')
        }
      )

      const finalText = streamingRef.current || reply
      pushChat({ role: 'assistant', text: finalText })
    } catch (e: any) {
      pushChat({ role: 'assistant', text: `发送失败：${e?.message || '网络错误，请检查 API 配置'}` })
      showToast('发送失败，请重试')
    } finally {
      streamingRef.current = ''
      setStreamingText('')
      setSending(false)
    }
  }, [configured, onNavigateSettings, pushChat])

  return (
    <div className="safe-top safe-bottom" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '100%',
      background: 'var(--bg)'
    }}>
      <StatusBar onClearChat={handleClearChat} />

      <div ref={scrollRef} className="scrollbar-hide" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px 8px'
      }}>
        {!configured && (
          <div style={{
            margin: '0 0 16px',
            padding: '20px 16px',
            borderRadius: 12,
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>监管者未上线</div>
            <div style={{
              fontSize: 12,
              color: 'var(--muted)',
              marginBottom: 16,
              lineHeight: 1.8,
              whiteSpace: 'pre-line'
            }}>
              {!ai.apiKey?.trim() ? '· 缺少 API Key\n' : ''}
              {!ai.endpoint?.trim() ? '· 缺少 Base URL\n' : ''}
              {!ai.model?.trim() ? '· 缺少模型名称\n' : ''}
              请前往设置完成配置，监管者才能真正对话。
            </div>
            <button
              onClick={() => onNavigateSettings?.()}
              style={{
                padding: '10px 32px',
                borderRadius: 100,
                background: 'var(--fg)',
                color: 'var(--bg)',
                border: 'none',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
              }}
            >去设置 →</button>
          </div>
        )}

        {configured && !usageAccess && (
          <div style={{
            margin: '0 0 12px',
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(229, 77, 46, 0.08)',
            border: '1px solid rgba(229, 77, 46, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#E54D2E' }}>缺少使用情况访问权限</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>监管者需要此权限查阅你的真实学习/娱乐时长</div>
            </div>
            <button
              onClick={async () => {
                await openUsageAccessSettings()
                setTimeout(() => hasUsageAccess().then(setUsageAccess), 2000)
              }}
              style={{
                padding: '6px 14px',
                borderRadius: 100,
                background: '#E54D2E',
                color: '#fff',
                border: 'none',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >去授权</button>
          </div>
        )}

        {messages.length === 0 && configured && (
          <div style={{
            padding: '18px 16px',
            borderRadius: 14,
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            marginBottom: 16,
            color: 'var(--muted)'
          }}>
            现在可以直接和监管者交流，要求、惩罚、奖励、任务和成就都会同步到你的状态里。
          </div>
        )}

        {messages.map(message => <Bubble key={message.id} role={message.role} text={message.text} />)}
        {sending && streamingText && <Bubble role="assistant" text={streamingText} />}
        {sending && !streamingText && <TypingIndicator />}
      </div>

      <div className="scrollbar-hide" style={{
        padding: '6px 16px',
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        flexShrink: 0
      }}>
        {QUICK_PROMPTS.map(prompt => (
          <button
            key={prompt}
            onClick={() => handleSend(prompt)}
            disabled={sending}
            style={{
              padding: '6px 12px',
              borderRadius: 100,
              background: 'var(--bg-alt)',
              border: '1px solid var(--border)',
              fontSize: 11,
              color: 'var(--fg)',
              whiteSpace: 'nowrap',
              cursor: sending ? 'not-allowed' : 'pointer',
              opacity: sending ? 0.5 : 1,
              transition: 'opacity 0.2s'
            }}
          >{prompt}</button>
        ))}
      </div>

      <InputBar sending={sending} onSend={handleSend} />
    </div>
  )
}
