# V3 · 02 — PROBLEM LIST（问题清单）

> 每条问题：**现象 → 代码定位 → 为什么违背 V3 产品原则 → 对应 V3 需求**。
> 严重度：🔴 P0（阻碍"执行闭环"成立）／🟠 P1（产品语义错误）／🟡 P2（体验/一致性）。
> 本清单是 `03_TARGET_ARCHITECTURE.md` 与 `04_MIGRATION_PLAN.md` 的输入。

---

## 总纲：当前的根本问题

> 系统目前是 **"任务打卡器 + UsageStats 计时器 + 游戏奖励系统"**，
> 而不是 **Discipline / Execution System**。
>
> 表现为一条线性链：
> `Mission → 打开学习 App → 计时 → 达 80% → Completed → XP/PTS`
>
> 而 V3 要求的是一个闭环：
> `PLAN → COMMITMENT → SESSION → BEHAVIOR → DEVIATION → INTERVENTION → RECOVERY → RESULT → REWARD → REVIEW → AI INSIGHT → NEXT PLAN`

下面所有问题都是"这条闭环缺了哪几环 / 哪几环语义错了"。

---

## 🔴 P0 — 阻碍执行闭环成立

### P0-1 Mission 与 Session 混为一体（**最核心**）
- **现象**：`Mission` 同时承载"计划"与"执行运行时状态"。
- **定位**：`types.ts:interface Mission` —— `actualStudyMs / distractionMs / focusIntervals / status / interventionLevel / distractedSince` 全挂在 Mission 上。
- **后果**：
  - 一个 Mission 只能有**一段**执行过程，无法表达"18:03–18:25 学了，18:25–18:30 分心，18:30–18:55 又回来"这种**多段执行**。
  - 中途偏离会被直接记在 Mission 头上，容易把"一次分心"放大成"任务失败"。
  - 无法统计 deviationCount / recoveryCount / 每段 Session 的 result。
- **V3 需求**：Mission=计划，Session=一次实际执行，Runtime Metrics 归 Session。一个 Mission → 多个 Session。

### P0-2 没有"执行闭环"的上半环与下半环
- **现象**：没有 Day Plan、没有 Commitment、没有 Daily Review、没有 AI Insight、没有 Next-Day-Plan。
- **定位**：`src/core/discipline/` 中不存在 Plan/Review/Insight 任何模块；`aiSupervisor.ts` 只在"干预瞬间"产一句话，不做长期模式分析。
- **后果**：系统只"盯当下"，不"看一天"，更不"帮改进"。AI 的价值被压缩成一句提醒。
- **V3 需求**：DAY PLAN → … → DAILY REVIEW → AI INSIGHT → NEXT DAY PLAN 全闭环。

### P0-3 完成是二元的，无"完成度 vs 执行质量"区分
- **现象**：`COMPLETION_RATIO = 0.8`，`actualStudyMs/targetMinutes ≥ 0.8 → COMPLETED`，否则未完成。
- **定位**：`missionEvaluator.ts:COMPLETION_RATIO / evaluateMission`。
- **后果**：
  - "60min 目标做了 48min" 与 "完全没做" 在语义上都被推向"未完成"，**把没到 100% 直接当成失败**。
  - 没有 `Completed / Partial / Abandoned` 三态，没有 `Execution Rate`、没有 `Execution Quality (A/B/C)`。
- **V3 需求**：Completion ≠ Execution Quality；要三态结果 + 执行率 + 质量等级。

### P0-4 没有 Deviation 模型，分心是二元状态
- **现象**：分心只是 Mission 上一个 `DISTRACTED` 状态位，没有结构化 Deviation 对象。
- **定位**：`types.ts:MissionStatus.DISTRACTED` + `disciplineEngine.onAppForeground`。
- **后果**：
  - 无法区分 DISTRACTION / IDLE / LATE_START / EARLY_STOP / OVEREXTENSION 五类偏离。
  - 无法记录每次偏离的 confidence / trigger / duration / resolvedBy。
  - 无法做"短暂切换豁免""语境判断"。
