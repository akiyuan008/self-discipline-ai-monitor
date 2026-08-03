import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { showToast } from '@/components/Toast'

const BACKUP_FILENAME = 'cyber-survival-backup.json'

interface BackupData {
  version: number
  exportTime: string
  app: string
  stores: Record<string, string>
}

function collectBackupData(): BackupData {
  const stores: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      const val = localStorage.getItem(key)
      if (val) stores[key] = val
    }
  }
  return {
    version: 2,
    exportTime: new Date().toISOString(),
    app: 'cyber-survival',
    stores
  }
}

/**
 * 执行备份到 Filesystem
 */
async function doBackup(): Promise<void> {
  const data = collectBackupData()
  const json = JSON.stringify(data, null, 2)
  await Filesystem.writeFile({
    path: BACKUP_FILENAME,
    data: json,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true
  })
}

/**
 * 导出备份（手动触发）
 */
export async function exportBackup(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // 桌面端：Blob 下载
    const data = collectBackupData()
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = BACKUP_FILENAME
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast('备份已下载')
    return
  }

  // 移动端：保存到 Documents
  try {
    await doBackup()
    showToast('备份已保存到 Documents/' + BACKUP_FILENAME)
  } catch (e: any) {
    showToast('备份失败：' + (e.message || '未知错误'))
    throw e
  }
}

/**
 * 自动备份（App 进入后台时调用）
 */
export async function autoBackup(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await doBackup()
    console.log('[AutoBackup] 自动备份完成')
  } catch (e) {
    console.warn('[AutoBackup] 自动备份失败', e)
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

  if (!data.stores || typeof data.stores !== 'object') {
    throw new Error('备份文件格式不正确')
  }

  for (const [key, val] of Object.entries(data.stores)) {
    if (typeof val === 'string') {
      localStorage.setItem(key, val)
    }
  }

  showToast('备份已恢复，正在重启…')
  setTimeout(() => {
    window.location.reload()
  }, 800)
}
