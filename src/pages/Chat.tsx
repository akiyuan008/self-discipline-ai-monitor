import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { currentPersona, useUserStore } from '@/stores/userStore'
import { sendChat } from '@/lib/ai'
import { lockScreenMinutes, isLateNight } from '@/lib/usageStats'
import { studyMinutesToday, focusScoreToday } from '@/stores/statsStore'

const QUICK_PROMPTS = [
  '今天状态不行，鼓励下我',
  '帮我拆个 2 小时学习计划',
  '我刚又摸鱼了，骂醒我',
  '看看我今天的进度',
  '今晚熬夜想学，行吗？'
]

export default function Chat() {
  const persona = currentPersona()
  const messages = useChatStore(s => s.messages)
  const push = useChatStore(s => s.push)
  const reset = useChatStore(s => s.reset)
  const nickname = useUserStore(s => s.nickname)

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length === 0) {
      push({ sender: 'ai', text: persona.greeting, mood: 'normal' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function send(text: string) {
    if (!text.trim() || sending) return
    setSending(true)
    push({ sender: 'user', text: text.trim() })
    setInput('')
    const r = await sendChat(messages.map(m => ({ sender: m.sender, text: m.text })), text.trim())
    push({ sender: 'ai', text: r.reply, mood: r.mood as any })

    // 检测是否建议锁屏
    if (r.mood === 'care' || (isLateNight() && /锁|睡|休息/.test(r.reply))) {
      const go = window.confirm(`${persona.name}建议锁屏休息一会儿，是否立即锁屏 5 分钟？`)
      if (go) await lockScreenMinutes(5)
    }
    setSending(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-stroke">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{ background: persona.color + '18' }}>{persona.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold" style={{ color: persona.color }}>{persona.name}</span>
              <span className="text-xs text-ink-3">· {nickname}</span>
            </div>
            <p className="text-[11px] text-ink-3 truncate">{persona.tagline}</p>
          </div>
          <button className="text-xs text-ink-3" onClick={() => {
            if (window.confirm('清空对话历史？')) reset()
          }}>清空</button>
        </div>
        {/* 当前状态 */}
        <div className="flex gap-2 mt-2 text-[10px]">
          <span className="chip bg-bg-soft text-ink-2">学习 {(studyMinutesToday() / 60).toFixed(1)}h</span>
          <span className="chip bg-bg-soft text-ink-2">专注 {focusScoreToday()}</span>
          {isLateNight() && <span className="chip bg-amber-50 text-amber-700">深夜模式</span>}
        </div>
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
        {messages.map(m => (
          <Bubble key={m.id} sender={m.sender} text={m.text} mood={m.mood} persona={persona} />
        ))}
        {sending && (
          <div className="flex gap-2 items-end">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-base"
              style={{ background: persona.color + '18' }}>{persona.emoji}</div>
            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-2.5 shadow-card">
              <span className="text-sm text-ink-3 typing">···</span>
            </div>
          </div>
        )}
      </div>

      {/* 快捷 */}
      <div className="px-4 pb-2 overflow-x-auto flex gap-2 scrollbar-hide">
        {QUICK_PROMPTS.map(q => (
          <button key={q} onClick={() => send(q)}
            className="chip bg-bg-soft text-ink-2 whitespace-nowrap active:opacity-70">{q}</button>
        ))}
      </div>

      {/* 输入 */}
      <div className="px-4 pb-3 safe-bottom">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder={`对 ${persona.name} 说点什么...`}
            rows={1}
            className="flex-1 bg-white rounded-2xl px-4 py-2.5 text-sm outline-none border border-stroke focus:border-brand resize-none max-h-32"
          />
          <button
            className="btn-primary px-4 py-2.5"
            disabled={!input.trim() || sending}
            onClick={() => send(input)}
          >送出</button>
        </div>
      </div>

      <style>{`
        .typing::after { content: ''; animation: dots 1.2s infinite; }
        @keyframes dots { 0%{content:'·'} 33%{content:'··'} 66%{content:'···'} 100%{content:''} }
      `}</style>
    </div>
  )
}

function Bubble({ sender, text, mood, persona }: {
  sender: string
  text: string
  mood?: string
  persona: ReturnType<typeof currentPersona>
}) {
  const isUser = sender === 'user'
  const moodBg =
    mood === 'punish' ? 'bg-rose-50 border border-rose-200' :
    mood === 'warn' ? 'bg-amber-50 border border-amber-200' :
    mood === 'praise' ? 'bg-emerald-50 border border-emerald-200' :
    mood === 'care' ? 'bg-blue-50 border border-blue-200' :
    'bg-white'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-brand text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[78%]">
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{text}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-2 items-end">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
        style={{ background: persona.color + '18' }}>{persona.emoji}</div>
      <div className={`${moodBg} rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[78%] shadow-card`}>
        <p className="text-sm text-ink-1 leading-relaxed whitespace-pre-wrap break-words">{text}</p>
      </div>
    </div>
  )
}
