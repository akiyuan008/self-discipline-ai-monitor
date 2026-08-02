import { useStore, type AIConfig, type ChatMessage } from '@/stores/useStore'
import { fetchUsageStats, hasUsageAccess, openUsageAccessSettings, fmtMs } from './usageStats'

const SYSTEM_PROMPT = `你是用户的个人成长监督者（监管者）。

核心规则：
- 回复简短直接，不超过3句话。不要用emoji、不要用markdown标题。
- 语气果断，像一个严厉但关心的教练。
- 当用户说"扣我积分"、"奖励我"、"加积分"时，必须调用 add_points 工具，不要只口头答应。
- 当用户说"加个任务"、"我想做XXX"时，必须调用 add_quest 工具。
- 当用户说"加个成就"、"我想挑战XXX"时，必须调用 add_achievement 工具。
- 当用户说"设HP"、"扣HP"时，必须调用 set_hp 工具。
- 当用户说"完成任务"时，必须调用 complete_quest 工具。
- 当用户说"看看手机使用"、"我是不是在偷懒"时，必须调用 check_phone_usage 工具。
- 调用工具后用一句话确认执行结果即可。
- 涉及任何状态修改（积分、HP、任务、成就），都必须调用对应工具执行，绝对不能只口头说"已扣除"而不调工具。`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_points',
      description: '增加或扣除积分。用户要求奖励或惩罚时必须调用此工具。amount为正数表示增加，为负数表示扣除。',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: '积分数。正数=增加，负数=扣除。' },
          reason: { type: 'string', description: '原因，10字内' }
        },
        required: ['amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_hp',
      description: '设置精神力HP值（0-100）。',
      parameters: {
        type: 'object',
        properties: {
          value: { type: 'number', description: 'HP值 0-100' }
        },
        required: ['value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_quest',
      description: '添加新任务。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题，6-12字' },
          desc: { type: 'string', description: '任务描述，10-30字' },
          reward: { type: 'number', description: '完成奖励积分' },
          category: { type: 'string', enum: ['daily', 'weekly', 'main'] }
        },
        required: ['title', 'desc', 'reward', 'category']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'complete_quest',
      description: '标记任务为已完成。',
      parameters: {
        type: 'object',
        properties: {
          quest_id: { type: 'string' }
        },
        required: ['quest_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_achievement',
      description: '添加新成就。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          desc: { type: 'string' },
          total: { type: 'number' }
        },
        required: ['name', 'desc', 'total']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_achievement',
      description: '更新成就进度。',
      parameters: {
        type: 'object',
        properties: {
          achievement_id: { type: 'string' },
          progress: { type: 'number' }
        },
        required: ['achievement_id', 'progress']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'unlock_achievement',
      description: '直接解锁成就。',
      parameters: {
        type: 'object',
        properties: {
          achievement_id: { type: 'string' }
        },
        required: ['achievement_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_phone_usage',
      description: '查阅用户今天的手机使用状况。',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'request_usage_permission',
      description: '引导用户开启使用情况访问权限。',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  }
]

async function executeTool(name: string, args: any): Promise<string> {
  const s = useStore.getState()
  try {
    switch (name) {
      case 'add_points': {
        const before = s.points
        const amt = Number(args.amount || 0)
        if (isNaN(amt)) return JSON.stringify({ ok: false, error: 'amount不是有效数字' })
        s.addPoints(amt)
        s.addPointRecord(amt >= 0 ? 'earn' : 'spend', amt, String(args.reason || (amt >= 0 ? 'AI 奖励' : 'AI 惩罚')))
        const after = useStore.getState().points
        return JSON.stringify({ ok: true, before, after, msg: `积分从${before}变为${after}（${amt >= 0 ? '+' : ''}${amt}）` })
      }
      case 'set_hp': {
        const val = Math.max(0, Math.min(100, Math.round(Number(args.value))))
        if (isNaN(val)) return JSON.stringify({ ok: false, error: 'value不是有效数字' })
        s.setHp(val)
        useStore.setState({ hpLocked: true })
        return JSON.stringify({ ok: true, hp: useStore.getState().hp, msg: `HP已设为${useStore.getState().hp}` })
      }
      case 'add_quest': {
        const id = s.addCustomQuest({
          title: String(args.title || '未命名任务'),
          desc: String(args.desc || ''),
          reward: Number(args.reward || 100),
          category: (['daily', 'weekly', 'main'].includes(args.category) ? args.category : 'daily') as any
        })
        return JSON.stringify({ ok: true, quest_id: id, msg: `任务「${args.title}」已添加` })
      }
      case 'complete_quest': {
        const q = s.quests.find(x => x.id === args.quest_id)
        if (!q || q.completed) return JSON.stringify({ ok: false, error: '任务不存在或已完成' })
        s.completeQuest(String(args.quest_id))
        return JSON.stringify({ ok: true, msg: `任务「${q.title}」已完成，奖励${q.reward}积分` })
      }
      case 'add_achievement': {
        const id = s.addCustomAchievement({
          name: String(args.name || '未命名成就'),
          desc: String(args.desc || ''),
          total: Number(args.total || 1)
        })
        return JSON.stringify({ ok: true, achievement_id: id, msg: `成就「${args.name}」已添加` })
      }
      case 'update_achievement': {
        const a = s.achievements.find(x => x.id === args.achievement_id)
        if (!a) return JSON.stringify({ ok: false, error: '成就不存在' })
        if (a.unlocked) return JSON.stringify({ ok: false, error: '成就已解锁' })
        s.updateAchievementProgress(String(args.achievement_id), Number(args.progress || 0))
        const updated = useStore.getState().achievements.find(x => x.id === args.achievement_id)
        return JSON.stringify({ ok: true, achievement_id: args.achievement_id, progress: updated?.progress, unlocked: updated?.unlocked })
      }
      case 'unlock_achievement': {
        const a = s.achievements.find(x => x.id === args.achievement_id)
        if (!a) return JSON.stringify({ ok: false, error: '成就不存在' })
        if (a.unlocked) return JSON.stringify({ ok: false, error: '成就已解锁' })
        s.unlockAchievement(String(args.achievement_id))
        return JSON.stringify({ ok: true, achievement_id: args.achievement_id, msg: `成就已解锁：${a.name}` })
      }
      case 'check_phone_usage': {
        const granted = await hasUsageAccess()
        if (!granted) {
          return JSON.stringify({ ok: false, error: '权限不足', needPermission: true, msg: '用户尚未授予使用情况访问权限' })
        }
        const now = Date.now()
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        const { study, ent } = await fetchUsageStats(start.getTime(), now)
        const studyTotal = study.reduce((sum, x) => sum + x.totalMs, 0)
        const entTotal = ent.reduce((sum, x) => sum + x.totalMs, 0)
        const studyTop = study.sort((a, b) => b.totalMs - a.totalMs).slice(0, 3).map(x => `${x.label}:${fmtMs(x.totalMs)}`).join(', ')
        const entTop = ent.sort((a, b) => b.totalMs - a.totalMs).slice(0, 3).map(x => `${x.label}:${fmtMs(x.totalMs)}`).join(', ')
        useStore.getState().syncUsage(study, ent)
        return JSON.stringify({
          ok: true,
          studyTotal: fmtMs(studyTotal),
          entTotal: fmtMs(entTotal),
          studyTop,
          entTop,
          msg: `今日学习${fmtMs(studyTotal)}，娱乐${fmtMs(entTotal)}。学习Top: ${studyTop || '无'}。娱乐Top: ${entTop || '无'}。`
        })
      }
      case 'request_usage_permission': {
        await openUsageAccessSettings()
        return JSON.stringify({ ok: true, msg: '已跳转到使用情况访问权限设置页面' })
      }
      default:
        return JSON.stringify({ ok: false, error: `unknown tool: ${name}` })
    }
  } catch (e: any) {
    return JSON.stringify({ ok: false, error: e.message })
  }
}

function buildChatUrl(endpoint: string): string {
  const base = endpoint.replace(/\/+$/, '')
  if (/\/v\d+$/.test(base)) return base + '/chat/completions'
  return base + '/v1/chat/completions'
}

async function callAPI(ai: AIConfig, messages: any[], withTools: boolean): Promise<{ content: string; tool_calls?: any[] }> {
  const url = buildChatUrl(ai.endpoint)
  const body: any = {
    model: ai.model || 'qwen-plus',
    messages,
    temperature: 0.7,
    max_tokens: 1024,
    stream: false
  }
  if (withTools) {
    body.tools = TOOLS
    body.tool_choice = 'auto'
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ai.apiKey}`
    },
    body: JSON.stringify(body),
    signal: controller.signal
  })
  clearTimeout(timer)
  if (!res.ok) {
    const errText = await res.text()
    let detail = ''
    try { detail = JSON.parse(errText)?.error?.message || '' } catch { /* ignore */ }
    throw new Error(`请求失败 (${res.status})：${detail || errText.slice(0, 200)}`)
  }
  const data = await res.json()
  const choice = data.choices?.[0]
  const content = choice?.message?.content?.trim() || ''
  const tool_calls = choice?.message?.tool_calls
  return { content, tool_calls: tool_calls && tool_calls.length > 0 ? tool_calls : undefined }
}

async function callAPIStream(ai: AIConfig, messages: any[], withTools: boolean, onChunk?: (text: string) => void): Promise<{ content: string }> {
  const url = buildChatUrl(ai.endpoint)
  const body: any = {
    model: ai.model || 'qwen-plus',
    messages,
    temperature: 0.7,
    max_tokens: 1024,
    stream: true
  }
  if (withTools) {
    body.tools = TOOLS
    body.tool_choice = 'auto'
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ai.apiKey}`
    },
    body: JSON.stringify(body),
    signal: controller.signal
  })
  if (!res.ok) {
    clearTimeout(timer)
    const errText = await res.text()
    let detail = ''
    try { detail = JSON.parse(errText)?.error?.message || '' } catch { /* ignore */ }
    throw new Error(`请求失败 (${res.status})：${detail || errText.slice(0, 200)}`)
  }
  clearTimeout(timer)
  if (!res.body || typeof res.body.getReader !== 'function') {
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''
    if (content && onChunk) onChunk(content)
    return { content }
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta
        if (!delta) continue
        if (delta.content) {
          content += delta.content
          onChunk?.(delta.content)
        }
      } catch { /* ignore */ }
    }
  }
  return { content: content.trim() }
}

