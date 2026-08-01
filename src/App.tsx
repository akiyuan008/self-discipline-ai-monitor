import { useEffect, useState, useRef } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
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
import Dock from '@/components/Dock'
import Toast from '@/components/Toast'
import { fetchUsageStats } from '@/lib/usageStats'
import type { PageId } from '@/stores/useStore'

// Dock 栏可见的主页面
const DOCK_PAGES: PageId[] = ['home', 'quests', 'chat', 'shop', 'profile']

// 全屏子页面 → 返回目标页
const BACK_MAP: Partial<Record<PageId, PageId>> = {
  dungeon: 'home',
  achievements: 'profile',
  settings: 'profile',
  pointsDetail: 'home',
}

export default function App() {
  const onboarded = useStore(s => s.onboarded)
  const isDark = useStore(s => s.isDark)
  const [current, setCurrent] = useState<PageId>('home')

  // 用 ref 持有最新页面，避免 backButton 监听器闭包过期
  const currentRef = useRef(current)
  currentRef.current = current

  useEffect(() => {
    document.body.classList.toggle('dark', isDark)
  }, [isDark])

  // ═══ Android 返回键 / 全面屏手势返回 ═══
  useEffect(() => {
    let listenerHandle: any

    CapacitorApp.addListener('backButton', () => {
      const page = currentRef.current
      // 在全屏子页面 → 返回上级
      if (BACK_MAP[page]) {
        setCurrent(BACK_MAP[page]!)
        return
      }
      // 在 Dock 页面但不是首页 → 回首页
      if (page !== 'home') {
        setCurrent('home')
        return
      }
      // 在首页 → 退出 App
      CapacitorApp.exitApp()
    }).then((h: any) => {
      listenerHandle = h
    })

    return () => {
      listenerHandle?.remove?.()
    }
  }, [])

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

  // 全屏页（无 Dock）：深渊/设置/成就/积分详情
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
        return <Profile onNavigate={(p: 'achievements' | 'settings' | 'chat') => setCurrent(p)} />
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
