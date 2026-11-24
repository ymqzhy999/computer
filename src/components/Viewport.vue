<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PCLabScene } from '../three/pcScene'
import { useBuildStore } from '../stores/build'
import type { Category } from '../types'

const host = ref<HTMLElement | null>(null)
const store = useBuildStore()
let scene: PCLabScene | null = null

function syncConfig() {
  scene?.setConfig(store.installedProducts, store.selection, store.quantities)
  scene?.setCustomizations(store.customizations)
}

function categoryFromProductId(id: string | null): Category | null {
  if (!id) return null
  return store.byId.get(id)?.category ?? null
}

function syncPreview() {
  const request = store.previewRequest
  if (!scene || !request) return
  const url = scene.capturePart(request.category)
  if (url) store.setPartPreview(request.category, url)
}

onMounted(() => {
  if (!host.value) return
  scene = new PCLabScene(host.value, {
    onSelect: (category) => {
      if (!category) return
      const productId = store.selection[category]
      if (productId) store.inspectProduct(productId)
    },
    onFps: (value) => store.setFps(value),
    onCamera: (readout) => store.setCamera(readout),
    onReady: () => {
      store.sceneReady = true
      syncConfig()
      scene?.setViewMode(store.viewMode)
      scene?.setExplode(store.explode)
      scene?.setDetached(store.detachedIds)
      scene?.setAutoRotate(store.autoRotate)
      scene?.setCaseTint(store.caseTint)
      scene?.setVisibility(store.hiddenIds, store.isolatedId)
      scene?.setTutorialVisible(store.tutorialVisible)
      scene?.setLightingPreset(store.lightingPreset)
      scene?.setPowerOn(store.powerOn)
      scene?.setDebugMode(store.debugMode)
      scene?.selectCategory(categoryFromProductId(store.inspectedId))
      syncPreview()
    },
  })
  scene.setViewMode(store.viewMode)
  scene.setExplode(store.explode)
  scene.setDetached(store.detachedIds)
  scene.setAutoRotate(store.autoRotate)
  scene.setCaseTint(store.caseTint)
  scene.setVisibility(store.hiddenIds, store.isolatedId)
  scene.setTutorialVisible(store.tutorialVisible)
  scene.setLightingPreset(store.lightingPreset)
  scene.setPowerOn(store.powerOn)
  scene.setDebugMode(store.debugMode)
})

watch(
  () => [store.installedProducts.map((p) => p.id).join('|'), store.quantities.fan ?? 0, store.quantities.expansion ?? 0],
  () => {
    syncConfig()
    scene?.setViewMode(store.viewMode)
    scene?.setExplode(store.explode)
    scene?.setDetached(store.detachedIds)
    scene?.selectCategory(categoryFromProductId(store.inspectedId))
  },
)

watch(
  () => store.customizations,
  (value) => scene?.setCustomizations(value),
  { deep: true },
)

watch(
  () => store.explode,
  (value) => scene?.setExplode(value),
)

watch(
  () => store.detachedIds.join('|'),
  () => scene?.setDetached([...store.detachedIds]),
)

watch(
  () => store.viewMode,
  (mode) => scene?.setViewMode(mode),
)

watch(
  () => store.autoRotate,
  (enabled) => scene?.setAutoRotate(enabled),
)

watch(
  () => store.caseTint,
  (tint) => scene?.setCaseTint(tint),
)

watch(
  () => [store.hiddenIds.join('|'), store.isolatedId],
  () => scene?.setVisibility([...store.hiddenIds], store.isolatedId),
)

watch(
  () => store.lightingPreset,
  (preset) => scene?.setLightingPreset(preset),
)

watch(
  () => store.powerOn,
  (enabled) => scene?.setPowerOn(enabled),
)

watch(
  () => store.debugMode,
  (enabled) => {
    scene?.setDebugMode(enabled)
    scene?.selectCategory(categoryFromProductId(store.inspectedId))
  },
)

watch(
  () => store.tutorialVisible?.join('|') ?? '*',
  () => scene?.setTutorialVisible(store.tutorialVisible),
)

watch(
  () => store.inspectedId,
  (id) => scene?.selectCategory(categoryFromProductId(id)),
)

watch(
  () => store.focusNonce,
  () => {
    if (store.focusTarget) scene?.focusPart(store.focusTarget as Category)
  },
)

watch(
  () => store.resetCameraNonce,
  () => scene?.resetCamera(),
)

watch(
  () => store.previewRequest,
  () => syncPreview(),
  { deep: true },
)

watch(
  () => store.assemblyDemoNonce,
  () => {
    if (!scene) return
    scene.setExplode(0)
    scene.setAutoRotate(false)
    scene.playAssemblySequence()
  },
)

watch(
  () => store.installFxNonce,
  () => {
    const category = store.installFxCategory
    if (scene && category) scene.animatePartInstall(category)
  },
)

onBeforeUnmount(() => {
  scene?.dispose()
  scene = null
})

defineExpose({
  capture: () => scene?.capture() ?? null,
})
</script>

<template>
  <div ref="host" class="viewport-host">
    <div v-if="!store.sceneReady" class="viewport-boot">
      <div class="boot-ring"></div>
      <p>正在加载 3D 场景</p>
      <span>初始化材质与装配结构</span>
    </div>
  </div>
</template>
