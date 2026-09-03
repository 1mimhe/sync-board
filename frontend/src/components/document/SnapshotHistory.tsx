import React, { useEffect, useState } from 'react'
import type { DocumentSnapshot } from '../../types'
import { documentApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { useWorkspace } from '../../stores/workspace.store'
import { Modal } from '../common/Modal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { IconHistory, IconPlus } from '../common/Icons'

export interface SnapshotHistoryProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  documentId: string
  onSnapshotRestored: () => void
}

export function SnapshotHistory({
  isOpen,
  onClose,
  workspaceId,
  documentId,
  onSnapshotRestored,
}: SnapshotHistoryProps) {
  const { addToast } = useToast()
  const { currentWorkspace, workspaces } = useWorkspace()
  const [snapshots, setSnapshots] = useState<DocumentSnapshot[]>([])
  const [snapshotName, setSnapshotName] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const [isRestoring, setIsRestoring] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<{ id: string; name?: string | null } | null>(null)

  const activeRole =
    currentWorkspace?.id === workspaceId
      ? currentWorkspace.role
      : workspaces.find((w) => w.id === workspaceId)?.role
  const canRestore = activeRole === 'owner' || activeRole === 'admin'

  const loadSnapshots = async () => {
    setLoading(true)
    const res = await documentApi.listSnapshots(workspaceId, documentId)
    setLoading(false)
    if (res.success && res.data) {
      setSnapshots(res.data)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadSnapshots()
    }
  }, [isOpen, workspaceId, documentId])

  const handleCaptureSnapshot = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCapturing(true)
    const res = await documentApi.createSnapshot(workspaceId, documentId, {
      snapshotName: snapshotName.trim() || undefined,
    })
    setIsCapturing(false)

    if (res.success) {
      setSnapshotName('')
      addToast('Document snapshot captured', 'success')
      loadSnapshots()
    } else {
      addToast(res.error?.message || 'Failed to capture snapshot', 'error')
    }
  }

  const handleRestore = (snapshotId: string, name?: string | null) => {
    if (!canRestore) {
      addToast('Only workspace owners and admins can restore snapshots', 'error')
      return
    }
    setConfirmRestore({ id: snapshotId, name })
  }

  const executeRestore = async () => {
    if (!confirmRestore) return
    setIsRestoring(confirmRestore.id)
    const res = await documentApi.restoreSnapshot(workspaceId, documentId, confirmRestore.id)
    setIsRestoring(null)
    setConfirmRestore(null)

    if (res.success) {
      addToast('Snapshot restored successfully', 'success')
      onSnapshotRestored()
      onClose()
    } else {
      addToast(res.error?.message || 'Failed to restore snapshot', 'error')
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconHistory size={18} /> Document Snapshots & Version History
        </div>
      }
      maxWidth={560}
    >
      <div style={{ display: 'grid', gap: 18 }}>
        {/* Create Snapshot Form */}
        <form onSubmit={handleCaptureSnapshot} style={{ display: 'flex', gap: 8 }}>
          <input
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            placeholder="Snapshot name (e.g. Before v2 release, Sprint 4 baseline)…"
            style={{ flex: 1, fontSize: 13 }}
          />
          <button className="btn btn-primary btn-sm" type="submit" disabled={isCapturing}>
            <IconPlus size={14} /> {isCapturing ? 'Saving…' : 'Capture Snapshot'}
          </button>
        </form>

        {/* Snapshots List */}
        <div style={{ display: 'grid', gap: 8 }}>
          {snapshots.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 14px',
                background: 'var(--bg3)',
                borderRadius: 10,
                border: '1px solid var(--border)',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>
                  {s.snapshotName || 'Automated Snapshot'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>
                  Captured {new Date(s.createdAt).toLocaleString()}
                </div>
              </div>

              {canRestore ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, color: 'var(--violet2)', fontWeight: 700 }}
                  onClick={() => handleRestore(s.id, s.snapshotName)}
                  disabled={isRestoring === s.id}
                >
                  {isRestoring === s.id ? 'Restoring…' : 'Restore'}
                </button>
              ) : (
                <span
                  className="badge"
                  style={{ fontSize: 10, color: 'var(--muted)', padding: '3px 8px' }}
                  title="Only workspace owners and admins can restore snapshots"
                >
                  Owner/Admin only
                </span>
              )}
            </div>
          ))}

          {snapshots.length === 0 && !loading && (
            <div style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 13, padding: 20 }}>
              No snapshots created yet. Use the form above to capture a version point.
            </div>
          )}
        </div>
      </div>
    </Modal>

    {/* Restore Snapshot Confirmation Dialog */}
    {confirmRestore && (
      <ConfirmDialog
        isOpen={!!confirmRestore}
        onClose={() => setConfirmRestore(null)}
        onConfirm={executeRestore}
        title="Restore Document Snapshot"
        message={`Are you sure you want to restore "${confirmRestore.name || 'Untitled'}"? Current document content will be replaced for all active editors.`}
        confirmLabel="Restore Snapshot"
        confirmVariant="danger"
      />
    )}
  </>
  )
}
