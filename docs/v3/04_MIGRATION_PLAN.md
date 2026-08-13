# V3 · 04 — MIGRATION PLAN（迁移计划）

> 目标：把 `03_TARGET_ARCHITECTURE.md` 落地，**不推倒重写**。
> 方法：在现有 `src/core/discipline/` 上**语义重构 + 职责拆分**，分阶段、可回滚、每阶段可验证。
> 每个 Phase 独立可交付；前一阶段不破坏现有功能。

---

## 0. 迁移总原则

1. **不重写、只拆分**：现有 11 个模块全部保留为起点，改的是"职责边界"，不是"推倒重来"。
2. **不删功能**：XP/PTS/Achievement/Shop/Abyss/Dungeon/Quests/课表/拍照核验 全部保留。
3. **新增先行，收编靠后**：先加 Session/Deviation/Recovery/Result 新能力（加法），最后才收编遗留 classTaskStore（减法最危险，放最后）。
4. **向后兼容**：持久化用 versioned migrate；旧 Mission 数据自动适配新模型。
5. **每阶段可验证**：每 Phase 有明确验证点；CI 编译 + 真机抽测。
6. **单一事实源**：运行时度量逐步只由 Session 持有，Mission 只读派生，杜绝双写。

---

## Phase 总览

| Phase | 内容 | 风险 | 依赖 |
|---|---|---|---|
| **0** | 准备：类型扩展 / 策略配置 / 持久化版本 | 低 | — |
| **1** | 引入 Session，Mission 运行时状态下移 | 中 | 0 |
| **2** | Deviation 模型 + 置信度判定 | 中 | 1 |
| **3** | Recovery 一等公民 + 奖励 | 低 | 2 |
| **4** | ResultEvaluator：三态 + 执行率 + 质量 + TIME/OUTCOME | 中 | 1 |
| **5** | Evidence 重定义 + AI 降权为建议 | 低 | 4 |
| **6** | DayPlan / DailyReview / AI Insight / NextPlan | 中 | 3,4 |
| **7** | 遗留收编：classTaskStore / -50 / Quests 时间轴 | 高 | 1–6 |

---

## Phase 0 — 准备（低风险）

**目标**：为后续阶段铺类型与配置地基，不改运行时行为。

- `types.ts` 新增类型骨架（先定义、暂不使用）：`Session / Deviation / SessionResult / DayPlan / DailyReview`、`DeviationType`、`SessionMode`、`taskType`。
- 新建 `discipline/config.ts`：把散落的阈值收敛成单一策略对象（`LEVEL1/2/3_MS`、`COMPLETION_RATIO`、`EVIDENCE_WEIGHTS`、`CONFIDENCE` 基准、`SHORT_SWITCH_EXEMPT_MS`），各模块从这里读，不再各自硬编码。
- `missionStore` persist `version` 升到 2，加 `migrate`（为 Phase 1 的 Mission 瘦身预留）。
- **验证**：`tsc -b` + build 通过；运行时行为不变。

---

## Phase 1 — 引入 Session，运行时状态下移（核心）

**目标**：Mission=计划、Session=执行；运行时度量归 Session。

1. 新增 `sessionStore.ts`（或在 disciplineStore 内）：`sessions[]`、`currentSessionId`、CRUD、persist。
2. `Mission` 增加 `sessionIds[]`；`actualStudyMs` 变为**从 Session 聚合的派生值**（保留字段做只读镜像，便于现有 UI 不动）。
3. `disciplineEngine` 拆出 **`sessionEngine.ts`**：
   - `startSession(missionId, mode)` → 建 Session(ACTIVE)，原 `startMission` 内部改为"建 Session"。
   - Session 生命周期：`SESSION_STARTED/STOPPED/PAUSED/RESUMED`。
   - `focusIntervals` 写入目标从 Mission 改为**当前 Session**（`addFocusInterval(sessionId,...)`）。
4. 执行期状态（FOCUSING/DISTRACTED/INTERVENTION/RECOVERING）**下移到 Session.status**；Mission 计划级状态收敛为 `PLANNED/ACTIVE/DONE/PARTIAL/ABANDONED`。
5. `runtime.ts` 采样/前台检测：事件带 `sessionId`，只对 ACTIVE Session 累计。
6. **兼容层**：Home/Dungeon/Quests 读"当前任务"的入口改成"当前 Session 的 Mission"；UI 尽量不改（靠派生值）。
7. **Dungeon**：`submitDungeonFocus` 目标改为当前 Session；`mode` 映射 Session.mode（STANDARD/ABYSS）。

