import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'

/**
 * 深渊回响 · 外部存储层
 * 音频文件与索引都写在 APP 之外的公共目录（Documents/MOSS_Echo/），
 * 卸载重装 APP 后数据依然保留。Web 环境降级为 localStorage。
 */

const FOLDER = 'MOSS_Echo'
const INDEX_FILE = `${FOLDER}/index.json`

export type EchoTrigger = 'streak-break' | 'date'

export interface EchoRecord {
  id: string
  type: 'voice' | 'text'
  text?: string          // 文字型内容
  voiceFile?: string     // 语音型文件名（相对 FOLDER）
  voiceData?: string     // base64 内联（仅 Web 降级用）
  createdAt: number
  context?: string       // 记录场景，如 "数学 · 深渊 55min"
  trigger: EchoTrigger   // 何时回放到用户面前
  triggerDate?: string   // yyyy-mm-dd，trigger==='date' 时有效
  played: boolean
}

function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

async function ensureDir(): Promise<void> {
  try {
    await Filesystem.stat({ path: FOLDER, directory: Directory.Documents })
  } catch {
    try {
      await Filesystem.mkdir({ path: FOLDER, directory: Directory.Documents, recursive: true })
    } catch { /* ignore */ }
  }
}

/** 读取全部回响索引 */
export async function loadEchoIndex(): Promise<EchoRecord[]> {
  if (!isNative()) {
    try {
      const raw = localStorage.getItem('moss-echo-index')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  }
  try {
    await ensureDir()
    const res = await Filesystem.readFile({ path: INDEX_FILE, directory: Directory.Documents, encoding: Encoding.UTF8 })
    const data = typeof res.data === 'string' ? res.data : ''
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/** 写回索引到外部存储 */
export async function saveEchoIndex(echoes: EchoRecord[]): Promise<void> {
  if (!isNative()) {
    try { localStorage.setItem('moss-echo-index', JSON.stringify(echoes)) } catch { /* ignore */ }
    return
  }
  try {
    await ensureDir()
    await Filesystem.writeFile({
      path: INDEX_FILE,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      data: JSON.stringify(echoes, null, 2)
    })
  } catch (e) {
    console.warn('[Echo] save index failed', e)
  }
}

/** 保存语音 base64 到外部目录，返回文件名；Web 降级返回空串（用内联） */
export async function saveVoiceFile(id: string, base64: string): Promise<string> {
  const filename = `voice_${id}.webm`
  if (!isNative()) return ''
  try {
    await ensureDir()
    await Filesystem.writeFile({
      path: `${FOLDER}/${filename}`,
      directory: Directory.Documents,
      data: base64
    })
  } catch (e) {
    console.warn('[Echo] save voice failed', e)
  }
  return filename
}

/** 读取语音为 base64（用于播放） */
export async function readVoiceBase64(rec: EchoRecord): Promise<string> {
  if (rec.voiceData) return rec.voiceData
  if (!rec.voiceFile || !isNative()) return ''
  try {
    const res = await Filesystem.readFile({ path: `${FOLDER}/${rec.voiceFile}`, directory: Directory.Documents })
    return typeof res.data === 'string' ? res.data : ''
  } catch (e) {
    console.warn('[Echo] read voice failed', e)
    return ''
  }
}

/** 删除语音文件 */
export async function deleteVoiceFile(rec: EchoRecord): Promise<void> {
  if (!rec.voiceFile || !isNative()) return
  try {
    await Filesystem.deleteFile({ path: `${FOLDER}/${rec.voiceFile}`, directory: Directory.Documents })
  } catch { /* ignore */ }
}

export function genEchoId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}
