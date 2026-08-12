# CURRENT_ARCHITECTURE.md — 当前架构分析

> 重构前置文档（第一阶段：只理解，不改代码）。
> 目标：为把本项目从"功能集合"重构成"AI 自律监工系统"提供准确的现状基线。
> 阅读完请确认后，再进入第二阶段重构。

---

## 0. 技术栈总览

| 层 | 技术 | 说明 |
|---|---|---|
| 前端框架 | React 18 + TypeScript + Vite | SPA |
| 移动端封装 | Capacitor 6 | Web → Android APK |
| 状态管理 | zustand + persist（localStorage） | 两个 store |
| Android 原生 | Kotlin 插件（`android_plugin/`） | UsageStats / 前台服务 / 锁屏 |
| AI | OpenAI 兼容接口（通义/DashScope） | 双 AI：MOSS 监工 + 二号验证官 |
| 通知 | @capacitor/local-notifications | 课程提醒 |
| 持久化 | localStorage（zustand persist） | 2 个 store key |

**两个持久化 store：**
- `cyber-survival-store`（`useStore`）：积分 / 连签 / XP / 成就 / AI 配置 / 聊天 / 主题 / 高考
- `class-task-store`（`classTaskStore`）：课程任务 / 核验记录 / 监测记录 / 深渊记录 / 通知设置

---

## 1. 当前架构

```
┌──────────────────────────────────────────────────────────┐
│                       React 前端 (Capacitor WebView)        │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐ │
│  │  Home    │ Quests   │ Dungeon  │  Chat    │ Profile  │ │
│  │ 首页仪表盘 │ 任务中心  │ 深渊专注  │ AI监工对话│ 个人中心  │ │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘ │
│         Shop / Achievements / Stats / ClassHistory / ...   │
├──────────────────────────────────────────────────────────┤
│              useStore (zustand)      classTaskStore (zustand)│
│   积分/连签/XP/成就/AI配置/聊天/主题   课程任务/核验/监测/深渊   │
├──────────────────────────────────────────────────────────┤
│         main.tsx 调度器（setInterval 轮询驱动）             │
│   monitorUsage(5min) / checkOverdue(60s) /                 │
│   checkFullAttendance(23:50) / dailySettle / 通知           │
├──────────────────────────────────────────────────────────┤
│              Capacitor Bridge (SelfDiscipline 插件)         │
├──────────────────────────────────────────────────────────┤
│                    Android 原生层                           │
│  SelfDisciplinePlugin.kt   MonitorService.kt (前台服务)     │
│  getUsageStats/hasAccess/   每60s轮询UsageStats            │
│  openSettings/lockScreen/   深夜娱乐→锁屏 / 连学90min→关怀   │
│  start/stopMonitorService                                   │
└──────────────────────────────────────────────────────────┘
```

**页面职责现状：**
| 页面 | 现状 |
|---|---|
| Home | 仪表盘：今日学习时长/目标进度/权限状态/高考倒计时/快捷入口 |
| Quests | 任务中心：按 SCHEDULE 展示当日课程，开始/打卡核验 |
| Dungeon | 深渊专注：计时器，读 `currentTask`，完成/中断记 abyssRecord |
| Chat | MOSS 对话 + 工具调用 |
| Profile | 个人中心/档案/学习档案入口 |
| Shop/Achievements/Stats/ClassHistory/DiagLogs/PointsDetail | 商店/成就/统计/历史/诊断日志/积分明细 |

---

## 2. 当前数据流

### 2.1 使用统计（UsageStats）数据流
```
Android UsageStatsManager
  → SelfDisciplinePlugin.getUsageStats(startTs,endTs)
  → usageStats.ts fetchUsageStats()
      → 用 appClassification.ts 把包名分成 study / ent
  → main.tsx monitorUsage()（每 5 分钟轮询一次）
      → classStore.updateMonitorState(studyMs, entMs)   // 娱乐超学习→警告→-50分
      → mainStore.syncUsage(study, ent)                  // todayStudyMs/todayEntMs
      → 增量发 XP：addExp + addStudyMs（用 localStorage STUDY_EXP_KEY 去重）
```

