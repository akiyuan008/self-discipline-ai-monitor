import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'
import { showToast } from '@/components/Toast'

const BACKUP_FILENAME = 'cyber-survival-backup.json'

interface BackupData {
  version: number
  exportTime: string
  app: string
  localStorage: Record<string, string>
  preferences: Record<string, string | null>
}

/**
 * 收集所有数据：localStorage + Capacitor Preferences
 */
async function collectBackupData(): Promise<BackupData> {
  // 1. 收集 localStorage
  const localStorage: Record<string, string> = {}
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (key) {
      const val = window.localStorage.getItem(key)
      if (val !== null) localStorage[key] = val
    }
  }

  // 2. 收集 Capacitor Preferences（如果有的话）
  const preferences: Record<string, string | null> = {}
  try {
    const { keys } = await Preferences.keys()
    for (const key of keys) {
      const { value } = await Preferences.get({ key })
      preferences[key] = value
    }
  } catch {
    // Preferences 可能未使用，忽略错误
  }

  return {
    version: 3,
    exportTime: new Date().toISOString(),
    app: 'cyber-survival',
    localStorage,
    preferences
  }
}

/**
 * 执行备份核心逻辑
 */
async function performBackup(): Promise<void> {
  const data = await collectBackupData()
  const json = JSON.stringify(data, null, 2)

  if (Capacitor.isNativePlatform()) {
    // Android/iOS: 保存到 Documents
    await Filesystem.writeFile({
      path: BACKUP_FILENAME,
      data: json,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true
    })
  } else {
    // 桌面端: Blob 下载
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
    await performBackup()
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
 * 自动备份（静默执行，不弹 Toast）
 */
export async function autoBackup(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await performBackup()
    console.log('[AutoBackup] 完成')
  } catch (e) {
    console.warn('[AutoBackup] 失败', e)
  }
}

/**
 * 导入备份
 */
export async function importBackup(file: File): Promise<void> {
  const text = await file.text()
  let data: BackupData
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('文件不是有效的 JSON')
  }

  if (!data.localStorage || typeof data.localStorage !== 'object') {
    throw new Error('备份文件格式不正确')
  }

  // 恢复 localStorage
  for (const [key, val] of Object.entries(data.localStorage)) {
    if (typeof val === 'string') {
      window.localStorage.setItem(key, val)
    }
  }

  // 恢复 Preferences
  if (data.preferences && typeof data.preferences === 'object') {
    for (const [key, val] of Object.entries(data.preferences)) {
      if (val !== null) {
        await Preferences.set({ key, value: val })
      } else {
        await Preferences.remove({ key })
      }
    }
  }

  showToast('备份已恢复，正在重启…')
  setTimeout(() => {
    window.location.reload()
  }, 800)
}
