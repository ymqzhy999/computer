<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  AlertTriangle,
  Box,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Eye,
  Info,
  Layers,
  Maximize2,
  Minimize2,
  MousePointer2,
  Move3d,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Power,
  Bug,
  RotateCcw,
  ScanLine,
  Sparkles,
  Square,
  Sun,
  Volume2,
  VolumeX,
  Wrench,
  X,
  ZoomIn,
} from 'lucide-vue-next'
import Viewport from './Viewport.vue'
import { useBuildStore } from '../stores/build'
import { categoryMeta, CORE_CATEGORIES } from '../data/meta'
import { formatPrice, productPrice } from '../services/pricing'
import { fanAudio } from '../services/fanAudio'
import type { ViewMode } from '../types'

const store = useBuildStore()
const viewport = ref<{ capture: () => string | null } | null>(null)
const isDiyMinimized = ref(false)

/** 风扇越多、整机越“满”，风声越明显；至少保留一点可听见的底噪。 */
const fanIntensity = computed(() => {
  const count = store.selection.fan ? Math.max(1, store.quantities.fan ?? 1) : 0
  const ratio = (store.metrics.power.peak || 300) / 800
  return Math.min(1.3, 0.55 + count * 0.09 + ratio * 0.35)
})

function togglePower() {
  store.togglePowerOn()
  fanAudio.handlePower(store.powerOn, fanIntensity.value)
}

watch(
  () => store.powerOn,
  (on) => fanAudio.handlePower(on, fanIntensity.value),
)

const modes: { id: ViewMode; label: string; icon: typeof Box }[] = [
  { id: 'assembled', label: '完整视图', icon: Box },
  { id: 'exploded', label: '爆炸拆解', icon: Layers },
  { id: 'section', label: '剖切视图', icon: ScanLine },
  { id: 'xray', label: '透明视图', icon: Eye },
]

const phase = computed(() => {
  if (store.diyMode) return `自主装机 · 第 ${store.diyStep}/10 步`
  if (store.viewMode === 'section') return '剖切视图'
  if (store.viewMode === 'xray') return '透明视图'
  if (store.explode > 0.6) return '爆炸拆解'
  if (store.explode > 0.02) return '拆解中'
  return '完整装配'
})
const statusText = computed(() => {
  if (store.compatibility.status === 'blocked') return '存在冲突'
  if (store.compatibility.status === 'caution') return '需要注意'
  return '兼容通过'
})
const complete = computed(() => CORE_CATEGORIES.every((category) => Boolean(store.selection[category])))

const selected = computed(() => store.inspectedProduct)
const selectedMeta = computed(() => (selected.value ? categoryMeta(selected.value.category) : null))
const explodedParts = computed(() =>
  [...store.installedProducts]
    .map((product) => ({ product, meta: categoryMeta(product.category) }))
    .sort((a, b) => a.meta.index.localeCompare(b.meta.index)),
)

function inspectPart(category: (typeof store.installedProducts)[number]['category']) {
  store.inspectProduct(store.selection[category] ?? null)
}

function selectMode(mode: ViewMode) {
  store.setViewMode(mode)
}

function toggleLighting() {
  if (store.lightingPreset === 'bright') store.setLightingPreset('studio')
  else if (store.lightingPreset === 'studio') store.setLightingPreset('night')
  else store.setLightingPreset('bright')
}

function installDiyRecommendation() {
  const cat = store.currentDiyStepInfo.category
  const candidates = store.allProducts.filter((p) => p.category === cat)
  if (!candidates.length) return
  // Pick highest value/performance product in pool
  const candidate = candidates[0]
  store.installProduct(candidate)
}

function capture() {
  const data = viewport.value?.capture()
  if (!data) return
  const link = document.createElement('a')
  link.href = data
  link.download = `pc-forge-${Date.now()}.png`
  link.click()
}
</script>