**关键点：** UsageStats 统计窗口永远是 **今天 00:00 → 当前时间**（全天累计），**不是按任务/Mission 窗口**。

### 2.2 任务数据流
```
SCHEDULE（静态配置，按 dayOfWeek 排课）
  → classTaskStore.generateTodayTasks()   // 每天生成 12 节 ClassTask
  → classTasks[]（status: pending/started/completed/overdue/absent）
```

### 2.3 持久化
- 两个 store 都 persist 到 localStorage，`merge` 时保留用户进度、补充新增字段。
- 照片 base64 已改存外部 Filesystem（`MOSS_Photos/`），localStorage 只存路径。

---

## 3. 当前任务流

```
SCHEDULE 排课
  ↓ generateTodayTasks()（每天一次）
ClassTask(pending)
  ↓ 用户在 Quests 点"开始"
startClassTask() → status=started, 设 currentTask
  ↓ 用户在 Quests 点"拍照核验"
handleTakePhoto() → verifyClassPhoto()（AI 二号打分）
  ↓ 通过
completeClassTask() → status=completed, 加积分+XP, 记 taskHistory
  ↓
（超时未完成）checkOverdue()（60s轮询）→ markTaskOverdue → status=overdue, 扣分
```

**任务状态机（classTaskStore 私有）：**
```
pending → started → completed
              ↘ overdue（超时）
              ↘ absent（缺课）
```

> ⚠️ 这是**任务侧**的状态机，与"用户实际在做什么"（专注/分心）**完全无关**。
> 任务完成靠**用户手动拍照核验**，不靠行为监测。

---

## 4. 当前监控流

**有两套并行监控，且互不通信：**

**A. Android 原生 MonitorService.kt（前台服务，每 60s）**
```
pollUsage()
  → 当前前台 App ∈ STUDY_PACKAGES → consecutiveStudyMin++，连学≥90min→关怀通知
  → 当前前台 App ∈ ENTERTAINMENT_PACKAGES
       深夜(23-5)→通知+锁屏 / 晚间(17-22)娱乐累计>1h→通知
```

**B. Web 侧 main.tsx monitorUsage（每 5 分钟）**
```
fetchUsageStats(00:00→now)
  → updateMonitorState：entMs > studyMs 且 >2min → warning++
       warning≥2 → -50 分（"检测到长时间娱乐"）
```

> ⚠️ **两套监控各自独立**：
> - Android 侧直接发通知/锁屏，**不产生事件给 TS**
> - Web 侧只算"今天娱乐是否超学习"，**和具体任务无关**
> - **没有"当前任务期间用户是否在分心"的判断**

---

## 5. 当前 AI 流

**双 AI 架构：**
| AI | 配置字段 | 用途 |
|---|---|---|
| MOSS（监工） | `ai` | Chat 对话 + 工具调用（add_points/add_quest/complete_quest/check_phone_usage…） |
| 二号验证官 | `ai2` | 打卡照片核验（verifyClassPhoto） |

**Chat 工具调用（ai.ts）：** `add_points` / `add_quest` / `complete_quest` / `add_achievement` / `update_achievement` / `unlock_achievement` / `check_phone_usage` / `update_subject_score` / `add_milestone` / `generate_weekly_plan` / `request_usage_permission` 等约 14 个工具。

**verifyClassPhoto（verifyAI.ts）：** 照片 base64 → AI 多模态打分 → pass/fail + score。无 AI key 时降级为"未核验"。

> ⚠️ AI 目前**只在用户主动对话时**工作，**不主动监控行为、不主动干预**。AI 不知道"当前任务""用户正在用什么 App""分心了多久"。

---

## 6. 当前奖励流

