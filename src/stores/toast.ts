import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ToastMessage } from '../types'

let seq = 0

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastMessage[]>([])
  const timers = new Map<string, number>()

  function dismiss(id: string) {
    items.value = items.value.filter((t) => t.id !== id)
    const timer = timers.get(id)
    if (timer) window.clearTimeout(timer)
    timers.delete(id)
  }

  function push(type: ToastMessage['type'], title: string, detail?: string, ttl = 3600) {
    seq += 1
    const id = `toast-${Date.now()}-${seq}`
    items.value = [...items.value.slice(-3), { id, type, title, detail }]
    const timer = window.setTimeout(() => dismiss(id), ttl)
    timers.set(id, timer)
    return id
  }

  const info = (title: string, detail?: string) => push('info', title, detail)
  const success = (title: string, detail?: string) => push('success', title, detail)
  const warning = (title: string, detail?: string) => push('warning', title, detail)
  const error = (title: string, detail?: string) => push('error', title, detail, 5200)

  return { items, push, dismiss, info, success, warning, error }
})
