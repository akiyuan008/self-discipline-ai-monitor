# Phase 10 设计方案 — Domain Closure（消灭 Course Legacy 与 V3 Core 的最后双事实来源）

> 状态：**设计待确认，未动代码**。确认后按 10A → 10B → 10C 逐段执行，每段完成即暂停。
> 定位：Phase 10 是 **Legacy Closure 的最后一个大阶段**。10C 后做全仓库 SoT 审计，再决定是否需要 Phase 11（不为架构完美而重构）。

---

## 0. 目标与范围

消灭 Course Legacy 与 V3 Core 之间的**最后双/三事实来源**，使以下五者成为唯一 SoT：

```
Mission · Session · Evidence · Verification · ResultEvaluator · RewardEngine
```

CourseTask 最终只保留**课程领域 Metadata / Adapter**（subject / period / 时间 / baseReward 等展示与生成所需），不再持有 completion / photo-verification / reward 任何 truth。

**已确认的两项 Phase 9 债务（本阶段偿还）：**
- 新课程核验失败不落 REJECTED Evidence（10B 偿还）
- Course 奖励未统一到 RewardEngine（10A 偿还）

---

## 1. 现状：双事实来源的实证（代码已核对）

当前一次"课程拍照核验通过"会触发**三重奖励发放**：

| # | 位置 | 发放内容 | 事实来源 |
|---|---|---|---|
| 1 | `Quests.handleTakePhoto` | `addPoints(totalReward)` + `addPointRecord('earn')` | 课程 PTS（baseReward+bonus） |
| 2 | `classTaskStore.completeClassTask` | `addXp(xpGain)` + `lastPointsChange` | 课程 XP（+50/+30） |
| 3 | `submitCoursePhotoEvidence → tryComplete → grantMissionReward` | RewardEngine 再发 PTS+XP | V3 Core 奖励 |

完成事实也有两份：
- `ClassTask.status='completed'`（legacy，Phase 8 视图仍读它）
- `Mission.status='COMPLETED'`（V3，ResultEvaluator 产出）

**Phase 10 就是把 #1/#2 的发放与 ClassTask 的 completion truth 全部收归 RewardEngine / Mission。**

---

## 2. Phase 10A — Reward Unification

### 2.1 目标数据流
```
completeClassTask
   → (Phase 9 已接) submitCoursePhotoEvidence → Evidence + Verification
   → tryComplete → ResultEvaluator(canComplete)
   → RewardEngine.grantMissionReward（课程规则）   ← 唯一发奖点
   → RewardTransaction（幂等记录）
```
`classTaskStore` / `Quests` **不再**调用 addPoints / addXp / addPointRecord 发放课程奖励；`completeClassTask` 只更新 ClassTask 展示态（status 供 Phase 8 视图过渡用，10C 再去）。

### 2.2 RewardTransaction 模型（新增 rewardStore.ts）
```ts
export type RewardKind =
  | 'MISSION_COMPLETE' | 'RECOVERY' | 'MISSED_PENALTY' | 'COURSE_COMPLETE'

export interface RewardTransaction {
  id: string              // 确定性幂等键（见 2.3）
  missionId?: string
  sessionId?: string
  kind: RewardKind
  points: number
  xp: number
  reason: string
  ts: number
}
```
`rewardStore`：`transactions[]` + `hasReward(id)` + `recordReward(txn)` + `getRewardsByMission(missionId)`，zustand persist。

### 2.3 幂等策略（防双发核心）
- **确定性幂等键**（不用随机 id）：
  - Mission 完成：`mission-complete-${missionId}`（一个 Mission 只发一次完成奖）
  - Recovery：`recovery-${sessionId}-#${recoveryCount}`（每次恢复一笔）
  - Missed 惩罚：`missed-${missionId}`
- `RewardEngine` 所有发放前先 `rewardStore.hasReward(id)`：已存在 → 返回 `{ alreadyIssued:true }` 并**不再调 callback**；否则发放并 `recordReward`。
- 这样即使 `tryComplete` 被多次触发、或迁移期新旧路径并存，也不会双发。

### 2.4 课程奖励规则迁入 RewardEngine
课程完成奖不再用通用 `basePoints=targetMinutes`，改用**课程规则**（从 legacy 平移，金额不变）：
- `basePoints = SCHEDULE.baseReward(subject,period)` + on-time `+15`（完成于下课时刻前）+ `aiScore≥80 → +25`
- `xp = 50`，`aiScore≥90 → +30`
- 判定为课程 Mission：`source==='SCHEDULE' && requiresEvidence===true`
- `grantMissionReward` 内部分流：课程 → 课程规则；其余 → 现有通用规则；统一经 RewardTransaction 幂等。
- `aiScore` 从该 Mission 的 `VerificationRecommendation.confidence×100` 读取；`baseReward/on-time` 由 subject+period 查 SCHEDULE。

