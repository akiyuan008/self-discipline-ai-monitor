import { useEffect, useState } from 'react'
import { useStore, hpFromStudy } from '@/stores/useStore'
import Onboarding from '@/pages/Onboarding'
import Home from '@/pages/Home'
import Dungeon from '@/pages/Dungeon'
import Quests from '@/pages/Quests'
import Shop from '@/pages/Shop'
import Profile from '@/pages/Profile'
import Chat from '@/pages/Chat'
import Achievements from '@/pages/Achievements'
import Settings from '@/pages/Settings'
import Dock from '@/components/Dock'
import Toast from '@/components/Toast'
import { fetchUsageStats } from '@/lib/usageStats'
import type { PageId } from '@/stores/useStore'

export default function App() {
  const onboarded = useStore(s => s.onboarded)
  const isDark = useStore(s => s.isDark)
  const [current, setCurrent] = useState<PageId>('home')

  useEffect(() => {
    document.body.classList.toggle('dark', isDark)
  }, [isDark])

  // 启动时跨日结算 + 拉取 UsageStats
  useEffect(() => {
    if (!onboarded) return
    const s = useStore.getState()
    s.dailySettle()
    // 启动时同步使用情况（初始同步可以覆盖 HP）
    fetchUsageStats(Date.now() - 24 * 3600_000, Date.now()).then(({ study, ent }) => {
      s.syncUsage(study, ent)
      // 仅在 HP 未被 AI 锁定时才根据学习时长自动设置
      if (!useStore.getState().hpLocked) {
        s.setHp(hpFromStudy(s.todayStudyMs, s.dailyGoalMin * 60_000))
        useStore.setState({ hpLocked: false }) // 初始同步后解除锁定
      }
    })
    // 每 5 分钟同步一次
    const id = window.setInterval(() => {
      const st = useStore.getState()
      // 每次定时同步都检查跨日结算
      st.dailySettle()
      fetchUsageStats(Date.now() - 24 * 3600_000, Date.now()).then(({ study, ent }) => {
        st.syncUsage(study, ent)
        // 仅在 HP 未被 AI 锁定时才根据学习时长自动设置
        if (!useStore.getState().hpLocked) {
          st.setHp(hpFromStudy(st.todayStudyMs, st.dailyGoalMin * 60_000))
          useStore.setState({ hpLocked: false })
        }
      })
    }, 5 * 60_000)
    return () => window.clearInterval(id)
  }, [onboarded])

  if (!onboarded) {
    return (
      <>
        <Onboarding />
        <Toast />
      </>
    )
  }

  // 全屏页：深渊/设置/成就/聊天
  if (current === 'dungeon') {
    return (
      <>
        <Dungeon onExit={() => setCurrent('home')} />
        <Toast />
      </>
    )
  }
  if (current === 'achievements') {
    return (
      <>
        <Achievements onBack={() => setCurrent('profile')} />
        <Toast />
      </>
    )
  }
  if (current === 'settings') {
    return (
      <>
        <Settings onBack={() => setCurrent('profile')} />
        <Toast />
      </>
    )
  }
  if (current === 'chat') {
    return (
      <>
        <Chat onBack={() => setCurrent('home')} />
        <Toast />
      </>
    )
  }

  // 主页面
  const M = current === 'home'
    ? (props: any) => <Home {...props} onNavigate={(p: PageId) => setCurrent(p)} />
    : current === 'profile'
      ? (props: any) => <Profile {...props} onNavigate={(p: 'achievements' | 'settings') => setCurrent(p)} />
      : current === 'quests'
        ? Quests
        : current === 'shop'
          ? Shop
          : Home

  return (
    <div className="min-h-full relative">
      <div className="animate-in" key={current}>
        <M />
      </div>
      <Toast />
      <Dock current={current} onChange={setCurrent} />
    </div>
  )
}
