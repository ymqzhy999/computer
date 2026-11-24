<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import TopBar from './components/TopBar.vue'
import Toasts from './components/Toasts.vue'
import LabLayout from './components/LabLayout.vue'
import SmartBuilder from './pages/SmartBuilder.vue'
import MarketPage from './pages/MarketPage.vue'
import BuildsPage from './pages/BuildsPage.vue'
import { useBuildStore } from './stores/build'
import { TAB_META } from './data/meta'

const store = useBuildStore()
const isLab = computed(() => store.activeTab === 'assembly' || store.activeTab === 'teardown')

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  if (event.metaKey || event.ctrlKey || event.altKey) return

  if (event.key >= '1' && event.key <= '5') {
    const tab = TAB_META[Number(event.key) - 1]
    if (tab) store.setTab(tab.id)
    return
  }
  if (event.code === 'Space' && isLab.value) {
    event.preventDefault()
    store.toggleTimeline()
    return
  }
  if (event.key === 'Escape') {
    if (store.guideMode) {
      store.closeGuide()
      return
    }
    store.inspectProduct(null)
    store.isolatedId = null
  }
  if (event.key.toLowerCase() === 'r' && isLab.value) {
    store.resetCamera()
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="app-shell">
    <TopBar />
    <main class="app-main">
      <LabLayout v-if="isLab" />
      <SmartBuilder v-else-if="store.activeTab === 'smart'" />
      <MarketPage v-else-if="store.activeTab === 'market'" />
      <BuildsPage v-else-if="store.activeTab === 'builds'" />
    </main>
    <Toasts />
  </div>
</template>