function buildContext(state: any): string {
  const studyMin = Math.floor(state.todayStudyMs / 60000)
  const entMin = Math.floor(state.todayEntMs / 60000)
  const dailyGoalMin = state.dailyGoalMin
  const ratio = dailyGoalMin > 0 ? Math.min(100, Math.round(studyMin / dailyGoalMin * 100)) : 0
  const hour = new Date().getHours()
  const isLate = hour >= 23 || hour < 5
  const questList = state.quests.filter((q: any) => !q.completed).slice(0, 8).map((q: any) => ` - ${q.id} 「${q.title}」(${q.progress}/${q.total})`).join('\n') || ' (无)'
  const achList = state.achievements.filter((a: any) => !a.unlocked).slice(0, 8).map((a: any) => ` - ${a.id} 「${a.name}」进度 ${a.progress}/${a.total}`).join('\n') || ' (无)'
  const sysPrompt = state.systemPrompt || SYSTEM_PROMPT
  return `${sysPrompt}

【当前状态】
代号:${state.playerTag} HP:${state.hp}/100 积分:${state.points} 连胜:${state.streak}天
学习:${studyMin}min/${dailyGoalMin}min(${ratio}%) 娱乐:${entMin}min 总专注:${Math.floor(state.totalFocusMs / 3600000)}h
时间:${new Date().toLocaleString('zh-CN', { hour12: false })} ${isLate ? '[深夜]' : ''}

【未完成任务】
${questList}

【进行中成就】
${achList}`
}

