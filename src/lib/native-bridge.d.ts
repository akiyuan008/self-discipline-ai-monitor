// Capacitor 自定义插件原生桥接的 TypeScript 声明
// 实际实现见 android/ 模块下的 SelfDisciplinePlugin.kt
export {}

declare global {
  interface Window {
    SelfDiscipline?: {
      getUsageStats(opts: { startTs: number; endTs: number }): Promise<{ stats: any[] }>
      hasUsageAccess(): Promise<{ granted: boolean }>
      openUsageAccessSettings(): Promise<void>
      lockScreen(opts: { minutes: number }): Promise<void>
      showOverlay(opts: { text: string }): Promise<void>
    }
  }
}
