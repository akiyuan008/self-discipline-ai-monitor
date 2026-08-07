import { Capacitor, registerPlugin } from '@capacitor/core'

const SelfDisciplinePlugin = registerPlugin('SelfDiscipline')
import type { UsageStat } from '@/stores/useStore'
import { STUDY_PACKAGES, ENTERTAINMENT_PACKAGES, APP_LABELS } from '@/data/appClassification'

export async function fetchUsageStats(startTs: number, endTs: number): Promise<{ study: UsageStat[]; ent: UsageStat[] }> {
  if (Capacitor.getPlatform() !== 'android') {
    return mockUsage()
  }
  try {
        
    const res = await SelfDisciplinePlugin.getUsageStats({ startTs, endTs })
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
    console.warn('[UsageStats] native failed', e)
    return mockUsage()
  }
}

export async function hasUsageAccess(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return true
  try {
        
    const r = await SelfDisciplinePlugin.hasUsageAccess()
    console.log('[UsageStats] hasUsageAccess response:', r)
    return !!r?.granted
  } catch (e) {
    console.error('[UsageStats] hasUsageAccess error:', e)
    return false
  }
}

export async function openUsageAccessSettings(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  try {
        
    await SelfDisciplinePlugin.openUsageAccessSettings()
  } catch (e: any) {
    console.error('[UsageStats] openUsageAccessSettings error:', e)
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
