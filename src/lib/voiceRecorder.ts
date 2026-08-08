/**
 * 语音录制 · Web MediaRecorder API
 * Android WebView 内录制 webm/opus；失败时抛错由上层降级到文字。
 */

let mediaRecorder: MediaRecorder | null = null
let stream: MediaStream | null = null
let chunks: Blob[] = []

export function isRecordingSupported(): boolean {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && typeof (window as any).MediaRecorder !== 'undefined'
}

export async function startRecording(): Promise<void> {
  if (!isRecordingSupported()) throw new Error('当前环境不支持录音')
  stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  chunks = []
  mediaRecorder = new MediaRecorder(stream)
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
  mediaRecorder.start()
}

/** 停止录音并返回 base64（不含 data: 前缀） */
export function stopRecording(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) { reject(new Error('未在录音状态')); return }
    const mr = mediaRecorder
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' })
      cleanup()
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        const base64 = result.includes(',') ? result.split(',')[1] : result
        resolve(base64)
      }
      reader.onerror = () => reject(new Error('录音读取失败'))
      reader.readAsDataURL(blob)
    }
    try { mr.stop() } catch (e) { cleanup(); reject(e as Error) }
  })
}

export function cancelRecording(): void {
  cleanup()
}

function cleanup(): void {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
  mediaRecorder = null
  chunks = []
}

export function isCurrentlyRecording(): boolean {
  return !!mediaRecorder && mediaRecorder.state === 'recording'
}
