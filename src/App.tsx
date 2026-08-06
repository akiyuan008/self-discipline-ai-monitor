import { useEffect, useState, useRef } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { useStore } from '@/stores/useStore'
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
import NavBar from '@/components/NavBar'
import { checkUpdate } from '@/lib/update'

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

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [lastChange])

  if (!visible || !display) return null

  const isPositive = display.amount >= 0
  return (
    <div style={{
      position: 'fixed',
      top: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: isPositive ? 'rgba(22, 163, 74, 0.95)' : 'rgba(229, 77, 46, 0.95)',
      color: '#fff',
      padding: '10px 20px',
      borderRadius: 100,
      fontSize: 13,
      fontWeight: 600,
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      animation: 'slideDown 0.3s ease',
      pointerEvents: 'none',
      whiteSpace: 'nowrap'
    }}>
      {isPositive ? '+' : ''}{display.amount} 积分 · {display.reason}
    </div>
  )
}

export default function App() {
  const page = useStore(s => s.onboarded ? 'home' : 'onboarding')
  const [currentPage, setCurrentPage] = useState(page)
  const onboarded = useStore(s => s.onboarded)

  useEffect(() => {
    if (onboarded) setCurrentPage('home')
  }, [onboarded])

  useEffect(() => {
    checkUpdate()
  }, [])

  const navigate = (p: string) => setCurrentPage(p)

  return (
    <div className="app-container">
      <PointsToast />
      {currentPage === 'onboarding' && <Onboarding onDone={() => setCurrentPage('home')} />}
      {currentPage === 'home' && <Home onNavigate={navigate} />}
      {currentPage === 'dungeon' && <Dungeon onNavigate={navigate} />}
      {currentPage === 'quests' && <Quests onNavigate={navigate} />}
      {currentPage === 'shop' && <Shop onNavigate={navigate} />}
      {currentPage === 'profile' && <Profile onNavigate={navigate} />}
      {currentPage === 'chat' && <Chat onNavigate={navigate} />}
      {currentPage === 'achievements' && <Achievements onNavigate={navigate} />}
      {currentPage === 'settings' && <Settings onNavigate={navigate} />}
      {currentPage === 'pointsDetail' && <PointsDetail onNavigate={navigate} />}
      {onboarded && currentPage !== 'onboarding' && (
        <NavBar current={currentPage} onNavigate={navigate} />
      )}
    </div>
  )
}