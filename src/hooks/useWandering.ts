/**
 * useWandering — 检测当前是否处于 Mission Control（wandering）主题。
 * 替代页面中硬编码的 `true ? ... : ...`，实现 Normal / Mission Control 双模式隔离。
 */
import { useStore } from '@/stores/useStore'

export function useWandering(): boolean {
  return useStore(s => s.theme) === 'wandering'
}
