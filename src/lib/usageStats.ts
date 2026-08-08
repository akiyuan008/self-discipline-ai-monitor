import { Capacitor, registerPlugin } from '@capacitor/core'
import type { UsageStat } from '@/stores/useStore'
import { STUDY_PACKAGES, ENTERTAINMENT_PACKAGES, SYSTEM_PACKAGES, APP_LABELS, isStudyApp, isEntertainmentApp } from '@/data/appClassification'
import { logger } from '@/lib/logger'

let _plugin: any = null
let _pluginLogged = false
function getPlugin(): any {
  if (!_plugin) {
    _plugin = registerPlugin('SelfDiscipline') as any
  }
  if (!_pluginLogged) {
    _pluginLogged = true
    const isNative = Capacitor.isNativePlatform()
    logger.info('usage', `SelfDiscipline 插件代理已创建`, { isNative, platform: Capacitor.getPlatform(), hasPlugin: !!_plugin })
  }
  return _plugin
}

export async function fetchUsageStats(startTs: number, endTs: number): Promise<{ study: UsageStat[]; ent: UsageStat[] }> {
  if (Capacitor.getPlatform() !== 'android') {
    return mockUsage()
  }
  try {
    const res = await getPlugin().getUsageStats({ startTs, endTs })
    const stats: any[] = res?.stats ?? []
    const study: UsageStat[] = []
    const ent: UsageStat[] = []

    for (const s of stats) {
      const pkg = s.packageName ?? ''
      if (!pkg || SYSTEM_PACKAGES.has(pkg)) continue

      const rawLabel = s.label || APP_LABELS[pkg] || pkg.split('.').pop() || '未知应用'
      const isStudy = isStudyApp(pkg, rawLabel)
      // 所有非学习类的三方应用归入娱乐/日常使用统计

      const item: UsageStat = {
        packageName: pkg,
        label: APP_LABELS[pkg] ?? rawLabel,
        isStudy,
        totalMs: s.totalMs ?? s.foregroundMs ?? 0
      }

      if (isStudy) study.push(item)
      else ent.push(item)
    }

    return { study, ent }
  } catch (e) {
    logger.warn('usage', '原生使用统计查询失败，使用 mock 数据', { error: String(e) })
    return mockUsage()
  }
}

export async function hasUsageAccess(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return true
  try {
    const r = await getPlugin().hasUsageAccess()
    logger.debug('usage', 'hasUsageAccess 返回', { granted: r?.granted, mode: r?.mode })
    return !!r?.granted
  } catch (e) {
    logger.error('usage', 'hasUsageAccess 查询失败', { error: String(e) })
    return false
  }
}

export async function openUsageAccessSettings(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    logger.info('auth', '尝试打开使用情况访问设置页')
    await getPlugin().openUsageAccessSettings()
    logger.info('auth', '设置页跳转成功')
  } catch (e: any) {
    logger.error('auth', '打开使用情况访问设置页失败', { error: String(e?.message || e) })
    throw new Error(e?.message || '无法打开设置页面')
  }
}

export async function requestUsagePermission(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  await openUsageAccessSettings()
}

function mockUsage(): { study: UsageStat[]; ent: UsageStat[] } {
  const now = Date.now()
  return {
    study: [
      { packageName: 'com.xiaodao', label: '小道背单词', isStudy: true, totalMs: 42 * 60_000 },
      { packageName: 'cn.com.moobo', label: '可汗数学', isStudy: true, totalMs: 38 * 60_000 },
      { packageName: 'com.duolingo', label: '多邻国', isStudy: true, totalMs: 25 * 60_000 }
    ],
    ent: [
      { packageName: 'com.ss.android.ugc.aweme', label: '抖音', isStudy: false, totalMs: 47 * 60_000 },
      { packageName: 'com.miHoYo', label: '原神', isStudy: false, totalMs: 38 * 60_000 },
      { packageName: 'tv.danmaku.bili', label: '哔哩哔哩', isStudy: false, totalMs: 22 * 60_000 }
    ].map((x, i) => ({ ...x, lastTimeUsed: now - (i + 1) * 1_800_000 }))
  }
}

export function isLateNight(): boolean {
  const h = new Date().getHours()
  return h >= 23 || h < 5
}

export function fmtMs(ms: number): string {
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min} 分钟`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分`
}
