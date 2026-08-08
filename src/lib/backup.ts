import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { showToast } from '@/components/Toast'

interface BackupData {
  version: number
  exportTime: string
  app: string
  data: Record<string, string>
}

/**
 * 生成带当前日期时间戳的备份文件名
 */
function getBackupFilename(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  return `cyber-survival-backup_${yyyy}${mm}${dd}_${hh}${min}.json`
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
 * 手动导出备份 (弹窗让用户选择存储目录/分享到其他位置)
 */
export async function exportBackup(): Promise<void> {
  const data = collectAllData()
  const nowIso = new Date().toISOString()
  const filename = getBackupFilename()

  const backup: BackupData = {
    version: 3,
    exportTime: nowIso,
    app: 'cyber-survival',
    data
  }
  const json = JSON.stringify(backup, null, 2)

  try {
    if (Capacitor.isNativePlatform()) {
      // 在 Native 环境写入 Cache/Documents 并调用原生 Share，让用户选择保存到文件/网盘/第三方应用
      const result = await Filesystem.writeFile({
        path: filename,
        data: json,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
        recursive: true
      })

      try {
        await Share.share({
          title: '导出自律备份数据',
          text: `赛博自律数据备份 (${filename})`,
          url: result.uri,
          dialogTitle: '选择导出位置 / 发送到'
        })
        showToast('备份已成功导出')
      } catch (shareErr: any) {
        // 用户取消分享或无调起支持，fallback 到 Documents 目录
        await Filesystem.writeFile({
          path: filename,
          data: json,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true
        })
        showToast(`已保存至 Documents/${filename}`)
      }
      return
    }

    // Web 浏览器环境：首选 File System Access API (showSaveFilePicker)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'JSON 备份文件',
            accept: { 'application/json': ['.json'] }
          }]
        })
        const writable = await handle.createWritable()
        await writable.write(json)
        await writable.close()
        showToast('备份已保存至指定文件夹')
        return
      } catch (e: any) {
        if (e.name === 'AbortError') {
          // 用户取消选择
          return
        }
      }
    }

    // Web 降级 1: Web Share API
    const blob = new Blob([json], { type: 'application/json' })
    const file = new File([blob], filename, { type: 'application/json' })

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: '导出自律备份数据',
          text: `赛博自律备份 (${filename})`,
          files: [file]
        })
        showToast('备份已成功导出')
        return
      } catch (e: any) {
        if (e.name === 'AbortError') return
      }
    }

    // Web 降级 2: 标准文件下载
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast(`备份文件已开始下载: ${filename}`)
  } catch (e: any) {
    showToast('备份导出失败：' + (e.message || '未知错误'))
    throw e
  }
}

/**
 * 自动备份（静默写入 Documents）
 */
export async function autoBackup(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const data = collectAllData()
    const backup: BackupData = {
      version: 3,
      exportTime: new Date().toISOString(),
      app: 'cyber-survival',
      data
    }
    const json = JSON.stringify(backup, null, 2)
    await Filesystem.writeFile({
      path: 'cyber-survival-backup_auto.json',
      data: json,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true
    })
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
  autoBackup().catch(() => {})
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

