# CURRENT_ARCHITECTURE.md — 自律核心架构（重构后 · 权威版本）

> 本文档描述第三阶段重构完成后的**当前架构**。
> 重构前的基线分析见 `docs/ARCHITECTURE_BASELINE_pre_refactor.md`（含旧架构问题清单）。
>
> 一句话概括：本项目已从"功能集合"重构为**以 Mission 为中心的 AI 自律监工系统**。
> 用户只需表达目标并开始任务，之后 App 自动监控 → 发现分心 → 分级干预 → 帮助恢复 → 判定完成 → 统一发奖 → 进入下一任务。

---

## 0. 核心设计哲学

1. **Mission 是唯一中心对象。** 课表、用户手动、AI 三种来源最终都统一成同一个 `Mission` 模型，贯穿首页/任务/Dungeon/监控/AI。禁止维护多套 CurrentTask/CurrentMission。
2. **事实与判断分离。** Android / UsageStats / Dungeon 只产"事实"（BehaviorEvent / FocusEvidence），不加积分、不扣分、不判完成。所有判断集中在 DisciplineEngine / MissionEvaluator。
3. **证据驱动的完成判定。** 完成不靠用户手动打卡，而靠行为证据（有效学习时长 + 可选 Evidence）。拍照只是 Evidence Provider 之一，不是默认完成条件。
4. **统一去重。** Dungeon 专注时间与学习 App 使用时间是两套证据源，由 `focusMath` 区间合并统一计算 `actualStudyMs`，**绝不重复累加**。
5. **Recovery > Punishment。** 分心干预分级（LEVEL 0/1/2/3），第一次分心只提醒不惩罚，核心目标是帮用户回到任务。
6. **奖励统一发放。** 所有 XP/PTS/成就由 RewardEngine 在 Mission 完成时统一发放，页面/Android/AI 都不直接发奖。

---

## 1. 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端框架 | React 18 + TypeScript + Vite | SPA |
| 移动端封装 | Capacitor 6 | Web → Android APK |
| 状态管理 | zustand + persist（localStorage） | useStore / classTaskStore / **missionStore** |
| **自律核心** | `src/core/discipline/`（纯 TS） | Mission / 状态机 / 证据去重 / 评估 / 奖励 |
| Android 原生 | Kotlin 插件（`android_plugin/`） | UsageStats / 前台服务 / 锁屏 / 行为事件 |
| App 分类 SSOT | `config/appCategories.json` | TS 与 Android 构建时共用，单一数据源 |
| AI | OpenAI 兼容接口 | MOSS 监工 + 二号验证官 + AI Supervisor |
| 通知 | @capacitor/local-notifications | 课程提醒 / 干预提醒 / AI 监督话语 |

**持久化 Source of Truth：**
- TypeScript `missionStore`（persist 到 localStorage）是 Mission 业务状态的唯一权威。
- Android 侧仅保存**最小运行时镜像**（MissionMirror，SharedPreferences），供 MonitorService 重启后恢复感知，不含业务判断。

---

## 2. 总体架构