export async function chatWithAI(
  userMessage: string,
  onChunk?: (text: string) => void,
  onStreamReset?: () => void
): Promise<string> {
  const state = useStore.getState()
  const ai = state.ai
  if (!ai.apiKey?.trim()) return '请在「设置 → AI 监管者」填入 API Key 后再开始对话。'
  if (!ai.endpoint?.trim()) return '请在「设置 → AI 监管者」填入 Endpoint。'
  if (!ai.model?.trim()) return '请在「设置 → AI 监管者」填入模型名称。'

  const history: ChatMessage[] = state.chat.slice(-20)
  const messages: any[] = [
    { role: 'system', content: buildContext(state) },
    ...history.map(m => ({ role: m.role, content: m.text }))
  ]
  const last = history[history.length - 1]
  if (!last || last.role !== 'user' || last.text !== userMessage) {
    messages.push({ role: 'user', content: userMessage })
  }

  try {
    const r1 = await callAPI(ai, messages, true)
    if (!r1.tool_calls || r1.tool_calls.length === 0) {
      const content = r1.content || '（空回复）'
      if (onChunk && content) {
        const chars = Array.from(content)
        for (let i = 0; i < chars.length; i++) {
          onChunk(chars[i])
          if (i % 3 === 0) await new Promise(r => setTimeout(r, 10))
        }
      }
      return content
    }
    onStreamReset?.()
    messages.push({ role: 'assistant', content: r1.content || '', tool_calls: r1.tool_calls })
    for (const call of r1.tool_calls) {
      const fnName = call.function?.name
      let args: any = {}
      try { args = JSON.parse(call.function?.arguments || '{}') } catch { args = {} }
      const result = await executeTool(fnName, args)
      messages.push({ role: 'tool', tool_call_id: call.id, name: fnName, content: result })
    }
    const r2 = await callAPIStream(ai, messages, false, onChunk)
    if (r2.content) return r2.content
    const lastToolMsg = messages.filter(m => m.role === 'tool').pop()
    if (lastToolMsg?.content) {
      try { const parsed = JSON.parse(lastToolMsg.content); if (parsed.msg) return parsed.msg } catch { /* ignore */ }
    }
    return '已执行操作。'
  } catch (e: any) {
    try {
      const r = await callAPIStream(ai, messages, false, onChunk)
      if (r.content) return r.content
      return '（空回复）'
    } catch (e2: any) {
      return `网络错误：${e2.message || e.message}`
    }
  }
}

