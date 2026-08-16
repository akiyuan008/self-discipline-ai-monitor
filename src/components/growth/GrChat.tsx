/**
 * src/components/growth/GrChat.tsx
 * Growth Mode Chat — AI 成长伙伴。温暖、中文为主。
 * 复用现有 chatWithAI / store 逻辑，只改视觉层。
 */
import { memo, useCallback, useEffect, useRef, useState, type CompositionEvent, type KeyboardEvent } from 'react'
import { App } from '@capacitor/app'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { chatWithAI } from '@/lib/ai'
import { hasUsageAccess, openUsageAccessSettings } from '@/lib/usageStats'
import Icon from '@/components/Icons'

interface Props { onNavigateSettings?: () => void }

const StatusBar = memo(function StatusBar({ onClearChat, onToggleHistory, showHistory, onNavigateSettings }: {
  onClearChat?: () => void; onToggleHistory?: () => void; showHistory: boolean; onNavigateSettings?: () => void
}) {
  const ai = useStore(s => s.ai)
  const points = useStore(s => s.points)
  const streak = useStore(s => s.streak)
  const messages = useStore(s => s.chat)

  return (
    <div style={{
      padding: '16px 16px 12px', display: 'flex', justifyContent: 'space-between',
      alignItems: 'flex-end', flexShrink: 0, borderBottom: '1px solid var(--growth-border)'
    }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: ai.apiKey ? 'var(--success)' : 'var(--growth-text-secondary)',
            display: 'inline-block'
          }} />
          成长伙伴 · {ai.apiKey ? '在线' : '离线'}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--growth-text)', margin: 0 }}>
          AI 助手
        </h1>
        <div style={{ fontSize: 11, color: 'var(--growth-text-secondary)', marginTop: 2 }}>
          {points} 积分 · 连签 {streak} 天
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onToggleHistory?.()} className="gr-btn gr-btn-outline" style={{ padding: '6px 12px', fontSize: 11 }}>
          {showHistory ? '关闭' : '历史'}
        </button>
        {messages.length > 0 && (
          <button onClick={() => onClearChat?.()} className="gr-btn gr-btn-outline" style={{ padding: '6px 12px', fontSize: 11 }}>清空</button>
        )}
        {onNavigateSettings && (
          <button onClick={() => onNavigateSettings()} style={{
            width: 32, height: 32, borderRadius: '50%', background: 'var(--growth-surface)',
            border: '1px solid var(--growth-border)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer'
          }}>
            <Icon.Gear size={14} color="var(--growth-text-secondary)" />
          </button>
        )}
      </div>
    </div>
  )
})

const Bubble = memo(function Bubble({ role, text }: { role: string; text: string }) {
  const isUser = role === 'user'
  const isSystem = role === 'system'

  if (isSystem) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <div className="bubble-in" style={{
          maxWidth: '90%', padding: '6px 12px', borderRadius: 100,
          background: 'var(--growth-surface-alt)', color: 'var(--growth-text-secondary)',
          fontSize: 11, lineHeight: 1.4, textAlign: 'center', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
        }}>{text}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      <div className="bubble-in" style={{
        maxWidth: '78%', padding: '10px 14px', borderRadius: 16,
        borderBottomRightRadius: isUser ? 4 : 16,
        borderBottomLeftRadius: isUser ? 16 : 4,
        background: isUser ? 'var(--growth-primary)' : 'var(--growth-surface)',
        color: isUser ? '#fff' : 'var(--growth-text)',
        fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        boxShadow: '0 2px 8px rgba(45,42,38,0.04)'
      }}>{text}</div>
    </div>
  )
})

