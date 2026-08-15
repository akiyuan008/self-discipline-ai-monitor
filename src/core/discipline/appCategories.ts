/**
 * src/core/discipline/appCategories.ts
 * App 分类加载器 —— 消费 config/appCategories.json（唯一 Source of Truth）。
 * Android 在构建时消费同一份 JSON，不维护独立分类。
 */
import raw from '../../../config/appCategories.json'

export type AppCategory = 'study' | 'entertainment' | 'social' | 'neutral'

interface CategoriesConfig {
  version: number
  categories: Record<string, { label: string; color: string; packages: string[] }>
  labels: Record<string, string>
  keywords: Record<string, string[]>
}

const config = raw as unknown as CategoriesConfig

/**
 * App 分类 Schema 版本（V3 Phase 11：App Category Unification）。
 * 统一分类规则自此版本生效；不重算历史 XP/历史奖励。
 */
export const CATEGORY_SCHEMA_VERSION: number = config.version

// 包名 → 分类（精确匹配）
const PKG_CATEGORY = new Map<string, AppCategory>()
for (const [cat, def] of Object.entries(config.categories)) {
  for (const pkg of def.packages) PKG_CATEGORY.set(pkg, cat as AppCategory)
}

/** 精确分类（包名命中） */
export function classifyByPackage(pkg: string): AppCategory | undefined {
  return PKG_CATEGORY.get(pkg)
}

/** 关键词模糊分类（包名/标签） */
export function classifyByKeyword(pkg: string, label: string = ''): AppCategory | undefined {
  const lowerPkg = pkg.toLowerCase()
  const lowerLabel = label.toLowerCase()
  for (const cat of ['study', 'entertainment'] as const) {
    const kws = config.keywords[cat] || []
    if (kws.some(k => lowerPkg.includes(k) || lowerLabel.includes(k))) return cat
  }
  return undefined
}

/**
 * 统一分类入口：先精确包名，再关键词。
 * 未命中的返回 'neutral'（不计入学习/分心）。
 */
export function classifyApp(pkg: string, label: string = ''): AppCategory {
  return classifyByPackage(pkg) ?? classifyByKeyword(pkg, label) ?? 'neutral'
}

export function isStudyApp(pkg: string, label: string = ''): boolean {
  return classifyApp(pkg, label) === 'study'
}

/** 分心类 App：娱乐 + 社交 */
export function isDistractionApp(pkg: string, label: string = ''): boolean {
  const cat = classifyApp(pkg, label)
  return cat === 'entertainment' || cat === 'social'
}

export function getAppLabel(pkg: string): string {
  return config.labels[pkg] ?? pkg.split('.').pop() ?? '未知应用'
}

export function getCategoryColor(cat: AppCategory): string {
  return config.categories[cat]?.color ?? '#8A8A8A'
}

export function getCategoryLabel(cat: AppCategory): string {
  return config.categories[cat]?.label ?? cat
}
