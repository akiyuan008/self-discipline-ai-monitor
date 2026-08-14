# Phase 10A 详细设计 — Reward Unification（含测试规格）

> 状态：**设计 + 测试规格待确认，未改产品代码**。确认后实施。
> 上游依据：`PHASE10_DESIGN.md` §2。本档细化 10A 的数据模型、幂等、迁移 marker、测试矩阵。
> 已确认决策：10C 方案甲；R2 接受今日双发既成事实，但必须记 reconciliation marker（`LEGACY_ACCEPTED`），不修改现有 PTS/XP。

---

## 1. 核心原则（本阶段硬约束）

1. **Legacy Reward → 停止新增**：`Quests` / `classTaskStore` 不再发放课程 PTS/XP。
2. **RewardEngine → 唯一新增奖励来源**。
3. **幂等基于稳定 eventId/sourceId**，**绝不**依据当前 PTS/XP 余额判断是否已发。
4. **Migration 识别既有 Legacy Reward**，避免 `Legacy + RewardEngine + Migration` 三次发放。
5. **今日双发 = 历史事实**：不追回、不扣回、不惩罚性回滚；仅记 marker。

---

## 2. RewardTransaction 数据模型（rewardStore.ts，新增）

```ts
export type RewardKind = 'MISSION_COMPLETE' | 'RECOVERY' | 'MISSED_PENALTY' | 'COURSE_COMPLETE'
export type RewardSourceType = 'REWARD_ENGINE' | 'LEGACY_COURSE'
export type MigrationStatus = 'LEGACY_ACCEPTED' | 'MIGRATED' | 'NONE'

export interface RewardTransaction {
  /** 稳定幂等键（由 eventId 派生，见 §3） */
  id: string
  /** 幂等依据的稳定事件 id（不是余额） */
  eventId: string
  missionId?: string
  sessionId?: string
  kind: RewardKind
  points: number
  xp: number
  reason: string
  ts: number
  // ── reconciliation / migration 字段（R2 marker 用） ──
  sourceType?: RewardSourceType
  sourceId?: string          // 如 classTaskId
  legacyGranted?: boolean    // true = 该奖励已由 legacy 实际发放过
  rewardAmount?: number      // legacy 实发金额（PTS）
  migrationStatus?: MigrationStatus
}
```

`rewardStore`（zustand persist，version 1）：
```ts
interface RewardState {
  transactions: RewardTransaction[]
  recordReward: (txn: RewardTransaction) => void        // 仅记录，不改余额
  hasRewardByEvent: (eventId: string) => boolean        // 幂等判断
  getRewardsByMission: (missionId: string) => RewardTransaction[]
}
```
> **`recordReward` 只落记录、不改 PTS/XP**；余额变更由 RewardEngine 调 `addPoints/addXp` 完成。Migration marker 只 `recordReward`、不调 addPoints/addXp → 不改余额（满足 R2）。

---

## 3. 稳定 eventId 方案（幂等依据）

| 场景 | eventId（稳定，确定性） | 说明 |
|---|---|---|
| Mission 完成 | `mission-complete:${missionId}` | 一个 Mission 只发一次完成奖 |
| Recovery | `recovery:${sessionId}:#${recoveryCount}` | 每次恢复一笔 |
| Missed 惩罚 | `missed:${missionId}` | 只罚一次 |
| Legacy 课程 marker | `mission-complete:${missionId}`（与完成同键） | 占用该键 → 阻止 RewardEngine 再发 |

**幂等判断**：`hasRewardByEvent(eventId)` —— transactions 中存在该 eventId 即视为已处理。
> 课程 legacy marker 与课程完成共用 `mission-complete:${missionId}`：marker 先占键 → 之后 `grantMissionReward` 查到已存在 → 跳过，不再发。

---

## 4. RewardEngine 改造

### 4.1 课程 Mission 判定
```ts
isCourseMission(m) = (m.source === 'SCHEDULE' && m.requiresEvidence === true)
```

### 4.2 课程奖励规则（从 legacy 平移，金额不变）
```
PTS = baseReward(subject,period)                 // 来自 SCHEDULE
    + 准点 bonus(+15)  若 completedAt ≤ period.endTime
    + AI bonus(+25)    若 aiScore ≥ 80
XP  = 50 + 30(若 aiScore ≥ 90)
```
- `baseReward` 由 subject+period 查 `SCHEDULE`。
- `aiScore = round(latest ACCEPTED recommendation.confidence × 100)`。
- `completedAt = mission.completedAt`；`period.endTime` 由 period 查。

### 4.3 grantMissionReward 流程（加幂等）
```
eventId = mission-complete:${m.id}
if rewardStore.hasRewardByEvent(eventId): return { alreadyIssued: true }   // 不再调 callback
if isCourseMission(m): {points,xp} = computeCourseReward(m)
else:                  {points,xp} = computeGenericReward(m)   // 现有通用规则（含深渊+400/专注加成）
cb.addPoints(points); cb.addXp(xp); cb.addPointRecord('earn', points, reason)   // 应用余额
rewardStore.recordReward({ eventId, kind:'MISSION_COMPLETE', points, xp, sourceType:'REWARD_ENGINE', migrationStatus:'NONE', ... })
return { points, xp }
```

### 4.4 抽出纯函数（rewardCore.ts，便于测试）
```ts
completionEventId(missionId): string
recoveryEventId(sessionId, n): string
missedEventId(missionId): string
isCourseMission(m): boolean
computeCourseReward(m, ctx): { points, xp }        // ctx={baseReward, aiScore, completedAt, periodEndMin}
computeGenericReward(m): { points, xp }            // 现有通用规则抽取
isAlreadyIssued(transactions, eventId): boolean    // 纯幂等判断
```
`grantMissionReward`/`grantRecoveryReward`/`grantMissedPenalty` 改为：eventId → isAlreadyIssued → 计算 → callback → recordReward。

