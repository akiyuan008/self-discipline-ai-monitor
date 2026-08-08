import { create } from 'zustand'
import {
  loadEchoIndex, saveEchoIndex, saveVoiceFile, deleteVoiceFile, genEchoId,
  type EchoRecord, type EchoTrigger
} from '@/lib/echoStorage'

interface EchoState {
  echoes: EchoRecord[]
  loaded: boolean
  init: () => Promise<void>
  addEcho: (input: {
    type: 'voice' | 'text'
    text?: string
    voiceBase64?: string
    context?: string
    trigger: EchoTrigger
    triggerDate?: string
  }) => Promise<string>
  markPlayed: (id: string) => void
  removeEcho: (id: string) => Promise<void>
  /** 取一个待回放的回响：断签触发 或 到达指定日期 */
  pickPending: (opts: { streakBroken?: boolean; today?: string }) => EchoRecord | null
}

export const useEchoStore = create<EchoState>()((set, get) => ({
  echoes: [],
  loaded: false,

  init: async () => {
    if (get().loaded) return
    const echoes = await loadEchoIndex()
    set({ echoes, loaded: true })
  },

  addEcho: async ({ type, text, voiceBase64, context, trigger, triggerDate }) => {
    const id = genEchoId()
    const rec: EchoRecord = {
      id, type, context, trigger, triggerDate,
      createdAt: Date.now(),
      played: false
    }
    if (type === 'text') {
      rec.text = text || ''
    } else if (type === 'voice' && voiceBase64) {
      const filename = await saveVoiceFile(id, voiceBase64)
      if (filename) rec.voiceFile = filename
      else rec.voiceData = voiceBase64 // Web 降级内联
    }
    const next = [rec, ...get().echoes]
    set({ echoes: next })
    await saveEchoIndex(next)
    return id
  },

  markPlayed: (id) => {
    const next = get().echoes.map(e => e.id === id ? { ...e, played: true } : e)
    set({ echoes: next })
    saveEchoIndex(next)
  },

  removeEcho: async (id) => {
    const rec = get().echoes.find(e => e.id === id)
    if (rec) await deleteVoiceFile(rec)
    const next = get().echoes.filter(e => e.id !== id)
    set({ echoes: next })
    await saveEchoIndex(next)
  },

  pickPending: ({ streakBroken, today }) => {
    const list = get().echoes.filter(e => !e.played)
    // 优先：断签触发
    if (streakBroken) {
      const hit = list.find(e => e.trigger === 'streak-break')
      if (hit) return hit
    }
    // 其次：到达指定日期
    if (today) {
      const hit = list.find(e => e.trigger === 'date' && e.triggerDate && e.triggerDate <= today)
      if (hit) return hit
    }
    return null
  }
}))
