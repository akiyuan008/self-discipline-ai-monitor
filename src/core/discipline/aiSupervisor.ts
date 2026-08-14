/**
 * src/core/discipline/aiSupervisor.ts
 * AI Supervisor —— AI 监督策略（最终决策 #6：AI = 监督策略）。
 *
 * 职责边界（重要）：
 *  - AI 只是"监督策略"，不直接判完成、不直接发奖。
 *  - 完成判定仍归 MissionEvaluator，奖励仍归 RewardEngine。
 *  - AI 产出的是：监督话语、'ai' 类 Evidence、动态 Mission（source='AI'）。
 *
 * 三件事：
 *  1. aiSupervise：干预升级/任务将错过时，请 MOSS 给一句监督话语（Recovery 优先）。
 *  2. aiJudgeEvidence：对 requiresEvidence 任务，AI 依据用户描述判完成，产 'ai' 证据。
 *  3. createAiMission：AI 动态创建 Mission（source='AI'）。
 */
import { useStore } from '@/stores/useStore'
import { buildChatUrl } from '@/lib/ai'
import { useMissionStore } from './missionStore'
import { addRecommendation } from './disciplineEngine'
import { useReviewStore } from './reviewStore'
import { aggregateReviews } from './dailyReview'
import { logger } from '@/lib/logger'
import type { Mission, AiInsight, InsightRange, ReviewAggregate } from './types'

/** 读取已配置的 AI（MOSS 引擎）；未配置返回 null */
function getAi() {
  const ai = useStore.getState().ai
  if (!ai.apiKey?.trim() || !ai.endpoint?.trim() || !ai.model?.trim()) return null
  return ai
}

