/**
 * src/core/discipline/deviationAnalyzer.ts
 * DeviationAnalyzer（V3 Phase 2）—— 置信度流水线与门控。
 *
 * 流水线（最终拍板，替代"Bilibili→0.92→干预 / Chrome→0.15→不干预"的硬编码映射）：
 *   raw behavior → App Category → base confidence → context 调整 → duration 调整
 *                → final confidence → Deviation Gate（是否记为偏离）→ Intervention Gate（是否干预）
 *
 * 硬规则：
 *   1. App Category 只是 base signal，不是最终 confidence。
 *      浏览器/neutral 语义中性，final confidence 必须结合 Session Context + Duration + Behavior。
 *   2. Deviation ≠ Intervention。可以"记录 Deviation 但不干预"（低置信 / 时长不足）。
 */
import { DEVIATION } from './config'
import type { Session, Mission, PendingDeviation } from './types'

export type { PendingDeviation }

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

/** App Category → base confidence（仅 base signal） */
export function baseConfidenceFor(category: string): number {
  if (category === 'entertainment') return DEVIATION.CONF_ENTERTAINMENT
  if (category === 'social') return DEVIATION.CONF_SOCIAL
  return DEVIATION.CONF_NEUTRAL // neutral / browser / 其他
}

/**
 * 计算最终置信度：base + duration 调整 + context 调整，neutral 封顶。
 * @param pd        偏离候选（含 base confidence 与起始时间）
 * @param session   当前 Session（提供 mode / 已偏离次数等 context）
 * @param elapsedMs 该候选已持续的时长
 */
export function computeFinalConfidence(
  pd: PendingDeviation,
  session: Session,
  _mission: Mission,
  elapsedMs: number
): number {
  let conf = pd.baseConfidence

  // duration 调整：持续越久，越可能是真实偏离（有上限）
  const durMin = elapsedMs / 60_000
  conf += Math.min(DEVIATION.MAX_DURATION_ADJUSTMENT, durMin * DEVIATION.DURATION_ADJUST_PER_MIN)

  // context 调整：Abyss 模式 stakes 更高
  if (session.mode === 'ABYSS') conf += DEVIATION.ABYSS_CONTEXT_ADJUSTMENT

  // context 调整：本 Session 已多次偏离 → 分心模式，略微提高
  if (session.deviationCount >= 2) conf += DEVIATION.REPEAT_ADJUSTMENT

  // neutral / 浏览器封顶：语义中性，无额外上下文证据时不单独判成高分心。
  // ⚠️ NEUTRAL_CAP 仅是"无上下文证据"时的上限：一旦存在 contextEvidence
  // （未来如 URL 语义 / 连续切换娱乐站点 / 长停留模式），即解除封顶、允许上下文重评。
  if (pd.category === 'neutral' && !pd.contextEvidence) {
    conf = Math.min(conf, DEVIATION.NEUTRAL_CONF_CAP)
  }

  return clamp01(conf)
}

/** Deviation Gate：final confidence 是否足以"正式成立"为一条 Deviation（记录层） */
export function shouldRecordDeviation(finalConfidence: number): boolean {
  return finalConfidence >= DEVIATION.RECORD_MIN_CONFIDENCE
}

/** Intervention Gate：final confidence 是否足以考虑干预（仍需配合 duration 分级） */
export function shouldConsiderIntervention(finalConfidence: number): boolean {
  return finalConfidence >= DEVIATION.INTERVENTION_MIN_CONFIDENCE
}

/** 是否仍属 transient switch（未达到成立所需的最短持续时长） */
export function isTransient(elapsedMs: number): boolean {
  return elapsedMs < DEVIATION.SHORT_SWITCH_EXEMPTION_MS
}