```
┌────────────────────────────────────────────────────────────────────┐
│                     React 前端 (Capacitor WebView)                   │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐          │
│  │  Home    │ Quests   │ Dungeon  │  Chat    │ Profile  │          │
│  │当前Mission│课表+动态  │Focus     │ MOSS对话 │ 个人中心 │          │
│  │卡片+开始  │Mission创建│Runtime   │+建Mission│          │          │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘          │
│                        ↓ 读 / 写                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              src/core/discipline/  （自律核心）                │   │
│  │  missionStore(Mission SoT) ── disciplineEngine(状态机)        │   │
│  │  focusMath(区间去重) ── missionEvaluator(证据判完成)          │   │
│  │  rewardEngine(统一发奖) ── aiSupervisor(AI监督) ── runtime    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                        ↑ BehaviorEvent / FocusEvidence               │
├────────────────────────────────────────────────────────────────────┤
│              Capacitor Bridge (SelfDiscipline 插件)                  │
│   getUsageStats / syncMissionMirror / lockScreen / behaviorEvent    │
├────────────────────────────────────────────────────────────────────┤
│                       Android 原生层                                  │
│  MonitorService.kt  前台服务：前台App检测→产 APP_FOREGROUND 事件      │
│  AppCategories.kt   构建时从 appCategories.json 生成（分类 SSOT）     │
│  MissionMirror.kt   最小 Mission 镜像（重启双保险）                   │
│  LockScreenActivity 锁屏遮罩（LEVEL2/3 执行手段）                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mission 统一模型

### 3.1 三种来源，一个模型

```
固定课表 (SCHEDULE)  ─┐
用户手动 (USER)      ─┼──→  统一 Mission 模型  ──→  DisciplineEngine
AI 动态  (AI)        ─┘
```

`Mission.source: 'SCHEDULE' | 'USER' | 'AI'`，另有 `createdBy: 'SYSTEM' | 'USER' | 'AI'`。

| 来源 | 生成方式 | 入口 |
|---|---|---|
| SCHEDULE | `scheduleToMissions.generateTodayMissions()` 按课表幂等生成当日任务 | 运行时自动 |
| USER | Quests 页「+ 动态任务」表单 → `createMission` | 用户手动 |
| AI | MOSS chat `create_mission` 工具 / `aiSupervisor.createAiMission` | AI 主动 |

### 3.2 状态机（唯一定义，所有页面共用）

```
READY → FOCUSING → DISTRACTED → INTERVENTION → RECOVERING → FOCUSING
                       │                                        │
                       └────────────→ COMPLETED ←───────────────┘
READY（错过窗口）→ MISSED        任意 → IDLE（手动停止）
```

| 状态 | 含义 |
|---|---|
| READY | 就绪，未开始 |
| FOCUSING | 正在专注执行 |
| DISTRACTED | 检测到分心 |
| INTERVENTION | 系统正在干预 |
| RECOVERING | 用户正在恢复 |
| COMPLETED | 已完成（证据达标） |
| MISSED | 错过窗口 |
| IDLE | 空闲（无当前任务） |

### 3.3 干预分级（Recovery > Punishment）

| 等级 | 触发（分心持续时长） | 手段 |
|---|---|---|
| LEVEL 0 | 不干预 | 无 |
| LEVEL 1 | ≥ 1 分钟 | 普通通知提醒 |
| LEVEL 2 | ≥ 5 分钟 | 强提醒 + 锁屏遮罩（**允许立即恢复**）+ AI 监督话语 |
| LEVEL 3 | ≥ 15 分钟 | 强制恢复模式（更长遮罩，可限制娱乐 App）+ AI 监督话语 |

> 第一次分心只提醒、不扣分、不锁死。

---

## 4. FocusEvidence 与统一去重（本次重构的核心创新）

### 4.1 两套证据源，一个累计系统

用户专注时长有两个来源，**绝不能分别累加**（否则 45min 会变 90min）：

```
Mission 开始
  ├─ 进入 Dungeon 专注 ──→ DUNGEON evidence（FocusInterval）
  └─ 使用学习 App ──────→ APP_USAGE evidence（FocusInterval，来自 UsageStats）
          ↓ 两者都写入 Mission.focusIntervals
   focusMath.mergeIntervalsMs（区间合并去重）
          ↓
   actualStudyMs（唯一次计算，不重复）
