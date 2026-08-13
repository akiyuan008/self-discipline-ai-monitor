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
  'src/core/discipline/resultResolver.ts'
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
const { DEVIATION, RESULT } = require(path.join(out, 'config.js'))

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
  check('D.rate', 'executionRate 20/60min=0.33', Math.round(R.computeExecutionRate({ focusDurationMs: 20 * min }, mNotDone) * 100) / 100, 0.33)
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
