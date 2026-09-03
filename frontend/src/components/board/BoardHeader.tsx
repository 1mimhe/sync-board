import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { BoardWithContent, PresenceViewer } from '../../types'
import { boardApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { Avatar } from '../common/Avatar'
import {
  IconStar,
  IconActivity,
  IconSearch,
  IconTag,
  IconDocument,
  IconArchive,
} from '../common/Icons'

export interface BoardHeaderProps {
  board: BoardWithContent
  workspaceId: string
  isConnected: boolean
  viewers: PresenceViewer[]
  onBoardUpdated: () => void
  onToggleActivity: () => void
  onToggleArchived?: () => void
  onToggleLabels?: () => void
  onToggleDocs?: () => void
  showFilters: boolean
  onToggleFilters: () => void
}

export function BoardHeader({
  board,
  workspaceId,
  isConnected,
  viewers,
  onBoardUpdated,
  onToggleActivity,
  onToggleArchived,
  onToggleLabels,
  onToggleDocs,
  showFilters,
  onToggleFilters,
}: BoardHeaderProps) {
  const { addToast } = useToast()
  const [title, setTitle] = useState(board.title)
  const [isStarred, setIsStarred] = useState(board.isStarred || false)

  const handleTitleBlur = async () => {
    const trimmed = title.trim()
    if (!trimmed || trimmed === board.title) return
    const res = await boardApi.update(workspaceId, board.id, { title: trimmed })
    if (res.success) {
      addToast('Board title updated', 'success')
      onBoardUpdated()
    } else {
      addToast(res.error?.message || 'Failed to update board title', 'error')
    }
  }

  const handleToggleStar = async () => {
    if (isStarred) {
      setIsStarred(false)
      await boardApi.unstar(workspaceId, board.id)
    } else {
      setIsStarred(true)
      await boardApi.star(workspaceId, board.id)
      addToast('Board starred', 'success')
    }
  }

  return (
    <div
      className="card"
      style={{
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        background: 'linear-gradient(180deg, rgba(28, 28, 31, 0.9) 0%, rgba(20, 20, 23, 0.9) 100%)',
      }}
    >
      {/* Title & Connection Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200, flex: 1 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          style={{
            background: 'transparent',
            border: 'none',
            fontWeight: 900,
            fontSize: 20,
            letterSpacing: '-0.5px',
            color: 'var(--text)',
            padding: '2px 6px',
            borderRadius: 6,
            width: '100%',
            maxWidth: 260,
          }}
          placeholder="Board Title"
        />

        <button
          className="btn btn-ghost btn-sm"
          onClick={handleToggleStar}
          title={isStarred ? 'Unstar Board' : 'Star Board'}
          style={{ padding: 6 }}
        >
          <IconStar size={18} filled={isStarred} />
        </button>

        <span
          className="badge"
          style={{
            fontSize: 11,
            gap: 6,
            background: isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            borderColor: isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
            color: isConnected ? '#6ee7b7' : '#fca5a5',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: isConnected ? 'var(--emerald)' : 'var(--red)',
            }}
          />
          {isConnected ? 'Live Sync' : 'Connecting…'}
        </span>
      </div>

      {/* Collaborators & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Active Board Viewers Avatars */}
        {viewers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {viewers.slice(0, 5).map((v, idx) => (
              <div
                key={v.userId}
                style={{
                  marginLeft: idx === 0 ? 0 : -8,
                  borderRadius: '50%',
                  boxShadow: `0 0 0 2px var(--bg3), 0 0 0 3.5px ${v.color || '#7c3aed'}`,
                  zIndex: 10 - idx,
                  position: 'relative',
                  display: 'flex',
                }}
              >
                <Avatar
                  name={v.displayName}
                  color={v.color}
                  avatarUrl={v.avatarUrl}
                  size={26}
                  title={`${v.displayName} is viewing this board`}
                />
              </div>
            ))}
            {viewers.length > 5 && (
              <span
                className="badge"
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                  padding: '2px 6px',
                }}
              >
                +{viewers.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Filter Toggle Button */}
        <button
          className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-ghost'}`}
          onClick={onToggleFilters}
          title="Filter Cards"
        >
          <IconSearch size={15} /> Filters
        </button>

        {/* Activity Logs Button */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={onToggleActivity}
          title="View Audit Log & Activities"
        >
          <IconActivity size={15} /> Activity
        </button>

        {/* Labels Management Button */}
        {onToggleLabels && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onToggleLabels}
            title="Manage Board & Workspace Labels"
          >
            <IconTag size={15} /> Labels
          </button>
        )}

        {/* Board Documents Button */}
        {onToggleDocs && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onToggleDocs}
            title="View Board Documents & Attached Card Docs"
          >
            <IconDocument size={15} /> Docs
          </button>
        )}

        {/* Archived Items Button */}
        {onToggleArchived && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onToggleArchived}
            title="View & Restore Archived Cards and Lists"
          >
            <IconArchive size={15} /> Archive
          </button>
        )}

        {/* Back to Workspace */}
        <Link to={`/workspaces/${workspaceId}`} className="btn btn-ghost btn-sm">
          Workspace Hub
        </Link>
      </div>
    </div>
  )
}
