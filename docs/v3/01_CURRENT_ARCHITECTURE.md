# V3 · 01 — CURRENT ARCHITECTURE（现状架构）

> 基线：`refactor/discipline-core` 分支（V2 自律核心重构后）。
> 本文只描述**当前代码真实状态**，不含任何目标设计。目标见 `03_TARGET_ARCHITECTURE.md`。
> 阅读对象：Principal Engineer / 接手 V3 的工程师。所有结论均可在代码中定位。

---

## 0. 一句话现状

项目已经拥有**一套可用的自律核心**（`src/core/discipline/`，Mission + 行为事件 + 证据去重 + 分级干预 + 统一发奖），
但它目前是**"任务 → 打开学习 App → 计时 → 达 80% → 完成 → 发奖"**的线性打卡器，
**没有** Session / Deviation / Recovery / Result / Review / AI-Insight 这些"执行闭环"概念，
且与一套**遗留课程打卡系统**（`classTaskStore`）并行运行。

---

## 1. 技术栈与分层

| 层 | 技术 | 关键文件 |
|---|---|---|
| 前端 | React 18 + TS + Vite + Zustand | `src/` |
| 自律核心 | 纯 TS 模块 | `src/core/discipline/`（11 个文件，约 1215 行） |
| 遗留任务系统 | zustand persist | `src/stores/classTaskStore.ts`（414 行） |
| 主状态 | zustand persist | `src/stores/useStore.ts`（558 行） |
| Android 原生 | Kotlin 插件 | `android_plugin/`（MonitorService / AppCategories / MissionMirror / Plugin / LockScreen） |
| App 分类 SSOT | JSON（构建时生成 Kotlin） | `config/appCategories.json` + `scripts/gen-android-categories.mjs` |
| AI | OpenAI 兼容（MOSS + 二号验证官 + Supervisor） | `src/lib/ai.ts` / `verifyAI.ts` / `core/discipline/aiSupervisor.ts` |

---

## 2. 自律核心模块清单（V3 的地基，**不重写**）

| 文件 | 职责 | V3 相关的关键现状 |
|---|---|---|
| `types.ts` | Mission / FocusInterval / Evidence / BehaviorEvent / Mirror | **Mission 同时承载计划与运行时状态**（见 §4） |
| `disciplineEngine.ts` | 状态机 `handleEvent` / 干预升级 / 完成触发 | 干预按**纯时长**升级（1/5/15 min），无置信度 |
| `missionEvaluator.ts` | 证据驱动完成判定 | **80% 时长 = COMPLETED**，二元完成 |
| `rewardEngine.ts` | 统一发奖（含深渊 +400） | 只在"完成/错过"两点发奖，**无 Recovery 奖励** |
| `runtime.ts` | 初始化 / 60s 采样 / 前台检测 / 干预接线 | 采样只对"激活态 Mission"累计 |
| `missionStore.ts` | Mission SoT（persist）+ Android 镜像 | `currentMissionId` 单一指针 |
| `aiSupervisor.ts` | 监督话语 / AI 证据判定 / AI 建任务 | AI 证据基准权重 **0.9**（偏高） |
| `appCategories.ts` | 分类加载（包名→关键词→neutral） | study=学习、ent+social=分心、neutral=不计 |
| `scheduleToMissions.ts` | 课表 → SCHEDULE Mission | `requiresEvidence` 由科目名正则判定 |
| `focusMath.ts` | 区间合并去重 | 已正确（Dungeon + UsageStats 不重复计） |

---

## 3. 当前核心数据模型（逐字段）

### 3.1 Mission（`types.ts`）
```ts
interface Mission {
  id; title; subject?; source: 'SCHEDULE'|'USER'|'AI'; createdBy?
  plannedStart; plannedEnd; targetMinutes        // 计划属性
  // ↓↓↓ 以下全部是"运行时/执行期"状态，目前挂在 Mission 上 ↓↓↓
  actualStudyMs; distractionMs
  focusIntervals: FocusInterval[]
  status: MissionStatus
  interventionLevel: 0|1|2|3
  requiresEvidence; evidence: Evidence[]
  startedAt?; completedAt?; distractedSince?; createdAt
}
```
**关键观察：** 计划属性（title/plannedStart/targetMinutes）与运行时度量（actualStudyMs/focusIntervals/interventionLevel/distractedSince）**混在同一个对象**。这是 V3 要拆分的核心。