```

### 4.2 FocusInterval 结构

```ts
interface FocusInterval {
  source: 'DUNGEON' | 'APP_USAGE'
  startedAt: number
  endedAt: number
  packageName?: string   // APP_USAGE 携带
  tag?: string           // 'abyss' | 'focus'（供 RewardEngine 识别挑战奖励）
}
```

### 4.3 去重算法（`focusMath.mergeIntervalsMs`）

经典区间合并：排序后逐个吸收重叠，重叠部分只计一次。

| 场景 | 输入 | 结果 |
|---|---|---|
| Dungeon 中途切出 | `19:00–19:20` + `19:25–19:50`（中间 5min 刷 B 站） | **45min**（分心 5min 单独计 distractionMs） |
| 两源完全重叠 | Dungeon `45min` + UsageStats `45min` | **45min**（不是 90） |
| 部分重叠 | `0–30` + `20–50` | **50min** |

### 4.4 Dungeon 如何产证据（Focus Runtime）

Dungeon 不再是独立计时器，而是 **Mission 的 Focus Runtime / Evidence Provider**：
- 计时运行 **且** App 在前台 → 打开一个 DUNGEON 区间。
- App 切后台（`pause`）→ 立即关闭区间并提交；回到前台（`resume`）→ 重新打开。
- 计时归零 / 手动停止 / 退出 → 关闭区间提交。
- 每段区间经 `submitDungeonFocus` → `addFocusInterval`（去重 + 派生 actualStudyMs + 尝试完成）。

> 因此"中途切出去刷 B 站那段时间"自动不算专注——靠 pause/resume 生命周期切分。

### 4.5 UsageStats 如何产证据

`runtime.ts` 采样器每 60s：
- `fetchUsageStats(windowStart, now)` 得窗口内学习/分心聚合时长（收敛到窗口内）。
- 学习时长 → 锚定窗口生成 `APP_USAGE` 区间 → `addFocusInterval`（去重）。
- 分心时长 → 累计 `distractionMs`（仅采样器产生，无双重计算风险）。
- 只对**激活态**任务采样（FOCUSING/RECOVERING/DISTRACTED/INTERVENTION），READY/IDLE 不计。

> Android 端我们的 App 包名归类为 neutral，因此在 Dungeon 期间 UsageStats 学习时长≈0，天然不与 Dungeon 重叠；即便重叠，区间合并也会去重。双保险。

---

## 5. DisciplineEngine 数据流

```
Android MonitorService ──→ APP_FOREGROUND（前台App变化，带分类）┐
UsageStats 采样器 ────────→ USAGE_SAMPLE（学习/分心时长）        │
Dungeon Focus Runtime ───→ DUNGEON FocusInterval               │
                                                                 ↓
                              DisciplineEngine.handleEvent(event)
                                                                 ↓
              判断"该做什么 / 实际在做什么 / 是否分心"
                                                                 ↓
              更新 Mission 状态（状态机）+ 分级干预（LEVEL 0/1/2/3）
                                                                 ↓
              MissionEvaluator（证据判完成）→ RewardEngine（统一发奖）
                                                                 ↓
                              进入下一任务