| 触发 | 奖励/惩罚 | 触发点 |
|---|---|---|
| 课程打卡完成 | baseReward + bonus(限时+AI分) | completeClassTask |
| 深渊完成 | +400 分 + XP | Dungeon 计时归零 |
| 学习时长（监控） | +XP（增量） | main.tsx monitorUsage |
| 全勤 | +150 分（连签加成） | checkFullAttendance (23:50) |
| 连签达标 | streak+1, +100XP | dailySettle |
| 成就解锁 | +200 分 + XP | checkAchievements |
| 课程逾期 | -penalty | checkOverdue |
| 长时间娱乐 | -50 分 | monitorUsage |

> ⚠️ 奖励由**多个分散的函数**直接 `addPoints/addExp`，没有统一的 RewardEngine。

---

## 7. 当前存在的主要问题（对应重构目标）

### 🔴 P0：没有"当前任务（Mission）"的统一定义
- `currentTask` 只存在于 classTaskStore，且只表示"已开始的课程任务"。
- Dungeon 读 `currentTask` 但**自己维护计时器/状态**，任务状态分散。
- **没有一个"用户当前真正该做的事"的中心对象**贯穿 Home/Dungeon/监控/AI。

### 🔴 P0：任务 ≠ 行为，完成靠手动
- 任务完成靠**用户手动拍照核验**，不是行为监测自动判定。
- 系统**不知道用户是否真的在做当前任务**，只靠用户自觉打卡。

### 🔴 P0：两套 App 分类，不一致
- Kotlin `MonitorService.kt` 有 `STUDY_PACKAGES`/`ENTERTAINMENT_PACKAGES`（16+8 个包）。
- TS `appClassification.ts` 有**另一套更大**的分类（含关键词模糊匹配）。
- **同一 App 在 Android 和 TS 可能分到不同类别** → 监控和统计口径不一致。

### 🔴 P0：监控不产生 BehaviorEvent，直接干预
- MonitorService 直接发通知/锁屏，Web 侧 monitorUsage 直接扣分。
- **没有统一的 BehaviorEvent 事件流**，无法做"分心→分级干预→恢复"。

### 🟠 P1：UsageStats 只按"全天"统计
- `fetchUsageStats(00:00→now)` 是全天累计，**无法回答"当前数学任务期间学了多久"**。
- 缺少 Mission 窗口的有效学习/分心时长统计。

### 🟠 P1：无分级干预
- 第一次分心就可能 -50 分（monitorUsage），**没有 LEVEL 0/1/2/3 分级干预**。
- 目标是"恢复用户"而非"惩罚用户"，当前是惩罚导向。

### 🟠 P1：Dungeon 自维护任务状态
- Dungeon 用自己的 `timeLeft/isRunning/mode`，不读中心 Mission。
- 违反"不让 Dungeon 维护自己的任务状态"。

### 🟠 P1：AI 不感知行为
- AI（MOSS）不知道当前 Mission、实际学习时长、分心时长、当前 App。
- AI 无法"主动干预"，只能被动应答。

### 🟡 P2：奖励分散
- 奖励逻辑散落在 `completeClassTask` / `monitorUsage` / `checkFullAttendance` / `dailySettle` / `checkAchievements` 等多处，直接调 `addPoints/addExp`，无统一 RewardEngine。

### 🟡 P2：状态恢复
- 任务/积分靠 localStorage persist 能恢复，但"当前 Mission 进行中"的中间态（FOCUSING/DISTRACTED）重启后可能丢失。

---

## 8. 本方案准备修改哪些地方（重构蓝图）

> 对应你的四阶段方案。核心：新增 `src/core/discipline/`，把现有功能全部变成 DisciplineEngine 的外围。

