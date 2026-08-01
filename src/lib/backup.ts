/**
 * 数据备份导入导出工具
 * 导出：将 localStorage 中的所有应用数据打包为 JSON 文件下载
 * 导入：读取 JSON 文件，恢复数据到 localStorage，然后刷新页面
 *
 * Android WebView 兼容：
 * - 优先使用 Blob + <a download> 下载
 * - 如果下载失败，回退到 Web Share API (navigator.share)
 * - 如果 Share 也不可用，在页面上展示 JSON 文本供用户手动复制
 */

import { Capacitor } from '@capacitor/core'

// 需要备份的 localStorage key 列表
const BACKUP_KEYS = [
  'cyber-survival-store',   // 主 store（HP、积分、任务、成就、AI配置、聊天记录等）
  'gaokao-profile-store',   // 高考档案馆 store（科目、错题、计划等）
]

interface BackupData {
  version: number
  exportTime: string
  stores: Record<string, string>  // key -> localStorage value (JSON string)
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
  const blob = new Blob([json], { type: 'application/json' })

  // ── 方案1：Blob + <a download>（桌面浏览器、部分 WebView）──
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)

    // 在 Capacitor Android 环境中，<a download> 可能不触发下载
    // 检测是否在 Android 上，如果是则尝试 Web Share 作为补充
    if (Capacitor.getPlatform() === 'android') {
      // 给 WebView 一点时间，如果 navigator.share 可用则也尝试分享
      if (navigator.share && navigator.canShare) {
        try {
          const file = new File([blob], filename, { type: 'application/json' })
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: '备份数据' })
            return 'share'
          }
        } catch {
          // 用户取消分享或分享失败，忽略
        }
      }
    }
    return 'download'
  } catch {
    // 继续尝试其他方案
  }

  // ── 方案2：Web Share API（Android WebView 支持）──
  if (navigator.share) {
    try {
      const file = new File([blob], filename, { type: 'application/json' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '备份数据' })
        return 'share'
      } else {
        // 只能分享文本
        await navigator.share({ text: json, title: '备份数据' })
        return 'share'
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        // 用户取消，不算错误
        return 'share'
      }
      // 继续到方案3
    }
  }

  // ── 方案3：在页面上展示 JSON 文本供手动复制 ──
  showTextBackup(json, filename)
  return 'text'
}

/**
 * 在页面上弹出一个文本框，展示备份内容供用户手动复制
 */
function showTextBackup(json: string, filename: string): void {
  // 移除已有的备份弹窗
  const existing = document.getElementById('__backup_modal')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.id = '__backup_modal'
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.6);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; box-sizing: border-box;
  `

  const modal = document.createElement('div')
  modal.style.cssText = `
    background: #fff; border-radius: 16px; padding: 20px;
    max-width: 400px; width: 100%; max-height: 80vh;
    display: flex; flex-direction: column; gap: 12px;
  `

  const title = document.createElement('div')
  title.textContent = '备份数据 — 长按复制'
  title.style.cssText = 'font-size: 16px; font-weight: 600; color: #111;'
  modal.appendChild(title)

  const textarea = document.createElement('textarea')
  textarea.value = json
  textarea.readOnly = true
  textarea.style.cssText = `
    flex: 1; min-height: 200px; max-height: 50vh;
    padding: 12px; border: 1px solid #ddd; border-radius: 8px;
    font-size: 11px; font-family: monospace; color: #333;
    resize: none; outline: none;
  `
  modal.appendChild(textarea)

  const btnRow = document.createElement('div')
  btnRow.style.cssText = 'display: flex; gap: 8px;'

  const copyBtn = document.createElement('button')
  copyBtn.textContent = '复制全部'
  copyBtn.style.cssText = `
    flex: 1; padding: 12px; border: none; border-radius: 100px;
    background: #111; color: #fff; font-size: 13px; font-weight: 600;
    cursor: pointer;
  `
  copyBtn.onclick = () => {
    textarea.select()
    document.execCommand('copy')
    copyBtn.textContent = '已复制 ✓'
    setTimeout(() => { copyBtn.textContent = '复制全部' }, 2000)
  }
  btnRow.appendChild(copyBtn)

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '关闭'
  closeBtn.style.cssText = `
    flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 100px;
    background: transparent; color: #666; font-size: 13px; font-weight: 600;
    cursor: pointer;
  `
  closeBtn.onclick = () => overlay.remove()
  btnRow.appendChild(closeBtn)

  modal.appendChild(btnRow)
  overlay.appendChild(modal)
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove() }
  document.body.appendChild(overlay)
}

/**
 * 从备份文件导入数据
 * @param file 用户选择的 JSON 文件
 * @returns Promise<void>，成功后自动刷新页面
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

  // 逐个恢复到 localStorage
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

  // 刷新页面以让 Zustand persist 重新读取 localStorage
  window.location.reload()
}
