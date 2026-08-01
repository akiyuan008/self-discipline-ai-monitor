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
import PointsDetail from '@/pages/PointsDetail'
import Archive from '@/pages/Archive'
import Dock from '@/components/Dock'
import Toast from '@/components/Toast'
import { fetchUsageStats } from '@/lib/usageStats'
import type { PageId } from '@/stores/useStore'

// Dock 栏可见的主页面
const DOCK_PAGES: PageId[] = ['home', 'quests', 'chat', 'shop', 'profile']

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
    fetchUsageStats(Date.now() - 24 * 3600_000, Date.now()).then(({ study, ent }) => {
      s.syncUsage(study, ent)
      if (!useStore.getState().hpLocked) {
        s.setHp(hpFromStudy(s.todayStudyMs, s.dailyGoalMin * 60_000))
        useStore.setState({ hpLocked: false })
      }
    })
    const id = window.setInterval(() => {
      const st = useStore.getState()
      st.dailySettle()
      fetchUsageStats(Date.now() - 24 * 3600_000, Date.now()).then(({ study, ent }) => {
        st.syncUsage(study, ent)
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

  // 全屏页（无 Dock）：深渊/设置/成就/积分详情/档案馆
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
  if (current === 'pointsDetail') {
    return (
      <>
        <PointsDetail onBack={() => setCurrent('home')} />
        <Toast />
      </>
    )
  }
  if (current === 'archive') {
    return (
      <>
        <Archive onBack={() => setCurrent('profile')} />
        <Toast />
      </>
    )
  }

  // 带 Dock 的主页面（包括 Chat）
  const showDock = DOCK_PAGES.includes(current)

  const renderPage = () => {
    switch (current) {
      case 'home':
        return <Home onNavigate={(p: PageId) => setCurrent(p)} />
      case 'quests':
        return <Quests onNavigate={(p: PageId) => setCurrent(p)} />
      case 'chat':
        return <Chat onNavigateSettings={() => setCurrent('settings')} />
      case 'shop':
        return <Shop onNavigate={(p: PageId) => setCurrent(p)} />
      case 'profile':
        return <Profile onNavigate={(p: 'achievements' | 'settings' | 'archive' | 'chat') => setCurrent(p)} />
      default:
        return <Home onNavigate={(p: PageId) => setCurrent(p)} />
    }
  }

  // Chat 页面需要全高布局，Dock 浮在上层
  const isChat = current === 'chat'

  return (
    <div className="min-h-full relative" style={{ height: isChat ? '100vh' : undefined }}>
      <div className={isChat ? '' : 'animate-in'} key={current} style={isChat ? { height: '100%' } : undefined}>
        {renderPage()}
      </div>
      <Toast />
      {showDock && <Dock current={current} onChange={setCurrent} />}
    </div>
  )
}
