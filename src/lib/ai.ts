import { useStore, type AIConfig, type ChatMessage } from '@/stores/useStore'

/**
 * 前端直连用户配置的 OpenAI 兼容 API
 * - 硬编码「监督智能体」System Prompt
 * - 滑动窗口：System Prompt + 最近 20 条历史对话（10 轮）
 * - 流式输出（stream: true）+ 打字机效果
 * - 工具调用：AI 可加任务/加成就/调积分/设 HP/完成 quests
 * API Key 仅存本地 localStorage
 */

// ═══════════════════════════════════════════════════════════
// 硬编码 System Prompt — 永远放在 messages[0]
// ═══════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `你是一个严格的个人成长监督智能体。你的核心职责是：
1. 奖励机制：当用户汇报每日完成事项时，根据任务的难度和完成质量，给予具体的积分、成就或口头奖励。
2. 计划与监督：主动帮助用户制定学习或工作计划，并监督其执行。
3. 专注力监测：你可以模拟监测用户手机应用使用情况的行为。当用户表示分心或拖延时，你要严厉地提醒他，并引导他回到正轨。
你的语气应该是专业、果断且带有一点激励性的。

【工具使用规则】
当用户的请求涉及"加任务"、"加成就"、"调积分"、"设精神力"、"完成某任务"时，必须调用对应工具，而不是只口头答应。
调用工具后，再用一句话确认你做了什么。
不要在没有用户明确意图的情况下擅自调积分（除非是惩罚/奖励场景）。`

// ═══════════════════════════════════════════════════════════
// 工具定义（OpenAI 兼容 function calling）
// ═══════════════════════════════════════════════════════════
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_quest',
      description: '给用户添加一个新任务到任务中心。当用户说"帮我加个任务"或"我想做XXX"时调用。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题，6-12 字' },
          desc: { type: 'string', description: '任务描述，10-30 字' },
          reward: { type: 'number', description: '完成奖励积分数，建议 50-500' },
          category: { type: 'string', enum: ['daily', 'weekly', 'main'], description: 'daily=日常，weekly=周常，main=主线' }
        },
        required: ['title', 'desc', 'reward', 'category']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_achievement',
      description: '给用户添加一个新成就到成就殿堂。当用户说"我想挑战XXX"或"加个成就"时调用。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '成就名，4-10 字' },
          desc: { type: 'string', description: '成就描述，10-30 字' },
          total: { type: 'number', description: '达成所需进度总数，1-999' }
        },
        required: ['name', 'desc', 'total']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_points',
      description: '给用户加积分（可为负数表示扣除，例如作为惩罚）。',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: '积分数，可为负数' },
          reason: { type: 'string', description: '原因，10 字内' }
        },
        required: ['amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_hp',
      description: '设置用户的精神力 HP（0-100）。值低于 30 表示惩罚，70+ 表示奖励。',
      parameters: {
        type: 'object',
        properties: {
          value: { type: 'number', description: 'HP 值 0-100' }
        },
        required: ['value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'complete_quest',
      description: '直接标记某个任务为已完成（用户已口头确认完成时调用）。',
      parameters: {
        type: 'object',
        properties: {
          quest_id: { type: 'string', description: '任务 ID' }
        },
        required: ['quest_id']
      }
    }
  }
]

// ═══════════════════════════════════════════════════════════
// 工具执行
// ═══════════════════════════════════════════════════════════
function executeTool(name: string, args: any): string {
  const s = useStore.getState()
  try {
    switch (name) {
      case 'add_quest': {
        const id = s.addCustomQuest({
          title: String(args.title || '未命名任务'),
          desc: String(args.desc || ''),
          reward: Number(args.reward || 100),
          category: (['daily', 'weekly', 'main'].includes(args.category) ? args.category : 'daily') as any
        })
        return JSON.stringify({ ok: true, quest_id: id, msg: `任务已添加到 ${args.category} 列表` })
      }
      case 'add_achievement': {
        const id = s.addCustomAchievement({
          name: String(args.name || '未命名成就'),
          desc: String(args.desc || ''),
          total: Number(args.total || 1)
        })
        return JSON.stringify({ ok: true, achievement_id: id, msg: '成就已添加到殿堂' })
      }
      case 'add_points': {
        const before = s.points
        const amt = Number(args.amount || 0)
        s.addPoints(amt)
        s.addPointRecord(amt >= 0 ? 'earn' : 'spend', amt, String(args.reason || (amt >= 0 ? 'AI 奖励' : 'AI 惩罚')))
        return JSON.stringify({ ok: true, before, after: useStore.getState().points })
      }
      case 'set_hp': {
        s.setHp(Number(args.value))
        useStore.setState({ hpLocked: true })
        return JSON.stringify({ ok: true, hp: useStore.getState().hp })
      }
      case 'complete_quest': {
        const q = s.quests.find(x => x.id === args.quest_id)
        if (!q || q.completed) {
          return JSON.stringify({ ok: false, error: '任务不存在或已完成' })
        }
        s.completeQuest(String(args.quest_id))
        return JSON.stringify({ ok: true, msg: '任务标记完成', reward: q.reward })
      }
      default:
        return JSON.stringify({ ok: false, error: `unknown tool: ${name}` })
    }
  } catch (e: any) {
    return JSON.stringify({ ok: false, error: e.message })
  }
}

// ═══════════════════════════════════════════════════════════
// 主入口：流式聊天 + 工具调用
// ═══════════════════════════════════════════════════════════

/**
 * @param userMessage 用户输入
 * @param onChunk 流式回调，每收到一段文字就调用
 * @returns 最终完整回复文本
 */
export async function chatWithAI(
  userMessage: string,
  onChunk?: (text: string) => void
): Promise<string> {
  const state = useStore.getState()
  const ai = state.ai

  if (!ai.apiKey?.trim()) {
    return '请在「设置 → AI 监管者」填入 API Key 后再开始对话。'
  }
  if (!ai.endpoint?.trim()) {
    return '请在「设置 → AI 监管者」填入 Endpoint（例如 https://api.deepseek.com/v1）。'
  }
  if (!ai.model?.trim()) {
    return '请在「设置 → AI 监管者」填入模型名称（例如 deepseek-chat）。'
  }

  // ── 滑动窗口：System Prompt（index 0）+ 最近 20 条历史对话（10 轮）──
  const history: ChatMessage[] = state.chat.slice(-20)
  const messages: any[] = [
    { role: 'system', content: buildContext(state) },
    ...history.map(m => ({ role: m.role, content: m.text })),
    { role: 'user', content: userMessage }
  ]

  try {
    // 第一轮：流式请求，可能返回 tool_calls
    const r1 = await callAPIStream(ai, messages, true, onChunk)

    if (r1.tool_calls && r1.tool_calls.length > 0) {
      // 把 assistant 的 tool_calls 加入 messages
      messages.push({
        role: 'assistant',
        content: r1.content || '',
        tool_calls: r1.tool_calls
      })
      // 执行每个工具
      for (const call of r1.tool_calls) {
        const fnName = call.function?.name
        let args: any = {}
        try {
          args = JSON.parse(call.function?.arguments || '{}')
        } catch {
          args = {}
        }
        const result = executeTool(fnName, args)
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: fnName,
          content: result
        })
      }
      // 第二轮：流式生成最终文字回复（不带 tools，避免再次触发）
      const r2 = await callAPIStream(ai, messages, false, onChunk)
      if (r2.content) return r2.content
      return '已执行操作。'
    }

    return r1.content || '（空回复）'
  } catch (e: any) {
    // 如果带工具的请求失败，尝试不带工具重试（仍用流式）
    if (e.message && (e.message.includes('tool') || e.message.includes('function') || e.message.includes('400'))) {
      try {
        const r = await callAPIStream(ai, messages, false, onChunk)
        if (r.content) return r.content
        return '（空回复）'
      } catch (e2: any) {
        return `网络错误：${e2.message}`
      }
    }
    return `网络错误：${e.message}`
  }
}

// ═══════════════════════════════════════════════════════════
// 流式 API 调用（SSE 解析）
// ═══════════════════════════════════════════════════════════

interface StreamResult {
  content: string
  tool_calls?: any[]
}

async function callAPIStream(
  ai: AIConfig,
  messages: any[],
  withTools: boolean,
  onChunk?: (text: string) => void
): Promise<StreamResult> {
  const url = ai.endpoint.replace(/\/$/, '') + '/chat/completions'
  const body: any = {
    model: ai.model || 'deepseek-chat',
    messages,
    temperature: 0.7,
    max_tokens: 1024,
    stream: true
  }
  if (withTools) {
    body.tools = TOOLS
    body.tool_choice = 'auto'
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ai.apiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const errText = await res.text()
    let detail = ''
    try { detail = JSON.parse(errText)?.error?.message || '' } catch { /* ignore */ }
    throw new Error(`请求失败 (${res.status})：${detail || errText.slice(0, 200)}`)
  }

  // 如果不支持流式（res.body 为空），回退到非流式 JSON 解析
  if (!res.body || typeof res.body.getReader !== 'function') {
    const data = await res.json()
    const choice = data.choices?.[0]
    const content = choice?.message?.content?.trim() || ''
    if (content && onChunk) onChunk(content)
    return {
      content,
      tool_calls: choice?.message?.tool_calls
    }
  }

  // ── SSE 流式解析 ──
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  const toolCalls: any[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // 按换行分割，处理完整的行
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // 保留最后一条不完整的行

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue

      const data = trimmed.slice(6) // 去掉 "data: "
      if (data === '[DONE]') continue

      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta
        if (!delta) continue

        // 文字内容
        if (delta.content) {
          content += delta.content
          onChunk?.(delta.content)
        }

        // 工具调用（流式中分片到达，需按 index 累积）
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            if (!toolCalls[idx]) {
              toolCalls[idx] = {
                id: tc.id || '',
                type: 'function',
                function: { name: '', arguments: '' }
              }
            }
            if (tc.id) toolCalls[idx].id = tc.id
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments
          }
        }
      } catch {
        // 忽略 JSON 解析错误（可能是不完整的 chunk）
      }
    }
  }

  return {
    content: content.trim(),
    tool_calls: toolCalls.length > 0 ? toolCalls.filter(tc => tc.function.name) : undefined
  }
}

// ═══════════════════════════════════════════════════════════
// 构建上下文：System Prompt + 用户当前状态
// ═══════════════════════════════════════════════════════════
function buildContext(state: any): string {
  const studyMin = Math.floor(state.todayStudyMs / 60_000)
  const entMin = Math.floor(state.todayEntMs / 60_000)
  const dailyGoalMin = state.dailyGoalMin
  const ratio = dailyGoalMin > 0 ? Math.min(100, Math.round(studyMin / dailyGoalMin * 100)) : 0
  const hour = new Date().getHours()
  const isLate = hour >= 23 || hour < 5

  const questList = state.quests
    .filter((q: any) => !q.completed)
    .slice(0, 8)
    .map((q: any) => `  - ${q.id} 「${q.title}」(${q.progress}/${q.total})`)
    .join('\n') || '  (无)'

  return `${SYSTEM_PROMPT}

