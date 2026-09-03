import { create } from 'zustand'
import type { User } from '../types'

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  setAuth: (token: string, user: User) => void
  setToken: (token: string) => void
  setUser: (user: User) => void
  clearAuth: () => void
}

const TOKEN_KEY = 'sb_access_token'
const USER_KEY = 'sb_user_profile'

function loadInitialState(): { token: string | null; user: User | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const rawUser = localStorage.getItem(USER_KEY)
    const user = rawUser ? JSON.parse(rawUser) : null
    return { token, user }
  } catch {
    return { token: null, user: null }
  }
}

const initial = loadInitialState()

export const useAuth = create<AuthState>((set) => ({
  token: initial.token,
  user: initial.user,
  isAuthenticated: !!initial.token,

  setAuth: (token, user) => {
    try {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } catch {}
    set({ token, user, isAuthenticated: true })
  },

  setToken: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {}
    set({ token, isAuthenticated: true })
  },

  setUser: (user) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } catch {}
    set({ user })
  },

  clearAuth: () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    } catch {}
    set({ token: null, user: null, isAuthenticated: false })
  },
}))
