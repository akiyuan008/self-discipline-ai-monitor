# V3 · 03 — TARGET ARCHITECTURE（目标架构）

> 本文定义 V3 的**目标状态**：数据模型、模块职责、执行闭环。
> 原则：**在现有 `src/core/discipline/` 上做语义重构与职责拆分，不推倒重写。**
> 落地步骤见 `04_MIGRATION_PLAN.md`。

---

## 0. V3 最高产品原则：自律执行闭环

```
DAY PLAN          今天计划做什么
  ↓
MISSION           每个执行目标（计划对象）
  ↓
SESSION           每次实际执行（一次专注会话）
  ↓
BEHAVIOR EVENTS   执行期间用户实际做了什么（事实）
  ↓
DISCIPLINE ANALYSIS  Engine 分析行为 vs 承诺
  ↓
ON TRACK / DEVIATION   在轨 or 偏离（带置信度）
  ↓
INTERVENTION      按置信度×时长分级干预
  ↓
RECOVERY          用户主动回到任务（正向行为，奖励）
  ↓
SESSION RESULT    这次执行最终如何（三态 + 质量）
  ↓
REWARD            对"可靠执行行为"给反馈
  ↓
DAILY REVIEW      今天的执行模式是什么
  ↓
AI INSIGHT        基于长期行为帮用户改进
  ↓
NEXT DAY PLAN     生成/建议次日计划
```

**核心思想（语义边界）：**

| 概念 | 含义 | 关键区别 |
|---|---|---|
| Mission | 我**计划**完成什么 | 计划对象，不背运行时状态 |
| Session | 我**此刻实际**在执行什么 | 一次执行，一个 Mission 可有多个 |
| Behavior | 我**实际**做了什么 | 只有事实 |
| Deviation | 我**何时偏离**了承诺 | 带 type/confidence/trigger |
| Recovery | 我**是否主动回来** | 正向行为 |
| Result | 这次执行**最终如何** | 三态 + 执行率 + 质量 |
| Reward | 对**可靠执行**的反馈 | 不只奖"完成"，也奖"恢复" |
| Review | 今天的**执行模式** | 结构化日度复盘 |
| AI | 帮用户**改进计划** | 解释/建议，不是真相源 |

---

## 1. Mission 重定义（保留对象，剥离运行时）

Mission 变成**"计划中的一个执行目标"**，不再承担运行时状态：

```ts
interface Mission {
  // ── 身份与计划（保留）──
  id: string
  title: string
  description?: string
  subject?: string
  source: 'SCHEDULE' | 'USER' | 'AI'
  createdBy?: 'SYSTEM' | 'USER' | 'AI'
  plannedStart: number
  plannedEnd: number
  targetMinutes: number

  // ── 任务类型（V3 新增，见 §6）──
  taskType: 'TIME_BASED' | 'OUTCOME_BASED'
  requiresEvidence: boolean            // OUTCOME_BASED → true
  evidenceRequirement?: string         // 结果型任务的验收描述（如"完成第三章习题"）

  // ── 状态与优先级 ──
  status: MissionStatus                // 计划级状态（收敛，见下）
  priority: 'low' | 'normal' | 'high'

  // ── 关系（V3 新增）──
  sessionIds: string[]                 // 该 Mission 的所有 Session
  dayPlanId?: string                   // 属于哪个 DayPlan

  createdAt: number
  completedAt?: number
}
```

**Mission 计划级状态（收敛）：**
`PLANNED`（已排程）→ `ACTIVE`（当前有 Session 在跑）→ `DONE` / `PARTIAL` / `ABANDONED`。
> 执行期的 FOCUSING/DISTRACTED/INTERVENTION/RECOVERING **下移到 Session**。Mission 不再直接持有 `actualStudyMs/focusIntervals/interventionLevel/distractedSince`——这些变成"从 Session 聚合出来的只读派生值"。

**Mission 完成度派生：** `actualStudyMs = Σ session.focusDurationMs`（跨 Session 聚合，仍走 focusMath 去重）。

---

## 2. Session（V3 核心新增）

一次"实际执行会话"。一个 Mission 可有多个 Session（分心后回来 = 新 Session 或延续，见 §4）。

```ts
interface Session {
  id: string
  missionId: string
  dayPlanId?: string

  startedAt: number
  endedAt?: number
  status: 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'DEVIATED' | 'RECOVERING'
        | 'COMPLETED' | 'ABANDONED'
  mode: 'STANDARD' | 'ABYSS'

  // ── 运行时度量（V3 从 Mission 移到这里）──
  focusDurationMs: number
  distractionDurationMs: number
  focusIntervals: FocusInterval[]      // 本 Session 的证据区间
  deviationIds: string[]               // 本 Session 的偏离记录
  deviationCount: number
  recoveryCount: number

  result?: SessionResult
  createdAt: number
}
```

