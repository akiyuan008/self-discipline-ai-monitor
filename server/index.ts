import express from 'express'
import cors from 'cors'
import ZAI from 'z-ai-web-dev-sdk'

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))
const port = 8787

let zai: any
async function initZAI() {
  zai = await ZAI.create()
}
initZAI().catch(e => {
  console.error('[ZAI] init failed:', e.message)
})

// =========================
// 多人格系统提示词生成
// =========================
function buildPersonaSystemPrompt(persona: any, userCtx: any) {
  const base = persona.voice
  const ctx = `\n\n【当前用户情况】
- 称呼: ${userCtx.nickname || '同学'}
- 今日学习时长: ${userCtx.studyMin.toFixed(0)} 分钟
- 今日娱乐时长: ${userCtx.entMin.toFixed(0)} 分钟
- 今日专注度: ${userCtx.focus}/100
- 每日目标: ${userCtx.dailyGoalMin} 分钟
- 最近 3 次评分: ${(userCtx.recentScores || []).join(', ') || '无'}
- 当前时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}
- 是否深夜: ${userCtx.isLateNight ? '是' : '否'}
- 是否连续学习超 90 分钟: ${userCtx.studyingTooLong ? '是' : '否'}

【你的口头禅】
${persona.catchphrases.map((c: string) => '· ' + c).join('\n')}

【惩罚偏好】${persona.punishmentStyle}

【行为准则】
1. 永远以"${persona.name}"人格回应，不要打破第四面墙，不要解释你是AI。
2. 回复要短促有力，移动端聊天场景，不超过 120 字。
3. 优先指出一个具体动作（接下来 5 分钟该干嘛）。
4. 检测到深夜/超长学习 → 主动建议休息并触发锁屏建议。
5. 连续低分 → 进入"深度谈话"模式：先承认情绪，再分析最近 3 天模式，提出调整计划并承诺重置 30% 惩罚。
6. 不说"加油"等空话。`
  return base + ctx
}

// =========================
// 路由
// =========================
app.get('/api/health', (req, res) => {
  res.json({ ok: true, zai: !!zai, persona: 'ready', ts: Date.now() })
})

app.post('/api/chat', async (req, res) => {
  try {
    const { persona, userCtx, history, userMessage } = req.body || {}
    if (!persona || !userMessage) {
      return res.status(400).json({ error: 'missing fields' })
    }
    if (!zai) {
      // SDK 未就绪时降级：返回人格默认回应
      const fallback = `${persona.greeting}\n\n[AI 服务暂时不可用，以下为本地人格回应]\n${persona.catchphrases[0]}`
      return res.json({
        reply: fallback,
        mood: 'normal',
        costTokens: 0,
        fallback: true
      })
    }

    const systemPrompt = buildPersonaSystemPrompt(persona, userCtx)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((m: any) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
      { role: 'user', content: userMessage }
    ]

    const completion = await zai.chat.completions.create({
      messages,
      temperature: 0.85,
      max_tokens: 600
    })

    const reply = completion?.choices?.[0]?.message?.content?.trim() || persona.catchphrases[0]
    const mood = detectMood(reply, userCtx)

    res.json({
      reply,
      mood,
      costTokens: completion?.usage?.total_tokens ?? 0
    })
  } catch (e: any) {
    console.error('[/api/chat] error:', e)
    res.status(500).json({ error: e.message })
  }
})