### 3.2 MissionStatus
`READY → FOCUSING → DISTRACTED → INTERVENTION → RECOVERING → COMPLETED`（+ `MISSED` / `IDLE`）。
> 状态机**只有任务级**，没有"一次执行会话（Session）"的独立生命周期。

### 3.3 FocusInterval（专注证据区间）
```ts
{ source: 'DUNGEON'|'APP_USAGE'; startedAt; endedAt; packageName?; tag?: 'abyss'|'focus' }
```
由 `focusMath.mergeIntervalsMs` 区间合并去重 → 派生 `actualStudyMs`。**这部分设计是正确的，V3 保留。**

### 3.4 Evidence
`type: usageStats|photo|screenshot|manual|ai`，`weight`。当前基准权重：
`usageStats 1.0 / ai 0.9 / photo 0.8 / screenshot 0.7 / manual 0.5`。

### 3.5 BehaviorEvent
`type: APP_FOREGROUND|APP_BACKGROUND|SCREEN_ON|SCREEN_OFF|MISSION_STARTED|MISSION_STOPPED|USAGE_SAMPLE`，携带 `packageName / appCategory / studyMs / distractionMs / windowStart`。
**原则已正确：只描述事实，不加 XP、不判完成。** V3 保留该原则，并新增 SESSION_* 事件。

---

## 4. 当前运行时数据流

```
initDiscipline()（main.tsx 启动时）
  ├─ generateTodayMissions()      课表 → SCHEDULE Mission
  ├─ wireInterventionHandlers()   干预回调（通知/锁屏/AI 话语）
  ├─ subscribeNativeBehaviorEvents()  订阅 Android APP_FOREGROUND
  ├─ pickCurrentMission()         自动指向当前任务
  ├─ 每 60s：sampleUsageForCurrentMission() → USAGE_SAMPLE
  │          （Android 原生另产 APP_FOREGROUND）
  └─ 每 60s：scanMissedMissions()  READY 过期 → MISSED

handleEvent(event)
  ├─ APP_FOREGROUND → 娱乐/社交 = DISTRACTED；学习 App = recover
  ├─ USAGE_SAMPLE   → 学习时长写 APP_USAGE 区间(去重)；分心时长累计
  └─ 分心持续 1/5/15min → LEVEL1/2/3 干预
evaluateMission() → actualStudyMs ≥ 80% target → COMPLETED → grantMissionReward
```

**干预升级（`disciplineEngine.escalateIntervention`）：** 仅按 `Date.now() - distractedSince` 的时长，1min→L1、5min→L2、15min→L3。**无置信度、无 App 语境、无"短暂切换"豁免。**

**完成判定（`missionEvaluator.evaluateMission`）：**
- 普通任务：`actualStudyMs / targetMinutes ≥ 0.8` → COMPLETED。
- `requiresEvidence` 任务：时长达标 **且** evidenceScore ≥ 0.6 → COMPLETED；否则要求补证据。
- **结果只有"完成/未完成"两态**，没有 Partial / Abandoned，也没有 Execution Quality。

---

## 5. 奖励发放路径（当前有**多条**，部分仍分散）

| 触发 | 发奖点 | 说明 |
|---|---|---|
| Mission 完成 | `rewardEngine.grantMissionReward` | 基础 PTS+XP、高专注加成、深渊 +400 |
| Mission 错过 | `rewardEngine.grantMissedPenalty` | 轻扣 |
| 遗留课程打卡 | `classTaskStore.completeClassTask` | baseReward + bonus + XP（另一条路径） |
| 遗留监测惩罚 | `classTaskStore.updateMonitorState` | 娱乐>学习 → **-50**（惩罚导向） |
| 全天学习 XP | `main.tsx monitorUsage` | addExp 增量 + addStudyMs（与 Mission 并行） |
| 连签/全勤/成就 | `useStore.dailySettle` / `checkFullAttendance` / `checkAchievements` | 保留 |