- **V3 需求**：新增 Deviation 实体（type / confidence / trigger / resolvedAt / resolvedBy）。

### P0-5 干预不带置信度，"打开即可能受罚"
- **现象**：干预仅按分心**时长**升级（1/5/15min），不看 App 语境、不看持续时间置信度。
- **定位**：`disciplineEngine.ts:LEVEL1_AFTER_MS/LEVEL2_AFTER_MS/LEVEL3_AFTER_MS + escalateIntervention`。
- **后果**：
  - 打开 Bilibili **10 秒**与 **8 分钟** 都可能朝同一干预路径走（1min 就 L1）——**违背"不要因为不确定而惩罚用户"**。
  - 无"高置信(娱乐 App 持续) vs 低置信(浏览器/未知)"之分。
- **V3 需求**：干预 = f(Deviation Confidence × 持续时长)；低置信不干预。

### P0-6 Recovery 不是正反馈，回来没有奖励
- **现象**：`recoverMission()` 只把状态拨回，**无任何奖励**；也没有 recoveryCount。
- **定位**：`disciplineEngine.ts:recoverMission`、`rewardEngine.ts`（无 recovery 项）。
- **后果**：产品传达的是"分心=坏事"，而不是"回来=自律"。**真正的自律是"分心后能回到轨道"，这个最关键的正向行为没有被强化。**
- **V3 需求**：Recovery 一等公民，记录并给予少量奖励。

---

## 🟠 P1 — 产品语义错误

### P1-1 UsageStats 被当成"学习/分心的真相"
- **现象**：`classifyApp` 把 study=正在学习、entertainment/social=分心。
- **定位**：`appCategories.ts:classifyApp / isDistractionApp`；`disciplineEngine.onAppForeground` 直接用分类判分心。
- **后果**：正是 V3 明确禁止的 `Study App = 在学习` / `Entertainment App = 一定分心`。UsageStats 只能说明"用户此刻在用哪个 App"，是 **Behavior Signal**，不是真相。
- **V3 需求**：UsageStats → App Category → Behavior Signal → Session Context → Engine 判断"可能 Deviation"。

### P1-2 neutral ≠ distraction 未落实，浏览器缺语境
- **现象**：浏览器（Chrome）未列入任何类 → 归 neutral 被"忽略"，但也没有"可能是学习辅助"的正向语境。
- **定位**：`config/appCategories.json`（neutral 仅系统类）；`keywords.entertainment` 含 `news/video/play/shop` 宽泛词，有误判风险。
- **后果**：数学 Session 中打开 Chrome 搜 "Bayes theorem" 本应是**可能的学习辅助**，现在要么被忽略、要么有被关键词误判为娱乐的风险。
- **V3 需求**：neutral/context-dependent 明确化；浏览器不能简单=分心。

### P1-3 TIME-BASED 与 OUTCOME-BASED 任务未区分
- **现象**：所有任务共用一套"时长达标"逻辑；`requiresEvidence` 只是一个布尔，且靠科目名正则（试卷/作业/背诵）。
- **定位**：`scheduleToMissions.ts:needsEvidence`；`missionEvaluator.evaluateMission`。
- **后果**："专注阅读 45min"（时间型）与"完成第三章习题"（结果型）被同一套标准衡量。UsageStats 只能证明"执行了一段时间"，**证明不了"题目做完了"**。
- **V3 需求**：taskType = TIME_BASED / OUTCOME_BASED；结果型走 Evidence/Result Verification。

### P1-4 AI 被当成高可信"客观证据"（权重 0.9）
- **现象**：`ai` 证据基准权重 0.9，仅次于 usageStats；`aiJudgeEvidence` 可凭 AI 判定直接 attach evidence 并触发完成。
- **定位**：`missionEvaluator.ts:EVIDENCE_BASE_WEIGHT.ai = 0.9`；`aiSupervisor.ts:aiJudgeEvidence`。
- **后果**：AI 是 **Interpretation**，不是 **Truth Source**。0.9 权重让 AI 几乎能单独决定完成，违背 V3。
- **V3 需求**：AI 降为 ~0.3，或改为 "Verification Recommendation → User Confirmation" 不直接进最终证据分。