---

## 5. Legacy 停止新增（移除发放点）

| 位置 | 现状 | 10A 改动 |
|---|---|---|
| `Quests.handleTakePhoto` | `addPoints(reward)` + `addPointRecord('earn')` | **删除**（保留 completeClassTask 调用以更新展示态） |
| `classTaskStore.completeClassTask` | `addXp(xpGain)` + `lastPointsChange` 金额 | **删除 addXp**；`lastPointsChange` 金额改由 RewardEngine 发放事件驱动（见风险 R3） |

> `completeClassTask` 仍保留：更新 ClassTask 展示态（10C 前 Phase 8 视图过渡用）+ 提交 Evidence（Phase 9 已接）。**只是不再发奖。**

---

## 6. Migration（识别既有 Legacy Reward，防三次发放）

### 6.1 marker 生成（一次性、幂等）
```
migrateLegacyCourseRewards():
  for task of 今日 classTasks where status==='completed':
    mission = findMissionForPeriod(task.period); if !mission → skip
    eventId = mission-complete:${mission.id}
    if rewardStore.hasRewardByEvent(eventId): skip            // 已标记/已发，幂等
    {points,xp} = computeCourseReward(mission, ctx)           // 重构 legacy 金额（同规则）
    rewardStore.recordReward({
      id: migration:${task.id},
      eventId,
      kind: 'COURSE_COMPLETE',
      points, xp,
      reason: 'LEGACY_ACCEPTED',
      sourceType: 'LEGACY_COURSE',
      sourceId: task.id,
      legacyGranted: true,
      rewardAmount: points,
      migrationStatus: 'LEGACY_ACCEPTED'
    })                                                        // 不调 addPoints/addXp → 不改余额
```

### 6.2 为什么不会三次发放
- **Legacy Reward**：已发生（既成事实，接受）。
- **Migration marker**：`recordReward` 不应用余额，只占 eventId + 记录。
- **RewardEngine**：之后 `grantMissionReward(eventId)` 查到 eventId 已被 marker 占用 → `alreadyIssued` → 不再发。
→ 三者中只有 Legacy 实际改了余额（历史事实）；marker 与 RewardEngine 都不再新增。✅

### 6.3 时机
`migrateLegacyCourseRewards` 在 `initDiscipline` 中、`migrateCourseVerifications` 之后调用（幂等，可重复执行）。

---

## 7. 测试矩阵（10A）

### 7.1 纯函数（rewardCore，node 可测）
| # | 用例 | 断言 |
|---|---|---|
| P1 | eventId 稳定性 | 同 missionId 两次 `completionEventId` 相等 |
| P2 | eventId 区分 | 不同 missionId / recovery n → 不同 eventId |
| P3 | isCourseMission | SCHEDULE+requiresEvidence→true；USER→false |
| P4 | computeCourseReward 基础 | baseReward=80,准点,ai92 → PTS=80+15+25=120, XP=50+30=80 |
| P5 | computeCourseReward 无加成 | baseReward=60,迟交,ai70 → PTS=60, XP=50 |
| P6 | computeGenericReward | 非课程 Mission → basePoints=targetMinutes + 加成（含深渊） |
| P7 | isAlreadyIssued | 空→false；含同 eventId→true；不同 eventId→false |

### 7.2 幂等与防双发（store 编排，build/CI + 集成）
| # | 用例 | 断言 |
|---|---|---|
| I1 | grantMissionReward 重复调用 | 第二次 alreadyIssued，callback 仅一次 |
| I2 | marker 后 grantMissionReward | eventId 已占 → 不发（不双发） |
| I3 | migrateLegacyCourseRewards 幂等 | 跑两次，第二次全部 skip，transactions 不增 |
| I4 | marker 不改余额 | recordReward 后 PTS/XP 不变（legacyGranted=true 仅记录） |
| I5 | Quests/classTaskStore 停止发放 | 核验通过后 PTS/XP 仅来自 RewardEngine（静态 + 运行时断言） |

### 7.3 回归
- 既有 124 项全绿（含 H 段 Evidence、K 段课程证据）。
- 新增 P1–P7 + I1–I5。
- `tsc -b` + `vite build` + CI APK。

---

## 8. 实施顺序（确认后）

1. `types.ts`：RewardTransaction / RewardKind / RewardSourceType / MigrationStatus。
2. `rewardCore.ts`（纯函数）+ 测试 P1–P7。
3. `rewardStore.ts`（recordReward/hasRewardByEvent/getRewardsByMission）。
4. `rewardEngine.ts`：grantMissionReward/Recovery/Missed 接入 eventId 幂等；课程规则 computeCourseReward。
5. 移除 legacy 发放点（Quests.addPoints、classTaskStore.addXp/lastPointsChange 金额）。
6. `courseMigration.ts`：migrateLegacyCourseRewards；runtime.initDiscipline 接线。
7. 测试 I1–I5 + 全量回归 + build。

---

## 9. 风险与边界（本阶段）

- **R3（积分提示）**：移除 `lastPointsChange` 后顶部积分变动提示需由 RewardEngine 产出等价事件；10A 先保证 RewardEngine 发放时写一条可被 UI 订阅的记录（`recordReward` 的 transaction 即可驱动），UI 订阅细节可随后接。
- **不改** Mission/Evidence/Session/ResultEvaluator 判定逻辑；10A 只动"奖励发放与幂等"。
- **不动** 10B（Rejected Evidence）、10C（CourseTask 退役）。

---

> **请确认本 10A 设计与测试规格。** 确认后我按 §8 顺序实施，完成即暂停等你验收（含 124+新增测试全绿 + build + CI），再进 10B。
