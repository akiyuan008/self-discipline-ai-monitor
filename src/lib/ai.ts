// 前端封装的 AI 调用接口
import { currentPersona, useUserStore } from '@/stores/userStore'
import { studyMinutesToday, entertainmentMinutesToday, focusScoreToday } from '@/stores/statsStore'
import { isLateNight } from '@/lib/usageStats'

// 自动选择 API base
// - 显式环境变量优先：VITE_API_BASE
// - 默认指向 http://127.0.0.1:8787（preview/打包后 / file:// 都直连后端）
// - 在 vite dev 模式下，可设 VITE_API_BASE=空 让前端走同源 /api 走 vite proxy
const envBase = (import.meta.env.VITE_API_BASE as string | undefined)
const API_BASE = envBase !== undefined ? envBase : 'http://127.0.0.1:8787'

export interface PersonaDTO {
  id: string
  name: string
  emoji: string
  voice: string
  catchphrases: string[]
  punishmentStyle: string
  greeting: string
}

function toDTO(p: ReturnType<typeof currentPersona>): PersonaDTO {
  return {
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    voice: p.voice,
    catchphrases: p.catchphrases,
    punishmentStyle: p.punishmentStyle,
    greeting: p.greeting
  }
}

function userCtx() {
  const u = useUserStore.getState()
  return {
    nickname: u.nickname,
    studyMin: studyMinutesToday(),
    entMin: entertainmentMinutesToday(),
    focus: focusScoreToday(),
    dailyGoalMin: u.dailyGoalMin,
    recentScores: [62, 58, 55],
    isLateNight: isLateNight(),
    studyingTooLong: false
  }
}

export async function sendChat(
  history: { sender: string; text: string }[],
  userMessage: string
): Promise<{ reply: string; mood: string }> {
  try {
    const r = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona: toDTO(currentPersona()),
        userCtx: userCtx(),
        history: history.slice(-10),
        userMessage
      })
    })
    if (!r.ok) throw new Error('chat failed')
    const data = await r.json()
    return { reply: data.reply, mood: data.mood }
  } catch (e) {
    return { reply: '网络不太行，但学习不能停。先做起来。', mood: 'warn' }
  }
}

export async function careCheck(): Promise<{
  trigger: boolean
  reply: string
  mood: string
  triggers: string[]
}> {
  try {
    const r = await fetch(`${API_BASE}/api/care-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: toDTO(currentPersona()), userCtx: userCtx() })
    })
    if (!r.ok) throw new Error('care-check failed')
    return await r.json()
  } catch (e) {
    return { trigger: false, reply: '', mood: 'normal', triggers: [] }
  }
}

export async function getAnalysis(
  type: 'weekly' | 'monthly',
  payload: any
): Promise<{ summary: string; suggestions: string[] }> {
  try {
    const r = await fetch(`${API_BASE}/api/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload })
    })
    if (!r.ok) throw new Error('analysis failed')
    return await r.json()
  } catch (e) {
    return {
      summary: '分析服务暂时不可用。',
      suggestions: []
    }
  }
}

export async function getPosterText() {
  const u = useUserStore.getState()
  try {
    const r = await fetch(`${API_BASE}/api/poster-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: u.nickname,
        studyMin: studyMinutesToday(),
        focus: focusScoreToday(),
        persona: toDTO(currentPersona())
      })
    })
    if (!r.ok) throw new Error('poster failed')
    return await r.json()
  } catch (e) {
    return { lines: [] }
  }
}
