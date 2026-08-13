import { useStore, type AIConfig, type ChatMessage } from '@/stores/useStore'
import { logger } from '@/lib/logger'
import { useGaoKaoStore } from '@/stores/gaoKaoStore'
import { fetchUsageStats, hasUsageAccess, openUsageAccessSettings, fmtMs } from '@/lib/usageStats'
import { useMissionStore } from '@/core/discipline/missionStore'

/**
 * 前端直连用户配置的 OpenAI 兼容 API
 * - 硬编码「监督智能体」System Prompt
 * - 滑动窗口：System Prompt + 最近 20 条历史对话（10 轮）
 * - 工具调用：第一轮非流式（可靠检测 tool_calls），第二轮流式输出最终回复
 * - API Key 仅存本地 localStorage
 */

// ═══════════════════════════════════════════════════════════
// 硬编码 System Prompt — 永远放在 messages[0]
// ═══════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `你是 MOSS，用户的个人成长监督 AI。

核心规则：
- 回复简短直接，不超过3句话。不要用emoji、不要用markdown标题。
- 语气果断，像一个严厉但关心的教练。
- 当用户说"扣我积分"、"奖励我"、"加积分"时，必须调用 add_points 工具，不要只口头答应。
- 当用户说"加个任务"、"我想做XXX"时，必须调用 add_quest 工具。
- 当用户说"我想专注完成XXX"、"给我安排个专注任务"、"今晚想把XXX看完"这类要立即专注的事时，必须调用 create_mission 工具，把它纳入自律系统监控。
- 当用户说"加个成就"、"我想挑战XXX"时，必须调用 add_achievement 工具。
- 当用户说"完成任务"时，必须调用 complete_quest 工具。
- 当用户说"看看手机使用"、"我是不是在偷懒"时，必须调用 check_phone_usage 工具。
- 调用工具后用一句话确认执行结果即可。
- 涉及任何状态修改（积分、任务、成就），都必须调用对应工具执行，绝对不能只口头说"已扣除"而不调工具。`

// ═══════════════════════════════════════════════════════════
// 工具定义（OpenAI 兼容 function calling）
// ═══════════════════════════════════════════════════════════
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_points',
      description: '增加或扣除积分。用户要求奖励或惩罚时必须调用此工具。amount为正数表示增加，为负数表示扣除。例如"扣我50积分"则amount=-50，"奖励我100积分"则amount=100。',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: '积分数。正数=增加，负数=扣除。例如 -50 表示扣50积分' },
          reason: { type: 'string', description: '原因，10字内' }
        },
        required: ['amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_quest',
      description: '添加新任务。用户说"加个任务"或"我想做XXX"时必须调用此工具。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题，6-12字' },
          desc: { type: 'string', description: '任务描述，10-30字' },
          reward: { type: 'number', description: '完成奖励积分，建议50-500' },
          category: { type: 'string', enum: ['daily', 'weekly', 'main'], description: 'daily=日常，weekly=周常，main=主线' }
        },
        required: ['title', 'desc', 'reward', 'category']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'complete_quest',
      description: '标记任务为已完成。用户口头确认完成某任务时必须调用此工具。需要提供任务ID。',
      parameters: {
        type: 'object',
        properties: {
          quest_id: { type: 'string', description: '任务ID' }
        },
        required: ['quest_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_achievement',
      description: '添加新成就到成就殿堂。用户说"加个成就"或"我想挑战XXX"时必须调用此工具。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '成就名，4-10字' },
          desc: { type: 'string', description: '成就描述，10-30字' },
          total: { type: 'number', description: '达成所需总数，1-999' }
        },
        required: ['name', 'desc', 'total']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_achievement',
      description: '更新某个成就的进度。用户完成了某项挑战的一部分时调用。',
      parameters: {
        type: 'object',
        properties: {
          achievement_id: { type: 'string', description: '成就ID' },
          progress: { type: 'number', description: '新的进度值' }
        },
        required: ['achievement_id', 'progress']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'unlock_achievement',
      description: '直接解锁某个成就。用户达成条件时调用。',
      parameters: {
        type: 'object',
        properties: {
          achievement_id: { type: 'string', description: '成就ID' }
        },
        required: ['achievement_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_phone_usage',
      description: '查阅用户今天的手机使用状况，包括学习App和娱乐App的使用时长。当你想了解用户是否在偷懒、是否在刷娱乐App时调用。用户说"看看我今天的表现"、"我是不是在偷懒"、"查查我的手机使用"时也调用。',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_subject_score',
      description: '修改某个科目的当前成绩或目标成绩。用户说"我数学考了120分"、"把语文目标设为130"时调用。',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: '科目名称，如"数学"、"语文"、"英语"、"物理"、"化学"、"生物"' },
          currentScore: { type: 'number', description: '当前成绩（可选）' },
          targetScore: { type: 'number', description: '目标成绩（可选）' }
        },
        required: ['subject']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_candidate_info',
      description: '修改高考档案基础信息。用户说"我目标大学是清华"、"把昵称改成XXX"、"目标分数改成650"时调用。',
      parameters: {
        type: 'object',
        properties: {
          nickname: { type: 'string', description: '考生昵称（可选）' },
          targetUniversity: { type: 'string', description: '目标大学（可选）' },
          targetTotalScore: { type: 'number', description: '目标总分（可选）' },
          currentTotalScore: { type: 'number', description: '当前总分（可选）' },
          weakSubjects: { type: 'array', items: { type: 'string' }, description: '薄弱科目列表（可选），如["数学-函数", "物理-力学"]' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_error_question',
      description: '添加一条错题记录。用户说"我错了一道函数题"、"记录一道错题"时调用。',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: '科目，如"数学"' },
          tag: { type: 'string', description: '知识点标签，如"函数图像"、"力学"' },
          desc: { type: 'string', description: '错题描述' }
        },
        required: ['subject', 'tag', 'desc']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'resolve_error_question',
      description: '标记一条错题已解决。用户说"那道函数题我会了"、"错题已解决"时调用。需要提供错题ID。',
      parameters: {
        type: 'object',
        properties: {
          question_id: { type: 'string', description: '错题ID' }
        },
        required: ['question_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_milestone',
      description: '添加一个里程碑记录。用户说"我这次模考进步了"、"记录一个里程碑"时调用。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '里程碑标题，如"模考进步50分"' },
          desc: { type: 'string', description: '描述' },
          type: { type: 'string', enum: ['streak', 'exam', 'errorClear', 'scoreUp', 'custom'], description: '类型' }
        },
        required: ['title', 'desc', 'type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_weekly_plan',
      description: '基于薄弱科目和错题生成本周学习计划。用户说"帮我生成周计划"、"制定本周学习计划"时调用。',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'request_usage_permission',
      description: '引导用户去系统设置开启使用情况访问权限。当check_phone_usage返回权限不足时调用。',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_mission',
      description: '动态创建一个专注 Mission（监督任务）。当用户说"我今晚想把函数第三章看完"、"给我加个45分钟背单词任务"、"帮我安排一个专注任务"时调用。创建的 Mission 会进入统一自律系统，自动监控、发现分心、干预、判完成并发奖。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题，4-15字，如"函数第三章"' },
          subject: { type: 'string', description: '科目/主题，如"数学"（可选）' },
          minutes: { type: 'number', description: '目标专注分钟数，建议25-90' },
          delayMin: { type: 'number', description: '多少分钟后开始；0或省略=立即可开始（可选）' }
        },
        required: ['title', 'minutes']
      }
    }
  }
]

// ═══════════════════════════════════════════════════════════
// 工具执行
// ═══════════════════════════════════════════════════════════
async function executeTool(name: string, args: any): Promise<string> {
  const s = useStore.getState()
  try {
    switch (name) {
      case 'add_points': {
        const before = s.points
        const amt = Number(args.amount || 0)
        if (isNaN(amt)) {
          return JSON.stringify({ ok: false, error: 'amount不是有效数字' })
        }
        s.addPoints(amt)
        s.addPointRecord(amt >= 0 ? 'earn' : 'spend', amt, String(args.reason || (amt >= 0 ? 'AI 奖励' : 'AI 惩罚')))
        const after = useStore.getState().points
        return JSON.stringify({ ok: true, before, after, msg: `积分从${before}变为${after}（${amt >= 0 ? '+' : ''}${amt}）` })
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
        if (!q || q.completed) {
          return JSON.stringify({ ok: false, error: '任务不存在或已完成' })
        }
        s.completeQuest(String(args.quest_id))
        return JSON.stringify({ ok: true, msg: `任务「${q.title}」已完成，奖励${q.reward}积分` })
      }
      case 'add_achievement': {
        const id = s.addCustomAchievement({
          name: String(args.name || '未命名成就'),
          desc: String(args.desc || ''),
          total: Number(args.total || 1)
        })
        return JSON.stringify({ ok: true, achievement_id: id, msg: `成就「${args.name}」已添加到殿堂` })
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
          return JSON.stringify({
            ok: false,
            error: '权限不足',
            needPermission: true,
            msg: '用户尚未授予使用情况访问权限，请调用 request_usage_permission 引导用户去设置。'
          })
        }
        const now = Date.now()
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        const { study, ent } = await fetchUsageStats(start.getTime(), now)

        const studyTotal = study.reduce((sum, x) => sum + x.totalMs, 0)
        const entTotal = ent.reduce((sum, x) => sum + x.totalMs, 0)
        const studyTop = study.sort((a, b) => b.totalMs - a.totalMs).slice(0, 3)
          .map(x => `${x.label}:${fmtMs(x.totalMs)}`).join(', ')
        const entTop = ent.sort((a, b) => b.totalMs - a.totalMs).slice(0, 3)
          .map(x => `${x.label}:${fmtMs(x.totalMs)}`).join(', ')

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
        return JSON.stringify({ ok: true, msg: '已跳转到使用情况访问权限设置页面，请引导用户开启权限后返回。' })
      }
      case 'create_mission': {
        const title = String(args.title || '未命名任务')
        const minutes = Math.max(1, Math.min(480, Math.round(Number(args.minutes) || 30)))
        const delayMin = Math.max(0, Math.round(Number(args.delayMin) || 0))
        const start = Date.now() + delayMin * 60000
        const m = useMissionStore.getState().createMission({
          title,
          subject: args.subject ? String(args.subject) : title,
          source: 'AI',
          createdBy: 'AI',
          plannedStart: start,
          plannedEnd: start + minutes * 60000,
          targetMinutes: minutes,
          requiresEvidence: false
        })
        return JSON.stringify({
          ok: true,
          mission_id: m.id,
          msg: `任务「${title}」已创建（${minutes}分钟${delayMin > 0 ? `，${delayMin}分钟后开始` : '，可立即开始'}），已纳入自律系统监控。`
        })
      }
      case 'update_subject_score': {
        const subjectName = String(args.subject || '')
        const gks = useGaoKaoStore.getState()
        const sub = gks.profile.subjects.find(s => s.name === subjectName)
        if (!sub) return JSON.stringify({ ok: false, error: `科目「${subjectName}」不存在` })
        const updates: any = {}
        if (args.currentScore !== undefined) updates.currentScore = Math.max(0, Math.min(sub.fullScore, Math.round(Number(args.currentScore))))
        if (args.targetScore !== undefined) updates.targetScore = Math.max(0, Math.min(sub.fullScore, Math.round(Number(args.targetScore))))
        if (Object.keys(updates).length === 0) return JSON.stringify({ ok: false, error: '未提供要修改的成绩' })
        gks.updateSubject(subjectName, updates)
        const updated = useGaoKaoStore.getState().profile.subjects.find(s => s.name === subjectName)
        return JSON.stringify({ ok: true, subject: subjectName, currentScore: updated?.currentScore, targetScore: updated?.targetScore, msg: `已更新 ${subjectName} 成绩` })
      }
      case 'update_candidate_info': {
        const gks = useGaoKaoStore.getState()
        const updates: any = {}
        if (args.nickname !== undefined) updates.nickname = String(args.nickname)
        if (args.targetUniversity !== undefined) updates.targetUniversity = String(args.targetUniversity)
        if (args.targetTotalScore !== undefined) updates.targetTotalScore = Math.max(0, Math.round(Number(args.targetTotalScore)))
        if (args.currentTotalScore !== undefined) updates.currentTotalScore = Math.max(0, Math.round(Number(args.currentTotalScore)))
        if (args.weakSubjects !== undefined && Array.isArray(args.weakSubjects)) updates.weakSubjects = args.weakSubjects
        if (Object.keys(updates).length === 0) return JSON.stringify({ ok: false, error: '未提供要修改的信息' })
        gks.updateProfile(updates)
        return JSON.stringify({ ok: true, msg: `已更新档案信息：${Object.keys(updates).join('、')}` })
      }
      case 'add_error_question': {
        const gks = useGaoKaoStore.getState()
        gks.addErrorQuestion({
          subject: String(args.subject || ''),
          tag: String(args.tag || ''),
          desc: String(args.desc || '')
        })
        return JSON.stringify({ ok: true, msg: `已记录错题：${args.subject}-${args.tag}` })
      }
      case 'resolve_error_question': {
        const gks = useGaoKaoStore.getState()
        const q = gks.profile.errorQuestions.find(eq => eq.id === args.question_id)
        if (!q) return JSON.stringify({ ok: false, error: '错题不存在' })
        if (q.resolved) return JSON.stringify({ ok: false, error: '错题已标记为解决' })
        gks.resolveErrorQuestion(String(args.question_id))
        return JSON.stringify({ ok: true, msg: `错题已解决：${q.tag}` })
      }
      case 'add_milestone': {
        const gks = useGaoKaoStore.getState()
        gks.addMilestone({
          title: String(args.title || ''),
          desc: String(args.desc || ''),
          type: String(args.type || 'custom') as any
        })
        return JSON.stringify({ ok: true, msg: `已添加里程碑：${args.title}` })
      }
      case 'generate_weekly_plan': {
        const gks = useGaoKaoStore.getState()
        gks.generateWeeklyPlan()
        const plan = useGaoKaoStore.getState().profile.generatedPlan
        return JSON.stringify({ ok: true, taskCount: plan.length, msg: `已生成本周学习计划，共 ${plan.length} 项任务` })
      }
      default:
        return JSON.stringify({ ok: false, error: `unknown tool: ${name}` })
    }
  } catch (e: any) {
    return JSON.stringify({ ok: false, error: e.message })
  }
}

// ═══════════════════════════════════════════════════════════
// 主入口：工具调用（非流式第一轮）+ 流式第二轮
// ═══════════════════════════════════════════════════════════

/**
 * @param userMessage 用户输入
 * @param onChunk 流式回调，每收到一段文字就调用
 * @param onStreamReset 当检测到工具调用、需要清空之前流式输出的内容时调用
 * @returns 最终完整回复文本
 */
export async function chatWithAI(
  userMessage: string,
  onChunk?: (text: string) => void,
  onStreamReset?: () => void
): Promise<string> {
  const state = useStore.getState()
  const ai = state.ai

  if (!ai.apiKey?.trim()) {
    return '请在「设置 → MOSS 引擎」填入 API Key 后再开始对话。'
  }
  if (!ai.endpoint?.trim()) {
    return '请在「设置 → MOSS 引擎」填入 Endpoint（例如 https://api.deepseek.com）。'
  }
  if (!ai.model?.trim()) {
    return '请在「设置 → MOSS 引擎」填入模型名称（例如 deepseek-v4-flash）。'
  }

  // ── 滑动窗口：System Prompt（index 0）+ 最近 20 条历史对话（10 轮）──
  const history: ChatMessage[] = state.chat.slice(-20)
  const messages: any[] = [
    { role: 'system', content: buildContext(state) },
    ...history.map(m => ({ role: m.role, content: m.text }))
  ]
  // 兜底：如果调用方未预先 pushChat，则补上
  const last = history[history.length - 1]
  if (!last || last.role !== 'user' || last.text !== userMessage) {
    messages.push({ role: 'user', content: userMessage })
  }

  try {
    // ── 第一轮：非流式请求（可靠检测 tool_calls）──
    const r1 = await callAPI(ai, messages, true)

    // 没有工具调用 → 直接返回内容（模拟流式输出效果）
    if (!r1.tool_calls || r1.tool_calls.length === 0) {
      const content = r1.content || '（空回复）'
      if (onChunk && content) {
        // 逐字输出模拟流式效果
        const chars = Array.from(content)
        for (let i = 0; i < chars.length; i++) {
          onChunk(chars[i])
          if (i % 3 === 0) await new Promise(r => setTimeout(r, 10))
        }
      }
      return content
    }

    // ── 有工具调用 → 执行工具，然后流式生成最终回复 ──
    // 清空之前可能的流式内容
    onStreamReset?.()

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
      const result = await executeTool(fnName, args)
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: result
      })
    }

    // ── 第二轮：流式生成最终文字回复（不带 tools，避免再次触发）──
    const r2 = await callAPIStream(ai, messages, false, onChunk)
    if (r2.content) return r2.content

    // 如果第二轮没有内容，尝试从最后一个工具结果中提取消息
    const lastToolMsg = messages.filter(m => m.role === 'tool').pop()
    if (lastToolMsg?.content) {
      try {
        const parsed = JSON.parse(lastToolMsg.content)
        if (parsed.msg) return parsed.msg
      } catch { /* ignore */ }
    }
    return '已执行操作。'
  } catch (e: any) {
    // 如果带工具的请求失败，尝试不带工具重试（流式）
    try {
      const r = await callAPIStream(ai, messages, false, onChunk)
      if (r.content) return r.content
      return '（空回复）'
    } catch (e2: any) {
      logger.error('ai', 'AI 对话请求失败（重试后仍失败）', { error: String(e2.message || e.message), model: ai.model })
      return `网络错误：${e2.message || e.message}`
    }
  }
}

// ═══════════════════════════════════════════════════════════
// URL 拼接工具：兼容两种 endpoint 格式
// ═══════════════════════════════════════════════════════════
export function buildChatUrl(endpoint: string): string {
  const base = endpoint.replace(/\/+$/, '')
  // 如果用户填了完整 URL（含 /chat/completions），直接返回
  if (base.endsWith('/chat/completions')) return base
  if (/\/v\d+$/.test(base)) return base + '/chat/completions'
  return base + '/v1/chat/completions'
}

// ═══════════════════════════════════════════════════════════
// 非流式 API 调用（用于可靠检测 tool_calls）
// ═══════════════════════════════════════════════════════════

interface APIResult {
  content: string
  tool_calls?: any[]
}

async function callAPI(
  ai: AIConfig,
  messages: any[],
  withTools: boolean
): Promise<APIResult> {
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
  let timer = setTimeout(() => controller.abort(), 60_000)

  try {
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
      const errText = await res.text()
      let detail = ''
      try { detail = JSON.parse(errText)?.error?.message || '' } catch { /* ignore */ }
      throw new Error(`请求失败 (${res.status})：${detail || errText.slice(0, 200)}`)
    }

    const data = await res.json()
    const choice = data.choices?.[0]
    const content = choice?.message?.content?.trim() || ''
    const tool_calls = choice?.message?.tool_calls

    return {
      content,
      tool_calls: tool_calls && tool_calls.length > 0 ? tool_calls : undefined
    }
  } finally {
    clearTimeout(timer)
  }
}

// ═══════════════════════════════════════════════════════════
// 流式 API 调用（SSE 解析）— 用于第二轮最终回复
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
  let timer = setTimeout(() => controller.abort(), 60_000)

  try {
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
      const errText = await res.text()
      let detail = ''
      try { detail = JSON.parse(errText)?.error?.message || '' } catch { /* ignore */ }
      throw new Error(`请求失败 (${res.status})：${detail || errText.slice(0, 200)}`)
    }

    // 如果不支持流式，回退到非流式 JSON 解析
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
    // timer 保持活跃：每次收到数据就重置超时，如果 reader.read() 卡住则触发 abort
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    const toolCalls: any[] = []

    const refreshTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(() => controller.abort(), 30_000)
    }

    while (true) {
      refreshTimer()
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
          // 忽略 JSON 解析错误
        }
      }
    }

    return {
      content: content.trim(),
      tool_calls: toolCalls.length > 0 ? toolCalls.filter(tc => tc.function.name) : undefined
    }
  } finally {
    clearTimeout(timer)
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

  const achList = state.achievements
    .filter((a: any) => !a.unlocked)
    .slice(0, 8)
    .map((a: any) => `  - ${a.id} 「${a.name}」进度 ${a.progress}/${a.total}`)
    .join('\n') || '  (无)'
  const gks = useGaoKaoStore.getState()
  const profile = gks.profile
  const subjectList = profile.subjects.map((s: any) => `  - ${s.name}：${s.currentScore}/${s.targetScore}（满分${s.fullScore}）${s.currentScore < s.targetScore ? '⚠️' : '✅'}`).join('\n')
  const errorList = profile.errorQuestions.slice(0, 5).map((q: any) => `  - [${q.resolved ? '✓' : '○'}] ${q.subject}·${q.tag}：${q.desc}`).join('\n') || '  （暂无）'
  const planList = profile.generatedPlan.slice(0, 5).map((p: any) => `  - [${p.completed ? '✓' : '○'}] ${p.content}（${p.subject}）`).join('\n') || '  （暂无）'

  return `${SYSTEM_PROMPT}