【当前用户情况】
- 玩家代号：${state.playerTag}
- 精神力 HP：${state.hp}/100
- 积分：${state.points}
- 今日学习时长：${studyMin} 分钟（目标 ${dailyGoalMin} 分钟，达成 ${ratio}%）
- 今日娱乐时长：${entMin} 分钟
- 连胜天数：${state.streak}
- 总专注时长：${Math.floor(state.totalFocusMs / 3600_000)} 小时
- 当前时间：${new Date().toLocaleString('zh-CN', { hour12: false })}
- 深夜：${isLate ? '是' : '否'}

【用户未完成的任务】（调用 complete_quest 时用对应 ID）
${questList}`
}

// ═══════════════════════════════════════════════════════════
// 测试连接 — 发送最小请求验证 API Key + Endpoint + Model
// ═══════════════════════════════════════════════════════════
export async function testConnection(cfg: {
  apiKey: string
  endpoint: string
  model: string
}): Promise<{ ok: boolean; msg: string }> {
  if (!cfg.apiKey?.trim()) return { ok: false, msg: '请先填入 API Key' }
  if (!cfg.endpoint?.trim()) return { ok: false, msg: '请先填入 Endpoint（如 https://api.deepseek.com/v1）' }
  if (!cfg.model?.trim()) return { ok: false, msg: '请先填入模型名称（如 deepseek-chat）' }

  const url = cfg.endpoint.replace(/\/$/, '') + '/chat/completions'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 8
      }),
      signal: controller.signal
    })
    clearTimeout(timer)

    if (res.ok) {
      return { ok: true, msg: '连接成功，监管者已就绪' }
    }
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
