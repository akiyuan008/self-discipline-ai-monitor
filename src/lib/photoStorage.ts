import { Filesystem, Directory } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'

const PHOTO_DIR = 'MOSS_Photos'

/** 保存照片 base64 到外部存储，返回相对路径；非原生环境返回空串 */
export async function savePhoto(base64: string, id: string): Promise<string> {
  if (!Capacitor.isNativePlatform() || !base64) return ''
  const filename = `verify_${id}.jpg`
  try {
    await Filesystem.writeFile({
      path: `${PHOTO_DIR}/${filename}`,
      directory: Directory.Documents,
      data: base64,
      recursive: true
    })
    return `${PHOTO_DIR}/${filename}`
  } catch (e) {
    console.warn('[PhotoStorage] save failed', e)
    return ''
  }
}

/** 从外部存储读取照片，返回 base64 */
export async function loadPhoto(path: string): Promise<string> {
  if (!Capacitor.isNativePlatform() || !path) return ''
  try {
    const { data } = await Filesystem.readFile({ path, directory: Directory.Documents })
    return typeof data === 'string' ? data : ''
  } catch (e) {
    return ''
  }
}
