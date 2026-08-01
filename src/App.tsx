import { useEffect, useState } from 'react'
import { useStore } from '@/stores/useStore'
import Onboarding from '@/pages/Onboarding'
import Home from '@/pages/Home'
import Dungeon from '@/pages/Dungeon'
import Quests from '@/pages/Quests'
import Shop from '@/pages/Shop'
import Profile from '@/pages/Profile'
import Achievements from '@/pages/Achievements'
import Settings from '@/pages/Settings'
import Dock from '@/components/Dock'
import Toast from '@/components/Toast'
import type { PageId } from '@/stores/useStore'

export default function App() {
  const onboarded = useStore(s => s.onboarded)
  const isDark = useStore(s => s.isDark)
  const [current, setCurrent] = useState<PageId>('home')

  useEffect(() => {
    document.body.classList.toggle('dark', isDark)
  }, [isDark])

  if (!onboarded) {
    return (
      <>
        <Onboarding />
        <Toast />
      </>
    )
  }

  // 深渊页全屏，不带 dock
  if (current === 'dungeon') {
    return (
      <>
        <Dungeon />
        <Toast />
      </>
    )
  }

  // 全屏弹层页
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

  // 主页面：home / quests / shop / profile
  const main: Record<'home' | 'quests' | 'shop' | 'profile', React.ComponentType<any>> = {
    home: (props: any) => <Home {...props} onNavigate={(p: PageId) => setCurrent(p)} />,
    quests: Quests,
    shop: Shop,
    profile: (props: any) => <Profile {...props} onNavigate={(p: 'achievements' | 'settings') => setCurrent(p)} />
  }
  const M = main[current as 'home' | 'quests' | 'shop' | 'profile'] || Home

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
