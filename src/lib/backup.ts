/**
 * 数据备份导入导出工具
 * 导出：将 localStorage 中的所有应用数据打包为 JSON 文件下载
 * 导入：读取 JSON 文件，恢复数据到 localStorage，然后刷新页面
 */

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
 * 导出全部数据为备份文件
 */
export function exportBackup(): void {
  const stores: Record<string, string> = {}

  for (const key of BACKUP_KEYS) {
    const val = localStorage.getItem(key)
    if (val) {
      stores[key] = val
    }
  }

  const data: BackupData = {
    version: 1,
    exportTime: new Date().toISOString(),
    stores
  }

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const a = document.createElement('a')
  a.href = url
  a.download = `cyber-survival-backup-${dateStr}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 从备份文件导入数据
 * @param file 用户选择的 JSON 文件
 * @returns Promise<void>，成功后自动刷新页面
 */
export async function importBackup(file: File): Promise<void> {
  const text = await file.text()
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
