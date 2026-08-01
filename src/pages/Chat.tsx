import { useState, useRef, useEffect, useCallback, memo } from 'react'
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

// ═══ 状态栏（独立组件，hp/points变化只重渲染这里）═══
const StatusBar = memo(function StatusBar() {
  const ai = useStore(s => s.ai)
  const hp = useStore(s => s.hp)
  const points = useStore(s => s.points)
  const messages = useStore(s => s.chat)
  const clearChat = useStore(s => s.clearChat)

  return (
    <div style={{
      padding: '10px 16px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--card-bg)',
      flexShrink: 0
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: ai.apiKey ? 'var(--success)' : 'var(--muted)',
          flexShrink: 0
        }} className={ai.apiKey ? 'pulse-ring' : ''} />
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
            AI_WARDEN · {ai.apiKey ? 'ONLINE' : 'OFFLINE'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>监管者</div>
        </div>
      </div>
      <div style={{
        display: 'flex', gap: 6,
        fontSize: 10, fontFamily: 'DM Mono, monospace',
        color: 'var(--muted)'
      }}>
        <span style={{
          padding: '3px 8px', borderRadius: 100,
          background: hp < 30 ? 'rgba(229,77,46,0.1)' : 'var(--bg-alt)',
          color: hp < 30 ? 'var(--danger)' : 'var(--muted)'
        }}>HP {hp}</span>
        <span style={{
          padding: '3px 8px', borderRadius: 100,
          background: 'var(--bg-alt)'
        }}>{points} PTS</span>
      </div>
      {messages.length > 0 && (
        <button
          onClick={() => { clearChat(); showToast('已清空对话') }}
          style={{
            padding: '6px 10px', borderRadius: 100,
            background: 'var(--bg-alt)', border: 'none',
            fontSize: 11, color: 'var(--muted)', cursor: 'pointer'
          }}
        >清空</button>
      )}
    </div>
  )
})

// ═══ 消息气泡（memo 隔离）═══
const Bubble = memo(function Bubble({ role, text }: { role: string; text: string }) {
  const isUser = role === 'user'
  return (
    <div style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12
    }}>
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
          fontSize: 14, lineHeight: 1.5,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
      >{text}</div>
    </div>
  )
})

// ═══ 打字指示器 ═══
const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
      <div style={{
        padding: '12px 16px', borderRadius: 16,
        borderBottomLeftRadius: 4,
        background: 'var(--card-bg)',
        display: 'flex', gap: 4, alignItems: 'center'
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--muted)',
            animation: `typingDot 1.2s ease-in-out ${i * 0.15}s infinite`
          }} />
        ))}
      </div>
    </div>
  )
})

// ═══ 输入区域（独立组件，避免流式渲染干扰输入）═══
interface InputBarProps {
  sending: boolean
  onSend: (text: string) => void
}

const InputBar = memo(function InputBar({ sending, onSend }: InputBarProps) {
  const [input, setInput] = useState('')

  function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    onSend(text)
    setInput('')
  }

  return (
    <div style={{
      padding: '8px 16px calc(90px + env(safe-area-inset-bottom))',
      borderTop: '1px solid var(--border)',
      background: 'var(--card-bg)', display: 'flex', gap: 8,
      flexShrink: 0,
      position: 'relative',
      zIndex: 1
    }}>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            handleSend()
          }
        }}
        placeholder="告诉监管者…"
        style={{
          flex: 1, padding: '10px 14px', borderRadius: 100,
          background: 'var(--bg)', border: '1px solid var(--border)',
          color: 'var(--fg)', fontSize: 14, outline: 'none',
          transition: 'border-color 0.2s'
        }}
        onFocus={e => e.target.style.borderColor = 'var(--fg)'}
        onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border)'}
      />
      <button
        onClick={handleSend}
        disabled={sending}
        style={{
          padding: '10px 20px', borderRadius: 100,
          background: 'var(--fg)', color: 'var(--bg)',
          border: 'none', fontSize: 13, fontWeight: 600,
          cursor: sending ? 'not-allowed' : 'pointer',
          opacity: sending ? 0.5 : 1,
          transition: 'opacity 0.2s, transform 0.1s'
        }}
      >发送</button>
    </div>
  )
})