<template>
  <section class="workbench hud-panel">
    <div class="viewport-host">
      <Viewport ref="viewport" />

      <button
        type="button"
        class="panel-edge panel-edge--left"
        :title="store.leftPanelOpen ? '收起配件列表' : '展开配件列表'"
        @click="store.toggleLeftPanel()"
      >
        <component :is="store.leftPanelOpen ? PanelLeftClose : PanelLeftOpen" :size="14" />
      </button>
      <button
        type="button"
        class="panel-edge panel-edge--right"
        :title="store.inspectorOpen ? '收起组件信息' : '展开组件信息'"
        @click="store.toggleInspector()"
      >
        <component :is="store.inspectorOpen ? PanelRightClose : PanelRightOpen" :size="14" />
      </button>

      <div class="viewport-hud">
        <div class="hud-top-left">
          <h1>{{ store.activeTab === 'teardown' ? '拆解实验室' : '装配实验室' }}<span class="hud-phase">{{ phase }}</span></h1>
          <div class="hud-subline">
            <span>{{ store.installedCount }} 个组件</span>
            <span>·</span>
            <span>拆解 {{ Math.round(store.explode * 100) }}%</span>
            <span>·</span>
            <span v-if="complete" class="hud-complete">整机完整</span>
            <span v-if="complete">·</span>
            <span>{{ statusText }}</span>
            <span v-if="store.powerOn" class="hud-powered">· 电源已接通</span>
          </div>
          <div class="hud-guide">
            <button
              type="button"
              class="diy-mode-btn"
              :class="{ 'diy-mode-btn--active': store.diyMode }"
              @click="store.diyMode ? store.exitDiyAssembly() : store.startDiyAssembly()"
            >
              <Wrench :size="13" />
              <span>{{ store.diyMode ? '退出装机教程' : '🛠️ 真实装机教程' }}</span>
            </button>
            <button type="button" :disabled="!complete" @click="store.openGuide('capability')">能力评估</button>
          </div>
        </div>
      </div>

      <div class="view-modes">
        <button
          v-for="mode in modes"
          :key="mode.id"
          type="button"
          class="view-mode"
          :class="{ 'view-mode--active': store.viewMode === mode.id }"
          @click="selectMode(mode.id)"
        >
          <component :is="mode.icon" :size="13" />
          <span>{{ mode.label }}</span>
        </button>
      </div>

      <div v-if="store.explode > 0.06" class="part-dock">
        <div class="part-dock__head">
          <span>部件直选</span>
          <em>{{ explodedParts.length }} 个</em>
        </div>
        <div class="part-dock__grid">
          <button
            v-for="item in explodedParts"
            :key="item.product.id"
            type="button"
            class="part-dock__item"
            :class="{ 'part-dock__item--active': selected?.id === item.product.id }"
            :title="`${item.meta.label} · ${item.product.brand} ${item.product.model}`"
            @click="inspectPart(item.product.category)"
          >
            <em>{{ item.meta.index }}</em>
            <span>{{ item.meta.short }}</span>
          </button>
        </div>
      </div>

      <div class="viewport-tools">
        <button
          type="button"
          class="tool-btn"
          :class="{ 'tool-btn--on': store.powerOn }"
          :title="store.powerOn ? '关闭电源' : '通电运行（会有风扇声）'"
          @click="togglePower"
        >
          <Power :size="15" />
          <span class="tool-btn__badge">{{ store.powerOn ? '断电' : '通电' }}</span>
        </button>
        <button
          type="button"
          class="tool-btn"
          :class="{ 'tool-btn--on': store.powerOn && !fanAudio.muted.value }"
          :title="fanAudio.muted.value ? '打开风扇声音' : '静音风扇声音'"
          @click="fanAudio.toggleMute()"
        >
          <component :is="fanAudio.muted.value ? VolumeX : Volume2" :size="15" />
          <span class="tool-btn__badge">{{ fanAudio.muted.value ? '静音' : '声音' }}</span>
        </button>
        <button
          type="button"
          class="tool-btn"
          :class="{ 'tool-btn--on': store.debugMode }"
          title="调试模式（显示选择框与坐标）"
          @click="store.toggleDebugMode()"
        >
          <Bug :size="15" />
        </button>
        <button
          type="button"
          class="tool-btn tool-btn--lighting"
          :title="`切换光线预设：当前为【${store.lightingPreset === 'bright' ? '通透自然' : store.lightingPreset === 'studio' ? '经典影棚' : '夜间工作台'}】`"
          @click="toggleLighting"
        >
          <Sun :size="15" />
          <span class="tool-btn__badge">{{ store.lightingPreset === 'bright' ? '通透' : store.lightingPreset === 'studio' ? '影棚' : '夜间' }}</span>
        </button>
        <button type="button" class="tool-btn" title="重置视角" @click="store.resetCamera()"><Maximize2 :size="15" /></button>
        <button type="button" class="tool-btn" title="导出 3D 截图" @click="capture"><Camera :size="15" /></button>
        <button type="button" class="tool-btn" :class="{ 'tool-btn--on': store.autoRotate }" title="自动旋转" @click="store.autoRotate = !store.autoRotate"><Move3d :size="15" /></button>
      </div>

      <div class="axis-gizmo" aria-hidden="true">
        <span class="axis axis--y">Y</span>
        <span class="axis axis--x">X</span>
        <span class="axis axis--z">Z</span>
        <i class="axis-line axis-line--y"></i>
        <i class="axis-line axis-line--x"></i>
        <i class="axis-line axis-line--z"></i>
      </div>

      <div class="interaction-hint">
        <span><MousePointer2 :size="11" /> 拖拽旋转</span>
        <span><ZoomIn :size="11" /> 滚轮缩放</span>
        <span><Crosshair :size="11" /> 单击选中 / 双击聚焦</span>
      </div>

      <div v-if="selected && !store.diyMode" class="selected-hud">
        <div class="selected-hud__head">
          <span>{{ selectedMeta?.index }} · {{ selectedMeta?.label }}</span>
          <div class="selected-hud__actions">
            <button type="button" class="btn-focus" title="聚焦此部件视角" @click="store.focusPart(selected.category)">
              <Crosshair :size="10" /> 聚焦
            </button>
            <button type="button" title="取消选择" @click="store.inspectProduct(null)">×</button>
          </div>
        </div>
        <strong>{{ selected.brand }} {{ selected.model }}</strong>
        <em>{{ selected.tagline }}</em>
        <div class="selected-hud__foot">
          <span>{{ formatPrice(productPrice(selected ?? undefined)) }}</span>
          <span>性能 {{ selected.performance.index }}</span>
        </div>
      </div>

      <!-- 真实自主装机流程浮动控制台 -->
      <transition name="diy-slide">
        <aside v-if="store.diyMode" class="diy-console" :class="{ 'diy-console--minimized': isDiyMinimized }">
          <div class="diy-console__header">
            <div class="diy-step-pill">
              <span class="diy-step-num">步骤 {{ String(store.diyStep).padStart(2, '0') }} / 10</span>
              <strong class="diy-step-title">{{ store.currentDiyStepInfo.title }}</strong>
            </div>
            <div class="diy-console__top-actions">
              <button
                type="button"
                class="diy-btn-pill"
                :class="{ 'diy-btn-pill--active': store.diyPlaying }"
                @click="store.playDiyAutoSequence"
              >
                <component :is="store.diyPlaying ? Square : Play" :size="12" />
                <span>{{ store.diyPlaying ? '暂停演示' : '一键演练' }}</span>
              </button>
              <button
                type="button"
                class="diy-btn-pill"
                :title="isDiyMinimized ? '展开装机指引与避坑指南' : '最小化控制台（最大化 3D 动画视野）'"
                @click="isDiyMinimized = !isDiyMinimized"
              >
                <component :is="isDiyMinimized ? Maximize2 : Minimize2" :size="12" />
                <span>{{ isDiyMinimized ? '展开' : '精简视野' }}</span>
              </button>
              <button
                type="button"
                class="diy-close-btn"
                title="退出自主装机"
                @click="store.exitDiyAssembly"
              >
                <X :size="14" />
              </button>
            </div>
          </div>

          <div v-show="!isDiyMinimized" class="diy-console__body">
            <div class="diy-action-row">
              <span class="diy-action-tag">操作动作</span>
              <strong class="diy-action-text">{{ store.currentDiyStepInfo.action }}</strong>
            </div>
            <p class="diy-detail-text">{{ store.currentDiyStepInfo.detail }}</p>

            <div class="diy-part-status" :class="store.isCurrentDiyInstalled ? 'is-installed' : 'is-missing'">
              <div class="status-indicator">
                <Check v-if="store.isCurrentDiyInstalled" :size="14" />
                <AlertTriangle v-else :size="14" />
              </div>
              <div class="status-info">
                <template v-if="store.isCurrentDiyInstalled">
                  <span class="status-label">已装配配件：</span>
                  <strong class="status-name">{{ store.currentDiyProduct?.brand }} {{ store.currentDiyProduct?.model }}</strong>
                </template>
                <template v-else>
                  <span class="status-label">等待装配：</span>
                  <span class="status-hint">请从左侧挑选配件装入（或点击右侧一键选用）</span>
                </template>
              </div>
              <button
                v-if="store.isCurrentDiyInstalled"
                type="button"
                class="btn-focus-step"
                title="聚焦当前步骤配件视角"
                @click="store.focusPart(store.currentDiyStepInfo.category)"
              >
                <Crosshair :size="11" /> 聚焦视角
              </button>
              <button
                v-else
                type="button"
                class="btn-quick-install"
                @click="installDiyRecommendation"
              >
                <Sparkles :size="12" /> 选用推荐配件
              </button>
            </div>

            <div class="diy-tips-grid">
              <div class="diy-tip-item diy-tip-item--tip">
                <Info :size="13" class="tip-icon" />
                <div class="tip-content">
                  <em>💡 老鸟避坑指南</em>
                  <span>{{ store.currentDiyStepInfo.tip }}</span>
                </div>
              </div>
              <div class="diy-tip-item diy-tip-item--caution">
                <AlertTriangle :size="13" class="tip-icon" />
                <div class="tip-content">
                  <em>⚠️ 高频翻车风险</em>
                  <span>{{ store.currentDiyStepInfo.caution }}</span>
                </div>
              </div>
            </div>
          </div>

          <footer class="diy-console__footer">
            <button
              type="button"
              class="diy-nav-btn diy-nav-btn--prev"
              :disabled="store.diyStep <= 1"
              @click="store.prevDiyStep"
            >
              <ChevronLeft :size="14" /> 上一步
            </button>
            <div class="diy-step-progress-dots">
              <span
                v-for="s in 10"
                :key="s"
                class="step-dot"
                :class="{
                  'is-passed': s < store.diyStep,
                  'is-active': s === store.diyStep
                }"
                :title="`第 ${s} 步`"
                @click="store.setDiyStep(s)"
              />
            </div>
            <button
              type="button"
              class="diy-nav-btn diy-nav-btn--next"
              @click="store.nextDiyStep"
            >
              <span>{{ store.diyStep >= 10 ? '🎉 封箱点亮' : '下一步' }}</span>
              <ChevronRight :size="14" />
            </button>
          </footer>
        </aside>
      </transition>
    </div>
  </section>
</template>
