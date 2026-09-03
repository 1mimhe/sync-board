import { create } from 'zustand'
import type { WorkspaceWithRole, WorkspaceMember } from '../types'
import { workspaceApi } from '../api/endpoints'

interface WorkspaceState {
  currentWorkspace: WorkspaceWithRole | null
  workspaces: WorkspaceWithRole[]
  members: WorkspaceMember[]
  isLoading: boolean
  setCurrentWorkspace: (ws: WorkspaceWithRole | null) => void
  fetchWorkspaces: () => Promise<void>
  fetchCurrentWorkspace: (id: string) => Promise<WorkspaceWithRole | null>
  fetchMembers: (workspaceId: string) => Promise<void>
}

const LAST_WORKSPACE_KEY = 'sb_active_workspace_id'

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  currentWorkspace: null,
  workspaces: [],
  members: [],
  isLoading: false,

  setCurrentWorkspace: (ws) => {
    if (ws) {
      localStorage.setItem(LAST_WORKSPACE_KEY, ws.id)
    } else {
      localStorage.removeItem(LAST_WORKSPACE_KEY)
    }
    set({ currentWorkspace: ws })
  },

  fetchWorkspaces: async () => {
    set({ isLoading: true })
    const res = await workspaceApi.listMine({ limit: 50 })
    if (res.success && res.data) {
      set({ workspaces: res.data.items, isLoading: false })
    } else {
      set({ isLoading: false })
    }
  },

  fetchCurrentWorkspace: async (id: string) => {
    set({ isLoading: true })
    const res = await workspaceApi.getById(id)
    if (res.success && res.data) {
      set({ currentWorkspace: res.data, isLoading: false })
      get().fetchMembers(id)
      return res.data
    }
    set({ isLoading: false })
    return null
  },

  fetchMembers: async (workspaceId: string) => {
    const res = await workspaceApi.getMembers(workspaceId)
    if (res.success && res.data) {
      set({ members: res.data })
    }
  },
}))
