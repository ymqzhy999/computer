<script setup lang="ts">
import ComponentTree from './ComponentTree.vue'
import Workbench from './Workbench.vue'
import Inspector from './Inspector.vue'
import Timeline from './Timeline.vue'
import BuildGuide from './BuildGuide.vue'
import { useBuildStore } from '../stores/build'

const store = useBuildStore()
</script>

<template>
  <div
    class="lab-layout"
    :class="{
      'lab-layout--left-collapsed': !store.leftPanelOpen,
      'lab-layout--right-collapsed': !store.inspectorOpen,
    }"
  >
    <ComponentTree />
    <Workbench />
    <Inspector />
    <Timeline />
    <BuildGuide />
  </div>
</template>
