# 自律养成

> 一个仿智谱清言设计语言的 Android 自律养成 App。根据手机使用时长、深夜时段、连续低分等自动提醒和记录，把自律变成养成游戏。

## ✨ 功能一览

| 序号 | 功能 | 实现位置 |
|------|------|----------|
| 1 | 手机 App 使用时长统计 | `src/pages/Stats.tsx` + `src/lib/usageStats.ts` + `android_plugin/.../SelfDisciplinePlugin.kt` |
| 2 | 个性化提示与状态记录 | `src/pages/Settings.tsx` + `src/stores/useStore.ts` |
| 3 | 情绪关怀与防倦怠 | `src/pages/Home.tsx` + `src/lib/usageStats.ts` |
| 4 | 奖励兑换商店 | `src/pages/Shop.tsx` |
| 5 | 学习效率深度分析 | `src/pages/PointsDetail.tsx` |
| 6 | 成就剧情化与养成 | `src/pages/Achievements.tsx` |

## 🧱 技术栈

- **前端**：React 18 + Vite 5 + TypeScript 5 + Tailwind 3 + Zustand 4 + React Router 6
- **服务端**：可选 Express 本地接口（如需扩展）
- **Android 桥接**：Capacitor 6 + 自定义 Kotlin 插件（UsageStatsManager / 强制锁屏 Activity / 前台轮询 Service / BootReceiver）
- **设计语言**：仿智谱清言（#2454FF 主色、卡片式、移动 ≤480px、安全区适配）

## 📁 项目结构

```
self_discipline_app/
├── capacitor.config.ts            # Capacitor 配置
├── index.html                     # Vite 入口
├── package.json
├── tailwind.config.js             # 仿清言配色 + 圆角 + 阴影 token
├── vite.config.ts                 # dev 模式 /api 代理到 8787
├── tsconfig.json
├── src/
│   ├── main.tsx                   # 路由表
│   ├── components/AppShell.tsx    # 顶部条 + 底部 5 Tab
│   ├── pages/
│   │   ├── Onboarding.tsx         # 首启：昵称+目标设定
│   │   ├── Home.tsx               # 今日进度环 + 快捷面板
│   │   ├── Stats.tsx              # 今日榜单/趋势/分类圆环
│   │   ├── Shop.tsx               # 积分商店
│   │   ├── Achievements.tsx       # 成就与里程碑
│   │   └── Settings.tsx           # 调整目标/备份/重置
│   ├── stores/                    # Zustand 持久化：用户/统计/聊天
│   ├── lib/
│   │   ├── ai.ts                  # 封装 4 个 AI 接口调用
│   │   ├── usageStats.ts          # 原生桥接 + mock fallback
│   │   ├── format.ts              # 时间格式化
│   │   └── native-bridge.d.ts     # window.SelfDiscipline 类型声明
│   ├── data/                      # 静态数据：人格/分类/世界/奖励
│   └── styles/index.css           # Tailwind 基础 + 动画
├── server/
│   └── index.ts                   # 可选本地接口
└── android_plugin/                # Kotlin 原生代码（拷到 android/app/src/main/）
    ├── AndroidManifest.xml        # 权限 + Activity/Service/Receiver 注册
    ├── res/values/{styles,strings}.xml
    └── java/cn/selfdiscipline/app/
        ├── MainActivity.kt        # 注册 SelfDiscipline 插件
        └── plugin/
            ├── SelfDisciplinePlugin.kt   # UsageStats / 锁屏 / 权限
            ├── LockScreenActivity.kt     # 全屏倒计时遮罩
            ├── MonitorService.kt         # 前台轮询 + 深夜/超长学习触发
            └── BootReceiver.kt           # 开机自启
```

## 🚀 本地预览（Web/PWA）

```bash
# 1. 安装依赖
npm install

# 2. 启动前端
npm run dev          # http://localhost:5173
```

打开浏览器开发者工具切到移动端视图（建议 390×844 iPhone 14），即可体验完整 6 大功能。

> ⚠️ 浏览器环境拿不到 Android UsageStats 真实数据，会自动降级到 mock 数据；锁屏会以 alert 形式模拟。

## 📱 打包 Android APK

云端环境无 Android SDK，请按以下步骤在本机（Mac/Win/Linux）执行：

```bash
# 1. 安装 Capacitor CLI（已含在 devDependencies）
npm install

# 2. 拷贝 android_plugin/ 内文件到生成的 android 工程
npm run build
npx cap add android
# 此时生成 android/ 目录

# 3. 覆盖原生代码与权限
cp -r android_plugin/java/* android/app/src/main/java/
cp android_plugin/AndroidManifest.xml android/app/src/main/AndroidManifest.xml  # 注意合并而非直接覆盖
cp -r android_plugin/res/* android/app/src/main/res/

# 4. 在 app/build.gradle 添加 LockScreenActivity 主题
#    （android_plugin/res/values/styles.xml 已就绪，Capacitor 默认会合并）

# 5. 同步 Web 资源到 Android 工程
npx cap sync android

# 6. 用 Android Studio 打开 android/ 目录
npx cap open android

# 7. 在 Android Studio 中 Build → Build APK(s)
#    输出：android/app/build/outputs/apk/debug/app-debug.apk
```

### 真机部署后必做

1. 打开 App 后系统会引导到「使用情况访问」权限页 → 找到「自律养成」→ 开启
2. 长按桌面 → 添加桌面小组件（可选，后续迭代支持）
3. 系统设置 → 电池 → 自启动管理 → 允许本 App 后台运行（保证 MonitorService 持续轮询）

## 🧠 本地接口说明

如需扩展，可在 server 目录下继续添加接口；当前前端主要通过本地状态和 Android 权限数据驱动体验。

## 🎮 玩法机制

### 积分体系
- 完成日目标 → +50 基础分
- 专注度每提升 10 → +10 分
- 娱乐时长超阈值 → 扣分（人格化警告）
- 免罚卡 ×1 抵消一次扣分

### 自律能量（养成用）
- 每日结算积分的 30% 转为能量
- 解锁地图（200/800/2000/5000）
- 解锁宠物（普通/稀有/史诗/传说）
- 养成进度与成就系统

### 悔悟机制
- 失败日可在 7 天内用「悔悟钥匙」弥补
- 涅槃凤凰宠物：失败后连续 7 天满分解锁

### 深度谈话模式
连续 3 天评分 < 60 时，系统会进入提醒模式：
1. 先承认情绪
2. 分析最近 3 天行为模式
3. 提出调整方案
4. 承诺重置 30% 惩罚

## 📝 设计决策

1. **为什么用 Capacitor 而不是 React Native**：保留 Web 开发体验，原生 API 通过自定义插件桥接，对前端代码无侵入。
2. **为什么使用本地状态驱动**：避免额外服务依赖，让应用在离线场景下也能稳定运行。
3. **为什么锁屏用 Activity 不用 DPM**：DPM.lockNow() 需要 Device Admin 权限，用户接受度低；Activity 全屏遮罩 + 屏蔽返回键已能满足"强制休息"诉求。

## 🛡️ 隐私

- 使用时长数据仅本地存储，不上传服务器
- 相关状态与统计信息保留在本地，避免隐私泄露

## 📜 License

MIT
