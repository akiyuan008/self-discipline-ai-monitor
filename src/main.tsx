import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as CapApp } from '@capacitor/app'
import './styles/index.css'
import App from '@/App'
import { autoBackup } from '@/lib/backup'

// 自动备份：App 进入后台时触发
CapApp.addListener('pause', () => {
  autoBackup().catch(() => {})
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
