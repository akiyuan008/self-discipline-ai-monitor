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
  const hp = useStore(s => s.hp)
  const points = useStore(s => s.points)
  const streak = useStore(s => s.streak)
  const todayStudyMs = useStore(s => s.todayStudyMs)
  const dailyGoalMin = useStore(s => s.dailyGoalMin)

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const streamingRef = useRef('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const studyMin = Math.floor(todayStudyMs / 60_000)
  const goalPct = dailyGoalMin > 0 ? Math.min(100, Math.round(studyMin / dailyGoalMin * 100)) : 0

  useEffect(() => {
    if (messages.length === 0) {
      const configured = ai.apiKey && ai.endpoint && ai.model
      let greeting: string
      if (configured) {
        // 根据当前状态生成更有温度的开场白
        if (hp < 30) {
          greeting = `状态拉响：HP ${hp}，精神力告急。\n今日学习 ${studyMin} 分钟，达成 ${goalPct}%。\n连胜 ${streak} 天——别断在这里。说吧，什么情况。`
        } else if (goalPct >= 100) {
          greeting = `今日目标已达成，HP ${hp}。\n连胜 ${streak} 天。状态不错，有什么打算？`
        } else if (goalPct >= 50) {
          greeting = `HP ${hp}，今日学习 ${studyMin} 分钟（${goalPct}%）。\n势头还行，继续推。需要我做什么？`
        } else {
          greeting = `HP ${hp}，今日学习 ${studyMin} 分钟，达成 ${goalPct}%。\n连胜 ${streak} 天。进度有点慢，说吧。`
        }
      } else {
        greeting = '监管者已就位。但还差一步：\n去「设置 → AI 监管者」填入 API Key、Endpoint 和模型名，我才能真正上线。'
      }
      pushChat({ role: 'assistant', text: greeting })
    }
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 80)
  }, [messages.length, streamingText])

  async function send(text: string) {
    if (!text.trim() || sending) return
    setSending(true)
    pushChat({ role: 'user', text: text.trim() })
    setInput('')
    // 重置流式状态
    streamingRef.current = ''
    setStreamingText('')

    // 流式回调：每收到一段文字就更新 UI（打字机效果）
    const reply = await chatWithAI(text.trim(), (chunk) => {
      streamingRef.current += chunk
      setStreamingText(streamingRef.current)
      // 滚动到底部
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 30)
    })

    // 如果流式过程中有内容，优先使用流式内容；否则用返回的字符串（可能是错误信息）
    const finalText = streamingRef.current || reply
    pushChat({ role: 'assistant', text: finalText })
    streamingRef.current = ''
    setStreamingText('')
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
      className="safe-top safe-bottom slide-in-right"
    >
      {/* 顶部 — 带状态指示 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--card-bg)'
      }}>
        <button
          onClick={onBack}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--bg-alt)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--fg)',
            transition: 'transform 0.15s'
          }}
          className="dock-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 在线状态指示灯 */}
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
        {/* 状态条 */}
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

      {/* 消息列表 */}
      <div ref={scrollRef} className="scrollbar-hide" style={{
        flex: 1, overflowY: 'auto', padding: '16px 16px 8px'
      }}>
        {messages.map(m => <Bubble key={m.id} role={m.role} text={m.text} />)}
        {/* 流式输出中：已有文字 → 显示打字机气泡；无文字 → 显示三点等待动画 */}
        {sending && streamingText && (
          <Bubble role="assistant" text={streamingText} />
        )}
        {sending && !streamingText && (
          <div style={{
            display: 'flex', gap: 6, alignItems: 'center',
            marginBottom: 12
          }}>
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
        )}
      </div>

      {/* 快捷指令 */}
      <div className="scrollbar-hide" style={{
        padding: '6px 16px', display: 'flex', gap: 6, overflowX: 'auto'
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
              cursor: sending ? 'not-allowed' : 'pointer',
              opacity: sending ? 0.5 : 1,
              transition: 'opacity 0.2s'
            }}
          >{q}</button>
        ))}
      </div>

      {/* 输入框 */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
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
            color: 'var(--fg)', fontSize: 14, outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={e => e.target.style.borderColor = 'var(--fg)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <button
          onClick={() => send(input)}
          disabled={sending || !input.trim()}
          style={{
            padding: '10px 20px', borderRadius: 100,
            background: 'var(--fg)', color: 'var(--bg)',
            border: 'none', fontSize: 13, fontWeight: 600,
            cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: sending || !input.trim() ? 0.5 : 1,
            transition: 'opacity 0.2s, transform 0.1s'
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
}
