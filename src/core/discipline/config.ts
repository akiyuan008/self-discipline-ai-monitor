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
// Evidence 双层模型（Phase 5）
//   Objective Evidence（usageStats/photo/screenshot）计入客观证据分；
//   Manual = User Assertion；AI = VerificationRecommendation（不计入客观分）。
//   下列权重为"旧系统兼容/迁移期参考值"，AI=0.3 仅作参考、非最终架构。
// ═══════════════════════════════════════════════════════════
export const EVIDENCE = {
  // ── 客观证据权重（计入 Objective Evidence Score）──
  WEIGHT_USAGE_STATS: 1.0,
  WEIGHT_PHOTO: 0.8,
  WEIGHT_SCREENSHOT: 0.7,
  // ── User Assertion / AI（仅参考，不计入客观分）──
  WEIGHT_MANUAL: 0.5,
  WEIGHT_AI_LEGACY: 0.3,
  /** 客观证据验证门槛：objectiveScore ≥ 该值 → 客观验证通过 */
  OBJECTIVE_VERIFY_THRESHOLD: 0.6,
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
  ai: 0.3, // V3 Phase5：AI=Interpretation，0.3 仅迁移参考，不直接计入客观证据分
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
// Execution Quality 综合评分（Phase 4）
//   QualityScore = ExecutionRate×W_RATE + FocusRatio×W_FOCUS
//                + RecoveryRate×W_RECOVERY + DeviationScore×W_DEVIATION
//   DeviationScore = max(0, 1 - deviationCount/DEVIATION_NORMALIZER)
//   RecoveryRate = recoveryCount/deviationCount；无偏离时 = 1（避免 0/0）
//   设计意图：Recovery（回来能力）被正向计入，而非只看偏离次数。
// ═══════════════════════════════════════════════════════════
export const QUALITY = {
  W_RATE: 0.40,
  W_FOCUS: 0.30,
  W_RECOVERY: 0.20,
  W_DEVIATION: 0.10,
  /** DeviationScore 归一化分母：偏离 5 次 → DeviationScore=0 */
  DEVIATION_NORMALIZER: 5,

  /** 档位阈值 */
  GRADE_A: 0.85,
  GRADE_B: 0.70,
  GRADE_C: 0.50,

  // ── 硬门槛（防止"只靠时间达标"掩盖执行质量）──
  /** FocusRatio < 该值 → 最高只能 C */
  FOCUS_RATIO_CAP_C: 0.40,
  /** ExecutionRate < 该值 → 直接 D */
  EXECUTION_RATE_GATE_D: 0.50,
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
} as const

// ═══════════════════════════════════════════════════════════
// Recovery 奖励（Phase 3）
//   理念：自律不是"永远不分心"，而是"分心后能回到轨道"。
//   主动 Recovery 是正向行为，给予小额奖励强化"回来"这个动作。
//   防刷：每个 Session 最多奖励前 MAX_PER_SESSION 次恢复。
// ═══════════════════════════════════════════════════════════
export const RECOVERY = {
  /** 每次主动恢复奖励的 PTS */
  BONUS_PTS: 10,
  /** 每次主动恢复奖励的 XP */
  BONUS_XP: 5,
  /** 每个 Session 内最多奖励的恢复次数（防"故意偏离-恢复"刷分） */
  MAX_PER_SESSION: 2,
} as const