**Session Mode：**
- `STANDARD`：普通专注。
- `ABYSS`：深渊（高压、退出记失败记录、更高奖励），规则集中到一个策略处。

**多 Session 示例（用户给的场景）：**
```
Mission 数学 18:00–19:00
  Session 1: 18:03–18:25  (focus 22min)
    Deviation: 18:25–18:30 (DISTRACTION, 5min)
    Recovery:  18:30 用户返回
  Session 2: 18:30–18:55  (focus 25min)
  → Mission actualStudyMs = 47min → 仍可 DONE（不因中途偏离判失败）
```

---

## 3. BehaviorEvent（原则不变，补充事件类型）

**不变的原则：** BehaviorEvent 只描述事实；不加 XP、不加分、不判完成、不判"懒惰/失败"。业务判断由 Engine 做。

```ts
type BehaviorEventType =
  | 'APP_FOREGROUND' | 'APP_BACKGROUND'
  | 'SCREEN_ON' | 'SCREEN_OFF'
  | 'USAGE_SAMPLE'
  | 'SESSION_STARTED' | 'SESSION_STOPPED'      // V3：原 MISSION_STARTED/STOPPED 改名
  | 'SESSION_PAUSED' | 'SESSION_RESUMED'        // V3 新增
```

事件携带：`ts / packageName? / appCategory? / sessionId? / studyMs? / distractionMs? / windowStart?`。

---

## 4. Deviation 模型（V3 核心新增）

```ts
type DeviationType =
  | 'DISTRACTION'      // 被娱乐/社交吸引
  | 'IDLE'             // 无明确 App 的放空/息屏
  | 'LATE_START'       // 晚于 plannedStart 才开始
  | 'EARLY_STOP'       // 提前放弃
  | 'OVEREXTENSION'    // 过度延长（如学到不收）

interface Deviation {
  id: string
  sessionId: string
  type: DeviationType
  startedAt: number
  endedAt?: number
  durationMs: number
  confidence: number        // 0–1，见 §5 置信度
  trigger: string           // 如 "打开 tv.danmaku.bili" / "浏览器搜索" / "无操作 3min"
  resolvedAt?: number
  resolvedBy?: 'USER_RECOVERY' | 'INTERVENTION' | 'TIMEOUT' | 'AUTO'
}
```

**Deviation 必须带上下文**（判定输入，见 §5）：
- 是否存在 Active Session
- 当前 Mission 是什么（subject / taskType）
- App Category（study/ent/social/neutral）
- 持续时间（10 秒 vs 8 分钟）
- 是否短暂切换（<阈值直接豁免）
- 用户是否主动返回
- 是否 Abyss Mode
- Confidence

> **反例纠正：** "打开 Bilibili 10 秒"不判严重分心；"打开 Bilibili 8 分钟"才形成高置信 Deviation。"打开 Chrome"confidence≈0.1，不触发强干预。

---

## 5. Confidence 与"可能偏离"判定

UsageStats 只是 **Behavior Signal**。判定链：

```
UsageStats(用户在哪个 App)
  → App Category
  → Behavior Signal
  → Current Session Context（Mission 是什么、mode、已执行多久）
  → Discipline Engine
  → 输出"可能 Deviation" + confidence
```

**置信度基准（可在策略配置调）：**

| 触发 | 基准 confidence |
|---|---|
| 明确娱乐 App（bili/抖音/游戏）持续 ≥60s | 0.9–0.95 |
| 社交 App 持续 ≥60s | 0.7–0.85 |
| 浏览器 / neutral 工具 | 0.1–0.3（context-dependent，不直接判分心） |
| 短暂切换 <10s | 豁免，不形成 Deviation |
| 息屏 / 无操作 | IDLE，confidence 随时间升 |

**原则：不要因为不确定而惩罚用户。**

---

## 6. TIME-BASED vs OUTCOME-BASED（任务类型）

| 类型 | 例子 | 完成依据 |
|---|---|---|
| `TIME_BASED` | "专注阅读 45min" | UsageStats + Focus Session 时长为主 |
| `OUTCOME_BASED` | "完成第三章习题" | `requiresEvidence=true`，走 Evidence/Result Verification；UsageStats 只证明"执行过"，不证明"做完" |

