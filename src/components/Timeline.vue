<script setup lang="ts">
import { computed } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-vue-next'
import { useBuildStore } from '../stores/build'
import { ASSEMBLY_STEPS } from '../data/defaults'

const store = useBuildStore()

const percent = computed(() => Math.round(store.explode * 100))
const currentIndex = computed(() => {
  let index = 0
  for (let i = 0; i < ASSEMBLY_STEPS.length; i += 1) {
    if (store.explode >= ASSEMBLY_STEPS[i].at - 0.001) index = i
  }
  return index
})
const currentStep = computed(() => ASSEMBLY_STEPS[currentIndex.value])
const assembledCount = computed(() => Math.max(0, Math.round(store.installedCount * (1 - store.explode))))
const detachedCount = computed(() => store.installedCount - assembledCount.value)
const phaseLabel = computed(() => {
  if (store.explode <= 0.01) return '完整装配状态'
  if (store.explode >= 0.985) return '完全拆解状态'
  return '拆解进行中'
})
const detail = computed(() => {
  if (store.explode <= 0.01 && store.detachedCount > 0) return `${store.installedCount - store.detachedCount} / ${store.installedCount} 组件锁定 · ${store.detachedCount} 项独立分离`
  if (store.explode <= 0.01) return `${store.installedCount} / ${store.installedCount} 组件锁定`
  if (store.explode >= 0.985) return `${store.installedCount} / ${store.installedCount} 组件分离`
  return `${assembledCount.value} 装配 · ${detachedCount.value} 分离`
})

function onSlide(event: Event) {
  const target = event.target as HTMLInputElement
  store.setTimeline(Number(target.value) / 100)
}

function jumpTo(at: number) {
  store.setTimeline(at)
}
</script>

<template>
  <footer class="timeline hud-panel">
    <div class="timeline-progress">
      <div class="progress-value">
        <strong>{{ String(percent).padStart(2, '0') }}</strong>
        <span>%</span>
      </div>
      <div class="progress-copy">
        <span>装配进度</span>
        <strong>{{ phaseLabel }}</strong>
        <em>{{ detail }}</em>
      </div>
    </div>

    <div class="timeline-center">
      <div class="transport">
        <button type="button" class="transport-btn" title="上一步" @click="store.stepTimeline(-1)">
          <ChevronLeft :size="16" />
        </button>
        <button type="button" class="transport-btn transport-btn--play" :title="store.timelinePlaying ? '暂停' : '播放拆解'" @click="store.toggleTimeline()">
          <Pause v-if="store.timelinePlaying" :size="18" />
          <Play v-else :size="18" />
        </button>
        <button type="button" class="transport-btn" title="下一步" @click="store.stepTimeline(1)">
          <ChevronRight :size="16" />
        </button>
        <div class="step-readout">
          <span>步骤 {{ String(currentIndex + 1).padStart(2, '0') }} / 09</span>
          <strong>{{ currentStep.label }}</strong>
          <em>{{ currentStep.detail }}</em>
        </div>
      </div>

      <div class="scrubber">
        <div class="scrubber-head">
          <span>已装配</span>
          <span>拆解序列</span>
          <span>已拆解</span>
        </div>
        <div class="scrubber-track">
          <input
            :value="Math.round(store.explode * 100)"
            type="range"
            min="0"
            max="100"
            step="1"
            aria-label="拆解进度"
            :style="{ '--fill': `${store.explode * 100}%` }"
            @input="onSlide"
          />
          <button
            v-for="(step, index) in ASSEMBLY_STEPS"
            :key="step.label"
            type="button"
            class="step-marker"
            :class="{ 'step-marker--active': index <= currentIndex }"
            :style="{ left: `${step.at * 100}%` }"
            :title="`${step.label} · ${step.detail}`"
            @click="jumpTo(step.at)"
          >
            <i></i>
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
          </button>
        </div>
        <div class="scrubber-labels">
          <span v-for="step in ASSEMBLY_STEPS" :key="step.label">{{ step.label }}</span>
        </div>
      </div>
    </div>

    <div class="timeline-actions">
      <div class="action-readout" :class="`action-readout--${store.compatibility.status}`">
        <span>配置状态</span>
        <strong>{{ store.compatibility.status === 'pass' ? '兼容通过' : store.compatibility.status === 'caution' ? '需要注意' : '存在冲突' }}</strong>
      </div>
      <div class="timeline-buttons">
        <button type="button" class="forge-btn forge-btn--primary" @click="store.startDiyAssembly()">
          <Sparkles :size="12" /> 真实装机教程
        </button>
        <button type="button" class="forge-btn" @click="store.resetAssembly()">
          <RotateCcw :size="12" /> 重新装配
        </button>
      </div>
    </div>
  </footer>
</template>
