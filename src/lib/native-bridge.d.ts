// Capacitor 自定义插件全局类型声明
// 解决 ai.ts / usageStats.ts 里大量 (window as any) 的问题

declare global {
  interface Window {
    SelfDiscipline?: {
      getUsageStats?: (opts: { startTs: number; endTs: number }) => Promise<{
        stats: Array<{
          packageName: string
          totalMs: number
          foregroundMs: number
          lastTimeUsed: number
          firstTimeUsed: number
        }>
      }>
      hasUsageAccess?: () => Promise<{ granted: boolean }>
      openUsageAccessSettings?: () => Promise<void>
      lockScreen?: (opts: { minutes: number; text?: string }) => Promise<void>
      showOverlay?: (opts: { text?: string }) => Promise<void>
    }
  }
}

export {}
