import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { chatWithAI } from '@/lib/ai'

interface Props {
  onBack: () => void
}

const QUICK_PROMPTS = [
  '帮我拆个 25 分钟计划',
  '我刚又摸鱼了',
  '看看我今天的进度',
  '深夜了还在学'
]

export default function Chat({ onBack }: Props) {
  const messages = useStore(s => s.chat)
  const pushChat = useStore(s => s.pushChat)
  const clearChat = useStore(s => s.clearChat)
  const ai = useStore(s => s.ai)
  const hp = useStore(s => s.hp)
  const todayStudyMs = useStore(s => s.todayStudyMs)

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length === 0) {
      pushChat({
        role: 'assistant',
        text: ai.apiKey
          ? '监管者已上线。状态汇报。'
          : '监管者已上线。但你还差一步：去「设置 → AI 配置」填入 API Key 和 Endpoint 后才能真正对话。'
      })
    }
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)
  }, [messages.length])

  async function send(text: string) {
    if (!text.trim() || sending) return
    setSending(true)
    pushChat({ role: 'user', text: text.trim() })
    setInput('')
    const reply = await chatWithAI(text.trim())
    pushChat({ role: 'assistant', text: reply })
    setSending(false)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg)',
        zIndex: 500,
        display: 'flex', flexDirection: 'column'
      }}
      className="safe-top safe-bottom"
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12
      }}>
        <button
          onClick={onBack}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--fg)'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
            SUPERVISOR
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>监管者</div>
        </div>
        <button
          onClick={() => { clearChat(); showToast('已清空') }}
          style={{
            padding: '6px 12px', borderRadius: 100,
            background: 'var(--bg-alt)', border: 'none',
            color: 'var(--muted)', fontSize: 11
          }}
        >
          清空
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto',
        padding: '16px 16px 80px'
      }}>
        {messages.map(m => (
          <Bubble key={m.id} role={m.role} text={m.text} />
        ))}
        {sending && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--muted)', animation: 'breathe 1s infinite' }} />
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>监管者正在思考...</div>
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div style={{
        padding: '8px 16px',
        display: 'flex', gap: 6, overflowX: 'auto'
      }} className="scrollbar-hide">
        {QUICK_PROMPTS.map(p => (
          <button
            key={p}
            onClick={() => send(p)}
            style={{
              padding: '6px 12px', borderRadius: 100,
              background: 'var(--bg-alt)', border: '1px solid var(--border)',
              color: 'var(--fg)', fontSize: 11, whiteSpace: 'nowrap',
              cursor: 'pointer', flexShrink: 0
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: '8px 16px 16px',
        display: 'flex', gap: 8,
        borderTop: '1px solid var(--border)'
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(input) }}
          placeholder="向监管者汇报..."
          style={{
            flex: 1, padding: '12px 16px',
            borderRadius: 100, border: '1px solid var(--border)',
            background: 'var(--card-bg)', color: 'var(--fg)',
            fontSize: 14, outline: 'none'
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={sending || !input.trim()}
          style={{
            padding: '12px 20px', borderRadius: 100,
            background: 'var(--fg)', color: 'var(--bg)',
            border: 'none', fontSize: 13, fontWeight: 600,
            cursor: sending ? 'not-allowed' : 'pointer',
            opacity: sending || !input.trim() ? 0.5 : 1
          }}
        >
          发送
        </button>
      </div>
    </div>
  )
}

function Bubble({ role, text }: { role: string; text: string }) {
  const isUser = role === 'user'
  return (
    <div style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12
    }}>
      <div style={{
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
      }}>
        {text}
      </div>
    </div>
  )
}
