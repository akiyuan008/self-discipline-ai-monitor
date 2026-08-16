/**
 * useGrowth — 检测当前是否处于 Growth Mode（成长模式）。
 * Normal Mode 和 Growth Mode 共享 Core，各自独立 UI。
 */
import { useStore } from '@/stores/useStore'

export function useGrowth(): boolean {
  return useStore(s => s.theme) === 'growth'
}