### P1-5 遗留课程系统与自律核心并行，两套任务/两套发奖/一个惩罚
- **现象**：`classTaskStore.ClassTask` + `currentTask` 与 `missionStore.Mission` + `currentMissionId` 并行；`completeClassTask` 独立发奖；`updateMonitorState` 娱乐>学习 → **-50**。
- **定位**：`classTaskStore.ts`、`main.tsx:monitorUsage/checkOverdue`、`Quests.tsx` 时间轴。
- **后果**：
  - **两个"当前任务"指针**，违背"唯一 Mission 中心"原则。
  - -50 惩罚是**惩罚导向**，与 Recovery>Punishment 冲突。
  - Quests 同时有课程时间轴与动态 Mission，用户心智分裂。
- **V3 需求**：收编到统一 Mission/Session；移除/改造 -50 惩罚。

### P1-6 无"开始后放弃"与"迟到/早退/超时"的刻画
- **现象**：`MISSED` 只用于 READY 任务过期；开始后中途退出只是停止，无 ABANDONED；无 LATE_START / EARLY_STOP / OVEREXTENSION。
- **定位**：`disciplineEngine.scanMissedMissions`（仅 READY→MISSED）。
- **后果**：执行质量的关键信号（拖到 18:20 才开始、25min 就撤、学到 2 小时不收）全部丢失。
- **V3 需求**：这些正是 Deviation 的 type，也是 Execution Quality 的输入。

---

## 🟡 P2 — 体验与一致性

### P2-1 Session Mode 没有正式建模
- **现象**：STANDARD / ABYSS 只作为 `FocusInterval.tag` 字符串存在，Abyss 的特殊规则（高压、退出即失败记录）散落在 Dungeon 与 rewardEngine。
- **定位**：`types.ts:FocusInterval.tag`；`rewardEngine.ts:hasAbyssDungeon`；`Dungeon.tsx`。
- **V3 需求**：Session.mode = STANDARD / ABYSS，正式建模，规则集中。

### P2-2 干预阈值硬编码、不可配
- **现象**：1/5/15min、80% 完成线、证据 0.6 门槛等均为常量。
- **定位**：`disciplineEngine.ts` / `missionEvaluator.ts` 顶部常量。
- **V3 需求**：收敛到单一策略配置（便于按 Abyss/普通、按用户调参）。

### P2-3 采样窗口与全天口径并存
- **现象**：discipline runtime 用"Mission 窗口"采样，main.tsx monitorUsage 用"全天"窗口，二者并行且口径不同。
- **定位**：`runtime.ts:sampleUsageForCurrentMission` vs `main.tsx:monitorUsage`。
- **V3 需求**：统一口径，全天统计作为 Review 输入而非并行奖励源。

### P2-4 Review/历史数据散落
- **现象**：taskHistory / monitorHistory / abyssRecords 分散在 classTaskStore，且不含 deviation/recovery/quality 维度。
- **定位**：`classTaskStore.ts` 历史字段。
- **V3 需求**：Daily Review 需要结构化的"今日执行模式"数据。

---

## 问题 → V3 需求映射速查

| 问题 | V3 对应章节/概念 |
|---|---|
| P0-1 | Mission 重定义 + 新增 Session（§四、§五） |
| P0-2 | DAY PLAN / REVIEW / AI INSIGHT / NEXT PLAN（§一闭环） |
| P0-3 | Completion vs Execution Quality（§十三） |
| P0-4 | Deviation 模型（§九、§十） |
| P0-5 | Confidence 干预（§十一） |
| P0-6 | Recovery 一等公民（§十二） |
| P1-1 | UsageStats 重定位为 Signal（§七） |
| P1-2 | App Category / 浏览器语境（§八） |
| P1-3 | Time-based vs Outcome-based（§十四） |
| P1-4 | Evidence 重定义、AI 降权（§十五） |
| P1-5 | 遗留收编（迁移计划 Phase 7） |
| P1-6 | Deviation type + Result（§九、§十三） |
| P2-* | 策略配置化 / 口径统一 / Review 数据结构化 |
