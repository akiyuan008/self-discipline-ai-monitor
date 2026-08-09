import { useEffect, useState, useRef } from 'react'
import { App as CapApp } from '@capacitor/app'
import { useStore } from '@/stores/useStore'
import type { PageId } from '@/stores/useStore'
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
import ClassHistory from '@/pages/ClassHistory'
import DiagLogs from '@/pages/DiagLogs'
import Stats from '@/pages/Stats'
import Dock from '@/components/Dock'
import Toast from '@/components/Toast'
import EchoTrigger from '@/components/EchoTrigger'
import { checkUpdate } from '@/lib/update'
import { ThemeProvider } from '@/components/ThemeToggle'

function PointsToast() {
  const lastChange = useStore(s => s.lastPointsChange)
  const [visible, setVisible] = useState(false)
  const [display, setDisplay] = useState<{ amount: number; reason: string } | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!lastChange) return
    if (lastChange.time === lastTimeRef.current) return
    if (Date.now() - lastChange.time > 5000) return
    lastTimeRef.current = lastChange.time
    setDisplay({ amount: lastChange.amount, reason: lastChange.reason })
    setVisible(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setVisible(false), 3000)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [lastChange])

  if (!visible || !display) return null
  const isPositive = display.amount >= 0
  return (
    <div style={{
      position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, background: isPositive ? 'rgba(22, 163, 74, 0.95)' : 'rgba(229, 77, 46, 0.95)',
      color: '#fff', padding: '10px 20px', borderRadius: 100, fontSize: 13, fontWeight: 600,
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)', animation: 'slideDown 0.3s ease',
      pointerEvents: 'none', whiteSpace: 'nowrap'
    }}>
      {isPositive ? '+' : ''}{display.amount} 积分 · {display.reason}
    </div>
  )
}

export default function App() {
  const page = useStore(s => s.onboarded ? 'home' : 'onboarding')
  const [currentPage, setCurrentPage] = useState<PageId>(page)
  const onboarded = useStore(s => s.onboarded)

  useEffect(() => {
    if (onboarded && currentPage === 'onboarding') setCurrentPage('home')
  }, [onboarded, currentPage])

  useEffect(() => { checkUpdate() }, [])

  // Android 物理返回键：子页面回 Home，Home 退出 App
  const pageRef = useRef(currentPage)
  pageRef.current = currentPage
  useEffect(() => {
    const sub = CapApp.addListener('backButton', ({ canGoBack }) => {
      const page = pageRef.current
      if (page === 'onboarding') return
      if (page === 'dungeon') return  // 深渊页自己处理返回（运行中弹确认，不直接退出）
      if (page !== 'home') {
        goBack()  // 返回上一个页面
      } else {
        if (!canGoBack) CapApp.exitApp()
      }
    })
    return () => { void sub.then(s => s.remove()) }
  }, [])

  const pageStackRef = useRef<PageId[]>([page])
  const navigate = (p: PageId) => {
    pageStackRef.current = [...pageStackRef.current, p]
    setCurrentPage(p)
  }
  const goHome = () => {
    pageStackRef.current = ['home']
    setCurrentPage('home')
  }
  const goBack = () => {
    const stack = pageStackRef.current
    if (stack.length <= 1) {
      setCurrentPage('home')
      return
    }
    const newStack = stack.slice(0, -1)
    pageStackRef.current = newStack
    setCurrentPage(newStack[newStack.length - 1])
  }

  return (
    <ThemeProvider><div className="app-container">
      <Toast />
      <PointsToast />
      <EchoTrigger />
      {currentPage === 'onboarding' && <Onboarding />}
      {currentPage === 'home' && <Home onNavigate={navigate} />}
      {currentPage === 'dungeon' && <Dungeon onExit={goHome} />}
      {currentPage === 'quests' && <Quests onNavigate={navigate} />}
      {currentPage === 'shop' && <Shop onNavigate={navigate} />}
      {currentPage === 'profile' && <Profile onNavigate={navigate} onNavigateStats={() => navigate('stats')} />}
      {currentPage === 'chat' && <Chat onNavigateSettings={() => navigate('settings')} />}
      {currentPage === 'achievements' && <Achievements onBack={goBack} />}
      {currentPage === 'settings' && <Settings onBack={goBack} onNavigateDiagLogs={() => navigate('diagLogs')} />}
      {currentPage === 'pointsDetail' && <PointsDetail onBack={goBack} />}
      {currentPage === 'classHistory' && <ClassHistory onBack={goBack} />}
      {currentPage === 'diagLogs' && <DiagLogs onBack={goBack} />}
        {currentPage === 'stats' && <Stats onBack={goBack} />}
      {onboarded && currentPage !== 'onboarding' && currentPage !== 'dungeon' && currentPage !== 'classHistory' && (
        <Dock current={currentPage} onChange={navigate} />
      )}
    </div></ThemeProvider>
  )
}