/**
 * 数据备份导入导出工具
 * 导出：将 localStorage 中的所有应用数据打包为 JSON 文件
 * 导入：读取 JSON 文件，恢复数据到 localStorage，然后刷新页面
 *
 * Android WebView 兼容：
 * - 优先使用 Capacitor Filesystem API 写入 Downloads
 * - 其次尝试 Web Share API
 * - 最后回退到弹窗手动复制
 */

import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { showToast } from '@/components/Toast'

// 需要备份的 localStorage key 列表
const BACKUP_KEYS = [
  'cyber-survival-store', // 主 store
  'gaokao-profile-store',   // 高考档案馆 store
]

interface BackupData {
  version: number
  exportTime: string
  stores: Record<string, string> // key -> localStorage value (JSON string)
}

/**
 * 收集所有需要备份的数据
 */
function collectBackupData(): BackupData {
  const stores: Record<string, string> = {}
  for (const key of BACKUP_KEYS) {
    const val = localStorage.getItem(key)
    if (val) {
      stores[key] = val
    }
  }
  return {
    version: 1,
    exportTime: new Date().toISOString(),
    stores
  }
}

/**
 * 导出全部数据为备份文件
 * 返回导出方式，方便 UI 层做对应提示
 */
export async function exportBackup(): Promise<'download' | 'share' | 'text'> {
  const data = collectBackupData()
  const json = JSON.stringify(data, null, 2)
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const filename = `cyber-survival-backup-${dateStr}.json`

  // ── 方案1：Capacitor Filesystem（Android 最可靠）──
  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.writeFile({
        path: filename,
        data: json,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true
      })
      showToast(`备份已保存到 Documents/${filename}`)
      return 'download'
    } catch (e: any) {
      console.warn('[Backup] Filesystem failed:', e)
      // 继续尝试其他方案
    }
  }

  // ── 方案2：Blob + <a> 下载（桌面浏览器）──
  const blob = new Blob([json], { type: 'application/json' })
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast('备份文件已下载')
    return 'download'
  } catch {
    // 继续尝试其他方案
  }

  // ── 方案3：Web Share API ──
  if (navigator.share) {
    try {
      const file = new File([blob], filename, { type: 'application/json' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '备份数据' })
        showToast('已通过分享导出备份')
        return 'share'
      } else {
        await navigator.share({ text: json, title: '备份数据' })
        showToast('已通过分享导出备份')
        return 'share'
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        showToast('分享已取消')
        return 'share'
      }
      // 继续到方案4
    }
  }

  // ── 方案4：弹窗展示 JSON 文本供手动复制 ──
  showTextBackup(json, filename)
  showToast('请复制备份文本保存')
  return 'text'
}

/**
 * 在页面上弹出一个文本框，展示备份内容供用户手动复制
 * 适配深色模式
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
  title.textContent = `备份数据 — ${filename}`
  title.style.cssText = `font-size: 15px; font-weight: 700; color: ${isDark ? '#fff' : '#111'};`
  modal.appendChild(title)

  const subtitle = document.createElement('div')
  subtitle.textContent = '长按下方文本框全选，然后复制保存到安全位置'
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
      showToast('备份内容已复制到剪贴板')
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

  // 自动选中全部文本
  setTimeout(() => {
    textarea.focus()
    textarea.select()
  }, 100)
}

/**
 * 从备份文件导入数据
 * @param file 用户选择的 JSON 文件
 */
export async function importBackup(file: File): Promise<void> {
  const text = await file.text()
  await importBackupText(text)
}

/**
 * 从备份文本导入数据（用于粘贴导入场景）
 */
export async function importBackupText(text: string): Promise<void> {
  let data: BackupData

  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('文件格式错误：无法解析 JSON')
  }

  if (!data || !data.stores || typeof data.stores !== 'object') {
    throw new Error('文件格式错误：缺少 stores 字段')
  }

  let restoredCount = 0
  for (const key of BACKUP_KEYS) {
    if (data.stores[key]) {
      localStorage.setItem(key, data.stores[key])
      restoredCount++
    }
  }

  if (restoredCount === 0) {
    throw new Error('备份文件中没有可恢复的数据')
  }

  showToast(`已恢复 ${restoredCount} 项数据，页面即将刷新`)
  setTimeout(() => {
    window.location.reload()
  }, 1500)
}
