/**
 * Access token and Refresh token pair response.
 */
export interface TokenPair {
  /** Signed JWT access token (15m validity) */
  accessToken: string;
  /** Cryptographically strong raw refresh token (7d validity) */
  refreshToken: string;
  /** Access token expiration time in seconds */
  expiresIn: number;
}

/**
 * Standard authentication response containing user info and token pair.
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    isEmailVerified: boolean;
    createdAt: Date;
  };
  tokens: TokenPair;
}
