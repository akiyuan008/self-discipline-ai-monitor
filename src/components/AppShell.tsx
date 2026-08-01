import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useUserStore, currentPersona } from '@/stores/userStore'

const tabs = [
  { to: '/', label: '首页', icon: HomeIcon },
  { to: '/stats', label: '统计', icon: StatsIcon },
  { to: '/chat', label: '监工', icon: ChatIcon, primary: true },
  { to: '/reward', label: '奖励', icon: RewardIcon },
  { to: '/pet', label: '养成', icon: PetIcon }
]

export default function AppShell() {
  const loc = useLocation()
  const nickname = useUserStore(s => s.nickname)
  const persona = currentPersona()

  return (
    <div className="min-h-full flex flex-col max-w-[480px] mx-auto bg-bg-page relative">
      {/* 顶部状态条 */}
      <div className="safe-top bg-brand text-white text-xs px-4 py-2 flex items-center justify-between">
        <span className="truncate">{nickname ? `${persona.emoji} ${persona.name} · ${nickname}` : persona.emoji + ' ' + persona.name}</span>
        <PersonaIndicator />
      </div>

      {/* 路由内容 */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* 底部 Tab Bar */}
      <nav className="absolute bottom-0 inset-x-0 safe-bottom bg-white border-t border-stroke flex items-stretch justify-around px-2">
        {tabs.map(t => {
          const Icon = t.icon
          const active = loc.pathname === t.to || (t.to !== '/' && loc.pathname.startsWith(t.to))
          if (t.primary) {
            return (
              <NavLink key={t.to} to={t.to} className="flex-1 flex flex-col items-center justify-end pb-2">
                <div className={`-mt-6 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-float transition ${active ? 'bg-brand scale-105' : 'bg-brand/90'}`}>
                  <Icon className="w-7 h-7" />
                </div>
                <span className={`text-[10px] mt-1 ${active ? 'text-brand font-medium' : 'text-ink-3'}`}>{t.label}</span>
              </NavLink>
            )
          }
          return (
            <NavLink key={t.to} to={t.to} className="flex-1 flex flex-col items-center justify-center py-2">
              <Icon className={`w-6 h-6 ${active ? 'text-brand' : 'text-ink-3'}`} />
              <span className={`text-[10px] mt-0.5 ${active ? 'text-brand font-medium' : 'text-ink-3'}`}>{t.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

function PersonaIndicator() {
  const points = useUserStore(s => s.points)
  const energy = useUserStore(s => s.energy)
  const pardon = useUserStore(s => s.pardonCards)
  return (
    <div className="flex items-center gap-2">
      <span className="chip bg-white/20 text-white">⚡ {energy}</span>
      <span className="chip bg-white/20 text-white">💎 {points}</span>
      {pardon > 0 && <span className="chip bg-white/20 text-white">🛡 {pardon}</span>}
    </div>
  )
}

// 简单的 inline SVG 图标
function HomeIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2v-9z" />
    </svg>
  )
}
function StatsIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-6 4 3 5-7" />
    </svg>
  )
}
function ChatIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}
function RewardIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H4v4a8 8 0 0 0 16 0z" />
      <path d="M2 8h20" />
      <path d="M12 14v8" />
    </svg>
  )
}
function PetIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="4" cy="8" r="2" />
      <path d="M6 14s-1 4 5 4 5-4 5-4-2-3-5-3-5 1-5 3z" />
    </svg>
  )
}
