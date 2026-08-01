import { Capacitor } from '@capacitor/core'
import type { UsageStat } from '@/data/mockUsage'
import { MOCK_USAGE_STATS } from '@/data/mockUsage'

/**
 * 原生 Android UsageStats 桥接
 * - 在 Capacitor Android 环境下，通过自定义插件 SelfDisciplinePlugin 读取 UsageStatsManager
 * - 在 Web 预览/PWA 下返回 mock 数据
 */
export async function fetchUsageStats(startTs: number, endTs: number): Promise<UsageStat[]> {
  if (Capacitor.getPlatform() !== 'android') {
    return MOCK_USAGE_STATS
  }
  try {
    // @ts-ignore 自定义插件的 TS 类型见 src/lib/native-bridge.d.ts
    const { SelfDiscipline } = window as any
    const res = await SelfDiscipline?.getUsageStats({ startTs, endTs })
    return (res?.stats ?? []) as UsageStat[]
  } catch (e) {
    console.warn('[UsageStats] native fetch failed, fallback to mock', e)
    return MOCK_USAGE_STATS
  }
}

/** 是否已获得"使用情况访问"权限 */
export async function hasUsageAccessPermission(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return true
  try {
    const { SelfDiscipline } = window as any
    const res = await SelfDiscipline?.hasUsageAccess?.()
    return !!res?.granted
  } catch {
    return false
  }
}

/** 跳到 Android 设置 Usage Access 页面 */
export async function openUsageAccessSettings(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    const { SelfDiscipline } = window as any
    await SelfDiscipline?.openUsageAccessSettings?.()
  } catch (e) {
    console.warn('[UsageAccess] open settings failed', e)
  }
}

/** 强制锁屏 N 分钟（DPM 锁屏或屏幕遮罩） */
export async function lockScreenMinutes(minutes: number): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') {
    alert(`【模拟锁屏】请离开手机 ${minutes} 分钟，期间不可解锁。`)
    return
  }
  try {
    const { SelfDiscipline } = window as any
    await SelfDiscipline?.lockScreen?.({ minutes })
  } catch (e) {
    console.warn('[LockScreen] native failed', e)
    alert(`【锁屏失败】原生桥接未生效，请手动锁屏 ${minutes} 分钟。`)
  }
}

/** 当前小时 */
export function currentHour(): number {
  return new Date().getHours()
}

/** 是否深夜 */
export function isLateNight(): boolean {
  const h = currentHour()
  return h >= 23 || h < 5
}

/** 是否连续学习超 90 分钟（mock 简化判断） */
export function isStudyingTooLong(): boolean {
  // 真机会监听 SCREEN_ON / USER_PRESENT 事件 + 当前前台 app
  return false
}
