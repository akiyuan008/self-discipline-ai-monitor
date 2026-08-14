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
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)

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
  'src/core/discipline/recoveryReward.ts'
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

const A = require(path.join(out, 'deviationAnalyzer.js'))
const R = require(path.join(out, 'resultResolver.js'))
const F = require(path.join(out, 'focusMath.js'))
const REC = require(path.join(out, 'recoveryReward.js'))
const EV = require(path.join(out, 'resultEvaluator.js'))
const HE = require(path.join(out, 'evidenceEvaluator.js'))
const ME = require(path.join(out, 'missionEvaluator.js'))
const { DEVIATION, RESULT, RECOVERY, QUALITY, COMPLETION, EVIDENCE } = require(path.join(out, 'config.js'))

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
  const r3 = x => Math.round(x * 1000) / 1000

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
process.exit(failed === 0 ? 0 : 1)
