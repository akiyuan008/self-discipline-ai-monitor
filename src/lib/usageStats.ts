import { Capacitor, registerPlugin } from '@capacitor/core'
import type { UsageStat } from '@/stores/useStore'
import { STUDY_PACKAGES, ENTERTAINMENT_PACKAGES, APP_LABELS } from '@/data/appClassification'
import { logger } from '@/lib/logger'

// 惰性获取插件代理，避免模块加载时 Capacitor 未初始化
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
      const isStudy = STUDY_PACKAGES.has(s.packageName)
      const isEnt = ENTERTAINMENT_PACKAGES.has(s.packageName)
      if (!isStudy && !isEnt) continue
      const item: UsageStat = {
        packageName: s.packageName,
        label: APP_LABELS[s.packageName] ?? s.label ?? s.packageName.split('.').pop() ?? '未知',
        isStudy,
        totalMs: s.totalMs ?? 0
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
