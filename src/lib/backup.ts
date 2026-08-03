/**
 * 数据备份导入导出工具
 * 导出：遍历所有 localStorage 数据 → 生成 JSON 文件 → 保存到手机 Downloads 目录
 * 导入：读取 JSON 文件 → 恢复数据到 localStorage → 刷新页面
 */

import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { showToast } from '@/components/Toast'

interface BackupData {
  version: number
  exportTime: string
  app: string
  stores: Record<string, string>
}

function collectBackupData(): BackupData {
  const stores: Record<string, string> = {}
  // 遍历所有 localStorage，全面备份
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
 * 导出备份
 * Android: 用 Capacitor Filesystem 保存到 Downloads 目录
 * 桌面: Blob 下载
 */
export async function exportBackup(): Promise<'filesystem' | 'download' | 'text'> {
  const data = collectBackupData()
  const json = JSON.stringify(data, null, 2)
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const filename = `cyber-survival-backup-${dateStr}.json`

  // Android/iOS：用 Filesystem 保存到 Downloads 目录
  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.writeFile({
        path: filename,
        data: json,
        directory: Directory.Downloads,
        encoding: Encoding.UTF8,
        recursive: true
      })
      showToast(`备份已保存到 下载/${filename}`)
      return 'filesystem'
    } catch (e: any) {
      showToast('保存到下载目录失败：' + (e.message || '未知错误'))
      // 回退到弹窗
    }
  }

  // 桌面浏览器：Blob 下载
  try {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast('备份已下载')
    return 'download'
  } catch {
    // 回退到弹窗
  }

  // 最终回退：弹窗展示 JSON
  showTextBackup(json, filename)
  return 'text'
}

/**
 * 弹窗展示备份文本
 */
function showTextBackup(json: string, filename: string): void {
  const existing = document.getElementById('__backup_modal')
  if (existing) existing.remove()

  const isDark = document.documentElement.classList.contains('dark') ||
    getComputedStyle(document.documentElement).getPropertyValue('--bg')?.trim() === '#0a0a0a'

  const overlay = document.createElement('div')
  overlay.id = '__backup_modal'
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; box-sizing: border-box;
  `

  const modal = document.createElement('div')
  modal.style.cssText = `
    background: ${isDark ? '#1a1a1a' : '#fff'};
    border-radius: 16px; padding: 20px;
    max-width: 400px; width: 100%; max-height: 80vh;
    display: flex; flex-direction: column; gap: 12px;
    border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e5e5'};
  `

  const title = document.createElement('div')
  title.textContent = `备份 — ${filename}`
  title.style.cssText = `font-size: 15px; font-weight: 700; color: ${isDark ? '#fff' : '#111'};`
  modal.appendChild(title)

  const subtitle = document.createElement('div')
  subtitle.textContent = '长按全选后复制，保存到备忘录或文件管理器'
  subtitle.style.cssText = `font-size: 12px; color: ${isDark ? 'rgba(255,255,255,0.5)' : '#666'};`
  modal.appendChild(subtitle)

  const textarea = document.createElement('textarea')
  textarea.value = json
  textarea.readOnly = true
  textarea.style.cssText = `
    flex: 1; min-height: 200px; max-height: 50vh;
    padding: 12px; border-radius: 10px;
    font-size: 11px; font-family: 'DM Mono', monospace;
    resize: none; outline: none; line-height: 1.5;
    background: ${isDark ? '#0a0a0a' : '#f5f5f5'};
    color: ${isDark ? '#e5e5e5' : '#333'};
    border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ddd'};
  `
  modal.appendChild(textarea)

  const btnRow = document.createElement('div')
  btnRow.style.cssText = 'display: flex; gap: 8px;'

  const copyBtn = document.createElement('button')
  copyBtn.textContent = '复制全部'
  copyBtn.style.cssText = `
    flex: 1; padding: 12px; border: none; border-radius: 100px;
    background: var(--fg, #111); color: var(--bg, #fff);
    font-size: 13px; font-weight: 600; cursor: pointer;
  `
  copyBtn.onclick = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(json)
      } else {
        textarea.select()
        document.execCommand('copy')
      }
      showToast('已复制到剪贴板')
    } catch {
      showToast('复制失败，请手动长按复制')
    }
  }
  btnRow.appendChild(copyBtn)

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '关闭'
  closeBtn.style.cssText = `
    flex: 1; padding: 12px; border: none; border-radius: 100px;
    background: var(--bg-alt, #f5f5f5); color: var(--fg, #111);
    font-size: 13px; font-weight: 600; cursor: pointer;
  `
  closeBtn.onclick = () => overlay.remove()
  btnRow.appendChild(closeBtn)

  modal.appendChild(btnRow)
  overlay.appendChild(modal)
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove() }
  document.body.appendChild(overlay)
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

  // 恢复所有 localStorage 数据
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
