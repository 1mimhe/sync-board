import React, { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import type { Socket } from 'socket.io-client'
import type { Document, EditorInfo } from '../../types'
import { documentApi } from '../../api/endpoints'
import { createAuthedSocket } from '../../socket/socket'
import { useAuth } from '../../stores/auth.store'
import { useToast } from '../../stores/toast.store'
import { Avatar } from '../common/Avatar'
import { SnapshotHistory } from './SnapshotHistory'
import { MarkdownViewer } from './MarkdownViewer'
import {
  IconHistory,
  IconCheck,
  IconDocument,
  IconEye,
  IconEdit,
  IconColumns,
  IconCopy,
  IconBold,
  IconItalic,
  IconQuote,
  IconList,
  IconCheckSquare,
  IconCode,
} from '../common/Icons'

export interface DocumentEditorProps {
  document: Document
  workspaceId: string
  onTitleUpdated: (newTitle: string) => void
}

interface RemoteAwareness {
  userId: string
  displayName: string
  color: string
  cursor?: {
    start: number
    end: number
  }
  updatedAt: number
}

type EditorMode = 'edit' | 'split' | 'preview'

function getLineAndCol(content: string, offset: number = 0): { line: number; col: number } {
  const safeOffset = Math.max(0, Math.min(offset, content.length))
  const lines = content.slice(0, safeOffset).split('\n')
  const line = lines.length
  const col = lines[lines.length - 1].length + 1
  return { line, col }
}

export function DocumentEditor({
  document: initialDoc,
  workspaceId,
  onTitleUpdated,
}: DocumentEditorProps) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [docTitle, setDocTitle] = useState(initialDoc.title)
  const [text, setText] = useState('')
  const [mode, setMode] = useState<EditorMode>('split')
  const [editors, setEditors] = useState<EditorInfo[]>([])
  const [awarenessMap, setAwarenessMap] = useState<Record<string, RemoteAwareness>>({})
  const [isConnected, setIsConnected] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [showSnapshots, setShowSnapshots] = useState(false)
  const [showPresenceMenu, setShowPresenceMenu] = useState(false)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 2500)
    return () => clearInterval(timer)
  }, [])

  const userRef = useRef(user)
  const editorsRef = useRef(editors)

  useEffect(() => {
    userRef.current = user
    editorsRef.current = editors
  }, [user, editors])

  const ydocRef = useRef<Y.Doc | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const lastAwarenessEmitRef = useRef<number>(0)
  const presenceMenuRef = useRef<HTMLDivElement | null>(null)

  const did = initialDoc.id

  // Close presence menu on click outside or Escape
  useEffect(() => {
    if (!showPresenceMenu) return

    const handleOutsideClick = (e: Event) => {
      if (
        presenceMenuRef.current &&
        !presenceMenuRef.current.contains(e.target as Node)
      ) {
        setShowPresenceMenu(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPresenceMenu(false)
      }
    }

    document.addEventListener('pointerdown', handleOutsideClick, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showPresenceMenu])

  const emitAwareness = React.useCallback((start?: number, end?: number) => {
    const socket = socketRef.current
    if (!socket || !socket.connected) return

    const now = Date.now()
    if (now - lastAwarenessEmitRef.current < 50) return
    lastAwarenessEmitRef.current = now

    const currentStart = start ?? textareaRef.current?.selectionStart ?? 0
    const currentEnd = end ?? textareaRef.current?.selectionEnd ?? currentStart

    const currentUser = userRef.current
    const currentEditors = editorsRef.current

    socket.emit('doc:awareness', {
      documentId: did,
      data: {
        userId: currentUser?.id,
        displayName: currentUser?.displayName || 'Anonymous',
        color: currentEditors.find((e) => e.userId === currentUser?.id)?.color || '#7c3aed',
        cursor: {
          start: currentStart,
          end: currentEnd,
        },
        updatedAt: now,
      },
    })
  }, [did])

  useEffect(() => {
    // 1. Initialize local Yjs Doc
    const ydoc = new Y.Doc()
    ydocRef.current = ydoc
    const yText = ydoc.getText('content')

    yText.observe(() => {
      setText(yText.toString())
    })

    // 2. Initialize Authed Socket
    const socket = createAuthedSocket()
    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      const stateVector = Y.encodeStateVector(ydoc)
      socket.emit('doc:join', {
        documentId: did,
        workspaceId,
        stateVector,
      })
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    socket.on('doc:joined', (ack: { documentId: string; state?: Uint8Array | number[]; editors?: EditorInfo[] }) => {
      if (ack.editors) {
        setEditors(ack.editors)
      }
      if (ack.state) {
        try {
          const raw = ack.state instanceof Uint8Array ? ack.state : new Uint8Array(ack.state)
          Y.applyUpdate(ydoc, raw)
          setText(yText.toString())
        } catch (e) {
          console.error('Failed to apply initial doc state', e)
        }
      }
      setTimeout(() => emitAwareness(0, 0), 100)
    })

    socket.on('doc:editor-joined', (editor: EditorInfo) => {
      setEditors((prev) => {
        if (prev.some((e) => e.userId === editor.userId)) return prev
        return [...prev, editor]
      })
      if (editor.userId !== user?.id) {
        addToast(`${editor.displayName} joined the document`, 'info')
      }
    })

    socket.on('doc:editor-left', (editor: EditorInfo) => {
      setEditors((prev) => prev.filter((e) => e.userId !== editor.userId))
      setAwarenessMap((prev) => {
        const updated = { ...prev }
        delete updated[editor.userId]
        return updated
      })
      if (editor.userId !== user?.id && editor.displayName) {
        addToast(`${editor.displayName} left the document`, 'info')
      }
    })

    socket.on('doc:awareness', (payload: { documentId: string; data: RemoteAwareness }) => {
      if (!payload?.data?.userId || payload.data.userId === user?.id) return
      setAwarenessMap((prev) => ({
        ...prev,
        [payload.data.userId]: payload.data,
      }))
    })

    socket.on('doc:update', (payload: { documentId: string; update: Uint8Array | number[] }) => {
      try {
        const raw =
          payload.update instanceof Uint8Array
            ? payload.update
            : new Uint8Array(payload.update)
        Y.applyUpdate(ydoc, raw)
        setText(yText.toString())
      } catch (e) {
        console.error('Failed to apply remote doc update', e)
      }
    })

    socket.on('doc:saved', (payload: { documentId: string; savedAt: string }) => {
      setLastSaved(new Date(payload.savedAt).toLocaleTimeString())
    })

    // Relay local updates to room
    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote' && socket.connected) {
        socket.emit('doc:update', {
          documentId: did,
          update,
        })
      }
    })

    return () => {
      if (socket.connected) {
        socket.emit('doc:leave', { documentId: did })
      }
      socket.disconnect()
      ydoc.destroy()
    }
  }, [did, workspaceId, user?.id, addToast, emitAwareness])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value
    const ydoc = ydocRef.current
    if (ydoc) {
      const yText = ydoc.getText('content')
      ydoc.transact(() => {
        yText.delete(0, yText.length)
        yText.insert(0, nextVal)
      })
    }
    setText(nextVal)
    const start = e.target.selectionStart
    const end = e.target.selectionEnd
    setCursorPos(getLineAndCol(nextVal, start))
    emitAwareness(start, end)
  }

  const handleSelectionChange = () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart
      const end = textareaRef.current.selectionEnd
      setCursorPos(getLineAndCol(text, start))
      emitAwareness(start, end)
    }
  }

  const handleTitleBlur = async () => {
    if (docTitle.trim() && docTitle !== initialDoc.title) {
      const res = await documentApi.rename(workspaceId, did, {
        title: docTitle.trim(),
      })
      if (res.success) {
        onTitleUpdated(docTitle.trim())
        addToast('Document title renamed', 'success')
      }
    }
  }

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = text.substring(start, end)
    const replacement = `${prefix}${selected || 'text'}${suffix}`

    const nextText = text.substring(0, start) + replacement + text.substring(end)
    const ydoc = ydocRef.current
    if (ydoc) {
      const yText = ydoc.getText('content')
      ydoc.transact(() => {
        yText.delete(0, yText.length)
        yText.insert(0, nextText)
      })
    }
    setText(nextText)

    setTimeout(() => {
      el.focus()
      const newCursorPos = start + prefix.length + (selected ? selected.length : 4)
      el.setSelectionRange(newCursorPos, newCursorPos)
      setCursorPos(getLineAndCol(nextText, newCursorPos))
      emitAwareness(newCursorPos, newCursorPos)
    }, 10)
  }

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(text)
    addToast('Markdown copied to clipboard', 'success')
  }

  const handleDownloadMarkdown = () => {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = `${docTitle.toLowerCase().replace(/\s+/g, '-') || 'document'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const chars = text.length
  const readingTime = Math.max(1, Math.ceil(words / 200))

  const otherActiveEditors = Object.values(awarenessMap).filter(
    (aw) => aw.userId !== user?.id && currentTime - aw.updatedAt < 60000,
  )

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Top Document Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 18px',
          background: 'var(--bg2)',
          borderRadius: 14,
          border: '1px solid var(--border)',
        }}
      >
        {/* Title & Autosaved Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 260 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--violet), var(--cyan))',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <IconDocument size={20} />
          </div>

          <div style={{ display: 'grid', gap: 2, flex: 1 }}>
            <input
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Untitled Document"
              style={{
                fontSize: 18,
                fontWeight: 900,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                padding: '2px 0',
                letterSpacing: '-0.3px',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
              {lastSaved ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    color: 'var(--muted)',
                    fontSize: 11.5,
                  }}
                >
                  <IconCheck size={13} style={{ color: 'var(--emerald)' }} />
                  Autosaved at {lastSaved}
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    color: 'var(--muted2)',
                    fontSize: 11.5,
                  }}
                >
                  <IconCheck size={13} style={{ color: 'var(--muted2)' }} />
                  All changes saved
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View Mode Switcher, Active Editors & Snapshots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Editor Mode Buttons */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg3)',
              padding: 3,
              borderRadius: 10,
              border: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              className={`btn btn-sm ${mode === 'edit' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('edit')}
              title="Editor only"
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              <IconEdit size={14} /> Edit
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'split' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('split')}
              title="Side-by-side edit and live preview"
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              <IconColumns size={14} /> Split
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('preview')}
              title="Formatted preview only"
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              <IconEye size={14} /> Preview
            </button>
          </div>

          {/* Active Collaborators Presence Pill with Click Outside Handler */}
          <div ref={presenceMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowPresenceMenu((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg3)',
                padding: '3px 12px 3px 6px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                cursor: 'pointer',
                color: 'inherit',
                transition: 'all 0.15s ease',
              }}
              title="Click to view active collaborators and real-time positions"
            >
              {/* Stacked Avatar Group */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {editors.slice(0, 4).map((ed, idx) => (
                  <div
                    key={ed.userId}
                    style={{
                      marginLeft: idx === 0 ? 0 : -8,
                      borderRadius: '50%',
                      boxShadow: `0 0 0 2px var(--bg3), 0 0 0 3.5px ${ed.color || '#7c3aed'}`,
                      zIndex: 10 - idx,
                      position: 'relative',
                      display: 'flex',
                    }}
                  >
                    <Avatar
                      name={ed.displayName}
                      color={ed.color}
                      avatarUrl={ed.avatarUrl}
                      size={24}
                      title={ed.displayName}
                    />
                  </div>
                ))}
                {editors.length > 4 && (
                  <span
                    style={{
                      marginLeft: 4,
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: 'var(--muted)',
                    }}
                  >
                    +{editors.length - 4}
                  </span>
                )}
              </div>

              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: 'var(--emerald)',
                    boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
                  }}
                />
                {editors.length === 1 ? '1 Editor' : `${editors.length} Editors`}
              </span>
            </button>

            {/* Presence Roster Dropdown */}
            {showPresenceMenu && (
              <div
                className="card shine"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 8,
                  width: 280,
                  padding: 14,
                  zIndex: 1000,
                  display: 'grid',
                  gap: 10,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Active Collaborators</span>
                  <span>{editors.length} online</span>
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  {editors.map((ed) => {
                    const isSelf = ed.userId === user?.id
                    const awareness = awarenessMap[ed.userId]
                    const isTyping = awareness && currentTime - awareness.updatedAt < 3000
                    const cursorInfo = awareness?.cursor
                      ? getLineAndCol(text, awareness.cursor.start)
                      : null

                    let statusText = 'Viewing'
                    if (isSelf) {
                      statusText = `You (Line ${cursorPos.line}, Col ${cursorPos.col})`
                    } else if (isTyping && cursorInfo) {
                      statusText = `Typing • Line ${cursorInfo.line}, Col ${cursorInfo.col}`
                    } else if (cursorInfo) {
                      statusText = `Line ${cursorInfo.line}, Col ${cursorInfo.col}`
                    }

                    return (
                      <div
                        key={ed.userId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 10,
                          background: 'var(--bg2)',
                          border: `1px solid ${ed.color || '#7c3aed'}30`,
                        }}
                      >
                        <Avatar
                          name={ed.displayName}
                          color={ed.color}
                          avatarUrl={ed.avatarUrl}
                          size={30}
                          isOnline={true}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12.5,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {ed.displayName}
                            </span>
                            {isSelf && (
                              <span
                                className="badge badge-emerald"
                                style={{ fontSize: 9.5, padding: '1px 5px' }}
                              >
                                You
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: isTyping ? 'var(--violet2)' : 'var(--muted)',
                              marginTop: 2,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              fontWeight: isTyping ? 700 : 500,
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: ed.color || '#7c3aed',
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {statusText}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Snapshots Button */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSnapshots(true)}
            title="View document versions and snapshots"
          >
            <IconHistory size={16} /> Snapshots
          </button>
        </div>
      </div>

      {/* Editor & Preview Body */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Markdown Toolbar (Shown in Edit and Split modes) */}
        {mode !== 'preview' && (
          <div
            style={{
              padding: '8px 14px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg2)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            {/* Headings Segment */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => insertMarkdown('# ')}
                style={{
                  height: 28,
                  minWidth: 30,
                  padding: '0 6px',
                  fontWeight: 800,
                  fontSize: 11.5,
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
                title="Heading 1"
              >
                H1
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => insertMarkdown('## ')}
                style={{
                  height: 28,
                  minWidth: 30,
                  padding: '0 6px',
                  fontWeight: 800,
                  fontSize: 11.5,
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
                title="Heading 2"
              >
                H2
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => insertMarkdown('### ')}
                style={{
                  height: 28,
                  minWidth: 30,
                  padding: '0 6px',
                  fontWeight: 800,
                  fontSize: 11.5,
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
                title="Heading 3"
              >
                H3
              </button>
            </div>

            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', margin: '0 3px' }} />

            {/* Inline Formatting */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => insertMarkdown('**', '**')}
                style={{
                  height: 28,
                  width: 28,
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
                title="Bold (Ctrl+B)"
              >
                <IconBold size={14} />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => insertMarkdown('*', '*')}
                style={{
                  height: 28,
                  width: 28,
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
                title="Italic (Ctrl+I)"
              >
                <IconItalic size={14} />
              </button>
            </div>

            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', margin: '0 3px' }} />

            {/* Blocks & Lists */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => insertMarkdown('> ')}
                style={{
                  height: 28,
                  padding: '0 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
                title="Blockquote"
              >
                <IconQuote size={13} /> Quote
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => insertMarkdown('- ')}
                style={{
                  height: 28,
                  padding: '0 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
                title="Bullet List"
              >
                <IconList size={13} /> List
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => insertMarkdown('- [ ] ')}
                style={{
                  height: 28,
                  padding: '0 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
                title="Task List"
              >
                <IconCheckSquare size={13} /> Task
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => insertMarkdown('```ts\n', '\n```')}
                style={{
                  height: 28,
                  padding: '0 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
                title="Code Block"
              >
                <IconCode size={13} /> Code
              </button>
            </div>

            {/* Collaborator Cursor Activity Badges in Toolbar */}
            {otherActiveEditors.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                {otherActiveEditors.slice(0, 3).map((aw) => {
                  const lineInfo = aw.cursor ? getLineAndCol(text, aw.cursor.start) : null
                  return (
                    <span
                      key={aw.userId}
                      className="badge"
                      style={{
                        fontSize: 10.5,
                        padding: '2px 8px',
                        borderColor: aw.color,
                        color: aw.color,
                        background: `${aw.color}15`,
                        fontWeight: 700,
                      }}
                    >
                      ● {aw.displayName} {lineInfo ? `(Ln ${lineInfo.line})` : '(Viewing)'}
                    </span>
                  )
                })}
              </div>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCopyMarkdown}
                title="Copy markdown text"
                style={{ padding: '4px 8px', fontSize: 11 }}
              >
                <IconCopy size={13} /> Copy
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleDownloadMarkdown}
                title="Export .md file"
                style={{ padding: '4px 8px', fontSize: 11 }}
              >
                Export
              </button>
            </div>
          </div>
        )}

        {/* Content Pane (Edit / Split / Preview) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: mode === 'split' ? '1fr 1fr' : '1fr',
            minHeight: 540,
          }}
        >
          {/* Editor Column */}
          {mode !== 'preview' && (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onSelect={handleSelectionChange}
              onKeyUp={handleSelectionChange}
              onClick={handleSelectionChange}
              placeholder="Start typing notes, specifications, or markdown documentation in real-time…"
              style={{
                width: '100%',
                height: '100%',
                minHeight: 540,
                border: 'none',
                borderRight: mode === 'split' ? '1px solid var(--border)' : 'none',
                outline: 'none',
                padding: 24,
                fontSize: 15,
                lineHeight: 1.7,
                background: 'transparent',
                color: 'var(--text)',
                fontFamily: 'inherit',
                resize: 'none',
              }}
            />
          )}

          {/* Preview Column */}
          {mode !== 'edit' && (
            <div
              className="scroll"
              style={{
                height: '100%',
                maxHeight: 650,
                overflowY: 'auto',
                background: 'rgba(15, 15, 18, 0.4)',
              }}
            >
              <MarkdownViewer content={text} />
            </div>
          )}
        </div>

        {/* Bottom Status Bar */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11.5,
            color: 'var(--muted)',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span>{words} words</span>
            <span>{chars} characters</span>
            <span>~{readingTime} min read</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Real-time Line & Col for current user */}
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
            <span
              className="badge"
              style={{
                fontSize: 10.5,
                padding: '2px 8px',
                gap: 5,
                background: isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                borderColor: isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                color: isConnected ? '#6ee7b7' : '#fca5a5',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: isConnected ? 'var(--emerald)' : 'var(--red)',
                }}
              />
              {isConnected ? 'CRDT Live Sync' : 'Connecting…'}
            </span>
          </div>
        </div>
      </div>

      {/* Snapshots Modal */}
      {showSnapshots && (
        <SnapshotHistory
          isOpen={showSnapshots}
          onClose={() => setShowSnapshots(false)}
          workspaceId={workspaceId}
          documentId={did}
          onSnapshotRestored={() => {
            const socket = socketRef.current
            const ydoc = ydocRef.current
            if (socket?.connected && ydoc) {
              const stateVector = Y.encodeStateVector(ydoc)
              socket.emit('doc:join', {
                documentId: did,
                workspaceId,
                stateVector,
              })
            }
          }}
        />
      )}
    </div>
  )
}