### 2.5 移除的 legacy 发放点
- `Quests.handleTakePhoto`：删除 `addPoints(reward)` + `addPointRecord('earn', reward)`（保留 completeClassTask 调用以更新展示态，但其不再发奖）。
- `classTaskStore.completeClassTask`：删除 `addXp(xpGain)` 与 `lastPointsChange` 的金额写入（改为不发奖；如需提示由 RewardEngine 的通知/toast 承担——见风险 R3）。

---

## 3. Phase 10B — Rejected Evidence

### 3.1 目标数据流
```
新课程照片核验失败
   → Photo（weight=0, refId=classTaskId）
   → Verification（AI Recommendation, status=REJECTED）
   → 落到 Mission.evidence + recommendations
   （不改变 Mission 完成态；REJECTED Evidence ≠ ABANDONED）
```

### 3.2 关键语义
- **REJECTED Evidence ≠ Mission ABANDONED**：一次核验失败只是"这条证据被拒"，Mission 仍可继续（重拍、或后续 VERIFIED）。
- **同一 Mission 可有多条 Evidence**：`REJECTED + VERIFIED` 并存。`ResultEvaluator` 依据**最新/有效**证据判定：存在 ACCEPTED photo（或客观分达标）→ 可完成；仅有 REJECTED → 不可完成但**不是** ABANDONED。
- 复用 Phase 9 `buildCoursePhotoEvidence`（aiPassed=false → weight0 + REJECTED），无需新模型。

### 3.3 改动点
- `Quests.handleTakePhoto` 失败分支：不再仅 `return`，改为调用一个新的 `submitRejectedCoursePhotoEvidence(task, photoPath, aiScore, aiReview)`（内部走 `buildCoursePhotoEvidence(aiPassed=false)` + 写入 Mission，**不 tryComplete**）。
- 该函数放 `courseEvidence.ts`（与 submitCoursePhotoEvidence 并列），幂等键区分：同一 classTaskId 的**最近一次**结果覆盖（见 3.4）。
- `ResultEvaluator` 不变（已能处理 REJECTED 不计客观分）。

### 3.4 幂等与"重拍覆盖"
- 一次核验 = 一条 photo evidence + 一条 recommendation，`refId=classTaskId`。
- 用户**重拍**会产生新核验：设计为"追加新证据 + 新 recommendation"，ResultEvaluator 取**最新 ACCEPTED** 判定。旧的 REJECTED 保留作审计轨迹。
- 幂等防的是**同一次核验重复落库**（用 `photo-${classTaskId}-${ts}` 或 recommendation.id 去重），不是阻止重拍。

---

## 4. Phase 10C — CourseTask Retirement

### 4.1 目标
CourseTask 不再维护 completion / photo-verification / reward truth，只保留**课程 Metadata/Adapter**：
- 保留：`subject / period / dayOfWeek / startTime/endTime / difficulty / baseReward`（供 generateTodayMissions、展示、奖励计算）。
- 退役：`status`（completion truth）→ 由 `Mission.status` 承载；photo/verify truth → 由 `Evidence/Verification` 承载；reward truth → 由 `RewardTransaction` 承载。

### 4.2 视图切换（Phase 8 统一视图收口）
- `unifiedMissionView.deriveViewStatus` 目前**优先读 classTask.status**（legacy 兼容）。10C 改为：**课程项完成态读 Mission.status / Evidence**，不再读 classTask.status。
- `ClassHistory` 的课程完成/核验展示改读 Mission + Evidence + RewardTransaction（或保留读 taskHistory 作历史归档，视审计结论）。

### 4.3 CourseTask 最终形态（两种选择，10C 时定）
- **方案甲（保留 Adapter）**：classTaskStore 仅存课程元数据 + 生成 Mission，不再有 status 语义；Quests 课程项完全走 MissionView。
- **方案乙（彻底移除）**：删除 ClassTask/completeClassTask，课程完全由 SCHEDULE→Mission 表达，Quests 只认 MissionView。改动大，风险高。
- **建议甲**（风险低、可回退），乙列为可选后续。

---

## 5. 依赖关系

```
10A（Reward 统一 + RewardTransaction）
   └─> 10B（Rejected Evidence；依赖 10A 的"奖励只走 RewardEngine"前提，避免失败分支误发奖）
          └─> 10C（CourseTask 退役；依赖 10A/10B 已把 completion/photo/reward truth 全部迁出）
```
- 10A 必须先做：它是幂等发放的地基；10B/10C 都假设奖励已统一。
- 10B 依赖 10A：失败分支落 REJECTED 时绝不能触发发奖。
- 10C 依赖 10A+10B：退役 CourseTask truth 前，确认 Mission/Evidence/RewardTransaction 已完整承接。

---

## 6. 迁移风险与回滚

