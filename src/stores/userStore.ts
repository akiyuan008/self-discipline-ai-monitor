import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { PERSONAS, type PersonaId, type Persona } from '@/data/personas'
import { WORLD_MAPS, PETS, ACHIEVEMENTS, type Achievement } from '@/data/world'

interface UserState {
  // 用户
  onboarded: boolean
  nickname: string
  personaId: PersonaId
  // 资源
  points: number            // 学习积分（绩效）
  energy: number            // 自律能量（养成用）
  // 收藏
  unlockedMaps: string[]
  unlockedPets: string[]
  activePet: string | null
  unlockedVoices: string[]
  unlockedSkins: string[]
  pardonCards: number       // 免罚卡数量
  // 周目标
  dailyGoalMin: number      // 每日学习目标分钟
  // 操作
  init: (nickname: string, personaId: PersonaId, dailyGoalMin: number) => void
  setPersona: (id: PersonaId) => void
  addPoints: (n: number, reason?: string) => void
  spendPoints: (n: number) => boolean
  addEnergy: (n: number) => void
  unlockMap: (id: string) => boolean
  unlockPet: (id: string) => boolean
  setActivePet: (id: string) => void
  unlockVoice: (id: string) => boolean
  unlockSkin: (id: string) => boolean
  addPardonCard: (n: number) => void
  usePardonCard: () => boolean
  unlockAchievement: (id: string) => void
  reset: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      nickname: '',
      personaId: 'mentor',
      points: 0,
      energy: 0,
      unlockedMaps: ['study_room'],
      unlockedPets: [],
      activePet: null,
      unlockedVoices: [],
      unlockedSkins: [],
      pardonCards: 0,
      dailyGoalMin: 120,

      init: (nickname, personaId, dailyGoalMin) =>
        set({ onboarded: true, nickname, personaId, dailyGoalMin, points: 100, energy: 50 }),

      setPersona: (id) => set({ personaId: id }),

      addPoints: (n) => set(s => ({ points: Math.max(0, s.points + n) })),
      spendPoints: (n) => {
        if (get().points < n) return false
        set(s => ({ points: s.points - n }))
        return true
      },
      addEnergy: (n) => set(s => ({ energy: Math.max(0, s.energy + n) })),
      unlockMap: (id) => {
        const map = WORLD_MAPS.find(m => m.id === id)
        if (!map) return false
        if (get().unlockedMaps.includes(id)) return true
        if (get().energy < map.unlockCost) return false
        set(s => ({ energy: s.energy - map.unlockCost, unlockedMaps: [...s.unlockedMaps, id] }))
        return true
      },
      unlockPet: (id) => {
        const pet = PETS.find(p => p.id === id)
        if (!pet) return false
        if (get().unlockedPets.includes(id)) return true
        if (get().energy < pet.unlockCost) return false
        set(s => ({
          energy: s.energy - pet.unlockCost,
          unlockedPets: [...s.unlockedPets, id],
          activePet: s.activePet ?? id
        }))
        return true
      },
      setActivePet: (id) => {
        if (!get().unlockedPets.includes(id)) return
        set({ activePet: id })
      },
      unlockVoice: (id) => {
        if (get().unlockedVoices.includes(id)) return true
        set(s => ({ unlockedVoices: [...s.unlockedVoices, id] }))
        return true
      },
      unlockSkin: (id) => {
        if (get().unlockedSkins.includes(id)) return true
        set(s => ({ unlockedSkins: [...s.unlockedSkins, id] }))
        return true
      },
      addPardonCard: (n) => set(s => ({ pardonCards: Math.max(0, s.pardonCards + n) })),
      usePardonCard: () => {
        if (get().pardonCards <= 0) return false
        set(s => ({ pardonCards: s.pardonCards - 1 }))
        return true
      },
      unlockAchievement: (id) => {
        const a = ACHIEVEMENTS.find(x => x.id === id)
        if (!a) return
        set(s => ({ energy: s.energy + 30 })) // 成就奖励
      },
      reset: () => set({
        onboarded: false, nickname: '', personaId: 'mentor',
        points: 0, energy: 0, unlockedMaps: ['study_room'],
        unlockedPets: [], activePet: null, unlockedVoices: [],
        unlockedSkins: [], pardonCards: 0, dailyGoalMin: 120
      })
    }),
    { name: 'self-discipline-store', storage: createJSONStorage(() => localStorage) }
  )
)

export function currentPersona(): Persona {
  return PERSONAS.find(p => p.id === useUserStore.getState().personaId) ?? PERSONAS[0]
}