> ⚠️ V2 已把 **Mission 完成奖励**收编进 RewardEngine，但**遗留课程打卡、-50 惩罚、全天 XP** 仍是并行路径。

---

## 6. 遗留系统（与自律核心并行，V3 需收编）

### 6.1 `classTaskStore.ts`（414 行）
- `ClassTask`：`pending/started/completed/overdue/absent`，独立于 Mission 的**另一套任务对象**。
- `currentTask`：与 `missionStore.currentMissionId` 并行的**第二个"当前任务"指针**。
- `completeClassTask`：拍照 + 二号 AI 打分 → 完成 + 发奖（Quests 时间轴仍在用）。
- `updateMonitorState`：娱乐>学习 → warning → **-50 分**（惩罚导向，违背 Recovery>Punishment）。
- `abyssRecords`：深渊战绩（成就判定依赖它）。
- 历史：taskHistory / verifyHistory / monitorHistory。

### 6.2 `main.tsx monitorUsage`（每 5 min）
- 全天窗口 `fetchUsageStats(00:00→now)`，`syncUsage(max)`、增量 XP、addStudyMs。
- 与 discipline runtime 的 60s 采样**并行**，口径不同（全天 vs Mission 窗口）。

### 6.3 页面现状
- **Home**：当前 Mission 卡片（开始专注）+ 遗留 SYSTEM STATUS。
- **Quests**：遗留课程时间轴（拍照核验）**+** 新增动态 Mission（USER/AI）——**两套并存**。
- **Dungeon**：Focus Runtime，提交 DUNGEON 证据；深渊模式；EchoRecorder。
- **Chat**：MOSS + `create_mission` 工具。

---

## 7. Android 原生现状

| 组件 | 现状 |
|---|---|
| `MonitorService.kt` | 前台服务，60s 轮询；前台 App 变化 → 产 `APP_FOREGROUND` BehaviorEvent（带分类）；保留深夜关怀/连学关怀 |
| `AppCategories.kt` | 由 `appCategories.json` 构建时生成（分类 SSOT）；study/ent/social/neutral |
| `MissionMirror.kt` | 最小 Mission 镜像（SharedPreferences），Service 重启恢复感知 |
| `SelfDisciplinePlugin.kt` | getUsageStats / syncMissionMirror / getMissionMirror / lockScreen / emitBehaviorEvent |
| `LockScreenActivity.kt` | LEVEL2/3 锁屏遮罩 |

**分类口径：** `neutral` 仅含系统/输入法/拨号等；**浏览器（Chrome 等）未列入任何类 → 归 neutral**。`keywords.entertainment` 含 `news/video/play/shop` 等宽泛词（存在把浏览器/工具误判为娱乐的潜在风险，见 PROBLEM LIST）。

---

## 8. 当前已经做对、V3 必须保留的地基

1. ✅ **Mission 三来源统一模型**（SCHEDULE/USER/AI）——V3 保留 Mission，只剥离运行时状态。
2. ✅ **BehaviorEvent 只描述事实**——V3 保留该原则。
3. ✅ **FocusEvidence 区间去重**（`focusMath`）——V3 保留，作为 Session 时长计算基础。
4. ✅ **统一 App 分类 SSOT**（appCategories.json → Kotlin）——V3 保留并细化 neutral/浏览器语境。
5. ✅ **RewardEngine 统一发奖入口**——V3 保留，扩展 Recovery/Result 奖励。
6. ✅ **分级干预 LEVEL 1/2/3 + 锁屏遮罩执行手段**——V3 保留等级，叠加置信度门控。
7. ✅ **TS persist SoT + Android 最小镜像**——V3 保留持久化策略。
8. ✅ **AI Supervisor 存在**——V3 扩展为"长期行为洞察 + 次日计划"，并把它从"证据真源"降级为"解释/建议"。

---

## 9. 一句话总结现状

> **地基（数据模型 + 事件 + 去重 + 统一发奖）是对的；缺的是把"一次执行"从 Mission 里拆出来（Session），
> 以及围绕它建立 Deviation / Recovery / Result / Review / AI-Insight 的完整执行闭环，
> 并把并行的遗留课程系统收编进来。**