**验证**：课表任务→开始→专注→时长正确累计进 Session→Mission 聚合值正确；中途切出不重复计。
**回滚**：Session 层是加法；若异常，UI 仍可读 Mission 派生值。

---

## Phase 2 — Deviation 模型 + 置信度判定

**目标**：把"二元 DISTRACTED"升级为结构化、带置信度的 Deviation。

1. 新增 `deviationStore.ts`：`deviations[]`、CRUD、persist。
2. `disciplineEngine` 拆出 **`deviationAnalyzer.ts`**：
   - 输入：BehaviorEvent + App Category + Session Context + duration。
   - 输出：`Deviation`（type + confidence + trigger）或"豁免"。
   - 规则（读 `config.ts`）：娱乐≥60s→0.9+；社交≥60s→0.7+；浏览器/neutral→0.1–0.3；<10s 豁免；息屏→IDLE。
3. `escalateIntervention` 改为**置信度门控**：`confidence × duration` 决定 LEVEL；低置信不干预。
4. 新增 Deviation type：`LATE_START`（开始晚于 plannedStart）、`EARLY_STOP`、`OVEREXTENSION`。
5. Session 增加 `deviationIds[] / deviationCount`。

**验证**：打开 B 站 10s 不触发；8min 触发且升级；打开 Chrome 不触发强干预；晚开始记 LATE_START。
**回滚**：Deviation 是加法；干预仍可退回纯时长逻辑（config 开关）。

---

## Phase 3 — Recovery 一等公民 + 奖励

**目标**：把"回来"变成正向行为。

1. Session 增加 `recoveryCount`；Deviation `resolvedBy` 记 `USER_RECOVERY`。
2. `disciplineEngine.recoverMission` → 改为 `recoverSession`：记一次 Recovery、resolve 当前 Deviation。
3. `rewardEngine` 新增 `grantRecoveryReward`（小额），在 Recovery 时发放。
4. 干预文案/Home/Dungeon 增加"回来 = 好"的正向叙事。

**验证**：分心后返回记 Recovery 并发小额奖励；recoveryCount 正确。
**风险**：低（纯加法）。

---

## Phase 4 — ResultEvaluator：三态 + 执行率 + 质量 + TIME/OUTCOME

**目标**：完成判定从"80% 二元"升级为"三态 + 执行率 + 质量"。

1. `missionEvaluator.ts` 重构为 **`resultEvaluator.ts`**：
   - `evaluateSession(session)` → `SessionResult{outcome, executionRate, executionQuality, ...}`。
   - outcome：`COMPLETED / PARTIAL / ABANDONED`（不再只有完成/未完成）。
   - executionRate = focus/target；quality = f(rate, deviationCount, recoveryCount, focus占比)。
2. Mission 结果 = 聚合各 Session result → `DONE / PARTIAL / ABANDONED`。
3. 任务类型分流：
   - `TIME_BASED`：时长为主。
   - `OUTCOME_BASED`（requiresEvidence）：走 Evidence/Result Verification；UsageStats 只证明"执行过"。
4. `scheduleToMissions` 生成时定 `taskType`（替代纯正则）；USER/AI 建任务显式指定。
5. `rewardEngine` 奖励按执行率/质量缩放（PARTIAL 给部分，不全扣）。

**验证**：60min 做 48min → PARTIAL/80%/B，不算失败；OUTCOME 任务需证据验收。
**回滚**：config 里保留 `legacy_binary_completion` 开关。

---

## Phase 5 — Evidence 重定义 + AI 降权为建议

**目标**：AI 从"高可信证据"降为"解释/建议 + 用户确认"。

1. `config.ts` 证据权重：`usageStats 1.0 / photo 0.8 / screenshot 0.7 / manual 0.5 / ai 0.3`。
2. `aiSupervisor.aiJudgeEvidence` 改为产出 **Verification Recommendation**（建议 + 理由），**不直接 attach 高权证据**。
3. 增加 **User Confirmation** 步骤：AI 建议 → 用户确认 → 才计入最终 Evidence Score（UI 在 Quests/Dungeon 证据流）。
4. OUTCOME_BASED 任务的验收流程接入该 recommendation + confirmation。

**验证**：AI 不再单独决定完成；用户确认后证据才生效。
**风险**：低（权重可配，先降权后加确认 UI）。