// ═══ 主组件 ═══
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

  // 检查使用情况访问权限
  useEffect(() => {
    hasUsageAccess().then(setUsageAccess)
  }, [])

  const configured = !!(ai.apiKey?.trim() && ai.endpoint?.trim() && ai.model?.trim())

  // 滚动到底部（用 rAF 节流，避免 setTimeout 堆积）
  const scrollToBottom = useCallback(() => {
    if (scrollRafRef.current) return
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      }
    })
  }, [])

  // 开场白 — 只在挂载时和 messages 从 0→有时触发，不依赖 streamingText
  const greetingDone = useRef(false)
  useEffect(() => {
    if (greetingDone.current) return
    if (configured && messages.length === 0) {
      greetingDone.current = true
      const s = useStore.getState()
      const studyMin = Math.floor(s.todayStudyMs / 60_000)
      const goalPct = s.dailyGoalMin > 0 ? Math.min(100, Math.round(studyMin / s.dailyGoalMin * 100)) : 0
      let greeting: string
      if (s.hp < 30) {
        greeting = `状态拉响：HP ${s.hp}，精神力告急。\n今日学习 ${studyMin} 分钟，达成 ${goalPct}%。\n连胜 ${s.streak} 天——别断在这里。说吧，什么情况。`
      } else if (goalPct >= 100) {
        greeting = `今日目标已达成，HP ${s.hp}。\n连胜 ${s.streak} 天。状态不错，有什么打算？`
      } else if (goalPct >= 50) {
        greeting = `HP ${s.hp}，今日学习 ${studyMin} 分钟（${goalPct}%）。\n势头还行，继续推。需要我做什么？`
      } else {
        greeting = `HP ${s.hp}，今日学习 ${studyMin} 分钟，达成 ${goalPct}%。\n连胜 ${s.streak} 天。进度有点慢，说吧。`
      }
      pushChat({ role: 'assistant', text: greeting })
    }
    // 如果有旧的"未配置"开场白，清空
    if (configured && messages.length === 1) {
      const last = messages[0]
      if (last.role === 'assistant' && last.text.includes('还差一步')) {
        clearChat()
        greetingDone.current = false // 重新触发
        return
      }
    }
    scrollToBottom()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 消息变化时滚动
  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  // 流式文本变化时滚动
  useEffect(() => {
    if (streamingText) scrollToBottom()
  }, [streamingText, scrollToBottom])

  // 发送消息
  const handleSend = useCallback(async (text: string) => {
    if (sending) return
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
        (chunk) => {
          streamingRef.current += chunk
          setStreamingText(streamingRef.current)
        },
        () => {
          // onStreamReset: 工具调用检测到时清空之前的流式内容
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
  }, [sending, configured, pushChat, onNavigateSettings])

  return (
    <div
      className="safe-top"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '100%',
        background: 'var(--bg)'
      }}
    >
      <StatusBar />

      {/* 消息列表 */}
      <div ref={scrollRef} className="scrollbar-hide" style={{
        flex: 1, overflowY: 'auto', padding: '12px 16px 8px'
      }}>
        {/* 未配置时显示配置卡片 */}
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
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              监管者未上线
            </div>
            <div style={{
              fontSize: 12, color: 'var(--muted)', marginBottom: 16,
              lineHeight: 1.8, whiteSpace: 'pre-line'
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
                border: 'none', fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
              }}
            >
              去设置 →
            </button>
          </div>
        )}

        {/* 使用情况权限引导 */}
        {configured && !usageAccess && (
          <div style={{
            margin: '0 0 12px',
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(229, 77, 46, 0.08)',
            border: '1px solid rgba(229, 77, 46, 0.2)',
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#E54D2E' }}>
                缺少使用情况访问权限
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                监管者需要此权限查阅你的真实学习/娱乐时长
              </div>
            </div>
            <button
              onClick={async () => {
                await openUsageAccessSettings()
                setTimeout(() => hasUsageAccess().then(setUsageAccess), 2000)
              }}
              style={{
                padding: '6px 14px', borderRadius: 100,
                background: '#E54D2E', color: '#fff',
                border: 'none', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              去授权
            </button>
          </div>
        )}

        {/* 消息列表 */}
        {messages.map(m => <Bubble key={m.id} role={m.role} text={m.text} />)}

        {/* 流式输出 */}
        {sending && streamingText && (
          <Bubble role="assistant" text={streamingText} />
        )}
        {sending && !streamingText && <TypingIndicator />}
      </div>

      {/* 快捷指令 */}
      <div className="scrollbar-hide" style={{
        padding: '6px 16px', display: 'flex', gap: 6, overflowX: 'auto',
        flexShrink: 0
      }}>
        {QUICK_PROMPTS.map(q => (
          <button
            key={q}
            onClick={() => handleSend(q)}
            disabled={sending}
            style={{
              padding: '6px 12px', borderRadius: 100,
              background: 'var(--bg-alt)', border: '1px solid var(--border)',
              fontSize: 11, color: 'var(--fg)', whiteSpace: 'nowrap',
              cursor: sending ? 'not-allowed' : 'pointer',
              opacity: sending ? 0.5 : 1,
              transition: 'opacity 0.2s'
            }}
          >{q}</button>
        ))}
      </div>

      {/* 输入框 */}
      <InputBar sending={sending} onSend={handleSend} />
    </div>
  )
}