【当前状态】
代号:${state.playerTag} 积分:${state.points} 连签:${state.streak}天
学习:${studyMin}min/${dailyGoalMin}min(${ratio}%) 娱乐:${entMin}min 总专注:${Math.floor(state.totalFocusMs / 3600_000)}h
时间:${new Date().toLocaleString('zh-CN', { hour12: false })} ${isLate ? '[深夜]' : ''}

【手机使用监测】
你可以随时调用 check_phone_usage 工具查阅用户今天的手机使用详情。
如果返回权限不足，调用 request_usage_permission 引导用户去系统设置开启权限。
当前已同步的学习时长:${studyMin}分钟 娱乐时长:${entMin}分钟（此数据可能不是实时的，如需最新数据请调check_phone_usage）

【未完成任务】(complete_quest用ID)
${questList}

【进行中成就】(update_achievement/unlock_achievement用ID)
${achList}

【高考档案】
考生：${profile.nickname}，目标：${profile.targetUniversity}，目标总分：${profile.targetTotalScore}，当前总分：${profile.currentTotalScore}
【各科成绩】(update_subject_score用科目名)
${subjectList}
【薄弱点】
${profile.weakSubjects.length > 0 ? profile.weakSubjects.join('、') : '（暂无）'}
【错题 TOP5】(resolve_error_question用ID)
${errorList}
【本周计划 TOP5】
${planList}`}

// ═══════════════════════════════════════════════════════════
// 测试连接
// ═══════════════════════════════════════════════════════════
export async function testConnection(cfg: {
  apiKey: string
  endpoint: string
  model: string
}): Promise<{ ok: boolean; msg: string }> {
  if (!cfg.apiKey?.trim()) return { ok: false, msg: '请先填入 API Key' }
  if (!cfg.endpoint?.trim()) return { ok: false, msg: '请先填入 Endpoint（如 https://api.deepseek.com）' }
  if (!cfg.model?.trim()) return { ok: false, msg: '请先填入模型名称（如 deepseek-v4-flash）' }

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
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 8
      }),
      signal: controller.signal
    })
    clearTimeout(timer)

    if (res.ok) {
      logger.info('ai', 'AI 连接测试成功', { model: cfg.model, endpoint: cfg.endpoint })
      return { ok: true, msg: '连接成功，MOSS 已就绪' }
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