---

## Phase 6 — DayPlan / DailyReview / AI Insight / NextPlan

**目标**：补上闭环的"一天"与"改进"环节。

1. `dayPlanStore.ts`：`DayPlan{date, missionIds, source, status}`；`scheduleToMissions` 把当日 Mission 归入 DayPlan；支持"确认承诺（COMMITTED）"。
2. `dailyReview.ts`：一天结束聚合 Session/Deviation/Recovery → `DailyReview{totalFocus, deviationCount, recoveryCount, onTrackRate, executionPattern}`。
3. `aiSupervisor` 扩展 **AI Insight**：读多日 DailyReview，产出模式洞察（"你 19:00 后易分心""数学恢复率高"）。
4. **Next Day Plan**：AI 基于洞察建议次日 DayPlan（调时段/时长/任务类型），用户确认 → 生成。
5. 新增 **Review 页面**（或并入 Stats）展示 DailyReview + AI Insight。

**验证**：一天结束生成 Review；多日后 AI 给洞察；确认后生成次日计划。
**依赖**：Phase 3/4 的 Session/Result 数据。

---

## Phase 7 — 遗留收编（最后、最谨慎）

**目标**：消除并行系统，统一任务/发奖口径。

1. **课程打卡 → Mission/Session**：Quests 时间轴的 `ClassTask` 收编为 Mission（拍照核验变为 OUTCOME 任务的 Evidence）。保留拍照 + 二号 AI 能力。
2. **移除 -50 惩罚**：`updateMonitorState` 的"娱乐>学习→-50"改为非惩罚性记录/提醒（Recovery>Punishment）。
3. **统一当前任务指针**：废弃 `classTaskStore.currentTask`，唯一用 `missionStore/sessionStore`。
4. **main.monitorUsage 收编**：全天 XP 增量改为 DailyReview 输入或并入 RewardEngine；消除与 runtime 采样的双口径。
5. **Quests 统一**：课程时间轴与动态 Mission 合并为统一 Mission 列表/时间轴。
6. 保留 `abyssRecords`、成就判定、历史记录（迁移数据源到 Session/Result）。

**风险**：高（触及遗留数据与用户既有进度）。**策略**：逐项灰度 + 数据迁移脚本 + 充分真机回归；任一项异常可单独回退。

---

## 数据迁移与持久化

- **versioned migrate**：`missionStore`/新 store 均用 zustand persist `version + migrate`，旧数据平滑升级。
- **旧 Mission 适配**：已有 Mission 无 sessionIds → migrate 时按现有 focusIntervals 反推出一个"历史 Session"（保留时长数据）。
- **classTaskStore 数据**：Phase 7 前**不动**；收编时提供一次性映射（ClassTask → Mission + Evidence）。
- **Android 镜像**：MissionMirror 仍只存最小镜像；如需 Session 感知，评估是否扩展镜像字段（倾向不加，保持 Android 轻量）。

---

## 每阶段验证基线

| 层 | 手段 |
|---|---|
| 编译 | `tsc -b` + `vite build` 本地通过 |
| 单元 | focusMath / resultEvaluator / deviationAnalyzer 关键用例（node 直测） |
| Android | CI `gradlew assembleDebug` 编译（Kotlin 改动） |
| 真机 | 每 Phase 出 APK 抽测对应场景 |

---

## 需要用户拍板的开放问题（执行前确认）

1. **Session 切分粒度**：分心后回来，是"延续原 Session"还是"开新 Session"？（倾向：短暂偏离延续、长偏离开新段，但都归同一 Mission。）
2. **Execution Quality 评级曲线**：A/B/C/D 的阈值如何定（如 rate≥0.9 且偏离≤1 = A）？
3. **Recovery 奖励额度**：每次恢复给多少 PTS/XP？是否设每日上限防刷？
4. **OUTCOME 任务的验收**：是否强制"AI 建议 + 用户确认"，还是允许纯拍照？
5. **-50 惩罚**：Phase 7 直接移除，还是改为"记录但不扣分"？
6. **DayPlan 承诺**：是否要求用户每天显式"确认今日计划"，还是自动 COMMITTED？
7. **遗留收编节奏**：Phase 7 是否拆成多个小版本灰度，还是一次性？

> 建议：先执行 **Phase 0–1**（地基 + Session 拆分），跑通后再推进后续 Phase。每个 Phase 完成后我给一次进度与真机验证点。
