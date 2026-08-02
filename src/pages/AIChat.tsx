import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '@/stores/useStore'
import { chatWithAI } from '@/lib/ai'
import type { PageId } from '@/stores/useStore'

interface AIChatProps {
  onNavigate?: (page: PageId) => void
}

export default function AIChat({ onNavigate }: AIChatProps) {
  const playerTag = useStore(s => s.playerTag)
  const hp = useStore(s => s.hp)
  const points = useStore(s => s.points)
  const chatHistory = useStore(s => s.chat)
  const pushChat = useStore(s => s.pushChat)
  const aiConfig = useStore(s => s.ai)

  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatHistory, streamText])

  // 聚焦输入框
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    // 检查 API 配置
    if (!aiConfig.apiKey || !aiConfig.endpoint || !aiConfig.model) {
      pushChat({ role: 'user', text })
      pushChat({
        role: 'assistant',
        text: '⚠️ 请先前往「设置 → AI 监管者」填入 API Key、Endpoint 和模型名称后再开始对话。'
      })
      setInput('')
      return
    }

    pushChat({ role: 'user', text })
    setInput('')
    setStreaming(true)
    setStreamText('')

    let assistantText = ''
    try {
      const reply = await chatWithAI(
        text,
        (chunk) => {
          assistantText += chunk
          setStreamText(assistantText)
        },
        () => {
          // 工具调用时清空流式内容，准备第二轮
          setStreamText('')
          assistantText = ''
        }
      )
      pushChat({ role: 'assistant', text: reply })
    } catch (e: any) {
      pushChat({ role: 'assistant', text: `对话出错：${e.message || '未知错误'}` })
    } finally {
      setStreaming(false)
      setStreamText('')
    }
  }, [input, streaming, aiConfig, pushChat])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const quickPrompts = [
    '看看我今天的表现',
    '扣我10积分',
    '奖励我50积分',
    '加个任务：复习数学',
    '设HP为80',
  ]

  return (
    <div
      className="view active safe-top"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)'
      }}
    >
      {/* 头部 */}
      <header style={{
        padding: '16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'var(--fg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18
        }}>
          🤖
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>AI 监管者</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {playerTag} · HP {hp} · {points} PTS
          </div>
        </div>
        <button
          onClick={() => onNavigate?.('settings')}
          style={{
            background: 'none', border: 'none',
            fontSize: 20, cursor: 'pointer', color: 'var(--muted)'
          }}
        >
          ⚙️
        </button>
      </header>

      {/* 对话区域 */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {chatHistory.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--muted)'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--fg)' }}>
              你的个人成长监督者
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              我可以查看你的手机使用情况、<br />
              管理积分和任务、调整你的 HP。<br />
              试试下面的快捷指令，或直接输入。
            </div>
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className="bubble-in"
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: msg.role === 'user' ? 'var(--fg)' : 'var(--card-bg)',
              color: msg.role === 'user' ? 'var(--bg)' : 'var(--fg)',
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxShadow: msg.role === 'assistant' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            {msg.text}
          </div>
        ))}

        {/* 流式输出中 */}
        {streaming && streamText && (
          <div
            className="bubble-in"
            style={{
              alignSelf: 'flex-start',
              maxWidth: '85%',
              padding: '12px 16px',
              borderRadius: '18px 18px 18px 4px',
              background: 'var(--card-bg)',
              color: 'var(--fg)',
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {streamText}
            <span style={{
              display: 'inline-block',
              width: 6, height: 6,
              borderRadius: '50%',
              background: 'var(--fg)',
              marginLeft: 4,
              animation: 'typingDot 1s infinite'
            }} />
          </div>
        )}

        {/* 加载指示器 */}
        {streaming && !streamText && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '12px 16px',
            display: 'flex', gap: 4, alignItems: 'center'
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)', animation: 'typingDot 1s infinite 0s' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)', animation: 'typingDot 1s infinite 0.2s' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)', animation: 'typingDot 1s infinite 0.4s' }} />
          </div>
        )}

        <div style={{ height: 8 }} />
      </div>

      {/* 快捷指令 */}
      {chatHistory.length === 0 && (
        <div style={{
          padding: '0 16px 12px',
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          flexShrink: 0
        }} className="scrollbar-hide">
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => { setInput(p); inputRef.current?.focus() }}
              style={{
                padding: '8px 14px',
                borderRadius: 100,
                border: '1px solid var(--border)',
                background: 'var(--card-bg)',
                color: 'var(--fg)',
                fontSize: 12,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* 输入框 */}
      <div style={{
        padding: '12px 16px 24px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexShrink: 0,
        background: 'var(--bg)'
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={streaming ? '监管者思考中...' : '输入指令...'}
          disabled={streaming}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 100,
            border: '1px solid var(--border)',
            background: 'var(--card-bg)',
            color: 'var(--fg)',
            fontSize: 14,
            outline: 'none'
          }}
        />
        <button
          onClick={handleSend}
          disabled={streaming || !input.trim()}
          style={{
            width: 44, height: 44,
            borderRadius: '50%',
            border: 'none',
            background: input.trim() && !streaming ? 'var(--fg)' : 'var(--bg-alt)',
            color: input.trim() && !streaming ? 'var(--bg)' : 'var(--muted)',
            fontSize: 18,
            cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          ↑
        </button>
      </div>
    </div>
  )
}
