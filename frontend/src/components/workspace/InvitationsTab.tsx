import React, { useEffect, useState } from 'react'
import type { WorkspaceWithRole, WorkspaceInvitation, WorkspaceRole } from '../../types'
import { workspaceApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { IconMail, IconPlus, IconCopy, IconTrash, IconCheck } from '../common/Icons'

export interface InvitationsTabProps {
  workspace: WorkspaceWithRole
}

export function InvitationsTab({ workspace }: InvitationsTabProps) {
  const { addToast } = useToast()
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([])
  const [loading, setLoading] = useState(false)

  // Send form
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceRole>('member')
  const [sending, setSending] = useState(false)

  // Copied state tracker
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const canInvite = workspace.role === 'owner' || workspace.role === 'admin'

  const loadInvitations = async () => {
    if (!canInvite) return
    setLoading(true)
    const res = await workspaceApi.getInvitations(workspace.id)
    setLoading(false)
    if (res.success && res.data) {
      setInvitations(res.data)
    }
  }

  useEffect(() => {
    loadInvitations()
  }, [workspace.id])

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setSending(true)
    const res = await workspaceApi.inviteMember(workspace.id, {
      email: email.trim(),
      role,
    })
    setSending(false)

    if (res.success && res.data) {
      setEmail('')
      addToast(`Invitation sent to ${res.data.email}`, 'success')
      loadInvitations()
    } else {
      addToast(res.error?.message || 'Failed to send invitation', 'error')
    }
  }

  const handleRevoke = async (invitationId: string) => {
    const res = await workspaceApi.revokeInvitation(workspace.id, invitationId)
    if (res.success) {
      addToast('Invitation revoked successfully', 'info')
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId))
    } else {
      addToast(res.error?.message || 'Failed to revoke invitation', 'error')
    }
  }

  const copyInviteLink = (token: string, id: string) => {
    const link = `${window.location.origin}/invite/${token}`
    navigator.clipboard.writeText(link)
    setCopiedId(id)
    addToast('Invitation link copied to clipboard!', 'success')
    setTimeout(() => setCopiedId(null), 3000)
  }

  if (!canInvite) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
        Only workspace Owners and Admins can view and send invitations.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Invite Form Card */}
      <div className="card shine" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconMail size={18} /> Invite Team Members
        </h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          Send an invitation email with a direct join link. Collaborators can register or sign in to join <b>{workspace.name}</b>.
        </p>

        <form onSubmit={handleSendInvite} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            style={{ flex: 1, minWidth: 240 }}
            required
          />

          <select
            value={role}
            onChange={(e) => setRole(e.target.value as WorkspaceRole)}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '8px 14px',
              borderRadius: 10,
              fontWeight: 700,
            }}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>

          <button className="btn btn-primary" type="submit" disabled={sending}>
            <IconPlus size={16} /> {sending ? 'Sending…' : 'Send Invite'}
          </button>
        </form>
      </div>

      {/* Pending Invitations Table */}
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>
            Pending Invitations ({invitations.length})
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={loadInvitations} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gap: 1 }}>
            {invitations.map((inv) => {
              const isExpired = new Date(inv.expiresAt) < new Date()
              const isCopied = copiedId === inv.id

              return (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--border)',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Email & Status */}
                  <div style={{ display: 'grid', gap: 4, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{inv.email}</span>
                      <span className="badge badge-violet" style={{ fontSize: 10, textTransform: 'capitalize' }}>
                        {inv.role}
                      </span>
                      <span
                        className={`badge ${
                          isExpired ? 'badge-danger' : 'badge-emerald'
                        }`}
                        style={{ fontSize: 10 }}
                      >
                        {isExpired ? 'Expired' : 'Pending'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Invited by <b>{inv.inviter?.displayName || 'Admin'}</b> • Expires{' '}
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions: Copy Link & Revoke */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => copyInviteLink(inv.token, inv.id)}
                      title="Copy Direct Invitation Link"
                    >
                      {isCopied ? <IconCheck size={14} style={{ color: 'var(--emerald)' }} /> : <IconCopy size={14} />}
                      {isCopied ? 'Copied!' : 'Copy Link'}
                    </button>

                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#f87171' }}
                      onClick={() => handleRevoke(inv.id)}
                      title="Revoke Invitation"
                    >
                      <IconTrash size={15} /> Revoke
                    </button>
                  </div>
                </div>
              )
            })}

            {invitations.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                No pending invitations. Use the form above to invite team members.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
