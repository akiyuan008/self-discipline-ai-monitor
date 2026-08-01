import { useStore, type AIConfig, type ChatMessage } from '@/stores/useStore'

/**
 * 前端直连用户配置的 GLM/兼容 OpenAI 协议的 API
 * 不经后端中转，API Key 仅存本地 localStorage
 */

const SYSTEM_PROMPT = `你是「监管者」，一个 AI 自律监督员。用户是「赛博生存」项目的玩家。

你的职责：
1. 盯紧用户学习进度。当用户状态低迷、连续低分时主动督促。
2. 用户问计划时，输出具体可执行的下一步动作，3 句以内。
3. 用户摸鱼时，严厉但不冷漠，给出 5 分钟内的具体动作。
4. 不要说"加油"等空话。不要暴露 AI 身份。
5. 用户问你数据时，给出评估+下一步。

人格：冷峻、简洁、有威严感。多用短句。中文回复。
每次回复不超过 120 字。`

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
  const messages = [
    { role: 'system' as const, content: buildContext(state) },
    ...history.map(m => ({ role: m.role, content: m.text })),
    { role: 'user' as const, content: userMessage }
  ]

  try {
    const url = ai.endpoint.replace(/\/$/, '') + '/chat/completions'
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ai.apiKey}`
      },
      body: JSON.stringify({
        model: ai.model || 'glm-4-plus',
        messages,
        temperature: 0.8,
        max_tokens: 400,
        stream: false
      })
    })
    if (!res.ok) {
      const errText = await res.text()
      return `请求失败 (${res.status})：${errText.slice(0, 100)}`
    }
    const data = await res.json()
    const reply = data?.choices?.[0]?.message?.content?.trim() || ''
    return reply || '（空回复）'
  } catch (e: any) {
    return `网络错误：${e.message}`
  }
}

function buildContext(state: any): string {
  const studyMin = Math.floor(state.todayStudyMs / 60_000)
  const entMin = Math.floor(state.todayEntMs / 60_000)
  const dailyGoalMin = state.dailyGoalMin
  const ratio = dailyGoalMin > 0 ? Math.min(100, Math.round(studyMin / dailyGoalMin * 100)) : 0
  const hour = new Date().getHours()
  const isLate = hour >= 23 || hour < 5
  return `${SYSTEM_PROMPT}

【当前用户情况】
- 玩家代号：${state.playerTag}
- 精神力 HP：${state.hp}/100
- 今日学习时长：${studyMin} 分钟（目标 ${dailyGoalMin} 分钟，达成 ${ratio}%）
- 今日娱乐时长：${entMin} 分钟
- 连胜天数：${state.streak}
- 总专注时长：${Math.floor(state.totalFocusMs / 3600_000)} 小时
- 当前时间：${new Date().toLocaleString('zh-CN', { hour12: false })}
- 深夜：${isLate ? '是' : '否'}`
}
