import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { showToast } from '@/components/Toast'

const BACKUP_FILENAME = 'cyber-survival-backup.json'

interface BackupData {
  version: number
  exportTime: string
  app: string
  data: Record<string, string>
}

/**
 * 收集所有 localStorage 数据
 */
function collectAllData(): Record<string, string> {
  const data: Record<string, string> = {}
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key) {
        const val = window.localStorage.getItem(key)
        if (val !== null) data[key] = val
      }
    }
  } catch (e) {
    console.error('[Backup] 读取 localStorage 失败', e)
  }
  return data
}

/**
 * 执行备份核心逻辑
 */
async function doBackup(): Promise<void> {
  const data = collectAllData()
  const backup: BackupData = {
    version: 3,
    exportTime: new Date().toISOString(),
    app: 'cyber-survival',
    data
  }
  const json = JSON.stringify(backup, null, 2)

  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: BACKUP_FILENAME,
      data: json,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true
    })
  } else {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = BACKUP_FILENAME
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/**
 * 手动导出备份
 */
export async function exportBackup(): Promise<void> {
  try {
    await doBackup()
    if (Capacitor.isNativePlatform()) {
      showToast('备份已保存到 Documents/' + BACKUP_FILENAME)
    } else {
      showToast('备份已下载')
    }
  } catch (e: any) {
    showToast('备份失败：' + (e.message || '未知错误'))
    throw e
  }
}

/**
 * 自动备份（静默执行）
 */
export async function autoBackup(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await doBackup()
    console.log('[AutoBackup] 完成')
  } catch (e) {
    console.warn('[AutoBackup] 失败', e)
  }
}

/**
 * 启动定时自动备份（每5分钟）
 */
export function startAutoBackup(): void {
  if (!Capacitor.isNativePlatform()) return
  // 立即备份一次
  autoBackup().catch(() => {})
  // 每5分钟备份一次
  setInterval(() => {
    autoBackup().catch(() => {})
  }, 5 * 60 * 1000)
}

/**
 * 导入备份
 */
export async function importBackup(file: File): Promise<void> {
  const text = await file.text()
  let backup: BackupData
  try {
    backup = JSON.parse(text)
  } catch {
    throw new Error('文件不是有效的 JSON')
  }

  if (!backup.data || typeof backup.data !== 'object') {
    throw new Error('备份文件格式不正确')
  }

  // 恢复所有 localStorage 数据
  for (const [key, val] of Object.entries(backup.data)) {
    if (typeof val === 'string') {
      window.localStorage.setItem(key, val)
    }
  }

  showToast('备份已恢复，正在重启…')
  setTimeout(() => {
    window.location.reload()
  }, 800)
}
