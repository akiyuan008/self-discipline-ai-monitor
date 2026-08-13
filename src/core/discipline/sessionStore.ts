/**
 * src/core/discipline/sessionStore.ts
 * Session 存储（V3 Phase 1）。
 *
 * Session = "一次用户主动开始的执行过程"，是执行期的 Source of Truth。
 * 一个 Mission 可以有多个 Session（显式 Stop 后再 Start 才产生新 Session）。
 * 分心/恢复发生在同一 Session 内部（FocusSegment + Deviation + Recovery），不新建 Session。
 *
 * 本 store 只负责持久化存取；业务逻辑（状态机、去重、干预、完成）在 disciplineEngine。
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Session, SessionMode, SessionStatus } from './types'

interface SessionState {
  /** 全部 Session（含历史，持久化） */
  sessions: Session[]
  /** 当前正在执行的 Session id（唯一当前执行指针） */
  currentSessionId: string | null

  createSession: (p: { missionId: string; mode?: SessionMode }) => Session
  setCurrentSession: (id: string | null) => void
  getSession: (id: string) => Session | undefined
  getCurrentSession: () => Session | undefined
  updateSession: (id: string, patch: Partial<Session>) => void
  getSessionsByMission: (missionId: string) => Session[]
  /** 获取某 Mission 当前"运行中"的 Session（ACTIVE/PAUSED/DEVIATED/RECOVERING） */
  getRunningSessionForMission: (missionId: string) => Session | undefined
}

function genSessionId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** 视为"执行中"的 Session 状态 */
export const RUNNING_SESSION_STATUS: SessionStatus[] = ['ACTIVE', 'PAUSED', 'DEVIATED', 'RECOVERING']

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,

      createSession: ({ missionId, mode }) => {
        const session: Session = {
          id: genSessionId(),
          missionId,
          startedAt: Date.now(),
          status: 'ACTIVE',
          mode: mode || 'STANDARD',
          segments: [],
          focusDurationMs: 0,
          distractionDurationMs: 0,
          deviations: [],
          deviationCount: 0,
          recoveryCount: 0,
          interventionLevel: 0,
          createdAt: Date.now()
        }
        set(s => ({ sessions: [...s.sessions, session], currentSessionId: session.id }))
        return session
      },

      setCurrentSession: (id) => set({ currentSessionId: id }),

      getSession: (id) => get().sessions.find(s => s.id === id),

      getCurrentSession: () => {
        const id = get().currentSessionId
        if (!id) return undefined
        return get().sessions.find(s => s.id === id)
      },

      updateSession: (id, patch) => {
        set(s => ({ sessions: s.sessions.map(x => (x.id === id ? { ...x, ...patch } : x)) }))
      },

      getSessionsByMission: (missionId) => get().sessions.filter(s => s.missionId === missionId),

      getRunningSessionForMission: (missionId) =>
        get().sessions.find(s => s.missionId === missionId && RUNNING_SESSION_STATUS.includes(s.status))
    }),
    {
      name: 'discipline-session-store',
      version: 1,
      storage: createJSONStorage(() => localStorage)
    }
  )
)
