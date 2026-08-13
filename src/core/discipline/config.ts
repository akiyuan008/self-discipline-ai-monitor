/**
 * src/core/discipline/config.ts
 * 自律核心 —— 统一策略配置（Phase 0）。
 *
 * 目的：把散落在 disciplineEngine / missionEvaluator / rewardEngine 的魔法数字
 * 收敛到单一策略对象，便于 Phase 2 置信度门控、按 Abyss/普通调参。
 *
 * ⚠️ Phase 0 原则：**行为中性** —— 此处数值与重构前完全一致，不改变任何运行时行为。
 * V3 目标值（如 AI 证据降权到 0.3、置信度门控）以注释标注，留待对应 Phase 生效。
 */

// ═══════════════════════════════════════════════════════════
// 干预升级阈值（分心持续时长 → LEVEL）
// ═══════════════════════════════════════════════════════════
export const INTERVENTION = {
  /** 分心 ≥1min → LEVEL 1 轻提醒 */
  LEVEL1_AFTER_MS: 60_000,
  /** 分心 ≥5min → LEVEL 2 强提醒 + 遮罩（可恢复） */
  LEVEL2_AFTER_MS: 5 * 60_000,
  /** 分心 ≥15min → LEVEL 3 强制恢复模式 */
  LEVEL3_AFTER_MS: 15 * 60_000,
} as const

// ═══════════════════════════════════════════════════════════
// 完成判定（MissionEvaluator）
// ═══════════════════════════════════════════════════════════
export const COMPLETION = {
  /** 普通任务：有效学习时长占目标的比例门槛（V3 Phase4 将改为三态+执行率，不再单一 0.8） */
  RATIO: 0.8,
  /** requiresEvidence 任务：证据充分度门槛 */
  EVIDENCE_SCORE_MIN: 0.6,
} as const

// ═══════════════════════════════════════════════════════════
// Evidence 基准权重（MissionEvaluator）
// ⚠️ V3 Phase5：ai 将从 0.9 降为 ~0.3（AI=Interpretation，不是 Truth Source），
//    并改为 Verification Recommendation + User Confirmation。Phase 0 暂维持现状。
// ═══════════════════════════════════════════════════════════
export const EVIDENCE_WEIGHT = {
  usageStats: 1.0,
  photo: 0.8,
  screenshot: 0.7,
  manual: 0.5,
  ai: 0.9, // V3 目标 ≈0.3（Phase 5）
} as const

// ═══════════════════════════════════════════════════════════
// Deviation / 置信度（Phase 2 生效，Phase 0 先定义）
// ═══════════════════════════════════════════════════════════
export const DEVIATION = {
  /** 短暂切换豁免：低于此时长的前台切换不形成 Deviation */
  SHORT_SWITCH_EXEMPT_MS: 10_000,
  /** 明确娱乐 App 持续 ≥60s 的基准置信度 */
  CONF_ENTERTAINMENT: 0.92,
  /** 社交 App 持续 ≥60s 的基准置信度 */
  CONF_SOCIAL: 0.75,
  /** 浏览器 / neutral 工具（context-dependent，不直接判分心） */
  CONF_NEUTRAL: 0.15,
  /** 触发 LEVEL1 所需的高置信分心持续时长 */
  HIGH_CONF_SUSTAIN_MS: 60_000,
} as const

// ═══════════════════════════════════════════════════════════
// 奖励（RewardEngine）
// ═══════════════════════════════════════════════════════════
export const REWARD = {
  /** 基础 PTS 下限 */
  BASE_POINTS_MIN: 20,
  /** 高专注加成（分心占比 <10%） */
  FOCUS_BONUS: 20,
  /** 高专注判定的分心占比上限 */
  FOCUS_BONUS_DISTRACTION_RATIO: 0.1,
  /** 深渊挑战奖励（经 RewardEngine 统一发放） */
  ABYSS_BONUS: 400,
  /** 错过任务的惩罚上限（轻度，Recovery 优先） */
  MISSED_PENALTY_MAX: 30,
  /** Recovery 奖励（Phase 3 生效） */
  RECOVERY_BONUS: 0, // V3 Phase3：设定每次主动恢复的小额奖励
} as const
