import { Capacitor, registerPlugin } from '@capacitor/core'
import type { UsageStat } from '@/stores/useStore'
import { classifyApp, getAppLabel, CATEGORY_SCHEMA_VERSION } from '@/core/discipline/appCategories'
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
      if (!pkg) continue

      const rawLabel = s.label || getAppLabel(pkg)
      // V3 Phase 11：统一分类（appCategories.json 唯一 SoT，schema v=CATEGORY_SCHEMA_VERSION）。
      // neutral（含系统/浏览器/未知应用）既不计入学习、也不计入分心。
      const cat = classifyApp(pkg, rawLabel)
      if (cat === 'neutral') continue

      const item: UsageStat = {
        packageName: pkg,
        label: rawLabel,
        isStudy: cat === 'study',
        totalMs: s.totalMs ?? s.foregroundMs ?? 0
      }

      if (cat === 'study') study.push(item)
      else ent.push(item) // entertainment + social = 分心类
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

/** 启动监工前台服务（后台持续监测使用情况） */
export async function startMonitorService(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    await getPlugin().startMonitorService()
    logger.info('monitor', '监工前台服务已启动')
  } catch (e: any) {
    logger.warn('monitor', '启动监工前台服务失败', { error: String(e?.message || e) })
  }
}

/** 停止监工前台服务 */
export async function stopMonitorService(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    await getPlugin().stopMonitorService()
    logger.info('monitor', '监工前台服务已停止')
  } catch (e: any) {
    logger.warn('monitor', '停止监工前台服务失败', { error: String(e?.message || e) })
  }
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
