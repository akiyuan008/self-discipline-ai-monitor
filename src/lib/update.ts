import { Dialog } from '@capacitor/dialog'

const CURRENT_VERSION = '1.1.0'
const VERSION_URL = 'https://raw.githubusercontent.com/akiyuan008/self-discipline-ai-monitor/main/public/version.json'

export async function checkUpdate() {
  try {
    const res = await fetch(VERSION_URL + '?t=' + Date.now())
    if (!res.ok) return
    const data = await res.json()
    if (data.version && data.version !== CURRENT_VERSION) {
      const { value } = await Dialog.confirm({
        title: '发现新版本 ' + data.version,
        message: data.changelog || '修复已知问题，优化使用体验',
        okButtonTitle: '立即下载',
        cancelButtonTitle: '稍后再说'
      })
      if (value && data.downloadUrl) {
        window.open(data.downloadUrl, '_system')
      }
    }
  } catch (e) {
    console.warn('[Update] check failed', e)
  }
}