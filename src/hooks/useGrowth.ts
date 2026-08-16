/**
 * useGrowth — 检测当前是否处于 Growth Mode（成长模式）。
 *
 * Growth Mode 是 App 的第二套产品逻辑（个人成长系统），不是主题。
 * Normal Mode（任务执行系统）与 Growth Mode 共享用户数据 / Session / Reward / Evidence，
 * 但 Home、导航、信息架构、用户旅程完全不同。
 */
import { useStore } from '@/stores/useStore'

export function useGrowth(): boolean {
  return useStore(s => s.appMode) === 'growth'
}