- `scheduleToMissions` 生成时按科目/描述判定 taskType（替代现有纯正则 needsEvidence）。
- USER/AI 创建 Mission 时显式指定 taskType。

---

## 7. Intervention（保留等级，叠加置信度门控）

保留 LEVEL 1/2/3 + 锁屏遮罩执行手段，但**触发条件 = confidence × 持续时长**：

| 条件 | 动作 |
|---|---|
| 高置信(娱乐) 持续 60s | LEVEL 1 提醒 |
| 高置信 持续 5min | LEVEL 2 强提醒 + 遮罩（可恢复） |
| 高置信 持续 15min | LEVEL 3 强制恢复模式 |
| 低置信(浏览器/未知) 30s | **不干预** |

**Recovery > Punishment** 不变：第一次分心只提醒不扣分；干预目的始终是帮用户回来。

---

## 8. Recovery（V3 一等公民）

```
18:30 打开娱乐 App → 18:34 检测到 Deviation → 18:35 用户主动返回
→ 记录 RECOVERY（resolvedBy=USER_RECOVERY）→ 给少量 Reward
```

- `recoveryCount` 记在 Session。
- RewardEngine 新增 **Recovery Reward**（小额，强化"回来"这个动作）。
- 产品叙事：**自律不是"永远不分心"，而是"分心后能回到轨道"。**

---

## 9. Session Result（Completion ≠ Execution Quality）

```ts
interface SessionResult {
  outcome: 'COMPLETED' | 'PARTIAL' | 'ABANDONED'
  executionRate: number       // 实际专注 / 目标，如 0.80
  executionQuality: 'A' | 'B' | 'C' | 'D'   // 综合偏离/恢复/专注度
  focusDurationMs: number
  distractionDurationMs: number
  deviationCount: number
  recoveryCount: number
  note?: string
}
```

- **不再"80% 就 Completed"一刀切**：
  - 60min 目标做 48min → `outcome=PARTIAL, executionRate=0.80, quality=B`，**不是失败**。
  - Mission 级汇总各 Session 的 result 得到 Mission 结果（DONE/PARTIAL/ABANDONED）。
- Execution Quality 由"执行率 + 偏离次数 + 恢复情况 + 专注占比"综合评定（策略可配）。

---

## 10. Reward（统一发放，扩展到执行行为）

仍由 **RewardEngine 唯一发放**（页面/Android/AI 不直接发奖），但奖励维度扩展：

| 奖励项 | 触发 |
|---|---|
| Session/Mission 完成 | 基础 PTS + XP（按执行率/质量缩放，而非全有全无） |
| **Recovery** | 每次主动恢复给小额奖励 |
| 高专注（低偏离） | 加成 |
| 深渊挑战（ABYSS mode） | +400 PTS（保留，经 RewardEngine） |
| OUTCOME 任务通过 Evidence 验收 | 结果奖励 |

- 奖励**与执行质量挂钩**（PARTIAL 也给部分奖励，不全扣）。
- 移除遗留 -50 惩罚（改为非惩罚性提醒/记录）。

---

## 11. Evidence 重定义（AI 降权为"解释"）

保留五类证据，**重新定义权重与 AI 角色**：

| 类型 | 权重 | 说明 |
|---|---|---|
| usageStats | 1.0 | 行为监测（时间型任务主依据） |
| photo | 0.8 | 照片凭证 |
| screenshot | 0.7 | 截图凭证 |
| manual | 0.5 | 用户自述 |
| **ai** | **≈0.3**（或不进最终分） | **Interpretation，不是 Truth Source** |

**AI 的新角色（推荐流程）：**
```
AI 分析（照片/描述）→ Verification Recommendation（建议通过/不通过 + 理由）
  → User Confirmation（用户确认）→ 才计入最终 Evidence Score
```
即 AI 给"建议"，最终由用户确认；AI 不再以 0.9 权重直接决定完成。

---

## 12. Day Plan / Daily Review / AI Insight / Next Plan

```ts
interface DayPlan {
  id: string
  date: string
  missionIds: string[]
  source: 'AUTO_SCHEDULE' | 'USER' | 'AI_SUGGESTED'
  status: 'DRAFT' | 'COMMITTED' | 'REVIEWED'
  createdAt: number
}

interface DailyReview {
  date: string
  missions: MissionSummary[]      // 每个 Mission 的 result 汇总
  totalFocusMs: number
  totalDistractionMs: number
  deviationCount: number
  recoveryCount: number
  onTrackRate: number             // 在轨时长占比
  executionPattern: string        // 结构化"今日执行模式"
}
```

