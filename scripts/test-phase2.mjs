#!/usr/bin/env node
/**
 * scripts/test-phase2.mjs
 * V3 Phase 2 可复跑测试矩阵（纯逻辑单元，无需 Android/浏览器）。
 *
 * 覆盖：
 *   A. Deviation 置信度流水线 + 双门控（Deviation Gate / Intervention Gate）
 *   B. transient switch 去抖（<SHORT_SWITCH_EXEMPTION_MS 不建 Deviation）
 *   C. NEUTRAL_CAP（无上下文封顶 / contextEvidence 解除封顶）
 *   D. resultResolver 三态（COMPLETED / PARTIAL / ABANDONED）—— P1 修复
 *   E. focusMath 区间去重（多 Session + 遗留 + 重叠 + 偏离剔除）
 *
 * 运行：npm run test:phase2   （或 node scripts/test-phase2.mjs）
 * 任一用例失败 → exit code 1。
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)

// localStorage polyfill（node 下让 zustand persist 可加载，用于 store 编排幂等测试）
if (typeof globalThis.localStorage === 'undefined') {
  const _mem = {}
  globalThis.localStorage = {
    getItem: (k) => (k in _mem ? _mem[k] : null),
    setItem: (k, v) => { _mem[k] = String(v) },
    removeItem: (k) => { delete _mem[k] },
    clear: () => { for (const k in _mem) delete _mem[k] },
    key: (i) => Object.keys(_mem)[i] ?? null,
    get length() { return Object.keys(_mem).length }
  }
}

// ── 1. 编译纯逻辑模块到临时目录 ──
const files = [
  'src/core/discipline/config.ts',
  'src/core/discipline/types.ts',
  'src/core/discipline/focusMath.ts',
  'src/core/discipline/deviationAnalyzer.ts',
  'src/core/discipline/missionEvaluator.ts',
  'src/core/discipline/evidenceEvaluator.ts',
  'src/core/discipline/resultEvaluator.ts',
  'src/core/discipline/resultResolver.ts',
  'src/core/discipline/recoveryReward.ts',
  'src/core/discipline/dailyReview.ts',
  'src/core/discipline/courseEvidenceCore.ts'
]
const out = mkdtempSync(path.join(tmpdir(), 'sd-phase2-'))
try {
  execSync(
    `node node_modules/typescript/bin/tsc ${files.join(' ')} --module commonjs --target ES2020 --outDir ${out} --skipLibCheck --esModuleInterop`,
    { cwd: root, stdio: 'pipe' }
  )
} catch (e) {
  console.error('❌ 编译失败：\n' + (e.stdout?.toString() || e.message))
  process.exit(1)
}

const A = require(path.join(out, 'core/discipline/deviationAnalyzer.js'))
const R = require(path.join(out, 'core/discipline/resultResolver.js'))
const F = require(path.join(out, 'core/discipline/focusMath.js'))
const REC = require(path.join(out, 'core/discipline/recoveryReward.js'))
const EV = require(path.join(out, 'core/discipline/resultEvaluator.js'))
const HE = require(path.join(out, 'core/discipline/evidenceEvaluator.js'))
const ME = require(path.join(out, 'core/discipline/missionEvaluator.js'))
const DR = require(path.join(out, 'core/discipline/dailyReview.js'))
const CEC = require(path.join(out, 'core/discipline/courseEvidenceCore.js'))

// ── 第二段编译：unifiedMissionView（依赖 data/schedule，公共根为 src/，单独 outDir）──
const umvFiles = [
  'src/core/discipline/config.ts',
  'src/core/discipline/types.ts',
  'src/core/discipline/unifiedMissionView.ts',
  'src/data/schedule.ts'
]
const outUmv = mkdtempSync(path.join(tmpdir(), 'sd-umv-'))
try {
  execSync(
    `node node_modules/typescript/bin/tsc ${umvFiles.join(' ')} --module commonjs --target ES2020 --outDir ${outUmv} --skipLibCheck --esModuleInterop`,
    { cwd: root, stdio: 'pipe' }
  )
} catch (e) {
  console.error('❌ unifiedMissionView 编译失败：\n' + (e.stdout?.toString() || e.message))
  process.exit(1)
}
const UMV = require(path.join(outUmv, 'core/discipline/unifiedMissionView.js'))

// ── 第三段编译：rewardCore（依赖 data/schedule，公共根 src/，单独 outDir）──
const rcFiles = [
  'src/core/discipline/config.ts',
  'src/core/discipline/types.ts',
  'src/core/discipline/rewardCore.ts',
  'src/data/schedule.ts'
]
const outRc = mkdtempSync(path.join(tmpdir(), 'sd-rc-'))
try {
  execSync(
    `node node_modules/typescript/bin/tsc ${rcFiles.join(' ')} --module commonjs --target ES2020 --outDir ${outRc} --skipLibCheck --esModuleInterop`,
    { cwd: root, stdio: 'pipe' }
  )
} catch (e) {
  console.error('❌ rewardCore 编译失败：\n' + (e.stdout?.toString() || e.message))
  process.exit(1)
}
const RC = require(path.join(outRc, 'core/discipline/rewardCore.js'))

// ── 第四段编译：rewardEngine 编排（含 rewardStore/sessionStore，node+localStorage polyfill）──
const rewFiles = [
  'src/core/discipline/config.ts',
  'src/core/discipline/types.ts',
  'src/core/discipline/rewardCore.ts',
  'src/core/discipline/rewardStore.ts',
  'src/core/discipline/sessionStore.ts',
  'src/core/discipline/rewardEngine.ts',
  'src/data/schedule.ts'
]
const outRew = mkdtempSync(path.join(root, '.tmp-sd-rew-'))
try {
  execSync(
    `node node_modules/typescript/bin/tsc ${rewFiles.join(' ')} --module commonjs --target ES2020 --outDir ${outRew} --skipLibCheck --esModuleInterop`,
    { cwd: root, stdio: 'pipe' }
  )
} catch (e) {
  console.error('❌ rewardEngine 编译失败：\n' + (e.stdout?.toString() || e.message))
  process.exit(1)
}
// 根 package.json 为 "type":"module"，此处标记为 commonjs 以便 require 加载
writeFileSync(path.join(outRew, 'package.json'), '{"type":"commonjs"}')
const REW = require(path.join(outRew, 'core/discipline/rewardEngine.js'))
const RWS = require(path.join(outRew, 'core/discipline/rewardStore.js'))
const { DEVIATION, RESULT, RECOVERY, QUALITY, COMPLETION, EVIDENCE } = require(path.join(out, 'core/discipline/config.js'))

// ── 2. 断言工具 ──
const min = 60000
const D = ms => ms
const results = []
function check(id, name, actual, expect) {
  const pass = JSON.stringify(actual) === JSON.stringify(expect)
  results.push({ id, name, pass, actual: String(actual), expect: String(expect) })
}
const sess = (mode, deviationCount) => ({ mode: mode || 'STANDARD', deviationCount: deviationCount || 0 })
const mission = { subject: '数学' }
const r3 = x => Math.round(x * 1000) / 1000

console.log('阈值: SHORT_SWITCH_EXEMPTION_MS=%dms  RECORD_MIN=%s  INTERVENTION_MIN=%s  NEUTRAL_CAP=%s  MEANINGFUL_EXECUTION_MS=%dms',
  DEVIATION.SHORT_SWITCH_EXEMPTION_MS, DEVIATION.RECORD_MIN_CONFIDENCE, DEVIATION.INTERVENTION_MIN_CONFIDENCE,
  DEVIATION.NEUTRAL_CONF_CAP, RESULT.MEANINGFUL_EXECUTION_MS)
console.log('')

// ═══ A. 置信度流水线 + 双门控 ═══
function confCase(id, name, category, elapsedMs, session, expTransient, expRecord, expIntervene) {
  const pd = { pkg: 'x', category, startedAt: 0, baseConfidence: A.baseConfidenceFor(category) }
  const conf = A.computeFinalConfidence(pd, session, mission, elapsedMs)
  check(id + '.transient', name + ' | transient', A.isTransient(elapsedMs), expTransient)
  check(id + '.record', name + ' | Deviation Gate(record)', A.shouldRecordDeviation(conf), expRecord)
  check(id + '.intervene', name + ' | Intervention Gate(conf)', A.shouldConsiderIntervention(conf), expIntervene)
  return conf
}

console.log('── A. 置信度流水线 + 双门控 ──')
confCase('A1', '数学+Chrome 5s（transient）', 'neutral', 5 * 1000, sess(), true, false, false)
confCase('B1', '数学+Chrome 3min（不判分心）', 'neutral', 3 * min, sess(), false, false, false)
confCase('C1', 'Bilibili 10s（记录，duration未到暂不升级）', 'entertainment', 10 * 1000, sess(), false, true, true)
confCase('C2', 'Bilibili 5min（记录+干预升级）', 'entertainment', 5 * min, sess(), false, true, true)
confCase('D1', '微信 3min（社交=偏离）', 'social', 3 * min, sess(), false, true, true)
const capConf = confCase('E1', '浏览器10min+Abyss+多次偏离（封顶）', 'neutral', 10 * min, sess('ABYSS', 3), false, false, false)
check('E1.cap', 'E1 | neutral 被 NEUTRAL_CAP 封顶(≤0.30)', capConf <= DEVIATION.NEUTRAL_CONF_CAP + 1e-9, true)

// ═══ C. NEUTRAL_CAP contextEvidence 解除封顶 ═══
console.log('── C. NEUTRAL_CAP 上下文重评 ──')
{
  const pdNoCtx = { pkg: 'chrome', category: 'neutral', startedAt: 0, baseConfidence: 0.15, contextEvidence: false }
  const pdWithCtx = { pkg: 'chrome', category: 'neutral', startedAt: 0, baseConfidence: 0.15, contextEvidence: true }
  const cNoCtx = A.computeFinalConfidence(pdNoCtx, sess('ABYSS', 3), mission, 10 * min)
  const cWithCtx = A.computeFinalConfidence(pdWithCtx, sess('ABYSS', 3), mission, 10 * min)
  check('C.noCtx', '无上下文证据 → 封顶 ≤ NEUTRAL_CAP', cNoCtx <= DEVIATION.NEUTRAL_CONF_CAP + 1e-9, true)
  check('C.withCtx', '有上下文证据 → 解除封顶(>NEUTRAL_CAP)', cWithCtx > DEVIATION.NEUTRAL_CONF_CAP, true)
}

// ═══ D. resultResolver 三态（P1）═══
console.log('── D. resultResolver 三态（Stop≠Abandoned）──')
{
  // COMPLETED：mission 满足完成条件（48/60=0.8）
  const mDone = { targetMinutes: 60, actualStudyMs: 48 * min, requiresEvidence: false, evidence: [] }
  // PARTIAL / ABANDONED：mission 未完成（20/60=0.33<0.8）
  const mNotDone = { targetMinutes: 60, actualStudyMs: 20 * min, requiresEvidence: false, evidence: [] }
  const sFocus2m = { focusDurationMs: 2 * min }   // ≥60s → PARTIAL
  const sFocus05m = { focusDurationMs: 0.5 * min } // <60s → ABANDONED
  check('D.completed', 'Stop 但已完成目标 → COMPLETED', R.resolveSessionOutcome(sFocus05m, mDone), 'COMPLETED')
  check('D.partial', 'Stop 有有效执行(2min) → PARTIAL', R.resolveSessionOutcome(sFocus2m, mNotDone), 'PARTIAL')
  check('D.abandoned', 'Stop 几乎无执行(0.5min) → ABANDONED', R.resolveSessionOutcome(sFocus05m, mNotDone), 'ABANDONED')
  check('D.rate', 'executionRate 20/60min=0.33', Math.round(R.sessionExecutionRate({ focusDurationMs: 20 * min }, mNotDone) * 100) / 100, 0.33)
}

// ═══ E. focusMath 去重 ═══
console.log('── E. focusMath 去重 ──')
{
  const t = (h, m2) => (h * 60 + m2) * min
  const legacy = [{ startedAt: t(10, 0), endedAt: t(10, 30) }]
  const s1 = [{ startedAt: t(18, 0), endedAt: t(18, 25) }]
  const s2 = [{ startedAt: t(18, 50), endedAt: t(19, 10) }]
  check('E.multi', '多Session+遗留聚合=75min', F.mergeIntervalsMs([...legacy, ...s1, ...s2]) / min, 75)
  const devCase = [{ startedAt: t(18, 0), endedAt: t(18, 25) }, { startedAt: t(18, 30), endedAt: t(18, 55) }]
  check('E.deviation', '偏离5min被剔除=50min', F.mergeIntervalsMs(devCase) / min, 50)
  const overlap = [{ source: 'DUNGEON', startedAt: t(18, 0), endedAt: t(18, 45) }, { source: 'APP_USAGE', startedAt: t(18, 0), endedAt: t(18, 45) }]
  check('E.dualSource', '双源重叠=45(非90)', F.mergeIntervalsMs(overlap) / min, 45)
}

// ═══ F. Recovery 奖励 + 防刷（Phase 3）═══
console.log('── F. Recovery 奖励 + 防刷 ──')
{
  // 防刷边界：每 Session 仅奖励前 MAX_PER_SESSION 次
  check('F.reward1', '第1次恢复 → 发奖', REC.shouldRewardRecovery(1), true)
  check('F.reward2', `第${RECOVERY.MAX_PER_SESSION}次恢复 → 发奖`, REC.shouldRewardRecovery(RECOVERY.MAX_PER_SESSION), true)
  check('F.noReward', `第${RECOVERY.MAX_PER_SESSION + 1}次恢复 → 不发奖(防刷)`, REC.shouldRewardRecovery(RECOVERY.MAX_PER_SESSION + 1), false)
  check('F.noReward0', '第0次 → 不发奖', REC.shouldRewardRecovery(0), false)
  // grantRecoveryReward 金额与回调
  let pts = 0, xp = 0; const records = []
  const cb = {
    addPoints: n => { pts += n },
    addXp: n => { xp += n },
    addExp: (n) => { xp += n },
    addPointRecord: (t, a, r) => { records.push({ t, a, r }) }
  }
  const res = REC.grantRecoveryReward(cb)
  check('F.pts', `发放 PTS = ${RECOVERY.BONUS_PTS}`, res.points, RECOVERY.BONUS_PTS)
  check('F.xp', `发放 XP = ${RECOVERY.BONUS_XP}`, res.xp, RECOVERY.BONUS_XP)
  check('F.record', '记录一条 earn 流水', records.length === 1 && records[0].t === 'earn' && records[0].a === RECOVERY.BONUS_PTS, true)
}

// ═══ G. Execution Quality 综合评分（Phase 4）═══
console.log('── G. Execution Quality 综合评分 ──')
{
  const M = (focus, distr, dev, rec, target) => ({
    focusDurationMs: focus * min, distractionDurationMs: distr * min,
    deviationCount: dev, recoveryCount: rec, targetMs: target * min
  })

  // G1 用户A(偏离3恢复3) vs 用户B(偏离1恢复0)：Recovery 能力应被奖励
  const userA = EV.evaluateExecution(M(54, 6, 3, 3, 60))  // rate0.9 focusRatio0.9 recoveryRate1 devScore0.4
  const userB = EV.evaluateExecution(M(54, 6, 1, 0, 60))  // rate0.9 focusRatio0.9 recoveryRate0 devScore0.8
  check('G1.A_grade', 'A(强恢复力) → 档位A', userA.quality, 'A')
  check('G1.B_grade', 'B(少偏离无恢复) → 档位B', userB.quality, 'B')
  check('G1.A>B', 'A 综合分 > B（回来能力被奖励）', userA.qualityScore > userB.qualityScore, true)
  check('G1.A_score', 'A qualityScore≈0.87', r3(userA.qualityScore), 0.87)
  check('G1.B_score', 'B qualityScore≈0.71', r3(userB.qualityScore), 0.71)

  // G2 硬门槛：rate0.95 但 focusRatio0.35 → 不能 A（最高C）
  const g2 = EV.evaluateExecution(M(57, 106, 0, 0, 60))
  check('G2.notA', 'rate0.95+focusRatio0.35 → 非A', g2.quality === 'A', false)
  check('G2.capC', 'FocusRatio<0.40 → 压到C', g2.quality, 'C')

  // G3 硬门槛：ExecutionRate<0.50 → 直接D（即使其它维度满分）
  const g3 = EV.evaluateExecution(M(25, 0, 0, 0, 60))
  check('G3.rateGateD', 'rate0.42(其余满分) → D', g3.quality, 'D')

  // G4 无偏离 → RecoveryRate=1（避免0/0），满分→A
  const g4 = EV.evaluateExecution(M(60, 0, 0, 0, 60))
  check('G4.recoveryRate1', '无偏离 RecoveryRate=1', g4.recoveryRate, 1)
  check('G4.fullA', '满分 → A，score=1', g4.quality === 'A' && r3(g4.qualityScore) === 1, true)

  // G5 三态结果
  check('G5.completed', '48/60(rate0.8) → COMPLETED', EV.evaluateExecution(M(48, 6, 0, 0, 60)).outcome, 'COMPLETED')
  check('G5.partial', '42/60(rate0.7) → PARTIAL', EV.evaluateExecution(M(42, 6, 0, 0, 60)).outcome, 'PARTIAL')
  check('G5.abandoned', '0.5min(无意义) → ABANDONED', EV.evaluateExecution(M(0.5, 0, 0, 0, 60)).outcome, 'ABANDONED')

  // G6 边界
  check('G6.target0', 'target=0 且有专注 → rate=1', EV.computeExecutionRate(M(5, 0, 0, 0, 0)), 1)
  check('G6.focusRatio_empty', '无数据 focusRatio=1', EV.computeFocusRatio(M(0, 0, 0, 0, 60)), 1)
  check('G6.devScore', '偏离5次 → DeviationScore=0', EV.computeDeviationScore(M(0, 0, 5, 0, 60)), 0)
  check('G6.devScore_clamp', '偏离>5次 → DeviationScore≥0', EV.computeDeviationScore(M(0, 0, 8, 0, 60)) >= 0, true)

  // G7 档位阈值边界（clean 会话：focusRatio=1/recovery=1/devScore=1 → score=rate*0.4+0.6）
  //    rate=0.625 → score=0.85 → A；rate=0.62 → score=0.848 → B
  const abA = EV.evaluateExecution(M(62.5, 0, 0, 0, 100))
  check('G7.AB_A', 'score=0.85 → A', abA.quality, 'A')
  const abB = EV.evaluateExecution(M(62, 0, 0, 0, 100))
  check('G7.AB_B', 'score=0.848 → B', abB.quality, 'B')
  check('G7.AB_score', 'score 恰在 0.85 边界', r3(abA.qualityScore) === 0.85 && r3(abB.qualityScore) === 0.848, true)
}

// ═══ H. Evidence 双层模型（Phase 5）═══
console.log('── H. Evidence 双层模型 + AI Recommendation ──')
{
  const objEv = (type, weight) => ({ type, tier: 'OBJECTIVE', weight, ts: 1 })
  const rec = (status, verdict, conf) => ({ id: 'r', missionId: 'm', aiVerdict: verdict, confidence: conf, status, createdAt: 1 })

  // H1 客观证据分只计 OBJECTIVE 层（photo），排除 manual 与 ai
  const ev1 = [objEv('photo', 0.8), { type: 'manual', tier: 'USER_ASSERTION', weight: 0.5, ts: 1 }, { type: 'ai', tier: 'AI_RECOMMENDATION', weight: 0.9, ts: 1 }]
  check('H1.objScore', '客观分只计 photo0.8（排除manual/ai）', HE.objectiveEvidenceScore(ev1), 0.8)

  // H2 旧 'ai' 证据（无 tier）被识别为 AI 层，不计客观分（读取兼容）
  const legacyAi = [{ type: 'ai', weight: 0.9, ts: 1 }]
  check('H2.legacy_tier', 'tierOf(旧ai)=AI_RECOMMENDATION', HE.tierOf(legacyAi[0]), 'AI_RECOMMENDATION')
  check('H2.legacy_excluded', '旧ai证据不计客观分', HE.objectiveEvidenceScore(legacyAi), 0)

  // H3 客观证据达标 → OBJECTIVE 验证
  const r3o = HE.evaluateEvidence([objEv('photo', 0.8)], [])
  check('H3.verified', 'photo0.8≥0.6 → verified', r3o.verified, true)
  check('H3.source', 'source=OBJECTIVE', r3o.verificationSource, 'OBJECTIVE')

  // H4 用户自述 → USER_ASSERTION 验证
  const r4 = HE.evaluateEvidence([{ type: 'manual', tier: 'USER_ASSERTION', weight: 0.5, ts: 1 }], [])
  check('H4.assertion', '用户自述 → verified', r4.verified, true)
  check('H4.source', 'source=USER_ASSERTION', r4.verificationSource, 'USER_ASSERTION')

  // H5 AI ACCEPTED → 验证（用户确认，非 AI 本身）
  const r5 = HE.evaluateEvidence([], [rec('ACCEPTED', 'pass', 0.7)])
  check('H5.accepted', 'AI ACCEPTED → verified', r5.verified, true)
  check('H5.source', 'source=AI_ACCEPTED', r5.verificationSource, 'AI_ACCEPTED')

  // H6 AI PENDING（哪怕 conf 0.9）→ 不验证
  const r6 = HE.evaluateEvidence([], [rec('PENDING', 'pass', 0.9)])
  check('H6.pending', 'AI PENDING(conf0.9) → 不验证', r6.verified, false)

  // H7 AI REJECTED → 不验证
  const r7 = HE.evaluateEvidence([], [rec('REJECTED', 'pass', 0.9)])
  check('H7.rejected', 'AI REJECTED → 不验证', r7.verified, false)

  // H8 AI 不进客观分：screenshot0.3+ai0.9 → 客观仅0.3<0.6 → 不验证
  const r8 = HE.evaluateEvidence([objEv('screenshot', 0.3), { type: 'ai', tier: 'AI_RECOMMENDATION', weight: 0.9, ts: 1 }], [])
  check('H8.ai_notObjective', '客观分仅0.3，ai不算 → 不验证', r8.objectiveScore === 0.3 && r8.verified === false, true)

  // H9 OUTCOME 任务完成判定（集成 missionEvaluator）
  const Mout = (actualMin, evidence, recs) => ({ targetMinutes: 60, actualStudyMs: actualMin * min, requiresEvidence: true, evidence, recommendations: recs })
  check('H9.pending_block', 'OUTCOME+AI PENDING(时长足) → 不可完成', ME.evaluateMission(Mout(60, [], [rec('PENDING', 'pass', 0.9)])).canComplete, false)
  check('H9.accepted_complete', 'OUTCOME+AI ACCEPTED(时长足) → 可完成', ME.evaluateMission(Mout(60, [], [rec('ACCEPTED', 'pass', 0.7)])).canComplete, true)
  check('H9.photo_complete', 'OUTCOME+photo0.8(时长足) → 可完成', ME.evaluateMission(Mout(60, [objEv('photo', 0.8)], [])).canComplete, true)
  check('H9.time_short', 'OUTCOME+photo0.8 但时长不足 → 不可完成', ME.evaluateMission(Mout(30, [objEv('photo', 0.8)], [])).canComplete, false)
}

// ═══ I. DailyReview 确定性聚合（Phase 6，纯函数，不调 AI）═══
console.log('── I. DailyReview 确定性聚合 ──')
{
  const mkMission = (id, status, targetMin, startedAt) => ({ id, status, targetMinutes: targetMin, startedAt, actualStudyMs: 0 })
  const mkSession = (mid, focus, distr, dev, rec) => ({ missionId: mid, focusDurationMs: focus * min, distractionDurationMs: distr * min, deviationCount: dev, recoveryCount: rec, status: 'COMPLETED', segments: [] })

  // I1 missionOutcome
  check('I1.completed', 'status COMPLETED → COMPLETED', DR.missionOutcome(mkMission('m1', 'COMPLETED', 60), []), 'COMPLETED')
  check('I1.missed', 'status MISSED → ABANDONED', DR.missionOutcome(mkMission('m2', 'MISSED', 60), []), 'ABANDONED')
  check('I1.notStarted', '无session无startedAt → NOT_STARTED', DR.missionOutcome(mkMission('m3', 'READY', 60), []), 'NOT_STARTED')
  check('I1.partial', 'session专注30min → PARTIAL', DR.missionOutcome(mkMission('m4', 'FOCUSING', 60, 1), [mkSession('m4', 30, 5, 1, 1)]), 'PARTIAL')
  check('I1.abandoned', 'session专注0.5min → ABANDONED', DR.missionOutcome(mkMission('m5', 'FOCUSING', 60, 1), [mkSession('m5', 0.5, 0, 0, 0)]), 'ABANDONED')

  // I2 generateDailyReviewCore
  const missions = [
    mkMission('a', 'COMPLETED', 60, 1),  // 完成, focus60
    mkMission('b', 'FOCUSING', 60, 1),   // 部分, focus30
    mkMission('c', 'MISSED', 60),        // 放弃
    mkMission('d', 'READY', 60)          // 未开始
  ]
  const sessions = [mkSession('a', 60, 10, 2, 2), mkSession('b', 30, 5, 1, 1)]
  const review = DR.generateDailyReviewCore({
    date: '2026-08-14', missions, sessions,
    plannedMissionIds: ['a', 'b', 'c', 'd'], committedMissionIds: ['a', 'b', 'c']
  })
  check('I2.planned', 'planned=4', review.planned, 4)
  check('I2.committed', 'committed=3', review.committed, 3)
  check('I2.started', 'started=2', review.started, 2)
  check('I2.completed', 'completed=1', review.completed, 1)
  check('I2.partial', 'partial=1', review.partial, 1)
  check('I2.abandoned', 'abandoned=1', review.abandoned, 1)
  check('I2.focus', 'focusTime=90min', review.focusTimeMs, 90 * min)
  check('I2.dev', 'deviationCount=3', review.deviationCount, 3)
  check('I2.rec', 'recoveryCount=3', review.recoveryCount, 3)
  check('I2.recRate', 'recoveryRate=1(3/3)', review.recoveryRate, 1)
  check('I2.execRate', 'executionRate=90/240=0.375', r3(review.executionRate), 0.375)
  check('I2.reliability', 'reliability=(1+0.5*1)/3=0.5', r3(review.reliabilityScore), 0.5)
  check('I2.quality_D', 'rate0.375<0.5 硬门槛 → D', review.executionQuality, 'D')

  // I3 aggregateReviews（7天/30天聚合）
  const agg = DR.aggregateReviews([review, { ...review, date: '2026-08-13' }])
  check('I3.days', 'days=2', agg.days, 2)
  check('I3.totalFocus', 'totalFocus=180min', agg.totalFocusMs, 180 * min)
  check('I3.avgRate', 'avgExecutionRate=0.375', r3(agg.avgExecutionRate), 0.375)
  check('I3.qualityDist', '质量分布总和=2', Object.values(agg.qualityDistribution).reduce((s, x) => s + x, 0), 2)
  const aggEmpty = DR.aggregateReviews([])
  check('I3.empty', '空 → days=0, recoveryRate=1', aggEmpty.days === 0 && aggEmpty.avgRecoveryRate === 1, true)
}

// ═══ J. Unified Mission View（Phase 8：去重 + 状态映射）═══
console.log('── J. Unified Mission View ──')
{
  const nowD = new Date()
  const pad2 = n => String(n).padStart(2, '0')
  const todayStr = `${nowD.getFullYear()}-${pad2(nowD.getMonth() + 1)}-${pad2(nowD.getDate())}`
  const tsAt = (h, m) => new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate(), h, m).getTime()
  const mkM = (o) => ({
    actualStudyMs: 0, distractionMs: 0, focusIntervals: [], evidence: [], sessionIds: [],
    requiresEvidence: false, interventionLevel: 0, createdAt: 1, ...o
  })

  // 课表 Mission（第1节 08:00）+ 对应 ClassTask；动态 Mission；无 Mission 的课程(第5节)
  const schedMission = mkM({ id: 'sm1', title: '数学 · 第1节', subject: '数学', source: 'SCHEDULE', plannedStart: tsAt(8, 0), plannedEnd: tsAt(9, 0), targetMinutes: 60, status: 'READY' })
  const dynMission = mkM({ id: 'dm1', title: '背单词', subject: '背单词', source: 'USER', plannedStart: tsAt(19, 0), plannedEnd: tsAt(19, 45), targetMinutes: 45, status: 'READY' })
  const doneMission = mkM({ id: 'dm2', title: '已完成任务', subject: 'x', source: 'USER', plannedStart: tsAt(10, 0), plannedEnd: tsAt(10, 30), targetMinutes: 30, status: 'COMPLETED' })
  const courseTask1 = { id: 'ct1', period: 1, date: todayStr, subject: '数学', status: 'pending' }
  const courseTask5 = { id: 'ct5', period: 5, date: todayStr, subject: '生物', status: 'pending' }
  const dayPlan = { id: 'dp', date: todayStr, missionIds: ['sm1', 'dm1', 'dm2'], commitments: [{ missionId: 'dm1', action: 'COMMITTED', ts: 1 }], status: 'COMMITTED', createdAt: 1 }

  const views = UMV.buildUnifiedMissionView({
    date: todayStr,
    missions: [schedMission, dynMission, doneMission],
    courseTasks: [courseTask1, courseTask5],
    sessions: [],
    dayPlan
  })

  check('J1.count', '视图数=4（3 Mission，ct1并入sm1，ct5兜底+1）', views.length, 4)
  check('J2.join', 'ct1 并入 sm1（classTaskId=ct1）', views.find(v => v.id === 'sm1')?.classTaskId === 'ct1', true)
  check('J3.dedup', 'period1 只有一条（无重复 COURSE 副本）', views.filter(v => v.classTaskId === 'ct1').length, 1)
  check('J4.courseOnly', 'ct5 无 Mission → source=COURSE', views.find(v => v.classTaskId === 'ct5')?.source, 'COURSE')
  check('J5.dyn_committed', 'dm1 dayPlan已承诺 → COMMITTED', views.find(v => v.id === 'dm1')?.viewStatus, 'COMMITTED')
  check('J6.done', 'dm2 已完成 → COMPLETED', views.find(v => v.id === 'dm2')?.viewStatus, 'COMPLETED')
  check('J7.sort', '按 plannedStart 升序', views[0].plannedStart <= views[views.length - 1].plannedStart, true)

  // 有 ACTIVE Session → EXECUTING
  const execMission = mkM({ id: 'em1', title: '执行中', subject: 'x', source: 'USER', plannedStart: tsAt(14, 0), plannedEnd: tsAt(15, 0), targetMinutes: 60, status: 'FOCUSING' })
  const activeSession = { id: 'ses1', missionId: 'em1', status: 'ACTIVE', focusDurationMs: 10 * 60000, distractionDurationMs: 0, deviationCount: 0, recoveryCount: 0, segments: [], createdAt: 1 }
  const views2 = UMV.buildUnifiedMissionView({ date: todayStr, missions: [execMission], courseTasks: [], sessions: [activeSession], dayPlan: undefined })
  check('J8.executing', 'ACTIVE Session + FOCUSING → EXECUTING', views2[0].viewStatus, 'EXECUTING')
  check('J8.progress', 'executionRate=10/60≈0.167', Math.round(views2[0].executionRate * 1000) / 1000, 0.167)

  // 状态映射覆盖：deriveViewStatus 直接测
  check('J9.planned', '无承诺未开始 → PLANNED', UMV.deriveViewStatus(mkM({ status: 'READY' }), [], 'PLANNED'), 'PLANNED')
  check('J9.missed', 'MISSED → ABANDONED', UMV.deriveViewStatus(mkM({ status: 'MISSED' }), [], 'PLANNED'), 'ABANDONED')
  check('J9.course_completed', '课程已完成(legacy) → COMPLETED', UMV.deriveViewStatus(mkM({ status: 'READY' }), [], 'PLANNED', { status: 'completed' }), 'COMPLETED')
}

// ═══ K. Course Evidence（Phase 9：证据构造 + 幂等 + 新旧回归）═══
console.log('── K. Course Evidence ──')
{
  const baseOpts = { missionId: 'm1', classTaskId: 'ct-2026-1', photoPath: 'MOSS_Photos/p1.jpg', ts: 1000, recId: 'rec1' }

  // K1 AI 通过 → photo weight=0.8 + recommendation ACCEPTED
  const passed = CEC.buildCoursePhotoEvidence({ ...baseOpts, aiPassed: true, aiScore: 92, aiReview: '认真' })
  check('K1.ev_weight', '通过 → photo weight=0.8', passed.evidence.weight, 0.8)
  check('K1.ev_tier', 'photo tier=OBJECTIVE', passed.evidence.tier, 'OBJECTIVE')
  check('K1.ev_refId', 'refId=classTaskId(溯源)', passed.evidence.refId, 'ct-2026-1')
  check('K1.rec_accepted', '通过 → recommendation ACCEPTED', passed.recommendation.status, 'ACCEPTED')
  check('K1.rec_verdict', 'aiVerdict=pass', passed.recommendation.aiVerdict, 'pass')
  check('K1.rec_conf', 'confidence=92/100=0.92', passed.recommendation.confidence, 0.92)

  // K2 AI 未过 → photo weight=0（不计客观分）+ REJECTED
  const failed = CEC.buildCoursePhotoEvidence({ ...baseOpts, aiPassed: false, aiScore: 30, aiReview: '非学习场景' })
  check('K2.ev_weight0', '未过 → photo weight=0', failed.evidence.weight, 0)
  check('K2.rec_rejected', '未过 → REJECTED', failed.recommendation.status, 'REJECTED')
  check('K2.rec_verdict', 'aiVerdict=fail', failed.recommendation.aiVerdict, 'fail')

  // K3 legacy 状态映射（保持原事实）
  check('K3.verified', 'passed=true → ACCEPTED(VERIFIED)', CEC.mapLegacyVerifyStatus(true), 'ACCEPTED')
  check('K3.rejected', 'passed=false → REJECTED', CEC.mapLegacyVerifyStatus(false), 'REJECTED')

  // K4 幂等：refId 去重
  check('K4.empty', '空证据 → hasPhoto=false', CEC.hasPhotoEvidenceForRef([], 'ct-x'), false)
  check('K4.dup', '已有同 refId photo → hasPhoto=true(幂等跳过)', CEC.hasPhotoEvidenceForRef([passed.evidence], 'ct-2026-1'), true)
  check('K4.otherRef', '不同 refId → hasPhoto=false', CEC.hasPhotoEvidenceForRef([passed.evidence], 'ct-other'), false)

  // K5 confidence 钳制
  check('K5.clamp_high', 'aiScore=150 → confidence=1', CEC.buildCoursePhotoEvidence({ ...baseOpts, aiPassed: true, aiScore: 150 }).recommendation.confidence, 1)

  // K6 新旧数据回归：ACCEPTED photo → evaluateEvidence 验证通过；REJECTED → 不通过
  const rAccepted = HE.evaluateEvidence([passed.evidence], [passed.recommendation])
  check('K6.accepted_verified', 'ACCEPTED photo → verified=true', rAccepted.verified, true)
  const rRejected = HE.evaluateEvidence([failed.evidence], [failed.recommendation])
  check('K6.rejected_notVerified', 'REJECTED photo(weight0) → verified=false', rRejected.verified, false)
  // 旧数据（Phase5 前 ai weight0.9）迁移后：AI 不再作为高权客观证据（buildCoursePhotoEvidence 只给 0.8/0）
  check('K6.ai_not_objective', '迁移后 photo 权重仅 0.8/0，无 0.9', passed.evidence.weight !== 0.9 && failed.evidence.weight !== 0.9, true)
}

// ═══ P. RewardCore（Phase 10A：eventId/课程奖励/幂等）═══
console.log('── P. RewardCore ──')
{
  const minMs = 60000
  // P1/P2 eventId
  check('P1.stable', 'completionEventId 稳定', RC.completionEventId('m1') === RC.completionEventId('m1'), true)
  check('P2.distinct', '不同 mission eventId 不同', RC.completionEventId('m1') !== RC.completionEventId('m2'), true)
  check('P2.recovery', 'recoveryEventId 随次数不同', RC.recoveryEventId('s1', 1) !== RC.recoveryEventId('s1', 2), true)

  // P3 isCourseMission
  check('P3.course', 'SCHEDULE+requiresEvidence → course', RC.isCourseMission({ source: 'SCHEDULE', requiresEvidence: true }), true)
  check('P3.notCourse', 'USER → 非课程', RC.isCourseMission({ source: 'USER', requiresEvidence: false }), false)

  // P4 课程奖励：准点 + AI≥80
  const r4 = RC.computeCourseRewardFromParts({ baseReward: 80, completedAt: 1000, classEndTime: 2000, aiScore: 92 })
  check('P4.pts', 'base80+准点15+AI25=120', r4.points, 120)
  check('P4.xp', 'XP=50+30=80', r4.xp, 80)
  check('P4.onTime', 'completedAt<=classEndTime → onTime=true', r4.onTime, true)

  // P5 迟交 + AI<80 → 无加成
  const r5 = RC.computeCourseRewardFromParts({ baseReward: 60, completedAt: 3000, classEndTime: 2000, aiScore: 70 })
  check('P5.pts', 'base60 迟交无AI=60', r5.points, 60)
  check('P5.xp', 'XP=50', r5.xp, 50)
  check('P5.onTime', '迟交 → onTime=false', r5.onTime, false)

  // P8 aiScore 缺失 → 不加 AI bonus（不猜测）
  const r8 = RC.computeCourseRewardFromParts({ baseReward: 80, completedAt: 1000, classEndTime: 2000, aiScore: null })
  check('P8.pts', 'aiScore=null → 80+15=95（无AI加成）', r8.points, 95)
  check('P8.xp', 'XP=50（无AI）', r8.xp, 50)

  // P9 completedAt 缺失 → onTime=null，不加准点 bonus
  const r9 = RC.computeCourseRewardFromParts({ baseReward: 80, completedAt: null, classEndTime: 2000, aiScore: 92 })
  check('P9.onTime_null', 'completedAt=null → onTime=null', r9.onTime, null)
  check('P9.pts', '无准点bonus → 80+25=105', r9.points, 105)
  // P9b 边界：completedAt===classEndTime → onTime=true
  const r9b = RC.computeCourseRewardFromParts({ baseReward: 80, completedAt: 2000, classEndTime: 2000, aiScore: 70 })
  check('P9b.boundary', 'completedAt==classEndTime → onTime=true', r9b.onTime, true)

  // P6 通用奖励（非课程）：basePoints=target + 专注加成 + 深渊
  const m6 = { targetMinutes: 30, actualStudyMs: 30 * minMs, distractionMs: 0, focusIntervals: [] }
  const abyssIv = [{ source: 'DUNGEON', startedAt: 0, endedAt: 1, tag: 'abyss' }]
  const r6 = RC.computeGenericReward(m6, abyssIv)
  check('P6.pts', '30+专注20+深渊400=450', r6.points, 450)
  check('P6.xp', 'XP=30+20=50', r6.xp, 50)

  // P7 isAlreadyIssued（幂等判断，基于 eventId 非余额）
  check('P7.empty', '空流水 → false', RC.isAlreadyIssued([], 'e'), false)
  check('P7.same', '同 eventId → true', RC.isAlreadyIssued([{ eventId: 'e' }], 'e'), true)
  check('P7.diff', '不同 eventId → false', RC.isAlreadyIssued([{ eventId: 'other' }], 'e'), false)
  check('P7.marker', 'LEGACY marker 占键 → 完成 eventId 已发', RC.isAlreadyIssued([{ eventId: 'mission-complete:m1' }], RC.completionEventId('m1')), true)
}

// ═══ I. Reward 幂等编排（Phase 10A：store 层，node+polyfill）═══
console.log('── I. Reward 幂等编排 ──')
{
  const mkMission = (id) => ({
    id, title: 'x', source: 'USER', requiresEvidence: false,
    targetMinutes: 30, actualStudyMs: 30 * 60000, distractionMs: 0,
    focusIntervals: [], evidence: [], recommendations: []
  })

  // I1 grantMissionReward 幂等：第二次 alreadyIssued，callback 仅一次
  {
    let calls = 0
    const cb = { addPoints: () => { calls++ }, addXp: () => {}, addPointRecord: () => {} }
    const m1 = mkMission('im1')
    const r1 = REW.grantMissionReward(m1, cb)
    const r2 = REW.grantMissionReward(m1, cb)
    check('I1.first', '首次发放有积分', r1.points > 0 && !r1.alreadyIssued, true)
    check('I1.second', '第二次 alreadyIssued=true', r2.alreadyIssued === true, true)
    check('I1.callback_once', 'addPoints 仅调用一次（不双发）', calls === 1, true)
  }

  // I2 LEGACY marker 占 eventId → RewardEngine 不再发（防重发）
  {
    let calls = 0
    const cb = { addPoints: () => { calls++ }, addXp: () => {}, addPointRecord: () => {} }
    const m2 = mkMission('im2')
    RWS.useRewardStore.getState().recordReward({
      id: 'migration:im2', eventId: RC.completionEventId('im2'), missionId: 'im2',
      kind: 'COURSE_COMPLETE', points: 120, xp: 80, reason: 'LEGACY_ACCEPTED', ts: Date.now(),
      sourceType: 'LEGACY_COURSE', legacyGranted: true, migrationStatus: 'LEGACY_ACCEPTED'
    })
    const r = REW.grantMissionReward(m2, cb)
    check('I2.blocked', 'marker 占键 → grant 跳过', r.alreadyIssued === true, true)
    check('I2.no_callback', 'marker 后无余额回调', calls === 0, true)
  }

  // I4 recordReward 只记录、不改余额（不调 callback）
  {
    let calls = 0
    const cb = { addPoints: () => { calls++ }, addXp: () => {}, addPointRecord: () => {} }
    const before = RWS.useRewardStore.getState().transactions.length
    RWS.useRewardStore.getState().recordReward({
      id: 'migration:im4', eventId: 'mission-complete:im4', missionId: 'im4',
      kind: 'COURSE_COMPLETE', points: 120, xp: 80, reason: 'LEGACY_ACCEPTED', ts: Date.now(),
      legacyGranted: true, migrationStatus: 'LEGACY_ACCEPTED'
    })
    const after = RWS.useRewardStore.getState().transactions.length
    check('I4.record_only', 'recordReward 落一条流水', after === before + 1, true)
    check('I4.no_callback', 'recordReward 不调余额回调', calls === 0, true)
  }

  // I3 migrateLegacyCourseRewards 幂等性（经 isAlreadyIssued 同键判断）
  {
    const eventId = RC.completionEventId('im-mig')
    RWS.useRewardStore.getState().recordReward({ id: 'migration:a', eventId, missionId: 'im-mig', kind: 'COURSE_COMPLETE', points: 1, xp: 1, reason: 'LEGACY_ACCEPTED', ts: Date.now(), migrationStatus: 'LEGACY_ACCEPTED' })
    check('I3.idem', '已有同 eventId marker → 再次迁移应跳过', RWS.useRewardStore.getState().hasRewardByEvent(eventId), true)
  }
}

// ── 3. 汇总 ──
console.log('')
const pad = (s, n) => String(s).padEnd(n)
console.log(pad('ID', 16) + pad('用例', 46) + pad('结果', 8) + '实际 / 期望')
let failed = 0
for (const r of results) {
  if (!r.pass) failed++
  console.log(pad(r.id, 16) + pad(r.name, 46) + pad(r.pass ? 'PASS' : 'FAIL', 8) + (r.pass ? r.actual : `${r.actual} / ${r.expect}`))
}
console.log('')
console.log(failed === 0 ? `✅ 全部 ${results.length} 项通过` : `❌ ${failed}/${results.length} 项失败`)

rmSync(out, { recursive: true, force: true })
rmSync(outRew, { recursive: true, force: true })
process.exit(failed === 0 ? 0 : 1)
