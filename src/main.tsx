import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/index.css'
import AppShell from '@/components/AppShell'
import Onboarding from '@/pages/Onboarding'
import Home from '@/pages/Home'
import Stats from '@/pages/Stats'
import Chat from '@/pages/Chat'
import Reward from '@/pages/Reward'
import Analysis from '@/pages/Analysis'
import Pet from '@/pages/Pet'
import Settings from '@/pages/Settings'
import { useUserStore } from '@/stores/userStore'

function Guard() {
  const onboarded = useUserStore(s => s.onboarded)
  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      {!onboarded ? (
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      ) : (
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/reward" element={<Reward />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/pet" element={<Pet />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Guard />
    </HashRouter>
  </React.StrictMode>
)
