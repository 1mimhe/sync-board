export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string | null
  isEmailVerified?: boolean
  createdAt: string
  updatedAt?: string
}

export interface AuthTokens {
  accessToken: string
  expiresIn: number
}

export interface AuthResponse {
  user: User
  tokens: AuthTokens
}
