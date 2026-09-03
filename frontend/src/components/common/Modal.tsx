import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { IconClose } from './Icons'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
  maxWidth?: number | string
  maxHeight?: number | string
  headerExtra?: React.ReactNode
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 640,
  maxHeight = '88vh',
  headerExtra,
}: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 16,
        animation: 'fade-in 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        className="card shine"
        style={{
          width: '100%',
          maxWidth,
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          background: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
          borderRadius: 18,
          overflow: 'hidden',
          animation: 'modal-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' }}>
              {title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {headerExtra}
              <button
                className="btn btn-ghost btn-sm"
                onClick={onClose}
                style={{ padding: 6, borderRadius: 8 }}
                aria-label="Close"
              >
                <IconClose size={16} />
              </button>
            </div>
          </div>
        )}
        <div
          className="scroll"
          style={{
            padding: 20,
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