const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
      <div style={{ padding: '10px 14px', borderRadius: 16, borderBottomLeftRadius: 4, background: 'var(--growth-surface)', display: 'flex', gap: 4, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--growth-text-secondary)', animation: `typingDot 1.2s ease-in-out ${i * 0.15}s infinite` }} />
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
      background: 'var(--growth-surface)', borderLeft: '1px solid var(--growth-border)',
      zIndex: 50, display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.2s ease'
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--growth-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--growth-text)' }}>对话历史</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--growth-text-secondary)' }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {Object.entries(grouped).map(([date, msgs]) => (
          <div key={date} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)', marginBottom: 6 }}>{date}</div>
            {msgs.slice(-3).map((msg, i) => (
              <div key={i} style={{
                fontSize: 11, padding: '6px 8px', borderRadius: 8,
                background: msg.role === 'user' ? 'var(--growth-surface-alt)' : 'transparent',
                marginBottom: 4, color: 'var(--growth-text-secondary)',
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

const QUICK_PROMPTS = [
  '查看今日表现',
  '奖励我50积分',
  '扣我10积分',
  '加个任务：复习数学',
  '我是不是在偷懒',
]

function InputBar({ sending, onSend }: { sending: boolean; onSend: (text: string) => void }) {
  const [displayValue, setDisplayValue] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sendingRef = useRef(sending)
  sendingRef.current = sending

  const handleSend = () => {
    const text = displayValue.trim()
    if (!text || sendingRef.current) return
    onSend(text)
    setDisplayValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isComposing && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      padding: '6px 14px 10px', borderTop: '1px solid var(--growth-border)',
      background: 'var(--growth-surface)', display: 'flex', gap: 8, flexShrink: 0,
      position: 'relative', zIndex: 1
    }}>
      <input
        ref={inputRef}
        value={displayValue}
        onChange={e => setDisplayValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={(e: CompositionEvent<HTMLInputElement>) => {
          setIsComposing(false)
          setDisplayValue(e.currentTarget.value)
        }}
        placeholder="向 AI 助手发送消息…"
        inputMode="text"
        enterKeyHint="send"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck="false"
        style={{
          flex: 1, padding: '10px 14px', borderRadius: 100,
          background: 'var(--growth-bg)', border: '1px solid var(--growth-border)',
          color: 'var(--growth-text)', fontSize: 14, outline: 'none',
          WebkitUserSelect: 'text', userSelect: 'text'
        }}
      />
      <button onClick={handleSend} disabled={sending} className="gr-btn gr-btn-primary" style={{
        padding: '10px 18px', borderRadius: 100, fontSize: 13,
        opacity: sending ? 0.5 : 1, cursor: sending ? 'not-allowed' : 'pointer'
      }}>发送</button>
    </div>
  )
}

export default function GrChat({ onNavigateSettings }: Props) {
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
      let greeting = `今日学习 ${studyMin} 分钟，达成 ${goalPct}%。连签 ${state.streak} 天。继续加油！`
      if (goalPct < 30) greeting = `今日学习仅 ${studyMin} 分钟，达成 ${goalPct}%。连签 ${state.streak} 天——别断在这里，加油！`
      else if (goalPct >= 100) greeting = `今日目标已达成。连签 ${state.streak} 天。状态不错，有什么打算？`
      else if (goalPct >= 50) greeting = `今日学习 ${studyMin} 分钟（${goalPct}%）。连签 ${state.streak} 天。势头不错，继续推进！`
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
    <div className="safe-top animate-in" style={{
      display: 'flex', flexDirection: 'column', height: '100dvh', maxHeight: '100dvh',
      background: 'var(--growth-bg)', position: 'relative', overflow: 'hidden', paddingBottom: 70
    }}>
      <StatusBar
        onClearChat={handleClearChat}
        onToggleHistory={() => setShowHistory(!showHistory)}
        showHistory={showHistory}
        onNavigateSettings={onNavigateSettings}
      />

      {showHistory && <ChatHistory onClose={() => setShowHistory(false)} />}

      <div ref={scrollRef} className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 6px', minHeight: 0 }}>
        {!configured && (
          <div className="gr-card" style={{ margin: '0 0 12px', textAlign: 'center' }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><Icon.Warning size={26} color="var(--warning)" /></div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--growth-text)', marginBottom: 6 }}>AI 助手未配置</div>
            <div style={{ fontSize: 12, color: 'var(--growth-text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
              {!ai.apiKey?.trim() ? '· 缺少 API Key\n' : ''}
              {!ai.endpoint?.trim() ? '· 缺少 Base URL\n' : ''}
              {!ai.model?.trim() ? '· 缺少模型名称\n' : ''}
              请前往设置完成配置。
            </div>
            <button onClick={() => onNavigateSettings?.()} className="gr-btn gr-btn-primary" style={{ padding: '8px 28px', borderRadius: 100 }}>去设置</button>
          </div>
        )}

        {configured && !usageAccess && (
          <div className="gr-card" style={{ margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>缺少使用情况访问权限</div>
              <div style={{ fontSize: 10, color: 'var(--growth-text-secondary)', marginTop: 2 }}>AI 助手需要此权限查阅你的真实学习/娱乐时长</div>
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
            }} className="gr-btn" style={{ padding: '6px 12px', borderRadius: 100, background: 'var(--danger)', color: '#fff', fontSize: 11 }}>去授权</button>
          </div>
        )}

        {messages.length === 0 && configured && (
          <div className="gr-card" style={{ marginBottom: 12, color: 'var(--growth-text-secondary)', fontSize: 13 }}>
            现在可以直接和 AI 助手交流，要求、惩罚、奖励、任务和成就都会同步到你的状态里。
          </div>
        )}

        {messages.map(message => <Bubble key={message.id} role={message.role} text={message.text} />)}
        {sending && streamingText && <Bubble role="assistant" text={streamingText} />}
        {sending && !streamingText && <TypingIndicator />}
      </div>

      <div className="scrollbar-hide" style={{ padding: '4px 14px', display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0 }}>
        {QUICK_PROMPTS.map(prompt => (
          <button key={prompt} onClick={() => handleSend(prompt)} disabled={sending} style={{
            padding: '5px 12px', borderRadius: 100, background: 'var(--growth-surface-alt)',
            border: '1px solid var(--growth-border)', fontSize: 11, color: 'var(--growth-text)',
            whiteSpace: 'nowrap', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1
          }}>{prompt}</button>
        ))}
      </div>

      <InputBar sending={sending} onSend={handleSend} />
    </div>
  )
}
