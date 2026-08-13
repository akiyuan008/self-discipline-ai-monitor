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
// Deviation / 置信度（Phase 2）
//   模型：raw behavior → App Category → base confidence → context 调整 → duration 调整
//         → final confidence → Deviation Gate（是否记为偏离）→ Intervention Gate（是否干预）
//   硬规则：Deviation ≠ Intervention。可"记录 Deviation 但不干预"。
// ═══════════════════════════════════════════════════════════
export const DEVIATION = {
  /** 短暂切换豁免：< 该时长视为 transient switch，【不创建 Deviation】（事件去抖，非"不算分心"） */
  SHORT_SWITCH_EXEMPTION_MS: 10_000,

  // ── base confidence（仅 base signal，非最终值；最终值需结合 context/duration）──
  CONF_ENTERTAINMENT: 0.92,   // 明确娱乐 App
  CONF_SOCIAL: 0.75,          // 社交 App
  CONF_NEUTRAL: 0.15,         // 浏览器 / neutral 工具（context-dependent，语义中性）

  // ── confidence 调整（final = base + duration + context）──
  DURATION_ADJUST_PER_MIN: 0.04,   // 每持续 1 分钟 +0.04
  MAX_DURATION_ADJUSTMENT: 0.20,   // duration 调整上限
  ABYSS_CONTEXT_ADJUSTMENT: 0.05,  // Abyss 模式高 stakes
  REPEAT_ADJUSTMENT: 0.05,         // 本 Session 已多次偏离（分心模式）

  /** neutral/浏览器最终置信度上限（Phase 2 永不把浏览器单独判成高分心） */
  NEUTRAL_CONF_CAP: 0.30,

  // ── Deviation Gate：final confidence ≥ 该值才"正式成立"为 Deviation（记录层）──
  RECORD_MIN_CONFIDENCE: 0.40,

  // ── Intervention Gate：final confidence ≥ 该值才考虑干预（配合 duration 分级）──
  INTERVENTION_MIN_CONFIDENCE: 0.60,

  /** 触发 LEVEL1 所需的高置信分心持续时长（干预分级仍由 INTERVENTION.* 时长驱动） */
  HIGH_CONF_SUSTAIN_MS: 60_000,
} as const

// ═══════════════════════════════════════════════════════════
// Session 结果判定（Phase 2 最小版；Phase 4 扩展为三态 + 执行率 + 质量等级）
// ═══════════════════════════════════════════════════════════
export const RESULT = {
  /** "有意义执行"阈值：专注时长 ≥ 该值视为 PARTIAL（而非 ABANDONED） */
  MEANINGFUL_EXECUTION_MS: 60_000,
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
