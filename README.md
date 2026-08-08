# 自律养成 · AI监工

> 一个 Android 自律养成 App：AI 监管者根据手机使用时长、课程打卡、专注时长等数据督促你学习，把自律变成养成游戏。

## ✨ 功能一览

| 序号 | 功能 | 实现位置 |
|------|------|----------|
| 1 | 手机 App 使用时长统计 | `src/lib/usageStats.ts` + `android_plugin/.../SelfDisciplinePlugin.kt` |
| 2 | AI 监管者对话（工具调用积分/任务/成就） | `src/pages/Chat.tsx` + `src/lib/ai.ts` |
| 3 | 课程表打卡 + AI 照片验证 | `src/pages/Quests.tsx` + `src/lib/verifyAI.ts` |
| 4 | 深渊专注模式（番茄钟） | `src/pages/Dungeon.tsx` |
| 5 | 积分商店（零食/道具兑换） | `src/pages/Shop.tsx` + `src/data/shop.ts` |
| 6 | 高考档案/估分/周报 | `src/stores/gaoKaoStore.ts` + `src/components/GaokaoProgress.tsx` |
| 7 | 双主题皮肤（默认 / 流浪地球） | `src/components/ThemeToggle.tsx` + `src/styles/index.css` |
| 8 | 课程提醒通知 | `src/main.tsx` + Capacitor LocalNotifications |

## 🧱 技术栈

- **前端**：React 18 + Vite 5 + TypeScript 5 + Tailwind 3 + Zustand 4（localStorage 持久化）
- **AI**：前端直连用户自配置的 OpenAI 兼容 API（function calling + SSE 流式），API Key 仅存本地
- **Android 桥接**：Capacitor 6 + 自定义 Kotlin 插件（UsageStatsManager / 锁屏 Activity / 前台轮询 Service / BootReceiver）
- **构建**：GitHub Actions 自动构建 APK 并发布 Release（见 `.github/workflows/build-apk.yml`）

## 📁 项目结构

```
self-discipline-ai-monitor/
├── capacitor.config.ts            # Capacitor 配置
├── index.html                     # Vite 入口
├── vite.config.ts
├── tailwind.config.js
├── public/version.json            # 版本号唯一来源（CI 读取）
├── src/
│   ├── main.tsx                   # 入口：定时调度/通知/使用统计轮询
│   ├── App.tsx                    # 页面导航 + 物理返回键处理
│   ├── components/                # Dock / ThemeToggle / Toast / GaokaoProgress
│   ├── pages/                     # Home / Dungeon / Quests / Shop / Chat / Profile ...
│   ├── stores/                    # useStore / classTaskStore / gaoKaoStore
│   ├── lib/                       # ai / verifyAI / usageStats / backup / logger / indexedDB
│   ├── data/                      # 课程表 / 商店 / 成就 / App 分类 / 模型预设
│   └── styles/index.css           # 主题变量 + 组件样式
└── android_plugin/                # Kotlin 原生代码（CI 拷到 android/app/src/main/）
    ├── AndroidManifest.xml
    ├── res/values/{styles,strings}.xml
    └── java/cn/selfdiscipline/app/
        ├── MainActivity.kt        # 注册 SelfDiscipline 插件
        └── plugin/
            ├── SelfDisciplinePlugin.kt   # UsageStats / 锁屏 / 权限
            ├── LockScreenActivity.kt     # 全屏倒计时遮罩
            ├── MonitorService.kt         # 前台轮询
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

本地构建：

```bash
npm install
npm run build
npx cap add android
# 将 android_plugin/ 下文件拷入 android/ 工程（见 CI 工作流步骤）
npx cap sync android
npx cap open android   # Android Studio 中 Build → Build APK(s)
```

### 真机部署后必做

1. 打开 App 后引导到「使用情况访问」权限页 → 找到本 App → 开启
2. 系统设置 → 电池 → 自启动管理 → 允许本 App 后台运行（保证 MonitorService 持续轮询）

## 🎮 玩法机制

### 积分（PTS）
- 完成课程打卡 → +baseReward（按时完成 +10，AI 评分 ≥80 +20）
- 完成自定义任务 → +任务奖励
- 课程逾期/缺课 → -penalty
- 长时间娱乐被监测到 → -50

### 经验（XP）与等级
- 学习 1 分钟 → +1 XP（增量发放）
- 打卡 +50 XP（AI 评分 ≥90 额外 +30）
- 每 1000 XP 升 1 级

### 深渊模式
高压专注挑战，中途退出会被判定失败并留下记录；完美通关 +200 PTS + 双倍经验。

## 📝 设计决策

1. **为什么用 Capacitor 而不是 React Native**：保留 Web 开发体验，原生 API 通过自定义插件桥接，对前端代码无侵入。
2. **为什么 AI 由前端直连**：用户自带 OpenAI 兼容 API Key（仅存本机 localStorage），无需维护后端服务，也不存在服务端 Key 泄露面。
3. **为什么锁屏用 Activity 不用 DPM**：DPM.lockNow() 需要 Device Admin 权限，用户接受度低；Activity 全屏遮罩 + 屏蔽返回键已能满足"强制休息"诉求。

## 🛡️ 隐私

- 使用时长、积分、对话等数据仅本地存储，不上传任何服务器
- AI 请求直连用户自己配置的 API 端点，应用不经过任何中转

## 📜 License

MIT
