/**
 * src/core/discipline/types.ts
 * 自律核心 —— 统一数据模型
 *
 * 设计原则（最终决策，不再摇摆）：
 * 1. Mission 三来源统一：SCHEDULE / USER / AI，统一成一个 Mission 模型。
 *    禁止维护多套 CurrentTask / CurrentMission。
 * 2. BehaviorEvent 只描述"用户实际行为"这一事实，不做业务判断。
 *    Android / UsageStats 只产事实，不加 XP / 扣分 / 判完成。
 * 3. 完成判定交给 MissionEvaluator（Evidence 证据驱动），拍照只是 Evidence 之一。
 * 4. 干预分级 LEVEL 0/1/2/3，核心是 Recovery > Punishment。
 */

// ═══════════════════════════════════════════════════════════
// Mission（当前真正应该完成的一件事）
// ═══════════════════════════════════════════════════════════

export type MissionSource = 'SCHEDULE' | 'USER' | 'AI'
export type MissionCreatedBy = 'SYSTEM' | 'USER' | 'AI'

/** Mission 状态机（唯一状态源，所有页面共用，不得另定义） */
export type MissionStatus =
  | 'READY'          // 就绪，尚未开始
  | 'FOCUSING'       // 正在专注执行
  | 'DISTRACTED'     // 检测到分心
  | 'INTERVENTION'   // 系统正在干预
  | 'RECOVERING'     // 用户正在恢复
  | 'COMPLETED'      // 已完成
  | 'MISSED'         // 错过
  | 'IDLE'           // 空闲（无当前任务）

/** 干预等级：0 不干预 / 1 轻提醒 / 2 强提醒+遮罩(可恢复) / 3 强制恢复模式 */
export type InterventionLevel = 0 | 1 | 2 | 3

export interface Mission {
  id: string
  title: string
  subject?: string
  source: MissionSource
  createdBy?: MissionCreatedBy

  /** 计划时间窗口（时间戳 ms） */
  plannedStart: number
  plannedEnd: number
  /** 目标专注分钟数 */
  targetMinutes: number

  /** 实际累计（ms）—— actualStudyMs 由 focusIntervals 去重合并后派生，勿手动累加 */
  actualStudyMs: number
  distractionMs: number

  /**
   * 专注时间证据区间（FocusEvidence）。DUNGEON 与 APP_USAGE 两种来源都写入这里，
   * 由 DisciplineEngine 统一做重叠去重后派生 actualStudyMs，杜绝双重计算。
   */
  focusIntervals: FocusInterval[]

  status: MissionStatus
  interventionLevel: InterventionLevel

  /** 是否需要"结果证据"（UsageStats 无法证明的任务，如试卷/作业/背诵） */
  requiresEvidence: boolean
  /** 已收集的证据 */
  evidence: Evidence[]

  startedAt?: number
  completedAt?: number
  /** 最近一次进入分心的时间（用于计算分心时长与升级干预） */
  distractedSince?: number
  /** 创建时间 */
  createdAt: number

  // ── V3（Phase 0 骨架，均为可选，向后兼容）──
  /** 任务类型：TIME_BASED 以时长为依据；OUTCOME_BASED 需 Evidence 验收 */
  taskType?: TaskType
  /** 该 Mission 下属的 Session id 列表（一个 Mission 可有多个 Session） */
  sessionIds?: string[]
  /** 优先级 */
  priority?: 'low' | 'normal' | 'high'
}

// ═══════════════════════════════════════════════════════════
// V3 任务类型
//   TIME_BASED   —— "专注阅读 45min"：UsageStats + Focus Session 时长为主
//   OUTCOME_BASED —— "完成第三章习题"：需 Evidence/Result 验收，时长只证明"执行过"
// ═══════════════════════════════════════════════════════════
export type TaskType = 'TIME_BASED' | 'OUTCOME_BASED'

// ═══════════════════════════════════════════════════════════
// FocusEvidence（专注时间证据区间）
//   Dungeon = Focus Runtime / Evidence Provider，不再是独立计时器。
//   DUNGEON 与 APP_USAGE 两种来源最终进入同一套时间累计，统一去重。
// ═══════════════════════════════════════════════════════════
export type FocusSource = 'DUNGEON' | 'APP_USAGE'

export interface FocusInterval {
  source: FocusSource
  /** 区间起止（时间戳 ms） */
  startedAt: number
  endedAt: number
  /** APP_USAGE 时携带包名；DUNGEON 时可空 */
  packageName?: string
  /** 可选标记：如 'abyss' / 'focus'，供 RewardEngine 识别挑战类奖励 */
  tag?: string
}

// ═══════════════════════════════════════════════════════════
// Evidence（完成证据）—— 拍照降级为 Evidence Provider
// ═══════════════════════════════════════════════════════════
export type EvidenceType = 'usageStats' | 'photo' | 'screenshot' | 'manual' | 'ai'

export interface Evidence {
  type: EvidenceType
  /** 证据强度 0-1（由 MissionEvaluator 解释） */
  weight: number
  ts: number
  /** 可选载荷：photo 存路径、manual 存备注等 */
  payload?: string
}

// ═══════════════════════════════════════════════════════════
// BehaviorEvent（用户实际行为 —— 只做事实，不做判断）
// ═══════════════════════════════════════════════════════════
export type BehaviorEventType =
  | 'APP_FOREGROUND'      // 切到某 App 前台（携带 packageName）
  | 'APP_BACKGROUND'      // App 退到后台
  | 'SCREEN_ON'           // 亮屏
  | 'SCREEN_OFF'          // 息屏
  | 'MISSION_STARTED'     // 任务开始（用户点击开始）
  | 'MISSION_STOPPED'     // 任务被手动停止
  | 'USAGE_SAMPLE'        // UsageStats 周期采样（携带窗口内 study/ent 时长）

