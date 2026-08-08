import { useState, useEffect } from 'react'
import { useEchoStore } from '@/stores/echoStore'
import { useStore } from '@/stores/useStore'
import EchoPlayer from '@/components/EchoPlayer'
import type { EchoRecord } from '@/lib/echoStorage'

/**
 * 深渊回响触发器：挂载在 App 顶层。
 * 断签（streakJustBroken）或到达指定日期时，弹出回放。
 */
export default function EchoTrigger() {
  const init = useEchoStore(s => s.init)
  const loaded = useEchoStore(s => s.loaded)
  const pickPending = useEchoStore(s => s.pickPending)
  const markPlayed = useEchoStore(s => s.markPlayed)

  const streakJustBroken = useStore(s => s.streakJustBroken)
  const clearStreakBroken = useStore(s => s.clearStreakBroken)

  const [activeEcho, setActiveEcho] = useState<EchoRecord | null>(null)

  // 初始化加载外部索引
  useEffect(() => { init() }, [init])

  // 检测触发
  useEffect(() => {
    if (!loaded) return
    if (activeEcho) return
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const hit = pickPending({ streakBroken: streakJustBroken, today: todayStr })
    if (hit) setActiveEcho(hit)
  }, [loaded, streakJustBroken, pickPending, activeEcho])

  function handleClose() {
    if (activeEcho) {
      markPlayed(activeEcho.id)
      if (activeEcho.trigger === 'streak-break') clearStreakBroken()
    }
    setActiveEcho(null)
  }

  if (!activeEcho) return null
  return <EchoPlayer echo={activeEcho} onClose={handleClose} />
}
