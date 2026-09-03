import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Document } from '../types'
import { documentApi } from '../api/endpoints'
import { DocumentEditor } from '../components/document/DocumentEditor'

export function DocumentPage() {
  const { wid, did } = useParams()
  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDoc = async () => {
    if (!wid || !did) return
    setLoading(true)
    const res = await documentApi.getById(wid, did)
    setLoading(false)

    if (res.success && res.data) {
      setDocument(res.data)
    }
  }

  useEffect(() => {
    loadDoc()
  }, [wid, did])

  if (loading && !document) {
    return <div style={{ color: 'var(--muted)', padding: 32 }}>Loading document…</div>
  }

  if (!document || !wid) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        Document not found or access denied.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <DocumentEditor
        document={document}
        workspaceId={wid}
        onTitleUpdated={(newTitle) => setDocument({ ...document, title: newTitle })}
      />
    </div>
  )
}
