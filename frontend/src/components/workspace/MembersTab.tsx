import { useState } from 'react'
import type { WorkspaceWithRole, WorkspaceMember, WorkspaceRole } from '../../types'
import { workspaceApi } from '../../api/endpoints'
import { useAuth } from '../../stores/auth.store'
import { useToast } from '../../stores/toast.store'
import { Avatar } from '../common/Avatar'
import { Modal } from '../common/Modal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { IconShield, IconUsers, IconTrash } from '../common/Icons'

export interface MembersTabProps {
  workspace: WorkspaceWithRole
  members: WorkspaceMember[]
  onRefresh: () => void
}

export function MembersTab({ workspace, members, onRefresh }: MembersTabProps) {
  const { user } = useAuth()
  const { addToast } = useToast()

  const [transferUserId, setTransferUserId] = useState<string | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null)

  const isOwner = workspace.role === 'owner' || workspace.ownerId === user?.id
  const isAdminOrOwner = isOwner || workspace.role === 'admin'

  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    const res = await workspaceApi.updateMemberRole(workspace.id, memberId, newRole)
    if (res.success) {
      addToast('Member role updated', 'success')
      onRefresh()
    } else {
      addToast(res.error?.message || 'Failed to update member role', 'error')
    }
  }

  const handleRemoveMember = (memberId: string, memberName: string) => {
    setMemberToRemove({ id: memberId, name: memberName })
  }

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return
    const res = await workspaceApi.removeMember(workspace.id, memberToRemove.id)
    if (res.success) {
      addToast('Member removed from workspace', 'info')
      onRefresh()
    } else {
      addToast(res.error?.message || 'Failed to remove member', 'error')
    }
    setMemberToRemove(null)
  }

  const handleTransferOwnership = async () => {
    if (!transferUserId) return
    setIsTransferring(true)
    const res = await workspaceApi.transferOwnership(workspace.id, transferUserId)
    setIsTransferring(false)

    if (res.success) {
      setTransferUserId(null)
      addToast('Ownership transferred successfully', 'success')
      onRefresh()
    } else {
      addToast(res.error?.message || 'Failed to transfer ownership', 'error')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconUsers size={20} /> Workspace Members ({members.length})
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
            Manage team roles, admin permissions, and ownership transfer.
          </p>
        </div>
      </div>

      {/* Members Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                MEMBER
              </th>
              <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                ROLE
              </th>
              <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                JOINED
              </th>
              <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textAlign: 'right' }}>
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.userId === user?.id
              const isTargetOwner = m.role === 'owner' || m.userId === workspace.ownerId

              return (
                <tr
                  key={m.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar
                        name={m.user.displayName}
                        email={m.user.email}
                        avatarUrl={m.user.avatarUrl}
                        size={36}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
                          {m.user.displayName} {isSelf && <span style={{ color: 'var(--violet2)', fontSize: 11 }}>(You)</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {m.user.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    {isTargetOwner ? (
                      <span className="badge badge-violet" style={{ fontSize: 11 }}>
                        <IconShield size={12} /> Owner
                      </span>
                    ) : isAdminOrOwner && !isSelf ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value as WorkspaceRole)}
                        style={{
                          background: 'var(--bg3)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                          padding: '4px 8px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="badge" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                        {m.role}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--muted)' }}>
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                      {isOwner && !isSelf && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11 }}
                          onClick={() => setTransferUserId(m.userId)}
                        >
                          Transfer Ownership
                        </button>
                      )}

                      {isAdminOrOwner && !isTargetOwner && !isSelf && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#f87171', padding: 6 }}
                          onClick={() => handleRemoveMember(m.id, m.user.displayName)}
                          title="Remove from workspace"
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Transfer Ownership Modal */}
      {transferUserId && (
        <Modal
          isOpen={!!transferUserId}
          onClose={() => setTransferUserId(null)}
          title="Transfer Workspace Ownership"
          maxWidth={460}
        >
          <div style={{ display: 'grid', gap: 16 }}>
            <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
              Are you sure you want to transfer primary ownership of <b>{workspace.name}</b> to this member?
              You will become a regular workspace admin.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setTransferUserId(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleTransferOwnership}
                disabled={isTransferring}
              >
                {isTransferring ? 'Transferring…' : 'Confirm Ownership Transfer'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Remove Member Confirmation Dialog */}
      {memberToRemove && (
        <ConfirmDialog
          isOpen={!!memberToRemove}
          onClose={() => setMemberToRemove(null)}
          onConfirm={confirmRemoveMember}
          title="Remove Team Member"
          message={`Are you sure you want to remove ${memberToRemove.name} from "${workspace.name}"? They will immediately lose access to all boards and documents.`}
          confirmLabel="Remove Member"
          confirmVariant="danger"
        />
      )}
    </div>
  )
}
