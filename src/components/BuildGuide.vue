<script setup lang="ts">
import { computed } from 'vue'
import { Sparkles, X } from 'lucide-vue-next'
import { useBuildStore } from '../stores/build'
import { estimateCapabilities, levelLabel } from '../services/capability'

const store = useBuildStore()
const capability = computed(() => estimateCapabilities(store.metrics, store.selection, store.byId))
const complete = computed(() => store.selectedCoreCount === 8)

function startAssemblyFromModal() {
  store.closeGuide()
  store.startDiyAssembly()
}
</script>

<template>
  <div v-if="store.guideMode === 'capability'" class="guide-overlay" @click.self="store.closeGuide()">
    <section class="guide-panel guide-panel--capability">
      <header class="guide-head">
        <div>
          <span class="guide-kicker">整机能力评估</span>
          <h2>这套配置能做什么</h2>
        </div>
        <button class="guide-close" type="button" aria-label="关闭" @click="store.closeGuide()"><X :size="15" /></button>
      </header>

      <div class="cap-summary">
        <Sparkles :size="18" />
        <div>
          <strong>{{ complete ? capability.summary : '整机尚未完整' }}</strong>
          <span>{{ complete ? '基于当前硬件性能指数的能力定位' : '补齐核心组件后可获得完整评估' }}</span>
        </div>
      </div>

      <div class="cap-groups">
        <article class="cap-group">
          <h3>游戏</h3>
          <div v-for="item in capability.gaming" :key="item.label" class="cap-row">
            <span>{{ item.label }}</span>
            <b :class="`cap-level--${item.level}`">{{ levelLabel(item.level) }}</b>
            <em>{{ item.detail }}</em>
          </div>
        </article>
        <article class="cap-group">
          <h3>软件与创作</h3>
          <div v-for="item in capability.software" :key="item.label" class="cap-row">
            <span>{{ item.label }}</span>
            <b :class="`cap-level--${item.level}`">{{ levelLabel(item.level) }}</b>
            <em>{{ item.detail }}</em>
          </div>
        </article>
        <article class="cap-group">
          <h3>本地大模型</h3>
          <div v-for="item in capability.llm" :key="item.label" class="cap-row">
            <span>{{ item.label }}</span>
            <b :class="`cap-level--${item.level}`">{{ levelLabel(item.level) }}</b>
            <em>{{ item.detail }}</em>
          </div>
        </article>
      </div>
      <p class="cap-disclaimer">{{ capability.disclaimer }}</p>
      <footer class="guide-actions">
        <button class="guide-btn" type="button" @click="startAssemblyFromModal">🛠️ 进入 3D 真实装机教程</button>
        <button class="guide-btn guide-btn--primary" type="button" @click="store.closeGuide()">完成</button>
      </footer>
    </section>
  </div>
</template>