- **DAY PLAN**：每天把 SCHEDULE Mission + USER/AI Mission 归入一个 DayPlan，用户可"确认承诺（COMMITMENT）"。
- **DAILY REVIEW**：一天结束时聚合 Session/Deviation/Recovery，产出结构化执行模式。
- **AI INSIGHT**：AI 读取多日 DailyReview，给出"你通常在 19:00 后分心""数学任务恢复率高"等洞察。
- **NEXT DAY PLAN**：AI 基于洞察建议次日计划（调整时段/时长/任务类型），用户确认后生成 DayPlan。

> AI 在这里是**长期行为分析器 + 计划建议器**，而不只是干预瞬间的一句话。

---

## 13. 模块职责映射（现有 → V3）

| 现有模块 | V3 职责 | 改动性质 |
|---|---|---|
| `types.ts` | Mission 瘦身 + 新增 Session/Deviation/SessionResult/DayPlan/DailyReview | **扩展** |
| `disciplineEngine.ts` | 拆出 SessionEngine（管 Session 生命周期）+ DeviationAnalyzer（置信度判定）；保留 handleEvent 入口 | **职责拆分** |
| `missionEvaluator.ts` | 变 ResultEvaluator：三态 outcome + executionRate + quality；TIME/OUTCOME 分流 | **语义重构** |
| `rewardEngine.ts` | 扩展 Recovery/质量缩放/OUTCOME 验收奖励 | **扩展** |
| `runtime.ts` | 采样/前台检测保留，事件带上 sessionId；接入 Session 生命周期 | **适配** |
| `missionStore.ts` | 新增 sessionStore / deviationStore / dayPlanStore（或合并为 disciplineStore） | **拆分/扩展** |
| `aiSupervisor.ts` | 增加 DailyReview 洞察 + NextPlan 建议；AI 证据降为 recommendation | **扩展 + 降权** |
| `appCategories.ts` | neutral/浏览器语境标注；分类增加 contextHint | **细化** |
| `scheduleToMissions.ts` | 生成时定 taskType；归入 DayPlan | **扩展** |
| `focusMath.ts` | 不变（Session 时长去重基础） | **保留** |
| `classTaskStore` / `main.monitorUsage` | 收编：课程打卡→Mission/Session；移除 -50；全天统计转 Review 输入 | **收编（最后阶段）** |

---

## 14. App Category（保留四类 + 语境）

保留 `study / entertainment / social / neutral`，但明确：
- **neutral ≠ distraction**；浏览器/工具默认 neutral + `contextDependent=true`。
- 分类 JSON 增加可选 `contextHint`（如 `"search"` / `"reference"`），供 DeviationAnalyzer 给低置信。
- 收紧 `keywords.entertainment`，避免把浏览器/工具误判为娱乐。
- Android 仍构建时消费同一份 JSON（SSOT 不变）。

---

## 15. V3 目标态数据流（全景）

```
DayPlan（今日承诺）
  → Mission[]（计划目标）
     → 用户开始 → Session(ACTIVE)
        → BehaviorEvents（APP_FOREGROUND / USAGE_SAMPLE / SCREEN_*）
           → DeviationAnalyzer（category + context + duration → confidence）
              ├─ ON TRACK → 累计 focusIntervals
              └─ DEVIATION(confidence) → Intervention(L1/L2/L3 门控)
                    → 用户返回 → Recovery(+reward) → Session(RECOVERING→ACTIVE)
        → Session 结束 → ResultEvaluator → SessionResult(三态+率+质量)
  → 一天结束 → DailyReview（聚合执行模式）
     → AI Insight（多日分析）→ Next DayPlan（建议）→ 用户确认 → 新 DayPlan
奖励：RewardEngine 在 Session/Mission 完成、Recovery、OUTCOME 验收处统一发放
```

---

## 16. V3 明确不做（护栏）

- ❌ 不删除任何现有功能（Mission/XP/PTS/Achievement/Shop/Abyss/Dungeon/Quests/课表/拍照核验）。
- ❌ 不推倒重写 `src/core/discipline/`——只做语义重构与职责拆分。
- ❌ 不让 BehaviorEvent 直接发奖/判完成/判"懒惰"。
- ❌ 不让"打开娱乐 App = 立即失败"或"没到 100% = 失败"。
- ❌ 不让 AI 成为高可信客观证据（降为解释/建议 + 用户确认）。
- ❌ 不因不确定的行为（低置信）惩罚用户。
