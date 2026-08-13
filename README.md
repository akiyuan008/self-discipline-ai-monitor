# 自律养成 · AI监工

> 一个 Android 自律养成 App。你只需**表达目标并开始任务**，系统会自动监控你的行为、发现分心、分级干预、帮你恢复、判定完成、发放奖励，然后进入下一个任务——把自律变成一个有人盯着的养成游戏。

## ✨ 功能一览

| 序号 | 功能 | 实现位置 |
|------|------|----------|
| 1 | **自律核心**（Mission 状态机 / 分心检测 / 分级干预 / 统一发奖） | `src/core/discipline/` |
| 2 | **FocusEvidence 专注证据去重**（Dungeon + 学习 App 双源不重复计） | `src/core/discipline/focusMath.ts` |
| 3 | 手机 App 使用时长统计（行为数据源） | `src/lib/usageStats.ts` + `SelfDisciplinePlugin.kt` |
| 4 | AI 监工 MOSS 对话（工具调用：积分/任务/成就/**建 Mission**） | `src/pages/Chat.tsx` + `src/lib/ai.ts` |
| 5 | AI Supervisor（监督话语 / AI 证据判定 / 动态建 Mission） | `src/core/discipline/aiSupervisor.ts` |
| 6 | 课表打卡 + AI 照片核验（Evidence 之一） | `src/pages/Quests.tsx` + `src/lib/verifyAI.ts` |
| 7 | 深渊专注（Mission 的 Focus Runtime） | `src/pages/Dungeon.tsx` |
| 8 | 积分商店（零食/道具兑换） | `src/pages/Shop.tsx` + `src/data/shop.ts` |
| 9 | 高考档案/估分/周报 | `src/stores/gaoKaoStore.ts` + `src/components/GaokaoProgress.tsx` |
| 10 | 双主题皮肤（默认 / 流浪地球 MOSS 风） | `src/components/ThemeToggle.tsx` + `src/styles/index.css` |
| 11 | 课程/干预/AI 监督通知 | `src/main.tsx` + Capacitor LocalNotifications |

## 🧠 核心理念

整个 App 围绕一个 **Mission（当前真正该做的一件事）** 运转：

```
课表(SCHEDULE) / 手动(USER) / AI(AI)   ← 三种来源，统一成一个 Mission 模型
        ↓
   DisciplineEngine（核心状态机）
        ↓
  证据汇流（统一去重）：UsageStats + Dungeon + 拍照/AI
        ↓
  分心检测 → 分级干预(LEVEL 0/1/2/3) → 帮助恢复
        ↓
  MissionEvaluator 判完成 → RewardEngine 统一发奖 → 下一任务
```

**六条设计原则：**
1. **Mission 是唯一中心对象**——三种来源统一模型，不维护多套 CurrentTask。
2. **事实与判断分离**——Android/UsageStats/Dungeon 只产事实，不加积分、不判完成。
3. **证据驱动完成**——靠行为证据判完成，拍照只是可选 Evidence，不是默认门槛。
4. **统一去重**——Dungeon 专注与学习 App 时长是两套证据，区间合并计算，绝不重复累加。
5. **Recovery > Punishment**——分心分级干预，第一次只提醒不惩罚，目标是帮你回到任务。
6. **奖励统一发放**——所有 XP/PTS/成就由 RewardEngine 发放，页面/Android/AI 不直接发奖。

## 🧱 技术栈

- **前端**：React 18 + Vite 5 + TypeScript 5 + Tailwind 3 + Zustand 4（localStorage 持久化）
- **自律核心**：`src/core/discipline/` 纯 TS 模块（状态机 / 证据去重 / 评估 / 奖励 / AI 监督）
- **AI**：前端直连用户自配置的 OpenAI 兼容 API（function calling + SSE 流式），API Key 仅存本地
- **Android 桥接**：Capacitor 6 + 自定义 Kotlin 插件（UsageStatsManager / 锁屏 Activity / 前台 Service / 行为事件）
- **App 分类 SSOT**：`config/appCategories.json` 单一数据源，TS 与 Android 构建时共用
- **构建**：GitHub Actions 自动构建 APK 并发布 Release（见 `.github/workflows/build-apk.yml`）

## 📁 项目结构

```
self-discipline-ai-monitor/
├── capacitor.config.ts            # Capacitor 配置
├── index.html                     # Vite 入口
├── vite.config.ts
├── tailwind.config.js
├── public/version.json            # 版本号唯一来源（CI 读取）
├── config/appCategories.json      # App 分类唯一数据源（study/entertainment/social/neutral）
├── scripts/gen-android-categories.mjs  # JSON → AppCategories.kt 生成器（prebuild 钩子）
├── src/
│   ├── main.tsx                   # 入口：initDiscipline + 定时调度/通知/使用统计
│   ├── App.tsx                    # 页面导航 + 物理返回键处理
│   ├── core/discipline/           # ★ 自律核心
│   │   ├── types.ts               #   Mission/事件/证据/状态机/干预等级
│   │   ├── focusMath.ts           #   区间合并去重
│   │   ├── missionStore.ts        #   Mission 业务 SoT（persist + Android 镜像）
│   │   ├── disciplineEngine.ts    #   核心状态机 + addFocusInterval
│   │   ├── missionEvaluator.ts    #   证据驱动完成判定
│   │   ├── rewardEngine.ts        #   统一奖励发放（含深渊 400PTS）
│   │   ├── scheduleToMissions.ts  #   课表 → Mission 生成
│   │   ├── aiSupervisor.ts        #   AI 监督策略
│   │   ├── appCategories.ts       #   分类加载器
│   │   └── runtime.ts             #   运行时初始化/采样/干预接线
│   ├── components/                # Dock / ThemeToggle / Toast / GaokaoProgress
│   ├── pages/                     # Home / Dungeon / Quests / Shop / Chat / Profile ...
│   ├── stores/                    # useStore / classTaskStore / gaoKaoStore
│   ├── lib/                       # ai / verifyAI / usageStats / backup / logger / indexedDB
│   ├── data/                      # 课程表 / 商店 / 成就 / App 分类 / 模型预设
│   └── styles/index.css           # 主题变量 + 组件样式
├── docs/
│   ├── CURRENT_ARCHITECTURE.md    # ★ 重构后权威架构文档
│   └── ARCHITECTURE_BASELINE_pre_refactor.md  # 重构前基线（历史）
└── android_plugin/                # Kotlin 原生代码（CI 拷到 android/app/src/main/）
    ├── AndroidManifest.xml
    ├── res/values/{styles,strings}.xml
    └── java/cn/selfdiscipline/app/
        ├── MainActivity.kt        # 注册 SelfDiscipline 插件
        └── plugin/
            ├── SelfDisciplinePlugin.kt   # UsageStats/锁屏/权限/镜像同步/行为事件
            ├── AppCategories.kt          # （生成）分类，与 TS 共用
            ├── MissionMirror.kt          # 最小 Mission 镜像（重启双保险）
            ├── MonitorService.kt         # 前台服务：产 APP_FOREGROUND 事件
            ├── LockScreenActivity.kt     # 全屏倒计时遮罩（LEVEL2/3）
            └── BootReceiver.kt           # 开机自启
```

## 🚀 本地预览（Web）

```bash
npm install
npm run dev          # http://localhost:5173
```

> ⚠️ 浏览器环境拿不到 Android UsageStats 真实数据，会自动降级到 mock 数据。

## 📱 打包 Android APK

推送到 `main` 分支即可由 GitHub Actions 自动构建并发布 prerelease APK。

> `npm run build` 会通过 `prebuild` 钩子自动从 `config/appCategories.json` 重新生成 `AppCategories.kt`，保证 Android 分类与 TS 始终一致。

本地构建：

```bash
npm install
npm run build                    # prebuild 自动生成 AppCategories.kt
npx cap add android
# 将 android_plugin/ 下文件拷入 android/ 工程（见 CI 工作流步骤）
npx cap sync android
npx cap open android             # Android Studio 中 Build → Build APK(s)
```

### 真机部署后必做

1. 打开 App 后引导到「使用情况访问」权限页 → 找到本 App → 开启
2. 系统设置 → 电池 → 自启动管理 → 允许本 App 后台运行（保证 MonitorService 持续产行为事件）

## 🎮 玩法机制

### Mission（任务）
- **课表任务**：按 SCHEDULE 每天自动生成（source=SCHEDULE）。
- **动态任务**：Quests 页「+ 动态任务」手动创建（source=USER）。
- **AI 任务**：对 MOSS 说"今晚想把函数第三章看完"，它帮你建（source=AI）。
- 任务状态机：`READY → FOCUSING → DISTRACTED → INTERVENTION → RECOVERING → COMPLETED`。

### 专注时长（FocusEvidence，统一去重）
- **Dungeon 专注** 与 **学习 App 使用** 都作为证据区间写入 Mission。
- 由 `focusMath` 区间合并去重：中途切出刷视频的那段自动不算专注，两源重叠不重复计。
- 有效学习时长达到目标（默认 ≥80%）→ Mission 完成。

### 分心干预（Recovery > Punishment）
| 等级 | 分心持续 | 手段 |
|------|---------|------|
| LEVEL 1 | ≥1 分钟 | 通知提醒 |
| LEVEL 2 | ≥5 分钟 | 强提醒 + 锁屏遮罩（可恢复）+ MOSS 监督话语 |
| LEVEL 3 | ≥15 分钟 | 强制恢复模式 + MOSS 监督话语 |

第一次分心只提醒、不扣分、不锁死。

### 积分（PTS）与经验（XP）——统一由 RewardEngine 发放
- **Mission 完成** → 基础 PTS（按目标时长）+ XP（按有效学习分钟）+ 高专注加成。
- **深渊挑战** → Mission 证据含 DUNGEON(abyss) → 额外 +400 PTS。
- 试卷/作业/背诵类任务需补充证据（拍照 / AI 判定 / 手动）才完成。
- 连签、全勤、成就等奖励保留。

## 📝 设计决策

1. **为什么用 Capacitor 而不是 React Native**：保留 Web 开发体验，原生 API 通过自定义插件桥接，对前端代码无侵入。
2. **为什么 AI 由前端直连**：用户自带 OpenAI 兼容 API Key（仅存本机 localStorage），无需后端，也无服务端 Key 泄露面。
3. **为什么锁屏用 Activity 不用 DPM**：DPM.lockNow() 需 Device Admin 权限，接受度低；Activity 全屏遮罩 + 屏蔽返回键已够。
4. **为什么 App 分类用单一 JSON**：原来 TS 和 Kotlin 各维护一套名单，同一 App 可能分到不同类别。现统一为 `config/appCategories.json`，Android 构建时生成 `AppCategories.kt`。
5. **为什么 Dungeon 与 UsageStats 时长要去重**：两者都是"专注"证据源，若各自累加会把 45 分钟算成 90 分钟。统一成 FocusInterval 区间合并，唯一入口计算。
6. **为什么奖励统一走 RewardEngine**：避免页面/Android/AI 各自发奖造成双重奖励（如深渊 400 PTS 既由 Dungeon 发又由 Mission 发）。

## 🛡️ 隐私

- 使用时长、积分、对话等数据仅本地存储，不上传任何服务器。
- AI 请求直连用户自己配置的 API 端点，应用不经过任何中转。

## 📚 文档

- 完整架构见 [`docs/CURRENT_ARCHITECTURE.md`](docs/CURRENT_ARCHITECTURE.md)（重构后权威版本）。
- 重构前基线见 [`docs/ARCHITECTURE_BASELINE_pre_refactor.md`](docs/ARCHITECTURE_BASELINE_pre_refactor.md)。

## 📜 License

MIT
