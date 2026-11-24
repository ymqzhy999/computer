<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  AlertTriangle,
  ArrowRight,
  Box,
  Check,
  Clock3,
  Clapperboard,
  Crosshair,
  Eye,
  EyeOff,
  Focus,
  Gauge,
  Gamepad2,
  ImagePlus,
  Layers,
  Maximize2,
  PackageCheck,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Zap,
} from 'lucide-vue-next'
import PartGlyph from './PartGlyph.vue'
import { useBuildStore } from '../stores/build'
import { useToastStore } from '../stores/toast'
import { categoryMeta } from '../data/meta'
import { evaluateCompatibility } from '../services/compatibility'
import { effectiveQuote, formatPrice, priceAgeDays } from '../services/pricing'
import { CATEGORY_SCENE_ID } from '../three/partRegistry'
import type { Category, PartCustomization } from '../types'

const store = useBuildStore()
const toast = useToastStore()
type InspectorTab = 'overview' | 'specs' | 'compat' | 'price'
const activeTab = ref<InspectorTab>('overview')
const imageBusy = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const scrollHost = ref<HTMLElement | null>(null)
const product = computed(() => store.inspectedProduct)
const category = computed<Category | null>(() => product.value?.category ?? null)
const meta = computed(() => (category.value ? categoryMeta(category.value) : null))
const installed = computed(() => Boolean(product.value && store.selection[product.value.category] === product.value.id))
const quote = computed(() => effectiveQuote(product.value ?? undefined, store.request.allowUsed))
const sceneId = computed(() => (category.value ? CATEGORY_SCENE_ID[category.value] : ''))
const hidden = computed(() => Boolean(sceneId.value && store.hiddenIds.includes(sceneId.value)))
const detached = computed(() => Boolean(category.value && store.detachedIds.includes(category.value)))
const partImage = computed(() => (store.partPreview?.category === category.value ? store.partPreview.url : null))

function refreshPartPreview() {
  if (category.value) store.requestPartPreview(category.value)
}

onMounted(refreshPartPreview)

watch(
  () => product.value?.id,
  async () => {
    await nextTick()
    activeTab.value = 'overview'
    if (scrollHost.value) scrollHost.value.scrollTop = 0
    refreshPartPreview()
  },
)

// The inspector is a long scroll surface. When the 3D scene selects a new
// part, bring the identity block back into view instead of leaving the user
// at the previous part's Custom Studio / specification scroll position.
watch(
  () => product.value?.id,
  async () => {
    await nextTick()
    if (scrollHost.value) scrollHost.value.scrollTop = 0
  },
)

const previewReport = computed(() => {
  if (!product.value) return store.compatibility
  if (installed.value) return store.compatibility
  return evaluateCompatibility(
    { ...store.selection, [product.value.category]: product.value.id },
    store.byId,
    store.quantities,
  )
})

const relevantIssues = computed(() => {
  if (!category.value) return []
  const issues = previewReport.value.issues.filter((i) => i.categories.includes(category.value as Category))
  return issues.length ? issues : previewReport.value.issues.slice(0, 3)
})

const statusLabel = computed(() => {
  const s = previewReport.value.status
  return s === 'pass' ? '兼容通过' : s === 'caution' ? '存在风险' : '硬性冲突'
})

