import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { WorkspaceWithRole } from '../../types'
import { workspaceApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { Modal } from '../common/Modal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { IconArchive, IconLogout } from '../common/Icons'

export interface WorkspaceSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  workspace: WorkspaceWithRole
  onUpdated: () => void
}

export function WorkspaceSettingsModal({
  isOpen,
  onClose,
  workspace,
  onUpdated,
}: WorkspaceSettingsModalProps) {
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [name, setName] = useState(workspace.name)
  const [slug, setSlug] = useState(workspace.slug)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'archive' | 'leave' | null>(null)

  // Keep fields synchronized when workspace or open state changes
  useEffect(() => {
    setName(workspace.name)
    setSlug(workspace.slug)
  }, [workspace.name, workspace.slug, isOpen])

  const isOwner = workspace.role === 'owner'
  const isAdminOrOwner = isOwner || workspace.role === 'admin'

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    if (trimmedName.length < 2) {
      addToast('Workspace name must be at least 2 characters', 'error')
      return
    }

    const payload: { name: string; slug?: string } = {
      name: trimmedName,
    }

    const trimmedSlug = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    // Only send custom slug if user changed it from the original workspace slug
    if (trimmedSlug && trimmedSlug !== workspace.slug) {
      payload.slug = trimmedSlug
    }

    setIsSaving(true)
    const res = await workspaceApi.update(workspace.id, payload)
    setIsSaving(false)

    if (res.success) {
      addToast('Workspace settings saved', 'success')
      onUpdated()
      onClose()
    } else {
      addToast(res.error?.message || 'Failed to update workspace', 'error')
    }
  }

  const executeConfirmAction = async () => {
    if (confirmAction === 'archive') {
      const res = await workspaceApi.archive(workspace.id)
      if (res.success) {
        addToast('Workspace archived', 'info')
        navigate('/workspaces')
      } else {
        addToast(res.error?.message || 'Failed to archive workspace', 'error')
      }
    } else if (confirmAction === 'leave') {
      const res = await workspaceApi.leave(workspace.id)
      if (res.success) {
        addToast('Left workspace', 'info')
        navigate('/workspaces')
      } else {
        addToast(res.error?.message || 'Failed to leave workspace', 'error')
      }
    }
    setConfirmAction(null)
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Workspace Settings" maxWidth={500}>
      <div style={{ display: 'grid', gap: 20 }}>
        {/* General Form */}
        <form onSubmit={handleSaveGeneral} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
            Workspace Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdminOrOwner}
              required
              minLength={2}
              maxLength={100}
            />
          </label>

          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
            Workspace URL Slug
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={!isAdminOrOwner}
              placeholder="e.g. acme-team"
              maxLength={100}
            />
          </label>

          {isAdminOrOwner && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn btn-primary" type="submit" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </form>

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* Danger Zone */}
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#f87171' }}>
            Danger Zone
          </div>

          {!isOwner && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Leave Workspace</div>
                <div style={{ fontSize: 11, color: 'var(--muted2)' }}>Revoke your membership from this workspace</div>
              </div>
              <button className="btn btn-danger btn-sm" type="button" onClick={() => setConfirmAction('leave')}>
                <IconLogout size={14} /> Leave
              </button>
            </div>
          )}

          {isOwner && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Archive Workspace</div>
                <div style={{ fontSize: 11, color: 'var(--muted2)' }}>Make all boards and docs read-only</div>
              </div>
              <button className="btn btn-danger btn-sm" type="button" onClick={() => setConfirmAction('archive')}>
                <IconArchive size={14} /> Archive
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>

    {/* Confirm Action Dialog */}
    <ConfirmDialog
      isOpen={confirmAction !== null}
      onClose={() => setConfirmAction(null)}
      onConfirm={executeConfirmAction}
      title={confirmAction === 'archive' ? 'Archive Workspace' : 'Leave Workspace'}
      message={
        confirmAction === 'archive'
          ? `Are you sure you want to archive "${workspace.name}"? All boards and documents will become read-only.`
          : `Are you sure you want to leave "${workspace.name}"? You will lose access to its resources until re-invited.`
      }
      confirmLabel={confirmAction === 'archive' ? 'Archive Workspace' : 'Leave Workspace'}
      confirmVariant="danger"
    />
  </>
  )
}
