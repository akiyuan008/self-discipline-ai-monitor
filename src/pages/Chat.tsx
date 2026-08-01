import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import { showToast } from '@/components/Toast'
import { chatWithAI } from '@/lib/ai'

interface Props {
  onBack: () => void
}

const QUICK_PROMPTS = [
  '帮我加个 25 分钟背单词的日常任务',
  '今天太累了，给我加个成就「一周摸鱼终结者」',
  '我刚偷偷刷了 30 分钟抖音，扣我 50 积分',
  '看看我今天的进度'
]

export default function Chat({ onBack }: Props) {
  const messages = useStore(s => s.chat)
  const pushChat = useStore(s => s.pushChat)
  const clearChat = useStore(s => s.clearChat)
  const ai = useStore(s => s.ai)

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length === 0) {
      pushChat({
        role: 'assistant',
        text: ai.apiKey
          ? '监管者已上线。状态汇报。'
          : '监管者已上线。但你还差一步：去「设置 → AI 配置」填入 API Key 和 Endpoint 后才能真正对话。AI 可以加任务、加成就、调积分、设精神力。'
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
      className="safe-top safe-bottom animate-in"
    >
      {/* 顶部 */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card-bg)'
      }}>
        <button
          onClick={onBack}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--bg-alt)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--fg)'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>AI_WARDEN</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>监管者</div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { clearChat(); showToast('已清空对话') }}
            style={{
              padding: '6px 12px', borderRadius: 100,
              background: 'var(--bg-alt)', border: 'none',
              fontSize: 11, color: 'var(--muted)', cursor: 'pointer'
            }}
          >清空</button>
        )}
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} className="scrollbar-hide" style={{
        flex: 1, overflowY: 'auto', padding: '16px 16px 8px'
      }}>
        {messages.map(m => <Bubble key={m.id} role={m.role} text={m.text} />)}
        {sending && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--muted)', fontSize: 12 }}>
            <span className="breathe" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)' }} />
            监管者思考中…
          </div>
        )}
      </div>

      {/* 快捷指令 */}
      <div className="scrollbar-hide" style={{
        padding: '8px 16px', display: 'flex', gap: 6, overflowX: 'auto'
      }}>
        {QUICK_PROMPTS.map(q => (
          <button
            key={q}
            onClick={() => send(q)}
            disabled={sending}
            style={{
              padding: '6px 12px', borderRadius: 100,
              background: 'var(--bg-alt)', border: '1px solid var(--border)',
              fontSize: 11, color: 'var(--fg)', whiteSpace: 'nowrap',
              cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1
            }}
          >{q}</button>
        ))}
      </div>

      {/* 输入框 */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--border)',
        background: 'var(--card-bg)', display: 'flex', gap: 8
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          placeholder="告诉监管者…"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 100,
            background: 'var(--bg)', border: '1px solid var(--border)',
            color: 'var(--fg)', fontSize: 14, outline: 'none'
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={sending || !input.trim()}
          style={{
            padding: '10px 20px', borderRadius: 100,
            background: 'var(--fg)', color: 'var(--bg)',
            border: 'none', fontSize: 13, fontWeight: 600,
            cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: sending || !input.trim() ? 0.5 : 1
          }}
        >发送</button>
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
      }}>{text}</div>
    </div>
  )
}