const age = computed(() => priceAgeDays(quote.value?.updatedAt))
const priceStatus = computed(() => quote.value?.snapshot?.status ?? 'unavailable')
const priceStateLabel = computed(() => {
  const s = priceStatus.value
  return s === 'live' ? '实时报价' : s === 'stale' ? '价格待更新' : s === 'sample' ? '归档样本' : '暂无报价'
})
const spark = computed(() => {
  const history = quote.value?.snapshot?.history
  if (!history || history.length < 2) return null
  const values = history.map((h) => h.price)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = history
    .map((point, index) => {
      const x = history.length === 1 ? 0 : (index / (history.length - 1)) * 220
      const y = 46 - ((point.price - min) / span) * 38
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return { points, min, max, delta: values[values.length - 1] - values[0] }
})

const alternatives = computed(() => {
  if (!product.value) return []
  const currentPrice = quote.value?.value ?? 0
  return store.allProducts
    .filter((p) => p.category === product.value!.category && p.id !== product.value!.id)
    .map((p) => ({ product: p, quote: effectiveQuote(p, store.request.allowUsed) }))
    .filter((x) => x.quote)
    .filter((x) => {
      const report = evaluateCompatibility(
        { ...store.selection, [product.value!.category]: x.product.id },
        store.byId,
        store.quantities,
      )
      return report.status !== 'blocked'
    })
    .sort((a, b) => {
      const da = currentPrice ? Math.abs((a.quote?.value ?? 0) - currentPrice) / currentPrice : 0
      const db = currentPrice ? Math.abs((b.quote?.value ?? 0) - currentPrice) / currentPrice : 0
      return da + (100 - (a.product.performance?.index ?? 0)) / 400 - (db + (100 - (b.product.performance?.index ?? 0)) / 400)
    })
    .slice(0, 3)
})

const facts = computed(() => {
  const p = product.value
  if (!p) return []
  const a = p.attrs
  const rows: { label: string; value: string }[] = []
  const add = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return
    rows.push({ label, value: String(value) })
  }
  if (p.category === 'cpu') {
    add('插槽 / SOCKET', a.socket)
    add('核心 / 线程', a.cores && a.threads ? `${a.cores}C / ${a.threads}T` : a.cores)
    add('频率 / CLOCK', a.baseClock || a.boostClock ? `${a.baseClock ?? '—'} / ${a.boostClock ?? '—'} GHz` : undefined)
    add('三级缓存', a.cacheMb ? `${a.cacheMb} MB` : undefined)
    add('内存支持', a.memoryType ? `${a.memoryType} · ${a.memoryMaxSpeed ?? a.memorySpeed ?? '—'} MT/s` : '—')
    add('TDP / PEAK', a.tdp ? `${a.tdp}W / ${a.peakPower ?? a.tdp}W` : '—')
  } else if (p.category === 'gpu') {
    add('图形核心', a.gpuChip)
    add('显存', a.vramGb ? `${a.vramGb} GB ${a.memoryType ?? ''}` : undefined)
    add('卡长 / 厚度', a.lengthMm ? `${a.lengthMm} mm / ${a.thicknessSlots ?? 2} slot` : undefined)
    add('整卡功耗', a.tdp ? `${a.tdp}W / ${a.peakPower ?? a.tdp}W` : undefined)
    add('供电接口', a.pcie12vhpwr ? `12VHPWR ×${a.pcie12vhpwr}` : a.pcie8 ? `PCIe 8pin ×${a.pcie8}` : '—')
    add('加速频率', a.boostClock ? `${a.boostClock} GHz` : undefined)
  } else if (p.category === 'motherboard') {
    add('插槽 / 芯片组', `${a.socket ?? '—'} / ${a.chipset ?? '—'}`)
    add('板型', a.formFactor)
    add('内存', a.memoryType ? `${a.memoryType} · ${a.memorySlots ?? 2} DIMM · ${a.memoryCapacity ?? '—'}GB` : '—')
    add('M.2 / SATA', `${a.m2Slots ?? 0} / ${a.sataPorts ?? 0}`)
    add('PCIe 插槽', a.pcieSlots)
    add('网络', [a.wifi, a.lan].filter(Boolean).join(' · ') || '—')
  } else if (p.category === 'memory') {
    add('代际 / 容量', `${a.memoryType ?? '—'} · ${a.memoryCapacity ?? '—'} GB`)
    add('套装', a.memorySticks ? `${a.memorySticks} × ${Math.round((a.memoryCapacity ?? 0) / a.memorySticks)} GB` : undefined)
    add('频率 / 时序', `${a.memorySpeed ?? '—'} MT/s · CL${a.casLatency ?? '—'}`)
    add('模组高度', a.heightMm ? `${a.heightMm} mm` : undefined)
    add('灯光', a.rgb ? 'ARGB' : '无')
  } else if (p.category === 'psu') {
    add('额定功率', a.wattage ? `${a.wattage} W` : undefined)
    add('认证', a.efficiency)
    add('ATX 规范', a.atxVersion)
    add('模组', a.modular)
    add('供电接口', `8pin ×${a.pcie8 ?? 0} · 12VHPWR ×${a.pcie12vhpwr ?? 0}`)
    add('长度', a.lengthMm ? `${a.lengthMm} mm` : undefined)
  } else if (p.category === 'cooler') {
    add('类型', a.coolerType === 'aio' ? '一体式水冷' : a.coolerType === 'air' ? '风冷' : '原装')
    add('解热能力', a.coolerTdp ? `${a.coolerTdp} W` : undefined)
    add('高度 / 冷排', a.coolerHeightMm ? `${a.coolerHeightMm} mm` : a.radiatorSize)
    add('支持插槽', a.cpuSockets?.join(' / '))
  } else if (p.category === 'case') {
    add('板型支持', a.supportedFormFactors?.join(' / '))
    add('最大显卡', a.maxGpuLengthMm ? `${a.maxGpuLengthMm} mm` : undefined)
    add('最大风冷', a.maxCoolerHeightMm ? `${a.maxCoolerHeightMm} mm` : undefined)
    add('冷排支持', a.radiatorSupport?.join(' / '))
    add('风扇位', a.fanSlots)
    add('硬盘位', `${a.driveBays35 ?? 0} × 3.5" / ${a.driveBays25 ?? 0} × 2.5"`)
  } else if (p.category === 'ssd' || p.category === 'hdd') {
    add('容量', a.capacityGb ? `${a.capacityGb} GB` : undefined)
    add('接口', a.interface)
    add('顺序读取', a.readMbps ? `${a.readMbps} MB/s` : undefined)
    add('顺序写入', a.writeMbps ? `${a.writeMbps} MB/s` : undefined)
    add('转速', a.rpm ? `${a.rpm} RPM` : undefined)
    add('功耗', a.tdp ? `${a.tdp} W` : undefined)
  } else if (p.category === 'fan') {
    add('尺寸', a.fanSizeMm ? `${a.fanSizeMm} mm` : undefined)
    add('转速', a.rpm ? `${a.rpm} RPM` : undefined)
    add('接口', a.interface)
    add('灯光', a.rgb ? 'ARGB' : '无')
    add('功耗', a.tdp ? `${a.tdp} W` : undefined)
  } else {
    add('类型', a.type)
    add('接口', a.interface)
    add('功耗', a.tdp ? `${a.tdp} W` : undefined)
  }
  return rows.filter((r) => r.value && r.value !== 'undefined')
})

const specRows = computed(() => (product.value ? Object.entries(product.value.specs) : []))

const customization = computed<PartCustomization | null>(() => (category.value ? store.customizationFor(category.value) : null))
const isCustomized = computed(() => Boolean(category.value && store.customizations[category.value]))
const customSurface = computed(() => {
  const surfaces: Record<Category, string> = {
    cpu: '处理器顶盖',
    motherboard: '主板屏蔽层',
    gpu: '显卡背板',
    memory: '内存马甲',
    ssd: '固态硬盘马甲',
    hdd: '机械硬盘外壳',
    psu: '电源外壳',
    cooler: '散热器顶盖',
    case: '钢化玻璃侧板',
    fan: '前置风扇框',
    expansion: '扩展卡外壳',
  }
  return category.value ? surfaces[category.value] : '—'
})

function updateCustomization(patch: Partial<PartCustomization>) {
  if (!category.value) return
  store.updateCustomization(category.value, patch)
}

function openFilePicker() {
  fileInput.value?.click()
}

function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('仅支持图片文件'))
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('图片不能超过 8MB'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('图片解析失败'))
      image.onload = () => {
        const max = 640
        const scale = Math.min(1, max / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('无法创建图片画布'))
          return
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.84))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