### 新增核心模块 `src/core/discipline/`
- **`Mission`**：当前真正要做的一件事（title/subject/plannedStart/plannedEnd/targetMinutes/actualStudyMs/distractionMs/status/interventionLevel…）
- **`BehaviorEvent`**：所有真实行为统一成事件（APP_FOREGROUND / APP_BACKGROUND / SCREEN_ON/OFF / MISSION_STARTED/STOPPED…）。**Android 和 UsageStats 只提供事实，不加 XP、不扣分、不判完成。**
- **`DisciplineEngine`**：`handleEvent(event)` 统一处理 → 判断该做什么/实际在做什么/是否分心/算有效学习/更新 Mission/决定干预/判完成/发奖励/进入下一任务。
- **统一状态机**：`READY → FOCUSING → DISTRACTED → INTERVENTION → RECOVERING → COMPLETED`（+ `IDLE`/`MISSED`）。所有页面不再自定义任务状态。

### 现有功能接入方式（不删除，改造成外围）
| 模块 | 改造方向 |
|---|---|
| Home | 首屏改为"我现在应该做什么"（当前 Mission + 剩余时间 + 开始专注），次要显示统计/XP/PTS |
| Quests | 只负责创建/查看 Mission 和计划，**不再自己判完成、不点击发奖** |
| Dungeon | 改为"当前 Mission 的执行界面"，读 `disciplineStore.currentMission`，不再自维护 currentTask |
| UsageStats | 支持按 Mission 窗口统计（missionStart→now），产出有效学习/分心/其他时长，只做数据源 |
| Android Monitor | 只产 BehaviorEvent（前台 App/App 切换/屏幕状态/系统干预），**不在 Android 加积分/扣分/判完成** |
| App 分类 | 统一成单一数据源 `config/appCategories.json`（study/entertainment/social/neutral），Android 和 TS 共用 |
| AI | 保留 Chat + Tool，新增 **AI Supervisor**：接收当前 Mission/目标/实际学习/分心/当前App/剩余时间/干预等级/最近行为，负责判断如何干预/生成提醒/恢复方案。**AI 不伪造数据，事实由程序提供** |
| 干预 | LEVEL 0 正常 / 1 轻提醒 / 2 强提醒 / 3 恢复模式。第一次分心只提醒不扣分，核心是**恢复用户** |
| Reward | XP/PTS/成就保留，但统一由 Mission 完成 → RewardEngine 发放，页面不直接发奖 |

### 绝对不做（对应你的"绝对不要做"）
- 不一开始重写整个项目；不删除现有功能
- 不让每个页面维护自己的 currentTask
- 不让 Dungeon 维护任务状态
- 不让 Quest 点击直接发奖
- 不让 Android 直接扣分
- 不让 AI 编造学习时间/无行为数据时判完成
- 不让 TS 和 Android 维护两套分类
- 不在第一次分心就惩罚
- 不为架构漂亮大改无关代码

---

## 9. 待你确认的关键决策点

在进入第二阶段前，请确认以下几点（影响实现方式）：

1. **Mission 来源**：Mission 是继续用现在的"固定课表 SCHEDULE"自动生成，还是改成"用户/AI 动态创建目标"？还是两者并存（课表自动生成 + 用户可加自定义 Mission）？
2. **打卡核验是否保留**：现在靠拍照 + AI 核验。重构后"完成判定"交给 DisciplineEngine（行为监测），那拍照核验是**保留作为可选加强验证**，还是**完全由行为监测取代**？
3. **两套 App 分类合并**：合并成单一 `appCategories.json` 时，以哪套为准？（建议以 TS 侧更完整的为准，Android 侧读取同一份）
4. **干预的执行手段**：分心干预目前是"通知 + 锁屏遮罩"。重构后 LEVEL 2/3 强干预，是否沿用锁屏遮罩？
5. **Mission 持久化粒度**：Mission 中间态（FOCUSING/DISTRACTED）需要跨 App 重启 / Android Service 重启保留，确认用 localStorage persist 是否足够（还是需要 Android 侧也存一份）。

---

> 确认以上理解和决策点后，我将进入第二阶段：搭建 `src/core/discipline/`（Mission / BehaviorEvent / DisciplineEngine），并逐模块接入。
