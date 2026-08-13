/**
 * src/core/discipline/missionStore.ts
 * Mission 业务状态 Source of Truth（TypeScript persist）。
 * Android 仅保存最小运行时镜像（MissionRuntimeMirror），不实现业务判断。
 *
 * 原则：所有 CurrentTask / CurrentMission 统一到这里的 currentMissionId。
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Mission, MissionRuntimeMirror, MissionSource, MissionCreatedBy } from './types'
import { localDateStr } from '@/lib/dateUtils'

const SelfDiscipline = registerPlugin<any>('SelfDiscipline')

interface MissionState {
  /** 全部 Mission（含历史，持久化） */
  missions: Mission[]
  /** 当前正在执行的 Mission id（唯一当前任务指针） */
  currentMissionId: string | null

  // ── actions ──
  createMission: (m: Omit<Mission, 'id' | 'createdAt' | 'status' | 'interventionLevel' | 'actualStudyMs' | 'distractionMs' | 'evidence' | 'focusIntervals'> & Partial<Pick<Mission, 'status' | 'evidence'>>) => Mission
  setCurrentMission: (id: string | null) => void
  getMission: (id: string) => Mission | undefined
  getCurrentMission: () => Mission | undefined
  updateMission: (id: string, patch: Partial<Mission>) => void
  /** 获取某天（默认今天）的 Missions */
  getMissionsByDate: (date?: string) => Mission[]
  clearFinished: () => void
}

function genMissionId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** 从当前 Mission 派生 Android 最小运行时镜像 */
export function toRuntimeMirror(m: Mission | undefined): MissionRuntimeMirror | null {
  if (!m) return null
  return {
    missionId: m.id,
    status: m.status,
    plannedStart: m.plannedStart,
    plannedEnd: m.plannedEnd,
    interventionLevel: m.interventionLevel
  }
}

/**
 * 把当前 Mission 镜像同步到 Android（供 MonitorService 重启后恢复）。
 * 原生方法未就绪时静默跳过（TS persist 仍是主状态）。
 */
async function syncMirrorToAndroid(m: Mission | undefined) {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    const mirror = toRuntimeMirror(m)
    await SelfDiscipline.syncMissionMirror({ mirror: mirror ? JSON.stringify(mirror) : '' })
  } catch {
    // 镜像同步失败不阻断业务，TS persist 仍是主状态
  }
}

export const useMissionStore = create<MissionState>()(
  persist(
    (set, get) => ({
      missions: [],
      currentMissionId: null,

      createMission: (input) => {
        const mission: Mission = {
          id: genMissionId(),
          createdAt: Date.now(),
          status: 'READY',
          interventionLevel: 0,
          actualStudyMs: 0,
          distractionMs: 0,
          evidence: [],
          focusIntervals: [],
          sessionIds: [],
          // V3：未显式指定 taskType 时，按是否需要证据推断
          taskType: input.requiresEvidence ? 'OUTCOME_BASED' : 'TIME_BASED',
          ...input
        } as Mission
        set(s => ({ missions: [...s.missions, mission] }))
        return mission
      },

      setCurrentMission: (id) => {
        set({ currentMissionId: id })
        const m = id ? get().missions.find(x => x.id === id) : undefined
        void syncMirrorToAndroid(m)
      },

      getMission: (id) => get().missions.find(m => m.id === id),

      getCurrentMission: () => {
        const id = get().currentMissionId
        if (!id) return undefined
        return get().missions.find(m => m.id === id)
      },

      updateMission: (id, patch) => {
        set(s => ({
          missions: s.missions.map(m => (m.id === id ? { ...m, ...patch } : m))
        }))
        // 若更新的是当前任务，同步镜像
        if (get().currentMissionId === id) {
          void syncMirrorToAndroid(get().getCurrentMission())
        }
      },

      getMissionsByDate: (date) => {
        const d = date || localDateStr()
        return get().missions.filter(m => {
          const md = new Date(m.plannedStart)
          const mdStr = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, '0')}-${String(md.getDate()).padStart(2, '0')}`
          return mdStr === d
        })
      },

      clearFinished: () => {
        set(s => ({ missions: s.missions.filter(m => m.status !== 'COMPLETED' && m.status !== 'MISSED') }))
      }
    }),
    {
      name: 'discipline-mission-store',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // V3 Phase0：为旧 Mission 补齐 sessionIds / taskType（向后兼容）
      migrate: (persisted: any, version: number) => {
        const p = (persisted || {}) as any
        if (version < 2 && Array.isArray(p.missions)) {
          p.missions = p.missions.map((m: any) => ({
            ...m,
            focusIntervals: m.focusIntervals || [],
            sessionIds: m.sessionIds || [],
            taskType: m.taskType || (m.requiresEvidence ? 'OUTCOME_BASED' : 'TIME_BASED')
          }))
        }
        return p
      }
    }
  )
)
