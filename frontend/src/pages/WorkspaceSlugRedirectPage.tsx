import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { workspaceApi } from '../api/endpoints'
import { useToast } from '../stores/toast.store'

export function WorkspaceSlugRedirectPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return

    const resolveSlug = async () => {
      const res = await workspaceApi.getBySlug(slug)
      if (res.success && res.data) {
        navigate(`/workspaces/${res.data.id}`, { replace: true })
      } else {
        setError(res.error?.message || `Workspace "@${slug}" not found or access denied.`)
        addToast(res.error?.message || 'Workspace not found', 'error')
      }
    }

    resolveSlug()
  }, [slug, navigate, addToast])

  if (error) {
    return (
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
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>Workspace Not Found</h2>
          <p style={{ color: 'var(--muted)' }}>{error}</p>
          <Link to="/workspaces" className="btn btn-primary">
            Back to Workspaces
          </Link>
        </div>
      </div>
    )
  }

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