export interface BehaviorEvent {
  type: BehaviorEventType
  ts: number
  packageName?: string
  /** 该 App 所属分类（由统一分类判定，见 appCategories） */
  appCategory?: 'study' | 'entertainment' | 'social' | 'neutral'
  /** USAGE_SAMPLE 时携带：采样窗口内的有效学习 / 分心毫秒数 */
  studyMs?: number
  distractionMs?: number
  /** USAGE_SAMPLE 时携带：采样窗口起点（用于把聚合时长锚定成 APP_USAGE 区间） */
  windowStart?: number
}

// ═══════════════════════════════════════════════════════════
// Android 最小 Mission 运行时镜像（Service 重启双保险）
// ═══════════════════════════════════════════════════════════
export interface MissionRuntimeMirror {
  missionId: string
  status: MissionStatus
  plannedStart: number
  plannedEnd: number
  interventionLevel: InterventionLevel
}

// ═══════════════════════════════════════════════════════════
// V3 —— Session（一次实际执行会话）
//
// 核心语义（最终拍板）：
//   一次"用户主动开始的执行过程" = 一个 Session。
//   分心、恢复【不】创建新 Session；Session 内部含多个 FocusSegment 与 Deviation。
//   用户明确结束（Stop）后再重新开始，才创建新的 Session。
//
//   Mission └── Session ─┬── FocusSegment（专注段）
//                        ├── Deviation（偏离）
//                        ├── Intervention（干预）
//                        ├── Recovery（恢复）
//                        └── Result（结果）
// ═══════════════════════════════════════════════════════════

export type SessionStatus =
  | 'PLANNED'      // 已排程未开始
  | 'ACTIVE'       // 正在执行（在轨）
  | 'PAUSED'       // 暂停
  | 'DEVIATED'     // 偏离中
  | 'RECOVERING'   // 恢复中
  | 'COMPLETED'    // 完成（达到完成条件）
  | 'PARTIAL'      // 部分完成（有有效执行但未达标）
  | 'ABANDONED'    // 放弃（几乎无有效执行即结束）

export type SessionMode = 'STANDARD' | 'ABYSS'

/** Session 内的一段专注（V3 的 FocusSegment，等价于原 FocusInterval + sessionId + id） */
export interface FocusSegment {
  id: string
  sessionId: string
  source: FocusSource        // DUNGEON | APP_USAGE
  startedAt: number
  endedAt: number
  packageName?: string
  tag?: string               // 'abyss' | 'focus'
}

export type DeviationType =
  | 'DISTRACTION'    // 被娱乐/社交吸引
  | 'IDLE'           // 无明确 App 的放空/息屏
  | 'LATE_START'     // 晚于 plannedStart 才开始
  | 'EARLY_STOP'     // 提前放弃
  | 'OVEREXTENSION'  // 过度延长

export type DeviationResolvedBy = 'USER_RECOVERY' | 'INTERVENTION' | 'TIMEOUT' | 'AUTO'

/**
 * 待定的偏离候选（transient 期间挂在 Session 上，未正式成立）。
 * 用于实现 <SHORT_SWITCH_EXEMPTION_MS 的 transient switch 去抖：
 * 前台切到可疑 App 时先挂候选，持续达到阈值才正式成立为 Deviation。
 */
export interface PendingDeviation {
  pkg: string
  category: 'study' | 'entertainment' | 'social' | 'neutral'
  startedAt: number
  baseConfidence: number
  /**
   * 是否存在额外上下文证据（Phase 2 恒为 false/未设置）。
   * 未来（如浏览器 URL 语义、连续切换娱乐站点、长停留模式）可置 true，
   * 以解除 NEUTRAL_CAP 封顶、允许基于上下文把 neutral 重新评估为更高置信度。
   */
  contextEvidence?: boolean
}

/** 偏离记录（V3）。Deviation ≠ App Category；带置信度与上下文。 */
export interface Deviation {
  id: string
  sessionId: string
  type: DeviationType
  startedAt: number
  endedAt?: number
  durationMs: number
  /** 0–1：由 DeviationAnalyzer 依据 category+context+duration 计算（Phase 2） */
  confidence: number
  /** 触发描述，如 "打开 tv.danmaku.bili" / "无操作 3min" */
  trigger: string
  resolvedAt?: number
  resolvedBy?: DeviationResolvedBy
}

export type SessionOutcome = 'COMPLETED' | 'PARTIAL' | 'ABANDONED'
export type ExecutionQuality = 'A' | 'B' | 'C' | 'D'

/** Session 结果（Phase 4 完整评定；Phase 1 先落最小结构） */
export interface SessionResult {
  outcome: SessionOutcome
  /** 执行率 = 实际专注 / 目标 */
  executionRate: number
  executionQuality?: ExecutionQuality
  focusDurationMs: number
  distractionDurationMs: number
  deviationCount: number
  recoveryCount: number
  note?: string
}

export interface Session {
  id: string
  missionId: string

  startedAt: number
  endedAt?: number
  status: SessionStatus
  mode: SessionMode

  /** 专注段（有序）；focusDurationMs 由 focusMath 去重合并派生 */
  segments: FocusSegment[]
  focusDurationMs: number
  distractionDurationMs: number

  /** 本 Session 的偏离记录（嵌入，保持 Session→Deviation 结构） */
  deviations: Deviation[]
  deviationCount: number
  recoveryCount: number

  /** 待定的偏离候选（transient 去抖期，未正式成立；成立后清空） */
  pendingDeviation?: PendingDeviation

  /** 执行期干预状态（权威源在 Session，Mission 侧为镜像） */
  interventionLevel: InterventionLevel
  distractedSince?: number

  result?: SessionResult
  createdAt: number
}
