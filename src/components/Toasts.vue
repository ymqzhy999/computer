<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-vue-next'
import { useToastStore } from '../stores/toast'

const toast = useToastStore()
const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
}
</script>

<template>
  <div class="toast-stack" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="item in toast.items" :key="item.id" class="toast-item" :class="`toast-item--${item.type}`">
        <span class="toast-icon"><component :is="icons[item.type]" :size="15" /></span>
        <div class="toast-copy">
          <strong>{{ item.title }}</strong>
          <em v-if="item.detail">{{ item.detail }}</em>
        </div>
        <button type="button" aria-label="关闭通知" @click="toast.dismiss(item.id)"><X :size="13" /></button>
      </div>
    </TransitionGroup>
  </div>
</template>