```

**关键约束：** 页面、Android、AI 都**不自己判断任务完成**，统一交给 MissionEvaluator。

---

## 6. 模块职责（最终分工）

| 模块 | 职责 | 不做 |
|---|---|---|
| **Mission** | 当前目标的载体 | — |
| **BehaviorEvent** | 描述用户实际行为的事实 | 不加 XP、不扣分、不判完成 |
| **FocusEvidence** | 专注时间区间证据 | 不直接累加，交去重 |
| **DisciplineEngine** | 核心状态机：收事件、判分心、分级干预 | — |
| **UsageStats** | 学习/分心时长数据源 | 不判完成 |
| **Android Monitor** | 行为采集 + 系统级干预执行 | 不加积分、不判完成、不维护分类 |
| **AI Supervisor** | 监督策略：监督话语 / ai 证据 / 动态 Mission | 不伪造数据、不直接判完成发奖 |
| **Evidence** | 完成证据（usageStats/photo/screenshot/manual/ai） | — |
| **MissionEvaluator** | 证据驱动的完成判定 | — |
| **RewardEngine** | XP / PTS / Achievement 统一发放 | — |

---

## 7. 子系统详解

### 7.1 课表 → Mission（scheduleToMissions.ts）
- `generateTodayMissions()`：按当日课表幂等生成 SCHEDULE Mission（启动时 + resume 时）。
- 试卷/作业/背诵类自动标记 `requiresEvidence`。
- `pickCurrentMission()`：选取当前该做的任务（提前 15 分钟可开始）。

### 7.2 动态 Mission（Quests）
- 「+ 动态任务」表单：标题 + 时长快选 + 开始时间 → `createMission(source=USER)`。
- 今日 USER/AI Mission 以 `DynamicMissionCard` 列表展示（状态/进度/开始按钮）。
- 课表时间轴（遗留 classTasks）保留并存。

### 7.3 AI（Chat + AI Supervisor）
- **MOSS chat** 新增 `create_mission` 工具：用户说"今晚想把函数第三章看完"→ MOSS 建 source=AI 的 Mission。
- **aiSupervisor.ts**：
  - `aiSupervise`：干预升级（LEVEL2/3）/任务将错过时，MOSS 给一句监督话语（Recovery 优先），以通知送达。
  - `aiJudgeEvidence`：对 requiresEvidence 任务，AI 依用户描述判定，产 `ai` 类证据 → 触发完成判定。
  - `createAiMission`：AI 动态建 Mission。
- AI 未配置/调用失败时**静默降级**，不阻断干预。

### 7.4 Dungeon（Focus Runtime）
- 保留 25/45 UI 与体验、深渊战绩记录（addAbyssRecord）。
- **不再直接完成 Mission、不再直接发 400 PTS / EXP**——改为提交 DUNGEON 证据，由 Mission 系统统一结算。
- 顶部新增「当前任务」上下文条：任务标题 + Mission 进度（x/y min）+ 本次专注时长。
- 进入时若有激活 Mission，自动同步深渊模式与目标时长；无任务则动态创建（source=USER）。
- `addFocusMs` 保留（今日进度/连签）——`syncUsage` 用 max 与学习 App 时长天然去重。

### 7.5 Android 原生
- **MonitorService.kt**：前台服务每 60s 轮询；前台 App 变化 → 产 `APP_FOREGROUND` BehaviorEvent（带统一分类）经 Capacitor 发给 TS。保留深夜关怀/连续学习关怀等系统级健康提醒。不再自己判完成。
- **AppCategories.kt**：由 `config/appCategories.json` **构建时生成**（`scripts/gen-android-categories.mjs`，挂在 `prebuild`，CI 每次 build 自动重生成）。分类唯一 Source of Truth，TS 与 Android 共用，不再两套名单。
- **MissionMirror.kt**：最小 Mission 镜像（missionId/status/plannedStart/plannedEnd/interventionLevel）存 SharedPreferences，MonitorService 重启后恢复感知。
- **SelfDisciplinePlugin.kt**：新增 `syncMissionMirror` / `getMissionMirror`；companion instance + `emitBehaviorEvent`（供 Service 经 Plugin 发事件）。

### 7.6 完成判定（missionEvaluator.ts）
- 默认完成 = 有效学习时长达标（`actualStudyMs / targetMinutes ≥ 80%`），**不需要拍照**。
- `requiresEvidence` 任务（试卷/作业/背诵）：行为达标 + Evidence 分数足够才完成；不足时提示补充证据（拍照/AI/manual）。
- Evidence 基准权重：usageStats 1.0 / ai 0.9 / photo 0.8 / screenshot 0.7 / manual 0.5。

### 7.7 统一奖励（rewardEngine.ts）
- Mission 完成 → `grantMissionReward`：基础 PTS（按目标时长）+ 基础 XP（按有效学习分钟）+ 高专注加成（分心<10%）。
- **深渊挑战奖励**：Mission 证据含 `DUNGEON + abyss` 标记 → 额外 +400 PTS（原 Dungeon 直接发的 400 迁移至此，杜绝双重奖励）。
- 错过任务 → `grantMissedPenalty`（轻度，体现恢复优先）。

---

## 8. 文件地图

```
src/core/discipline/
  types.ts               Mission/BehaviorEvent/FocusInterval/Evidence/状态机/干预等级/镜像
  appCategories.ts       分类加载器（消费 config/appCategories.json）
  focusMath.ts           区间合并去重（mergeIntervalsMs / computeFocusMs）
  missionStore.ts        Mission 业务 SoT（zustand persist + Android 镜像同步）
  missionEvaluator.ts    证据驱动完成判定
  rewardEngine.ts        统一奖励发放（含深渊 400PTS 规则）
  disciplineEngine.ts    核心状态机（handleEvent / addFocusInterval / 分级干预）
  scheduleToMissions.ts  课表 → SCHEDULE Mission 生成器
  aiSupervisor.ts        AI 监督策略（监督话语 / ai 证据 / 动态 Mission）
  runtime.ts             运行时：采样 / 前台检测 / 干预接线 / 原生事件订阅 / initDiscipline
  index.ts               barrel 导出

config/appCategories.json           App 分类唯一数据源（study/entertainment/social/neutral）
scripts/gen-android-categories.mjs  JSON → AppCategories.kt 生成器（prebuild 钩子）