// 情绪关怀触发判定（前端定时轮询，建议每 15 分钟）
app.post('/api/care-check', async (req, res) => {
  try {
    const { persona, userCtx } = req.body || {}
    if (!persona) return res.status(400).json({ error: 'missing persona' })

    // 触发条件判定
    const triggers: string[] = []
    if (userCtx.isLateNight) triggers.push('深夜学习')
    if (userCtx.studyingTooLong) triggers.push('连续超长学习')
    if (userCtx.studyMin > 0 && userCtx.studyMin < userCtx.dailyGoalMin * 0.5 && userCtx.entMin > 60)
      triggers.push('娱乐时长过高且学习进度滞后')
    if ((userCtx.recentScores || []).filter((s: number) => s < 60).length >= 3) triggers.push('连续低分')

    if (triggers.length === 0) {
      return res.json({ trigger: false, reply: '', mood: 'normal' })
    }

    let reply = ''
    let mood: any = 'care'

    // 深度谈话模式
    if (triggers.includes('连续低分')) {
      mood = 'punish'
      if (zai) {
        const sp = `${persona.voice}\n\n【触发条件】用户连续低分，进入"深度谈话"模式。
【要求】先承认 ta 的情绪（不超过 2 句），然后分析最近模式（基于 userCtx），提出具体调整方案，并承诺：本轮结束后系统将重置 30% 惩罚。语气要真诚。不超过 180 字。

【当前情况】${JSON.stringify(userCtx, null, 2)}`
        const completion = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: sp },
            { role: 'user', content: '我刚看了下自己最近的表现……' }
          ],
          temperature: 0.7,
          max_tokens: 400
        })
        reply = completion?.choices?.[0]?.message?.content?.trim() || ''
      }
      if (!reply) {
        reply = `我看了下你最近的曲线，三天没到 60 分。\n不是你不行，是计划超载了。\n这样，今晚把目标改成 60 分钟，剩下的我帮你重置 30% 的扣分，重新开始。`
      }
    } else {
      // 关怀模式
      mood = 'care'
      if (zai) {
        const sp = `${persona.voice}\n\n【触发条件】${triggers.join('、')}。
【要求】主动提醒用户休息或调整。语气温度要够，但不超过 80 字。最后给出一个具体动作建议。`
        const completion = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: sp },
            { role: 'user', content: '继续学' }
          ],
          temperature: 0.8,
          max_tokens: 200
        })
        reply = completion?.choices?.[0]?.message?.content?.trim() || ''
      }
      if (!reply) {
        if (triggers.includes('深夜学习')) {
          reply = `${persona.catchphrases[3] || ''} 这个点了，先别硬撑。锁屏 5 分钟去喝口水。`
        } else if (triggers.includes('连续超长学习')) {
          reply = `学了够久了。番茄钟到点，起来动动，回来再战效率更高。`
        } else {
          reply = `看下来今天学习进度落后娱乐时长又偏高。先把手机倒扣 10 分钟，从最简单的那个任务开始。`
        }
      }
    }

    res.json({ trigger: true, reply, mood, triggers })
  } catch (e: any) {
    console.error('[/api/care-check] error:', e)
    res.status(500).json({ error: e.message })
  }
})

// 深度学习分析周报/月报
app.post('/api/analysis', async (req, res) => {
  try {
    const { type, payload } = req.body || {}
    if (!zai) {
      return res.json({
        summary: 'AI 暂不可用，以下为模板化建议：1) 周三/周五学习时间显著偏低；2) 21:00 后娱乐时长飙升；3) 数学投入下降 22%。',
        suggestions: ['把周三晚 21:00 设为"启动番茄"提醒', '数学作业改到上午专注度最高时段', '启用免罚卡，给自己留一次容错']
      })
    }

    const systemPrompt = `你是一位学习行为分析师，给用户生成${type === 'weekly' ? '周' : '月'}度分析报告。
要求：
1. 总结部分不超过 150 字，直击痛点。
2. 给出 3-5 条具体可执行建议（每条 30 字内），不要套话。
3. 输出严格 JSON：{"summary":"...","suggestions":["...","..."]}
4. 基于 payload 数据：${JSON.stringify(payload).slice(0, 3000)}`

    const completion = await zai.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: '请生成报告' }],
      temperature: 0.6,
      max_tokens: 800
    })
    const raw = completion?.choices?.[0]?.message?.content?.trim() || ''
    let parsed: any = null
    try {
      const m = raw.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(m ? m[0] : raw)
    } catch {
      parsed = { summary: raw, suggestions: [] }
    }
    res.json(parsed)
  } catch (e: any) {
    console.error('[/api/analysis] error:', e)
    res.status(500).json({ error: e.message })
  }
})

// 学霸战绩图素材生成（文字版）
app.post('/api/poster-text', async (req, res) => {
  try {
    const { nickname, studyMin, focus, persona } = req.body || {}
    res.json({
      lines: [
        `${nickname} 的本周战绩`,
        `累计学习 ${Math.round(studyMin / 60)} 小时`,
        `平均专注度 ${focus}/100`,
        `监工寄语：${persona?.catchphrases?.[0] || '稳住，别浪。'}`
      ]
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

function detectMood(text: string, userCtx: any): string {
  if (/锁|停|休息|缓|喝|动动/.test(text)) return 'care'
  if (/扣|罚|锁屏|警告|别.*了|又拖延|不是真的/.test(text)) return 'punish'
  if (/棒|不错|好样的|蹭蹭|信你|稳|漂亮/.test(text)) return 'praise'
  if (/深夜|熬夜|这个点|晚了/.test(text)) return 'warn'
  return 'normal'
}

app.listen(port, '0.0.0.0', () => {
  console.log(`[self-discipline] server on http://0.0.0.0:${port}`)
})
