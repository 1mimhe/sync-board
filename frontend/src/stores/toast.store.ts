import { create } from 'zustand'
import type { ToastMessage } from '../types'

interface ToastState {
  toasts: ToastMessage[]
  addToast: (
    messageOrPayload:
      | string
      | {
          message: string
          type?: 'success' | 'error' | 'info' | 'warning'
          title?: string
          duration?: number
        },
    type?: 'success' | 'error' | 'info' | 'warning',
    options?: { title?: string; duration?: number },
  ) => void
  removeToast: (id: string) => void
}

let toastCounter = 0

export const useToast = create<ToastState>((set) => ({
  toasts: [],

  addToast: (messageOrPayload, explicitType = 'info', explicitOptions = {}) => {
    let message = ''
    let type: 'success' | 'error' | 'info' | 'warning' = explicitType
    let title: string | undefined = explicitOptions.title
    let duration = explicitOptions.duration ?? 4000

    if (typeof messageOrPayload === 'object' && messageOrPayload !== null) {
      message = messageOrPayload.message
      if (messageOrPayload.type) type = messageOrPayload.type
      if (messageOrPayload.title !== undefined) title = messageOrPayload.title
      if (messageOrPayload.duration !== undefined) duration = messageOrPayload.duration
    } else {
      message = String(messageOrPayload ?? '')
    }

    const id = `toast-${Date.now()}-${++toastCounter}`

    const newToast: ToastMessage = {
      id,
      message,
      type,
      title,
      duration,
    }

    set((state) => ({ toasts: [...state.toasts, newToast] }))

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))
