import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Sender = 'ai' | 'user' | 'system'

export interface ChatMessage {
  id: string
  sender: Sender
  text: string
  ts: number
  mood?: 'normal' | 'warn' | 'care' | 'punish' | 'praise'
}

interface ChatState {
  messages: ChatMessage[]
  push: (msg: Omit<ChatMessage, 'id' | 'ts'>) => void
  reset: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      push: (msg) =>
        set(s => ({
          messages: [...s.messages, { ...msg, id: crypto.randomUUID(), ts: Date.now() }]
        })),
      reset: () => set({ messages: [] })
    }),
    { name: 'self-discipline-chat', storage: createJSONStorage(() => localStorage) }
  )
)
