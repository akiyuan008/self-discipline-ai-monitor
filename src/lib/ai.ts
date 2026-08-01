import { useStore, type AIConfig, type ChatMessage } from '@/stores/useStore'

/**
 * 前端直连用户配置的 GLM / OpenAI 兼容 API
 * 支持工具调用：AI 可以加任务/加成就/调积分/设 HP/完成 quests
 * API Key 仅存本地 localStorage
 */

const SYSTEM_PROMPT = `你是「监管者」，一个 AI 自律监督员。用户是「赛博生存」项目的玩家。

你的职责：
1. 盯紧用户学习进度。当用户状态低迷、连续低分时主动督促。
2. 用户问计划时，输出具体可执行的下一步动作，3 句以内。
3. 用户摸鱼时，严厉但不冷漠，给出 5 分钟内的具体动作。
4. 不要说"加油"等空话。不要暴露 AI 身份。
5. 用户问你数据时，给出评估+下一步。

人格：冷峻、简洁、有威严感。多用短句。中文回复。
每次回复不超过 120 字。

【工具使用规则】
当用户的请求涉及"加任务"、"加成就"、"调积分"、"设精神力"、"完成某任务"时，**必须**调用对应工具，而不是只口头答应。
调用工具后，再用一句话确认你做了什么。
不要在没有用户明确意图的情况下擅自调积分（除非是惩罚/奖励场景）。`

// 工具定义（OpenAI 兼容 function calling）
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

/** 执行单个工具调用 */
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
        // 标记 HP 为 AI 手动设置，避免被定时同步覆盖
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

/** 主入口：聊天 + 工具调用循环 */
export async function chatWithAI(userMessage: string): Promise<string> {
  const state = useStore.getState()
  const ai = state.ai
  if (!ai.apiKey) {
    return '请在「设置 → AI 配置」填入 API Key 后再开始对话。'
  }
  if (!ai.endpoint) {
    return '请在「设置 → AI 配置」填入 API Endpoint（例如 https://open.bigmodel.cn/api/paas/v4）。'
  }

  const history: ChatMessage[] = state.chat.slice(-10)
  const messages: any[] = [
    { role: 'system', content: buildContext(state) },
    ...history.map(m => ({ role: m.role, content: m.text })),
    { role: 'user', content: userMessage }
  ]

  try {
    // 第一轮：可能返回 tool_calls
    const r1 = await callAPI(ai, messages, true)
    const choice = r1?.choices?.[0]
    const msg = choice?.message
    if (!msg) return '（空回复）'

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // 把 assistant 的 tool_calls 加入 messages
      messages.push({
        role: 'assistant',
        content: msg.content || '',
        tool_calls: msg.tool_calls
      })
      // 执行每个工具
      for (const call of msg.tool_calls) {
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
      // 第二轮：让 AI 生成最终文字回复
      const r2 = await callAPI(ai, messages, true)
      const finalText = r2?.choices?.[0]?.message?.content?.trim()
      if (finalText) return finalText
      return '已执行操作。'   // 兜底
    }

    return msg.content?.trim() || '（空回复）'
  } catch (e: any) {
    // 如果带工具的请求失败，尝试不带工具重试
    if (e.message && (e.message.includes('tool') || e.message.includes('function') || e.message.includes('400'))) {
      try {
        const r = await callAPI(ai, messages, false)
        const text = r?.choices?.[0]?.message?.content?.trim()
        if (text) return text
        return '（空回复）'
      } catch (e2: any) {
        return `网络错误：${e2.message}`
      }
    }
    return `网络错误：${e.message}`
  }
}

/**
 * 调用 API
 * @param withTools 是否携带工具定义（部分模型不支持 function calling）
 */
async function callAPI(ai: AIConfig, messages: any[], withTools: boolean) {
  const url = ai.endpoint.replace(/\/$/, '') + '/chat/completions'
  const body: any = {
    model: ai.model || 'glm-4-plus',
    messages,
    temperature: 0.7,
    max_tokens: 600
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
    throw new Error(`请求失败 (${res.status})：${errText.slice(0, 200)}`)
  }
  return await res.json()
}

function buildContext(state: any): string {
  const studyMin = Math.floor(state.todayStudyMs / 60_000)
  const entMin = Math.floor(state.todayEntMs / 60_000)
  const dailyGoalMin = state.dailyGoalMin
  const ratio = dailyGoalMin > 0 ? Math.min(100, Math.round(studyMin / dailyGoalMin * 100)) : 0
  const hour = new Date().getHours()
  const isLate = hour >= 23 || hour < 5
  // 列出已有任务 ID 供 AI 调用 complete_quest
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

/**
 * 测试 AI 连接 — 发送一条最小请求验证 API Key + Endpoint + Model 可用
 */
export async function testConnection(cfg: { apiKey: string; endpoint: string; model: string }): Promise<{ ok: boolean; msg: string }> {
  if (!cfg.apiKey?.trim()) return { ok: false, msg: '请先填入 API Key' }
  if (!cfg.endpoint?.trim()) return { ok: false, msg: '请先选模型供应商' }
  if (!cfg.model?.trim() || cfg.model === 'custom') return { ok: false, msg: '请选择具体模型' }

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
    if (res.status === 404) return { ok: false, msg: '模型名或 endpoint 不对：' + (detail || res.status) }
    return { ok: false, msg: `HTTP ${res.status} ${detail || ''}`.trim() }
  } catch (e: any) {
    clearTimeout(timer)
    if (e.name === 'AbortError') return { ok: false, msg: '请求超时（15s），可能 endpoint 不通' }
    return { ok: false, msg: `网络错误：${e.message}` }
  }
}