android_plugin/java/.../plugin/
  AppCategories.kt       （生成）分类，与 TS 共用
  MissionMirror.kt       最小 Mission 镜像存取
  MonitorService.kt      前台服务：产 APP_FOREGROUND 事件 + 系统级健康提醒
  SelfDisciplinePlugin.kt Capacitor 插件（含镜像同步 / 事件发射）
  LockScreenActivity.kt  锁屏遮罩（LEVEL2/3 执行手段）
  BootReceiver.kt        开机自启
```

---

## 9. 持久化与状态恢复

- **业务状态 SoT**：`missionStore` persist 到 localStorage（currentMissionId 唯一当前任务指针）。
- **Android 最小镜像**：`currentMission` 变化时经 `syncMissionMirror` 同步到 SharedPreferences；MonitorService 重启后据此知道"当前是否有 Mission 在执行"，再向 TS 同步。
- 双保险：App UI 被回收但 MonitorService 仍在时，Android 侧仍保有最小上下文。

---

## 10. 遗留系统与迁移说明

重构遵循"不删除现有功能"，以下为**仍并存的遗留系统**及后续收编方向：

| 遗留 | 现状 | 后续方向 |
|---|---|---|
| `classTaskStore`（课程任务/打卡核验） | Quests 时间轴仍用它；拍照核验仍走二号 AI | 逐步并入 Mission（核验 → Evidence） |
| `main.tsx monitorUsage`（全天学习 XP） | 仍为学习 App 时长发被动 XP | 决定是否收编进 RewardEngine |
| Quests 课程时间轴 | 与动态 Mission 列表并存 | 统一到 Mission 时间轴 |
| `useStore.quests`（add_quest） | MOSS 的 add_quest 工具仍用它 | 与 Mission 体系对齐 |

> ⚠️ 已知并存：遗留 `monitorUsage` 的被动学习 XP 与 Mission 完成奖励可能同时发放。当前按"不删现有功能"保留，属待决取舍。

---

## 11. 已拍板的关键决策（不再摇摆）

1. **Mission 来源**：课表 + 用户动态 + AI 动态三者并存，统一成一个 Mission 模型（source 字段区分）。禁止多套 CurrentTask/CurrentMission。
2. **拍照核验**：保留，但从默认完成机制降级为**可选 Evidence Provider**。默认完成 = 行为监测达标。Evidence 可扩展 Photo/Screenshot/UsageStats/Manual/AI。
3. **App 分类**：TypeScript `config/appCategories.json` 为唯一 Source of Truth，Android 构建时消费同一份，不维护独立分类。
4. **分心干预**：保留通知 + 锁屏遮罩，但分级 LEVEL 0/1/2/3，第一次分心不强锁。核心是 Recovery，不是 Punishment。
5. **Mission 持久化**：TS persist 为业务 SoT；Android 只存最小运行时镜像（missionId/status/plannedStart/plannedEnd/interventionLevel），不实现 MissionEvaluator/RewardEngine。
6. **Dungeon 定位**（关键修正）：Dungeon = Mission 的 **Focus Runtime / Focus Evidence Provider**，不是独立计时器。Dungeon 时间与 UsageStats 时间统一成 FocusEvidence，由 focusMath 区间去重，绝不双重计算。原 400 PTS 迁移到 RewardEngine。

---

## 12. 验证状态与后续

- TypeScript 全量编译通过，Vite 构建通过。
- 区间去重经用户场景实测：`20+25=45`、完全重叠=45（非90）、部分重叠=50。
- Android Kotlin 由 CI（`gradlew assembleDebug`）编译验证，已通过。
- 新 APK 经 GitHub Actions 构建并发布到 Release。

**建议真机验证：**
1. 课表任务到点出现在首页，点「开始专注」进 Dungeon 计时。
2. Dungeon 专注时长正确累计进 Mission；中途切出再回来不重复计算。
3. Quests 动态创建任务、开始任务。
4. MOSS 对话「给我安排个 45 分钟背单词」→ 建出 source=AI 的 Mission。
5. 分心后 LEVEL 升级（通知 → 遮罩 → AI 监督话语）。

**后续迭代方向：** Quests 时间轴并入 Mission、拍照核验并入 Evidence、monitorUsage 收编、AI Supervisor 主动生成恢复方案。
