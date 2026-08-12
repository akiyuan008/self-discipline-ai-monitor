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
}

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