| # | 风险 | 缓解 |
|---|---|---|
| R1 | 迁移期**双发**（legacy 与 RewardEngine 并存） | RewardTransaction 确定性幂等键；10A 一次性移除 legacy 发放点，不留并行 |
| R2 | 今日已完成课程**已双发**（Phase 9 引入），无法追回 | 明确为既成事实；10A 起幂等保证不再新增双发；可选：迁移时对今日已发课程打标记防再发 |
| R3 | 移除 `lastPointsChange` 后，App 顶部积分变动提示消失 | RewardEngine 发放时产出等价提示事件（由 UI 订阅），保持体验 |
| R4 | 10C 切换视图读 Mission.status，历史课程无 Mission 导致显示异常 | 仅当日/有 Mission 的走新路径；历史保留 taskHistory 归档展示 |
| R5 | REJECTED 重拍产生多条证据，ResultEvaluator 误判 | ResultEvaluator 明确取"最新 ACCEPTED"；测试覆盖 REJECTED+VERIFIED 混合 |

**回滚策略**：每个子阶段独立提交；RewardTransaction 是纯增量存储，回滚只需还原发放调用点，不影响已有数据。

---

## 7. 数据迁移方案

- **10A**：
  - 新增 `rewardStore`（persist，version 1）。
  - 一次性迁移钩子：遍历**当日** `classTasks` 中 `status==='completed'` 且已有对应 Mission 的项，写入 `COURSE_COMPLETE` RewardTransaction（幂等键 `mission-complete-${missionId}`）标记"已发奖"，防止 RewardEngine 再次发放。（历史天无 Mission，不涉及。）
  - 不改动历史 `taskHistory`（归档保留）。
- **10B**：无存量迁移（只影响新核验）；可选回填：把历史 `verifyHistory` 中 `passed=false` 的记录补成 REJECTED Evidence（幂等，默认**不做**，除非要求）。
- **10C**：无数据迁移（CourseTask 退役是读取路径切换）；`taskHistory`/`verifyHistory` 作为历史归档保留。

---

## 8. 幂等策略汇总

| 场景 | 幂等键 | 效果 |
|---|---|---|
| Mission 完成奖 | `mission-complete-${missionId}` | 一个 Mission 只发一次完成奖 |
| Recovery 奖 | `recovery-${sessionId}-#${n}` | 每次恢复一笔，防重复 |
| Missed 惩罚 | `missed-${missionId}` | 只罚一次 |
| Course photo 证据 | `refId=classTaskId`（+ 最近覆盖） | 同次核验不重复落库；重拍追加 |
| Course 迁移防双发 | `mission-complete-${missionId}` 预标记 | 已完成课程不再被 RewardEngine 重发 |

---

## 9. 测试矩阵（规划）

**10A Reward 统一**
- A1 课程完成 → 仅 RewardEngine 发一次课程奖励（baseReward+bonus+XP），金额与 legacy 规则一致
- A2 重复触发 tryComplete → RewardTransaction 幂等，不双发
- A3 非课程 Mission 完成 → 通用规则（basePoints=targetMinutes）不变
- A4 Quests/classTaskStore 不再调用 addPoints/addXp（静态检查 + 运行时断言）
- A5 迁移钩子：今日已完成课程被预标记，RewardEngine 不再重发

**10B Rejected Evidence**
- B1 新核验失败 → 生成 REJECTED Evidence + REJECTED recommendation，Mission 不变完成态
- B2 REJECTED ≠ ABANDONED（missionOutcome 不因 REJECTED 变 ABANDONED）
- B3 同 Mission REJECTED 后重拍 VERIFIED → ResultEvaluator 判可完成
- B4 同次核验不重复落库（幂等）

**10C CourseTask 退役**
- C1 统一视图课程完成态读 Mission.status（不再读 classTask.status）
- C2 ClassTask 无 completion/photo/reward truth 字段依赖（静态检查）
- C3 历史课程展示不回归（taskHistory 归档仍可读）

**回归**：124 项既有测试全绿 + 新增项；tsc + vite build；CI APK。

---

## 10. 10C 之后：全仓库 SoT 审计（决定是否需 Phase 11）

10C 完成后执行一次审计，逐项确认唯一 SoT：
- 当前任务指针：仅 `missionStore.currentMissionId`？（排查 classTaskStore.currentTask 残留）
- 完成事实：仅 `Mission.status`（ResultEvaluator）？
- 证据/核验：仅 `Evidence`/`VerificationRecommendation`？
- 奖励：仅 `RewardTransaction`（RewardEngine）？
- 专注时长：仅 `Session.segments`/`actualStudyMs`（focusMath 去重）？
- 分类：仅 `config/appCategories.json`？
审计输出"每个领域事实的唯一来源 + 残留引用清单"，据此判断是否**真正必要**的 Phase 11；不为架构完美而重构。

---

> **请确认本设计方案。** 确认后我从 **10A（Reward Unification）** 开始，完成即暂停等你验收，再进 10B。