/** 一次性补全调用（非对话、无工具） */
async function oneShot(messages: any[], maxTokens = 200, temperature = 0.5): Promise<string> {
  const ai = getAi()
  if (!ai) return ''
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const resp = await fetch(buildChatUrl(ai.endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.apiKey}` },
      body: JSON.stringify({ model: ai.model, messages, temperature, max_tokens: maxTokens, stream: false }),
      signal: controller.signal
    })
    if (!resp.ok) return ''
    const data = await resp.json()
    return (data.choices?.[0]?.message?.content || '').trim()
  } catch (e) {
    logger.warn('aiSupervisor', 'AI 调用失败', { error: String(e) })
    return ''
  } finally {
    clearTimeout(timer)
  }
}

export interface SupervisionResult {
  message: string
}

/**
 * AI 监督：干预升级或任务将错过时，给一句监督话语。
 * Recovery > Punishment —— 语气帮助用户回到任务，而非责骂。
 */
export async function aiSupervise(
  m: Mission,
  reason: 'DISTRACTED' | 'AT_RISK'
): Promise<SupervisionResult | null> {
  if (!getAi()) return null
  const studiedMin = Math.floor(m.actualStudyMs / 60000)
  const prompt = reason === 'DISTRACTED'
    ? `用户正在做任务「${m.title}」（目标 ${m.targetMinutes} 分钟，已专注 ${studiedMin} 分钟），但分心了，现在处于干预阶段。请给一句简短监督话语（30字内），帮他回到任务。语气果断但关心，像教练。不用emoji。只输出话语本身。`
    : `用户的任务「${m.title}」（目标 ${m.targetMinutes} 分钟，已专注 ${studiedMin} 分钟）快到截止时间、可能被错过。请给一句简短鼓励话语（30字内）。不用emoji。只输出话语本身。`
  const text = await oneShot([
    { role: 'system', content: '你是 MOSS，用户的自律监督 AI。回复简短、果断，帮助用户回到任务。恢复优先，不以惩罚为目的。' },
    { role: 'user', content: prompt }
  ], 120, 0.6)
  if (!text) return null
  return { message: text.slice(0, 60) }
}

/**
 * AI 证据判定：对 requiresEvidence 任务，AI 依据用户描述判完成，产 'ai' 证据。
 * 判定通过后 attachEvidence 触发 MissionEvaluator；奖励由 RewardEngine 统一发放。
 */
export async function aiJudgeEvidence(missionId: string, note: string): Promise<{ ok: boolean; msg: string; pending?: boolean }> {
  const store = useMissionStore.getState()
  const m = store.getMission(missionId)
  if (!m) return { ok: false, msg: '任务不存在' }
  if (!getAi()) return { ok: false, msg: '未配置 AI 监督者，请在设置中配置 MOSS 引擎' }

  const prompt = `用户正在做任务「${m.title}」（主题：${m.subject || m.title}）。用户这样描述完成情况："${note}"。请判断用户是否真实完成了任务。输出 JSON：{"pass": true/false, "confidence": 0到1的小数, "reason": "20字内"}。要严格，不要轻易放过。`
  const text = await oneShot([
    { role: 'system', content: '你是严格的任务完成核验 AI。只输出 JSON，不要其他文字。' },
    { role: 'user', content: prompt }
  ], 200, 0.2)

  const jsonMatch = text.match(/\{[\s\S]*?\}/)
  if (!jsonMatch) return { ok: false, msg: 'AI 判定失败，请稍后重试' }
  try {
    const r = JSON.parse(jsonMatch[0])
    const pass = !!r.pass
    const confidence = Math.max(0, Math.min(1, Number(r.confidence) || 0.5))
    // Phase 5：AI 只产 VerificationRecommendation（PENDING），不自动判完成。
    // 由用户确认（未来 UI 调 accept/rejectRecommendation）或客观证据决定完成。
    addRecommendation(missionId, { aiVerdict: pass ? 'pass' : 'fail', confidence, reason: r.reason || note })
    if (pass) {
      return { ok: true, pending: true, msg: `AI 建议通过（待用户确认）${r.reason ? '：' + r.reason : ''}` }
    }
    return { ok: false, msg: `AI 判定未完成${r.reason ? '：' + r.reason : ''}` }
  } catch {
    return { ok: false, msg: 'AI 判定结果解析失败' }
  }
}

/**
 * AI 动态创建 Mission（source='AI'）。
 * 供 MOSS chat 工具与自主建议调用。创建后由统一的 Mission 系统接管。
 */
export function createAiMission(opts: {
  title: string
  subject?: string
  minutes: number
  delayMin?: number
}): Mission {
  const store = useMissionStore.getState()
  const start = Date.now() + (opts.delayMin || 0) * 60000
  const m = store.createMission({
    title: opts.title,
    subject: opts.subject || opts.title,
    source: 'AI',
    createdBy: 'AI',
    plannedStart: start,
    plannedEnd: start + opts.minutes * 60000,
    targetMinutes: opts.minutes,
    requiresEvidence: false
  })
  logger.info('aiSupervisor', `AI 动态创建 Mission: ${opts.title}`, { minutes: opts.minutes, delayMin: opts.delayMin || 0 })
  return m
}

// ═══════════════════════════════════════════════════════════
// AI Insight（V3 Phase 6）—— On-Demand，不参与 DailyReview 基础计算
// 负责：Pattern Detection / Explanation / Risk / Suggestion / NextPlan Recommendation
// 支持范围：TODAY / LAST_7_DAYS / LAST_30_DAYS
// ═══════════════════════════════════════════════════════════

/** 日期字符串(yyyy-mm-dd) 加/减 n 天 */
function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function rangeToDays(range: InsightRange): number {
  if (range === 'LAST_7_DAYS') return 7
  if (range === 'LAST_30_DAYS') return 30
  return 1
}

/** 把聚合数据压成给 AI 的简明文本 */
function describeAggregate(agg: ReviewAggregate, range: InsightRange): string {
  if (agg.days === 0) return '（该范围内无 DailyReview 数据）'
  const qd = agg.qualityDistribution
  const focusMin = Math.round(agg.totalFocusMs / 60000)
  return [
    `范围:${range} 覆盖${agg.days}天`,
    `总专注:${focusMin}分钟 平均执行率:${(agg.avgExecutionRate * 100).toFixed(0)}%`,
    `完成任务:${agg.totalCompleted}/${agg.totalCommitted}个承诺 平均可靠度:${(agg.avgReliabilityScore * 100).toFixed(0)}%`,
    `总偏离:${agg.totalDeviations}次 总恢复:${agg.totalRecoveries}次 平均恢复率:${(agg.avgRecoveryRate * 100).toFixed(0)}%`,
    `质量分布:A=${qd.A} B=${qd.B} C=${qd.C} D=${qd.D}`
  ].join('；')
}

/**
 * 按需生成 AI Insight。
 *   - 已存在同 (baseDate, range) 的 Insight → 直接返回（不重复调 AI）。
 *   - 否则读取范围内 DailyReview 快照 → 聚合 → 调 AI → 保存并返回。
 *   - AI 不计算 DailyReview；只基于已存在的确定性快照做解释与建议。
 */
export async function generateAiInsight(baseDate: string, range: InsightRange): Promise<AiInsight | null> {
  const rstore = useReviewStore.getState()

  // On-Demand 缓存：已存在则直接读取
  const cached = rstore.getAiInsight(baseDate, range)
  if (cached) return cached

  if (!getAi()) {
    logger.warn('aiSupervisor', 'generateAiInsight: 未配置 AI，无法生成 Insight')
    return null
  }

  // 读取范围内的 DailyReview 快照并聚合
  const days = rangeToDays(range)
  const startDate = shiftDate(baseDate, -(days - 1))
  const reviews = rstore.getReviewsInRange(startDate, baseDate)
  const agg = aggregateReviews(reviews)

  const prompt = `你是用户的自律教练 MOSS。下面是用户最近的结构化执行数据（已确定性统计，勿重新计算）。请基于数据给出：
1) patternDetection 行为模式（如"晚间易分心""数学恢复率高"）
2) explanation 解释（为什么会这样）
3) risk 风险（持续下去的问题）
4) suggestion 具体可执行建议
5) nextPlanRecommendation 次日计划建议（可含建议任务）
数据：${describeAggregate(agg, range)}
输出 JSON：{"patternDetection":"...","explanation":"...","risk":"...","suggestion":"...","nextPlanRecommendation":"..."}。每项40字内，不用emoji。`

  const text = await oneShot(
    [
      { role: 'system', content: '你是数据驱动的自律教练。只基于给定数据输出 JSON，不编造数据。' },
      { role: 'user', content: prompt }
    ],
    500,
    0.5
  )

  const insight: AiInsight = {
    id: `ins-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    baseDate,
    range,
    rawText: text,
    createdAt: Date.now()
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const p = JSON.parse(jsonMatch[0])
      insight.patternDetection = p.patternDetection
      insight.explanation = p.explanation
      insight.risk = p.risk
      insight.suggestion = p.suggestion
      insight.nextPlanRecommendation = p.nextPlanRecommendation
    } catch {
      logger.warn('aiSupervisor', 'AI Insight JSON 解析失败，保留 rawText')
    }
  }

  rstore.saveAiInsight(insight)
  logger.info('aiSupervisor', `AI Insight 生成(${range})`, { baseDate, days: agg.days })
  return insight
}