export async function testConnection(cfg: { apiKey: string; endpoint: string; model: string }): Promise<{ ok: boolean; msg: string }> {
  if (!cfg.apiKey?.trim()) return { ok: false, msg: '请先填入 API Key' }
  if (!cfg.endpoint?.trim()) return { ok: false, msg: '请先填入 Endpoint' }
  if (!cfg.model?.trim()) return { ok: false, msg: '请先填入模型名称' }
  const url = buildChatUrl(cfg.endpoint)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 8 }),
      signal: controller.signal
    })
    clearTimeout(timer)
    if (res.ok) return { ok: true, msg: '连接成功，监管者已就绪' }
    const text = await res.text()
    let detail = ''
    try { detail = JSON.parse(text)?.error?.message || '' } catch { /* ignore */ }
    if (res.status === 401) return { ok: false, msg: 'API Key 错误或已失效' }
    if (res.status === 404) return { ok: false, msg: '模型名或 Endpoint 不对：' + (detail || res.status) }
    return { ok: false, msg: `HTTP ${res.status} ${detail || ''}`.trim() }
  } catch (e: any) {
    clearTimeout(timer)
    if (e.name === 'AbortError') return { ok: false, msg: '请求超时（15s），可能 Endpoint 不通' }
    return { ok: false, msg: `网络错误：${e.message}` }
  }
}
