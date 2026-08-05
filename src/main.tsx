import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as CapApp } from '@capacitor/app'
import './styles/index.css'
import App from '@/App'
import { autoBackup, startAutoBackup } from '@/lib/backup'

// App 进入后台时自动备份
CapApp.addListener('pause', () => {
  autoBackup().catch(() => {})
})

// 启动定时自动备份
startAutoBackup()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