async function onImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  imageBusy.value = true
  try {
    const imageData = await downscaleImage(file)
    updateCustomization({ imageData })
  } catch (error) {
    toast.error('图案导入失败', error instanceof Error ? error.message : '未知错误')
  } finally {
    imageBusy.value = false
  }
}

function clearImage() {
  updateCustomization({ imageData: undefined })
}

function install() {
  if (!product.value) return
  store.installProduct(product.value)
}

function remove() {
  if (!category.value) return
  store.removeProduct(category.value)
}

function focus() {
  if (!category.value) return
  store.focusPart(CATEGORY_SCENE_ID[category.value])
}

function isolate() {
  if (!sceneId.value) return
  store.isolatePart(sceneId.value)
}

function toggleHide() {
  if (!category.value) return
  store.toggleCategoryVisibility(category.value)
}

function openProductUrl() {
  const url = quote.value?.sourceUrl
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <aside class="inspector hud-panel">
    <div class="panel-head inspector-head">
      <div>
        <span class="panel-kicker">当前选择</span>
        <h2>组件信息</h2>
      </div>
      <span v-if="meta" class="head-badge">{{ meta.label }}</span>
    </div>

    <template v-if="product">
      <div ref="scrollHost" class="inspector-scroll">
        <div class="inspector-hero" :class="{ 'inspector-hero--render': partImage }">
          <img v-if="partImage" class="part-render" :src="partImage" :alt="`${meta?.label} ${product.brand} ${product.model} 3D 模型`" />
          <PartGlyph v-else :category="product.category" :product="product" />
          <span class="hero-caption">{{ meta?.label }} · 装配模型</span>
        </div>

        <div class="inspector-title">
          <div class="title-index">{{ meta?.index }}</div>
          <div class="title-copy">
            <div class="title-brand">{{ meta?.label }} · {{ product.brand }} <span>/ {{ product.status === 'eol' ? '已停产' : product.status === 'upcoming' ? '即将上市' : '在售' }}</span></div>
            <h3>{{ product.model }}</h3>
            <p>{{ product.tagline }}</p>
          </div>
        </div>

        <div class="install-banner" :class="installed ? 'install-banner--on' : ''">
          <span class="install-banner__icon">
            <PackageCheck v-if="installed" :size="15" />
            <Plus v-else :size="15" />
          </span>
          <span>
            <strong>{{ installed ? '当前配置已安装' : '尚未装入当前配置' }}</strong>
            <em>{{ installed ? '更换同类别型号将实时重算兼容性' : '装载后立即更新 3D、价格与功耗' }}</em>
          </span>
        </div>

        <div class="action-grid">
          <button type="button" class="forge-btn forge-btn--primary" @click="install">
            <RefreshCw v-if="installed" :size="13" />
            <Plus v-else :size="13" />
            {{ installed ? '重新装载' : '装载组件' }}
          </button>
          <button type="button" class="forge-btn" :disabled="!installed" @click="remove">
            <Trash2 :size="13" /> 移除
          </button>
          <button type="button" class="forge-btn" :disabled="!installed" @click="focus">
            <Focus :size="13" /> 定位
          </button>
          <button type="button" class="forge-btn" :disabled="!installed" @click="isolate">
            <Crosshair :size="13" /> 隔离
          </button>
          <button type="button" class="forge-btn" :disabled="!installed || !category" @click="category && store.toggleDetach(category)">
            <Maximize2 :size="13" /> {{ detached ? '归位' : '分离' }}
          </button>
          <button type="button" class="forge-btn" :disabled="!installed" @click="toggleHide">
            <EyeOff v-if="hidden" :size="13" />
            <Eye v-else :size="13" />
            {{ hidden ? '显示' : '隐藏' }}
          </button>
        </div>

        <div class="inspector-tabs" role="tablist" aria-label="组件信息分类">
          <button type="button" :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">概览</button>
          <button type="button" :class="{ active: activeTab === 'specs' }" @click="activeTab = 'specs'">技术参数</button>
          <button type="button" :class="{ active: activeTab === 'compat' }" @click="activeTab = 'compat'">兼容性</button>
          <button type="button" :class="{ active: activeTab === 'price' }" @click="activeTab = 'price'">市场价格</button>
        </div>

        <section v-if="category && activeTab === 'overview'" class="inspect-section custom-studio">
          <div class="section-title">
            <span><ImagePlus :size="12" /> 自定义图案涂装</span>
            <span class="custom-surface-tag">{{ customSurface }}</span>
          </div>

          <div class="custom-art">
            <div v-if="customization?.imageData" class="custom-art__preview">
              <img :src="customization.imageData" alt="自定义图案预览" />
              <button type="button" class="custom-art__remove" @click="clearImage"><Trash2 :size="11" /> 移除图片</button>
            </div>
            <button v-else type="button" class="custom-art__drop" :disabled="imageBusy" @click="openFilePicker">
              <ImagePlus :size="18" />
              <span>{{ imageBusy ? '正在处理…' : '上传自定义图案 / 照片' }}</span>
              <em>支持 JPG · PNG · WEBP（实时映射到 {{ customSurface }}）</em>
            </button>
            <input ref="fileInput" type="file" accept="image/*" hidden @change="onImageUpload" />
          </div>
        </section>

        <section v-show="activeTab === 'price'" class="inspect-section">
          <div class="section-title">
            <span>参考价格</span>
            <span class="price-state" :class="`price-state--${priceStatus}`">{{ priceStateLabel }}</span>
          </div>
          <div class="price-main">
            <div>
              <strong>{{ formatPrice(quote?.value ?? null) }}</strong>
              <em v-if="quote?.condition === 'used'">二手参考价</em>
              <em v-else>人民币含税参考价</em>
            </div>
            <div class="price-range">
              <span>最低 {{ formatPrice(quote?.min ?? null) }}</span>
              <span>最高 {{ formatPrice(quote?.max ?? null) }}</span>
            </div>
          </div>

          <div v-if="spark" class="sparkline">
            <div class="spark-head">
              <span>30 天归档趋势</span>
              <strong :class="spark.delta <= 0 ? 'delta-down' : 'delta-up'">
                {{ spark.delta <= 0 ? '▼' : '▲' }} {{ formatPrice(Math.abs(spark.delta)) }}
              </strong>
            </div>
            <svg viewBox="0 0 220 50" preserveAspectRatio="none" aria-label="价格归档趋势">
              <defs>
                <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#7fa8bd" stop-opacity=".28" />
                  <stop offset="100%" stop-color="#7fa8bd" stop-opacity="0" />
                </linearGradient>
              </defs>
              <polyline :points="spark.points" fill="none" stroke="#7fa8bd" stroke-width="1.4" vector-effect="non-scaling-stroke" />
              <polygon :points="`0,50 ${spark.points} 220,50`" fill="url(#sparkFill)" />
            </svg>
          </div>

          <div class="price-meta">
            <button type="button" class="price-source" @click="openProductUrl">
              <span>来源 · {{ quote?.source ?? '暂无可靠报价' }}</span>
              <ArrowRight :size="11" />
            </button>
            <span><Clock3 :size="11" /> 更新 {{ quote?.updatedAt?.slice(0, 10) ?? '—' }} <em v-if="age !== null">({{ age }} 天前)</em></span>
          </div>
          <p v-if="quote?.snapshot?.note" class="price-note">{{ quote.snapshot.note }}</p>
          <div v-if="product.usedPrice" class="used-price">
            <span>二手参考</span>
            <strong>{{ formatPrice(product.usedPrice) }}</strong>
            <em>仅在智能配机允许二手时计入</em>
          </div>
        </section>

        <section v-show="activeTab === 'specs'" class="inspect-section">
          <div class="section-title">
            <span>关键规格</span>
            <span>{{ facts.length }} 项</span>
          </div>
          <div class="fact-grid">
            <div v-for="fact in facts" :key="fact.label" class="fact-cell">
              <span>{{ fact.label }}</span>
              <strong>{{ fact.value }}</strong>
            </div>
          </div>
          <p class="product-desc">{{ product.description }}</p>
        </section>

        <section v-show="activeTab === 'compat'" class="inspect-section">
          <div class="section-title">
            <span>兼容检测</span>
            <span class="compat-pill" :class="`compat-pill--${previewReport.status}`">
              <ShieldCheck v-if="previewReport.status === 'pass'" :size="11" />
              <TriangleAlert v-else :size="11" />
              {{ statusLabel }}
            </span>
          </div>
          <div v-if="!installed" class="preview-note">
            <AlertTriangle :size="12" /> 以下为替换预览，尚未写入当前配置。
          </div>
          <div v-if="relevantIssues.length" class="issue-list">
            <div v-for="issue in relevantIssues" :key="issue.id" class="issue-row" :class="`issue-row--${issue.level}`">
              <span class="issue-icon">
                <Check v-if="issue.level === 'ok'" :size="11" />
                <AlertTriangle v-else :size="11" />
              </span>
              <span>
                <strong>{{ issue.title }}</strong>
                <em>{{ issue.detail }}</em>
              </span>
            </div>
          </div>
          <div v-else class="compat-pass">
            <ShieldCheck :size="16" />
            <span>当前组合未发现插槽、尺寸、供电或接口冲突。</span>
          </div>
          <div class="compat-score">
            <span>兼容评分</span>
            <div class="score-track"><i :style="{ width: `${previewReport.score}%` }"></i></div>
            <strong>{{ previewReport.score }}</strong>
          </div>
        </section>

        <section v-if="product.workloads" v-show="activeTab === 'compat'" class="inspect-section workload-section">
          <div class="section-title">
            <span>适用负载</span>
            <span class="workload-context">{{ product.workloads.badge }}</span>
          </div>
          <p class="workload-tier-title">{{ product.workloads.tier }}</p>
          <p class="workload-summary">{{ product.workloads.summary }}</p>

          <div v-if="product.workloads.games?.length" class="workload-row">
            <Gamepad2 :size="14" class="workload-icon" />
            <div>
              <strong>游戏表现</strong>
              <ul class="workload-list">
                <li v-for="(game, gIdx) in product.workloads.games" :key="gIdx">{{ game }}</li>
              </ul>
            </div>
          </div>

          <div v-if="product.workloads.productivity?.length" class="workload-row">
            <Clapperboard :size="14" class="workload-icon" />
            <div>
              <strong>生产与创作</strong>
              <ul class="workload-list">
                <li v-for="(task, tIdx) in product.workloads.productivity" :key="tIdx">{{ task }}</li>
              </ul>
            </div>
          </div>
        </section>

        <section v-show="activeTab === 'specs'" class="inspect-section">
          <div class="section-title">
            <span>性能参考</span>
            <span>综合 {{ product.performance.index }}</span>
          </div>
          <div class="perf-bars">
            <div v-for="bar in [
              { label: '游戏', value: product.performance.gaming },
              { label: '生产力', value: product.performance.productivity },
              { label: '单核', value: product.performance.single },
              { label: '多核', value: product.performance.multi },
            ]" :key="bar.label" class="perf-row">
              <span>{{ bar.label }}</span>
              <div class="perf-track"><i :style="{ width: `${bar.value}%` }"></i></div>
              <strong>{{ bar.value }}</strong>
            </div>
          </div>
          <div class="power-line">
            <Zap :size="12" />
            <span>组件功耗</span>
            <strong>{{ product.attrs.peakPower ?? product.attrs.tdp ?? '—' }} W</strong>
            <span class="power-line__sep">·</span>
            <Gauge :size="12" />
            <span>整机峰值</span>
            <strong>{{ store.metrics.power.peak }} W</strong>
          </div>
        </section>

        <section v-if="specRows.length" v-show="activeTab === 'specs'" class="inspect-section">
          <div class="section-title">
            <span>完整参数</span>
            <span>SKU {{ product.sku }}</span>
          </div>
          <div class="spec-table">
            <div v-for="[key, value] in specRows" :key="key" class="spec-row">
              <span>{{ key }}</span>
              <strong>{{ value }}</strong>
            </div>
          </div>
        </section>

        <section v-if="alternatives.length" v-show="activeTab === 'overview'" class="inspect-section">
          <div class="section-title">
            <span>替换推荐</span>
            <span>兼容优先</span>
          </div>
          <div class="alt-list">
            <button v-for="alt in alternatives" :key="alt.product.id" type="button" class="alt-row" @click="store.inspectProduct(alt.product.id)">
              <span class="alt-code">{{ categoryMeta(alt.product.category).short }}</span>
              <span class="alt-copy">
                <strong>{{ alt.product.brand }} {{ alt.product.model }}</strong>
                <em>PF {{ alt.product.performance.index }} · {{ alt.product.tagline }}</em>
              </span>
              <span class="alt-price">{{ formatPrice(alt.quote?.value ?? null) }}</span>
              <ArrowRight :size="12" />
            </button>
          </div>
        </section>
      </div>
    </template>

    <template v-else>
      <div class="inspector-empty">
        <div class="empty-orbit">
          <span></span><span></span><span></span>
          <Box :size="38" />
        </div>
        <h3>未选择组件</h3>
        <p>从左侧结构树选择硬件，或在 3D 场景中点击部件。检查器将显示完整规格、市场价格与兼容推断。</p>
        <div class="empty-stats">
          <div><span>已装组件</span><strong>{{ store.installedCount }}</strong></div>
          <div><span>整机功率</span><strong>{{ store.metrics.power.peak }}W</strong></div>
          <div><span>兼容评分</span><strong>{{ store.compatibility.score }}</strong></div>
        </div>
        <div v-if="store.compatibility.errors.length" class="empty-alert">
          <Layers :size="14" />
          <span>{{ store.compatibility.errors[0].title }} — {{ store.compatibility.errors[0].detail }}</span>
        </div>
      </div>
    </template>
  </aside>
</template>
