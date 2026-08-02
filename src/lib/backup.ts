/**
 * 数据备份导入导出工具
 * 导出：将 localStorage 中的所有应用数据打包为 JSON
 * 导入：读取 JSON 文件，恢复数据到 localStorage，然后刷新页面
 */

import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { showToast } from '@/components/Toast'

// 需要备份的 localStorage key 列表
const BACKUP_KEYS = [
  'cyber-survival-store',
  'gaokao-profile-store',
]

interface BackupData {
  version: number
  exportTime: string
  stores: Record<string, string>
}

function collectBackupData(): BackupData {
  const stores: Record<string, string> = {}
  for (const key of BACKUP_KEYS) {
    const val = localStorage.getItem(key)
    if (val) stores[key] = val
  }
  return {
    version: 1,
    exportTime: new Date().toISOString(),
    stores
  }
}

/**
 * 导出备份
 * Android: 优先用 Web Share API 分享文本，回退到弹窗复制
 * 桌面: 用 Blob 下载
 */
export async function exportBackup(): Promise<'download' | 'share' | 'text'> {
  const data = collectBackupData()
  const json = JSON.stringify(data, null, 2)
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const filename = `cyber-survival-backup-${dateStr}.json`

  // 桌面浏览器：Blob 下载
  if (!Capacitor.isNativePlatform()) {
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
  }

  // Android/iOS：Web Share API
  if (navigator.share) {
    try {
      await navigator.share({
        title: filename,
        text: json
      })
      showToast('备份已分享')
      return 'share'
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        showToast('分享已取消')
        return 'share'
      }
      // 回退到弹窗
    }
  }

  // 最终回退：弹窗展示 JSON
  showTextBackup(json, filename)
  showToast('请复制备份文本')
  return 'text'
}

/**
 * 弹窗展示备份文本，适配深色模式
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
        if (!document.execCommand('copy')) throw new Error('复制失败')
      }
      copyBtn.textContent = '已复制 ✓'
      showToast('已复制到剪贴板')
      setTimeout(() => { copyBtn.textContent = '复制全部' }, 2000)
    } catch {
      copyBtn.textContent = '复制失败，请手动复制'
      textarea.focus()
      textarea.select()
    }
  }
  btnRow.appendChild(copyBtn)

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '关闭'
  closeBtn.style.cssText = `
    flex: 1; padding: 12px; border-radius: 100px;
    background: transparent; color: ${isDark ? '#fff' : '#666'};
    font-size: 13px; font-weight: 600; cursor: pointer;
    border: 1px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#ddd'};
  `
  closeBtn.onclick = () => overlay.remove()
  btnRow.appendChild(closeBtn)

  modal.appendChild(btnRow)
  overlay.appendChild(modal)
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove() }
  document.body.appendChild(overlay)

  setTimeout(() => {
    textarea.focus()
    textarea.select()
  }, 100)
}

/**
 * 从备份文件导入
 */
export async function importBackup(file: File): Promise<void> {
  const text = await file.text()
  await importBackupText(text)
}

/**
 * 从备份文本导入
 */
export async function importBackupText(text: string): Promise<void> {
  let data: BackupData
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('文件格式错误：无法解析 JSON')
  }

  if (!data?.stores || typeof data.stores !== 'object') {
    throw new Error('文件格式错误：缺少 stores 字段')
  }

  let restored = 0
  for (const key of BACKUP_KEYS) {
    if (data.stores[key]) {
      localStorage.setItem(key, data.stores[key])
      restored++
    }
  }

  if (restored === 0) {
    throw new Error('备份文件中没有可恢复的数据')
  }

  showToast(`已恢复 ${restored} 项数据，即将刷新`)
  setTimeout(() => window.location.reload(), 1500)
}
