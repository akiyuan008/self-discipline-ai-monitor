#!/usr/bin/env node
/**
 * scripts/gen-android-categories.mjs
 * 从 config/appCategories.json（唯一 Source of Truth）生成 Android 端
 * AppCategories.kt，实现"TypeScript 与 Android 构建时共用同一份分类配置"。
 *
 * 用法:  npm run gen:android-categories
 * 产物:  android_plugin/java/cn/selfdiscipline/app/plugin/AppCategories.kt
 *
 * 注意: Android 侧只做包名精确匹配；TS 侧另有 keyword 模糊兜底。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const cfg = JSON.parse(readFileSync(resolve(root, 'config/appCategories.json'), 'utf8'))
const cats = cfg.categories || {}

const listOf = (pkgs) => pkgs.length
  ? `setOf(\n${pkgs.map(p => `      "${p}"`).join(',\n')}\n  )`
  : 'emptySet()'

const study = cats.study?.packages || []
const entertainment = cats.entertainment?.packages || []
const social = cats.social?.packages || []
const neutral = cats.neutral?.packages || []

const labels = cfg.labels || {}
const labelsEntries = Object.entries(labels)
  .map(([k, v]) => `      "${k}" to "${String(v).replace(/"/g, '\\"')}"`)
  .join(',\n')

const kotlin = `package cn.selfdiscipline.app.plugin

/**
 * AUTO-GENERATED from config/appCategories.json — DO NOT EDIT.
 * Regenerate with: npm run gen:android-categories
 *
 * App 分类唯一数据源（Single Source of Truth），与 TypeScript 共用同一份配置。
 * Android 在构建时消费 config/appCategories.json 生成本文件，不维护独立分类。
 */
object AppCategories {
  const val CATEGORY_STUDY = "study"
  const val CATEGORY_ENTERTAINMENT = "entertainment"
  const val CATEGORY_SOCIAL = "social"
  const val CATEGORY_NEUTRAL = "neutral"

  val STUDY_PACKAGES: Set<String> = ${listOf(study)}

  val ENTERTAINMENT_PACKAGES: Set<String> = ${listOf(entertainment)}

  val SOCIAL_PACKAGES: Set<String> = ${listOf(social)}

  val NEUTRAL_PACKAGES: Set<String> = ${listOf(neutral)}

  val APP_LABELS: Map<String, String> = mapOf(
${labelsEntries}
  )

  /** 精确分类（包名命中）；未命中归为 neutral */
  fun classify(pkg: String): String = when {
    STUDY_PACKAGES.contains(pkg) -> CATEGORY_STUDY
    ENTERTAINMENT_PACKAGES.contains(pkg) -> CATEGORY_ENTERTAINMENT
    SOCIAL_PACKAGES.contains(pkg) -> CATEGORY_SOCIAL
    NEUTRAL_PACKAGES.contains(pkg) -> CATEGORY_NEUTRAL
    else -> CATEGORY_NEUTRAL
  }

  /** 分心类 App：娱乐 + 社交 */
  fun isDistraction(pkg: String): Boolean {
    val c = classify(pkg)
    return c == CATEGORY_ENTERTAINMENT || c == CATEGORY_SOCIAL
  }

  fun label(pkg: String): String = APP_LABELS[pkg] ?: pkg.substringAfterLast('.')
}
`

const out = resolve(root, 'android_plugin/java/cn/selfdiscipline/app/plugin/AppCategories.kt')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, kotlin, 'utf8')
console.log(`✓ AppCategories.kt generated`)
console.log(`  study=${study.length} entertainment=${entertainment.length} social=${social.length} neutral=${neutral.length} labels=${Object.keys(labels).length}`)
console.log(`  -> ${out}`)
