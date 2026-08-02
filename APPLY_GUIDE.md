# 自律养成 App — 修复补丁 v2（含 AI 监督者页面）

## 本次新增/修复内容

| 文件 | 说明 |
|------|------|
| `src/pages/AIChat.tsx` | **新建**：AI 监督者对话页面。支持流式输出、快捷指令、气泡对话、自动滚动 |
| `src/pages/Settings.tsx` | **重写**：完整可编译。含 AI 监管者配置（API Key / Endpoint / Model / System Prompt / 测试连接）、番茄钟、高考档案、深色模式、备份、重置 |
| `src/components/Dock.tsx` | **重写**：5 Tab 版本，第二个位置是「监督者」（🤖），其余为首页/任务/商店/档案 |
| `src/pages/Home.tsx` | 补全残缺外壳，可编译 |
| `src/stores/useStore.ts` | 补全 AI 字段 + 道具效果 + 免罚卡逻辑 |
| `src/data/appClassification.ts` | 包名与 Kotlin 后端统一 |
| `src/lib/native-bridge.d.ts` | 新建全局类型声明 |
| `src/pages/Stats.tsx` | 新建使用时长统计页 |

## 快速应用步骤

### 1. 覆盖文件
```bash
cp self-discipline-fixes/src/pages/AIChat.tsx       src/pages/AIChat.tsx
cp self-discipline-fixes/src/pages/Home.tsx         src/pages/Home.tsx
cp self-discipline-fixes/src/pages/Settings.tsx      src/pages/Settings.tsx
cp self-discipline-fixes/src/pages/Stats.tsx         src/pages/Stats.tsx
cp self-discipline-fixes/src/components/Dock.tsx   src/components/Dock.tsx
cp self-discipline-fixes/src/stores/useStore.ts      src/stores/useStore.ts
cp self-discipline-fixes/src/data/appClassification.ts src/data/appClassification.ts
cp self-discipline-fixes/src/lib/native-bridge.d.ts  src/lib/native-bridge.d.ts
```

### 2. 修改 App.tsx

**a) 顶部 import 新增：**
```tsx
import AIChat from '@/pages/AIChat'
import Stats from '@/pages/Stats'
```

**b) DOCK_PAGES 改为 5 个：**
```tsx
const DOCK_PAGES: PageId[] = ['home', 'aichat', 'quests', 'shop', 'profile']
```

**c) BACK_MAP 新增：**
```tsx
const BACK_MAP: Partial<Record<PageId, PageId>> = {
  dungeon: 'home',
  achievements: 'profile',
  settings: 'profile',
  pointsDetail: 'home',
  stats: 'home',
  aichat: 'home',      // ← 新增
}
```

**d) renderPage 的 switch 里新增 case：**
```tsx
case 'aichat':
  return <AIChat onNavigate={(p) => setCurrent(p)} />
case 'stats':
  return <Stats onNavigate={(p) => setCurrent(p)} />
```

**e) PageId 类型里加上 `'aichat'` 和 `'stats'`：**
在 `src/stores/useStore.ts` 里：
```tsx
export type PageId =
  | 'home'
  | 'aichat'      // ← 新增
  | 'dungeon'
  | 'quests'
  | 'shop'
  | 'profile'
  | 'achievements'
  | 'settings'
  | 'pointsDetail'
  | 'stats'       // ← 新增
  | 'onboarding'
```

### 3. 编译验证
```bash
npm run build
```

### 4. 提交
```bash
git add -A
git commit -m "feat: 新增 AI 监督者对话页，补全 Settings/Home/Stats，统一包名，完善道具系统"
git push origin main
```

## AI 监督者页面功能

- **流式对话**：打字机效果逐字输出，支持 SSE 流式解析
- **快捷指令**：首次进入时展示 5 个常用指令按钮（查看表现、扣积分、奖励、加任务、设 HP）
- **工具调用可视化**：AI 调用 add_points / set_hp / add_quest 等工具后，结果会显示在对话中
- **配置入口**：对话页右上角 ⚙️ 可直接跳转到 Settings 的 AI 配置区
- **状态栏**：顶部显示当前 HP 和积分，AI 随时掌握你的状态

## Settings 里的 AI 配置

打开「设置 → AI 监管者」：
1. **API Key**：填入你的 Key（如 DeepSeek、通义千问等）
2. **Endpoint**：如 `https://api.deepseek.com` 或 `https://dashscope.aliyuncs.com/compatible-mode/v1`
3. **模型名称**：如 `deepseek-chat`、`qwen-plus`
4. **System Prompt**：可自定义监督者人格，留空则用默认严厉教练风格
5. **测试连接**：一键验证配置是否正确
6. **保存**：配置仅存在本地 localStorage

## 仍建议后续完善

1. **Quests.tsx / Achievements.tsx / Profile.tsx / Onboarding.tsx / PointsDetail.tsx / Dungeon.tsx** — 如果也是残缺 JSX，需要同样补全外壳
2. **深度谈话模式** — 连续 3 天评分 < 60 的触发逻辑
3. **悔悟钥匙机制** — 失败日 7 天内弥补
4. **MonitorService.kt** — 国产 ROM 兼容优化
