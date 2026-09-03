import React, { useEffect, useState, useRef } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from 'react-router-dom'
import { useAuth } from './stores/auth.store'
import { authApi } from './api/endpoints'
import { refreshAccessToken } from './api/client'
import { Header } from './components/common/Header'
import { Sidebar } from './components/common/Sidebar'
import { ToastContainer } from './components/common/Toast'
import { EmailVerificationBanner } from './components/auth/EmailVerificationBanner'

// Lazy-loaded Pages for optimal bundle chunking
const LoginPage = React.lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = React.lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })))
const VerifyEmailPage = React.lazy(() => import('./pages/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })))
const InvitePage = React.lazy(() => import('./pages/InvitePage').then((m) => ({ default: m.InvitePage })))
const WorkspacesPage = React.lazy(() => import('./pages/WorkspacesPage').then((m) => ({ default: m.WorkspacesPage })))
const WorkspaceDetailPage = React.lazy(() => import('./pages/WorkspaceDetailPage').then((m) => ({ default: m.WorkspaceDetailPage })))
const BoardPage = React.lazy(() => import('./pages/BoardPage').then((m) => ({ default: m.BoardPage })))
const DocumentsListPage = React.lazy(() => import('./pages/DocumentsListPage').then((m) => ({ default: m.DocumentsListPage })))
const DocumentPage = React.lazy(() => import('./pages/DocumentPage').then((m) => ({ default: m.DocumentPage })))
const HealthPage = React.lazy(() => import('./pages/HealthPage').then((m) => ({ default: m.HealthPage })))
const AuthCallbackPage = React.lazy(() => import('./pages/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage })))
const WorkspaceSlugRedirectPage = React.lazy(() => import('./pages/WorkspaceSlugRedirectPage').then((m) => ({ default: m.WorkspaceSlugRedirectPage })))

function PageLoadingSpinner() {
  return (
    <div
      style={{
        height: '100%',
        minHeight: 280,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '3px solid rgba(124, 58, 237, 0.2)',
          borderTopColor: 'var(--violet)',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  )
}

/**
 * Global session bootstrapper:
 * If user has an active refresh token cookie, silently restore session before rendering routes.
 */
function AuthBootstrapper({ children }: { children: React.ReactNode }) {
  const { setToken, setUser } = useAuth()
  const [checking, setChecking] = useState(() => !useAuth.getState().token)
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    if (hasCheckedRef.current) return
    hasCheckedRef.current = true

    let isCancelled = false

    const checkExistingSession = async () => {
      try {
        const currentToken = useAuth.getState().token
        const currentUser = useAuth.getState().user

        if (currentToken && !currentUser) {
          const profileRes = await authApi.getProfile(currentToken)
          if (!isCancelled && profileRes.success && profileRes.data) {
            setUser(profileRes.data)
          }
          return
        }

        if (!currentToken) {
          const freshToken = await refreshAccessToken()
          if (isCancelled) return

          if (freshToken) {
            setToken(freshToken)
            const profileRes = await authApi.getProfile(freshToken)
            if (!isCancelled && profileRes.success && profileRes.data) {
              setUser(profileRes.data)
            }
          }
        }
      } catch {
        // No valid session cookie found
      } finally {
        if (!isCancelled) {
          setChecking(false)
        }
      }
    }

    checkExistingSession()

    return () => {
      isCancelled = true
    }
  }, [setToken, setUser])

  if (checking) {
    return (
      <div
        className="grid-bg"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--bg)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '3px solid rgba(124, 58, 237, 0.2)',
            borderTopColor: 'var(--violet)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    )
  }

  return <>{children}</>
}

/**
 * GuestRoute:
 * Prevents authenticated users from seeing Login / Register / Password Reset pages
 * and immediately redirects them to the main workspace panel.
 */
function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const redirectUrl = searchParams.get('redirect') || '/workspaces'

  if (isAuthenticated) {
    return <Navigate to={redirectUrl} replace />
  }

  return <>{children}</>
}

/**
 * ProtectedLayout:
 * Guards workspace panel routes, enforcing authentication.
 */
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  }

  return (
    <div
      className="grid-bg"
      style={{
        height: '100vh',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        background:
          'radial-gradient(1000px 500px at 15% -10%, rgba(124, 58, 237, 0.2), transparent 60%), radial-gradient(800px 400px at 85% 0%, rgba(6, 182, 212, 0.12), transparent 60%), var(--bg)',
        overflow: 'hidden',
      }}
    >
      <div>
        <Header />
        <EmailVerificationBanner />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          minHeight: 0,
          height: '100%',
        }}
      >
        <Sidebar />
        <main
          className="scroll"
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            overflowY: 'auto',
          }}
        >
          <React.Suspense fallback={<PageLoadingSpinner />}>{children}</React.Suspense>
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthBootstrapper>
        <React.Suspense fallback={<PageLoadingSpinner />}>
          <Routes>
          {/* Public Auth & Invitation Routes */}
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestRoute>
                <RegisterPage />
              </GuestRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <GuestRoute>
                <ForgotPasswordPage />
              </GuestRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <GuestRoute>
                <ResetPasswordPage />
              </GuestRoute>
            }
          />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/login/callback" element={<AuthCallbackPage />} />

          {/* Workspace Invitation Routes */}
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/invitations" element={<InvitePage />} />
          <Route path="/invitations/:token" element={<InvitePage />} />
          <Route path="/invitations/:token/accept" element={<InvitePage />} />

          {/* Protected App Routes (Workspaces Panel) */}
          <Route
            path="/workspaces"
            element={
              <ProtectedLayout>
                <WorkspacesPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/w/:slug"
            element={
              <ProtectedLayout>
                <WorkspaceSlugRedirectPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/workspaces/slug/:slug"
            element={
              <ProtectedLayout>
                <WorkspaceSlugRedirectPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/workspaces/:wid"
            element={
              <ProtectedLayout>
                <WorkspaceDetailPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/workspaces/:wid/boards/:bid"
            element={
              <ProtectedLayout>
                <BoardPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/workspaces/:wid/documents"
            element={
              <ProtectedLayout>
                <DocumentsListPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/workspaces/:wid/documents/:did"
            element={
              <ProtectedLayout>
                <DocumentPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/health"
            element={
              <ProtectedLayout>
                <HealthPage />
              </ProtectedLayout>
            }
          />

          {/* Root & Fallback */}
          <Route path="/" element={<Navigate to="/workspaces" replace />} />
          <Route
            path="*"
            element={
              <div
                className="grid-bg"
                style={{
                  minHeight: '100vh',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 20,
                  textAlign: 'center',
                }}
              >
                <div className="card" style={{ padding: 40, display: 'grid', gap: 16, maxWidth: 440 }}>
                  <h1 style={{ fontSize: 32, fontWeight: 900 }}>404</h1>
                  <p style={{ color: 'var(--muted)' }}>The page you are looking for does not exist.</p>
                  <Link to="/workspaces" className="btn btn-primary">
                    Return to Dashboard
                  </Link>
                </div>
              </div>
            }
          />
        </Routes>
        </React.Suspense>
      </AuthBootstrapper>
    </BrowserRouter>
  )
}
