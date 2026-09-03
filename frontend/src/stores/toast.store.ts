import { create } from 'zustand'
import type { ToastMessage } from '../types'

interface ToastState {
  toasts: ToastMessage[]
  addToast: (
    message: string,
    type?: 'success' | 'error' | 'info' | 'warning',
    options?: { title?: string; duration?: number },
  ) => void
  removeToast: (id: string) => void
}

let toastCounter = 0

export const useToast = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type = 'info', options = {}) => {
    const id = `toast-${Date.now()}-${++toastCounter}`
    const duration = options.duration ?? 4000

    const newToast: ToastMessage = {
      id,
      message,
      type,
      title: options.title,
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
