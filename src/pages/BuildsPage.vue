<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  Copy,
  Cpu,
  Database,
  Download,
  FileText,
  Gauge,
  GitCompare,
  Layers,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-vue-next'
import ChartPanel from '../components/ChartPanel.vue'
import ImportDialog from '../components/ImportDialog.vue'
import { useBuildStore } from '../stores/build'
import { useToastStore } from '../stores/toast'
import { CORE_CATEGORIES, CATEGORY_META, categoryMeta } from '../data/meta'
import { computeMetrics } from '../services/metrics'
import { evaluateCompatibility } from '../services/compatibility'
import { effectiveQuote, formatPrice, productPrice, selectionRange } from '../services/pricing'
import { exportCsv, exportJson, exportPdf } from '../services/export'
import type { ExportPayload } from '../services/export'
import type { BuildSelection, Category, SavedBuild } from '../types'
import type { EChartsOption } from 'echarts'

const store = useBuildStore()
const toast = useToastStore()
const name = ref('')
const note = ref('')
const editingId = ref<string | null>(null)
const editName = ref('')
const editNote = ref('')
const importOpen = ref(false)
const simCategory = ref<'gpu' | 'cpu' | 'memory'>('gpu')
const simProductId = ref<string | null>(null)

const compatibilityLabel = computed(() => {
  const status = store.compatibility.status
  return status === 'pass' ? '兼容通过' : status === 'caution' ? '存在风险' : '硬性冲突'
})
function compatLabel(status: string) {
  return status === 'pass' ? '兼容通过' : status === 'caution' ? '存在风险' : '存在冲突'
}

const budgetDelta = computed(() => store.request.budget - store.total)
const budgetFill = computed(() => Math.min(100, Math.round((store.total / Math.max(1, store.request.budget)) * 100)))
const priceRange = computed(() => selectionRange(store.selection, store.byId, store.quantities, store.request.allowUsed))

/** 每一万元能买到多少性能指数，用来给“值不值”一个直观数字。 */
function valuePerWan(perf: number, total: number): number {
  if (!total) return 0
  return Math.round((perf / (total / 10000)) * 10) / 10
}
const currentValue = computed(() => valuePerWan(store.metrics.performance.index, store.total))

const currentSelection = computed(() =>
  CORE_CATEGORIES.filter((c) => store.selection[c]).map((c) => ({
    category: c,
    product: store.byId.get(store.selection[c] as string),
  })),
)

const diagnosisCategory = ref<Category | null>(null)
const diagnosisIssues = computed(() => store.compatibility.issues.filter((issue) => issue.level !== 'ok'))
const diagnosisPasses = computed(() => store.compatibility.passes.slice(0, 8))
const diagnosisLabel = computed(() => (diagnosisCategory.value ? categoryMeta(diagnosisCategory.value).label : ''))
const diagnosisTarget = computed(() => {
  const category = diagnosisCategory.value
  return category && store.selection[category]
    ? store.byId.get(store.selection[category] as string)?.performance.index ?? 0
    : 0
})
const diagnosisOptions = computed(() => {
  const category = diagnosisCategory.value
  if (!category) return []
  return store.allProducts
    .filter((product) => product.category === category && product.id !== store.selection[category])
    .map((product) => {
      const report = evaluateCompatibility({ ...store.selection, [category]: product.id }, store.byId, store.quantities)
      return { product, report, price: productPrice(product, store.request.allowUsed) }
    })
    .filter((option) => option.price != null && option.report.status !== 'blocked')
    .sort((a, b) => {
      const passDelta = Number(b.report.status === 'pass') - Number(a.report.status === 'pass')
      if (passDelta !== 0) return passDelta
      const perfDelta =
        Math.abs(a.product.performance.index - diagnosisTarget.value) -
        Math.abs(b.product.performance.index - diagnosisTarget.value)
      if (perfDelta !== 0) return perfDelta
      return (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER)
    })
    .slice(0, 6)
})

function openDiagnosis(category: Category) {
  diagnosisCategory.value = diagnosisCategory.value === category ? null : category
}

function applyDiagnosis(product: (typeof store.allProducts)[number]) {
  store.installProduct(product)
  diagnosisCategory.value = null
  toast.success('已替换组件', `${product.brand} ${product.model}`)
}

const simOptions = computed(() => {
  return store.allProducts
    .filter((p) => p.category === simCategory.value && p.id !== store.selection[simCategory.value] && p.price?.reference)
    .map((product) => {
      const report = evaluateCompatibility(
        { ...store.selection, [simCategory.value]: product.id },
        store.byId,
        store.quantities,
      )
      return { product, report }
    })
    .filter((x) => x.report.status !== 'blocked')
    .sort((a, b) => b.product.performance.index - a.product.performance.index)
    .slice(0, 6)
})

watch(
  simCategory,
  () => {
    simProductId.value = simOptions.value[0]?.product.id ?? null
  },
  { immediate: true },
)

const simProduct = computed(() => (simProductId.value ? store.byId.get(simProductId.value) : undefined))
const simSelection = computed<BuildSelection>(() => ({ ...store.selection, [simCategory.value]: simProductId.value }))
const simMetrics = computed(() => computeMetrics(simSelection.value, store.byId, store.quantities, store.request.allowUsed))
const simReport = computed(() => evaluateCompatibility(simSelection.value, store.byId, store.quantities))
const simDelta = computed(() => ({
  total: simMetrics.value.total - store.total,
  performance: simMetrics.value.performance.index - store.metrics.performance.index,
  gaming: simMetrics.value.performance.gaming - store.metrics.performance.gaming,
  power: simMetrics.value.power.peak - store.metrics.power.peak,
}))
const simValue = computed(() => valuePerWan(simMetrics.value.performance.index, simMetrics.value.total))
/** 升级预览里要讲清楚“风险到底是什么”，所以带上 issue 的 detail 一起显示。 */
const simIssues = computed(() => {
  const list = simReport.value.errors.length ? simReport.value.errors : simReport.value.warnings
  return list.slice(0, 3).map((issue) => ({ title: issue.title, detail: issue.detail }))
})

type ChartPoint = {
  name: string
  value: [number, number, number]
  kind: 'upgrade' | 'pass' | 'caution' | 'blocked' | 'current'
  category?: Category
  /** 具体的风险/冲突原因，避免只写“存在风险”而说不清风险是什么。 */
  risks?: string[]
}

/** 把兼容报告里的问题压缩成一句人话，最多 3 条，供图表、卡片、升级预览共用。 */
function riskText(report: { errors: { title: string }[]; warnings: { title: string }[] }): string[] {
  const list = report.errors.length ? report.errors : report.warnings
  return list.slice(0, 3).map((issue) => issue.title)
}

/**
 * 升级候选云：显卡 / CPU 里兼容、且性能高于当前件的型号，按“每万元性能”挑前 7 个。
 * 有了这层点，散点图才不是孤零零一个点，用户能看到“再花多少钱能换多少性能”。
 */
const upgradeCandidates = computed(() => {
  const picked: {
    category: Category
    product: (typeof store.allProducts)[number]
    total: number
    performance: number
    power: number
    value: number
    risks: string[]
  }[] = []
  for (const category of ['gpu', 'cpu'] as Category[]) {
    const installed = store.selection[category] ? store.byId.get(store.selection[category] as string) : undefined
    const basePerformance = installed?.performance.index ?? 0
    const pool = store.allProducts
      .filter(
        (product) =>
          product.category === category &&
          product.id !== store.selection[category] &&
          product.performance.index > basePerformance &&
          productPrice(product, store.request.allowUsed) != null,
      )
      .map((product) => {
        const price = productPrice(product, store.request.allowUsed) ?? 0
        return { product, price, ratio: price ? product.performance.index / price : 0 }
      })
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 26)

    let kept = 0
    for (const entry of pool) {
      if (kept >= 7) break
      const selection = { ...store.selection, [category]: entry.product.id }
      const report = evaluateCompatibility(selection, store.byId, store.quantities)
      if (report.status === 'blocked') continue
      const metrics = computeMetrics(selection, store.byId, store.quantities, store.request.allowUsed)
      if (!metrics.total) continue
      picked.push({
        category,
        product: entry.product,
        total: metrics.total,
        performance: metrics.performance.index,
        power: metrics.power.peak,
        value: valuePerWan(metrics.performance.index, metrics.total),
        risks: riskText(report),
      })
      kept += 1
    }
  }
  return picked
})

const chartPoints = computed<ChartPoint[]>(() => {
  const points: ChartPoint[] = upgradeCandidates.value.map((entry) => ({
    name: `${categoryMeta(entry.category).short} · ${entry.product.model}`,
    value: [Math.round(entry.total), Math.round(entry.performance), entry.power],
    kind: 'upgrade',
    category: entry.category,
    risks: entry.risks,
  }))
  for (const build of store.savedBuilds) {
    const report = evaluateCompatibility(build.selection, store.byId, build.quantities)
    points.push({
      name: build.name,
      value: [build.total, build.performance, build.power],
      kind: build.compatibility === 'pass' ? 'pass' : build.compatibility === 'caution' ? 'caution' : 'blocked',
      risks: riskText(report),
    })
  }
  points.push({
    name: '当前配置',
    value: [store.total, Math.round(store.metrics.performance.index), store.metrics.power.peak],
    kind: 'current',
  })
  return points
})

const bestValueUpgrade = computed(() => {
  const sorted = [...upgradeCandidates.value].sort((a, b) => b.value - a.value)
  return sorted[0]
})

/** 已保存方案的风险原因（保存时只存了状态，具体问题按当前配件表重新算）。 */
const savedRisks = computed(() => {
  const map = new Map<string, { status: string; risks: string[] }>()
  for (const build of store.savedBuilds) {
    const report = evaluateCompatibility(build.selection, store.byId, build.quantities)
    map.set(build.id, { status: report.status, risks: riskText(report) })
  }
  return map
})

const chartRange = computed(() => {
  const prices = chartPoints.value.map((point) => point.value[0]).filter((v) => v > 0)
  const perfs = chartPoints.value.map((point) => point.value[1]).filter((v) => v > 0)
  const maxPrice = Math.max(store.request.budget, ...prices, 12000)
  const minPrice = Math.min(...prices)
  const maxPerf = Math.max(60, ...perfs)
  const yMax = Math.min(100, Math.ceil((maxPerf * 1.12) / 5) * 5)
  // 价格低于 6k 时保留原点，否则把左边界收到数据区，避免所有点挤在右侧。
  const xMin = minPrice > 6000 ? Math.max(0, Math.floor((minPrice * 0.88) / 1000) * 1000) : 0
  return {
    x: { min: xMin, max: Math.ceil((maxPrice * 1.08) / 1000) * 1000 },
    y: { min: 0, max: yMax },
  }
})

const scatterOption = computed<EChartsOption>(() => {
  const range = chartRange.value
  const points = chartPoints.value
  const upgradeData = points.filter((point) => point.kind === 'upgrade')
  const savedData = points.filter((point) => point.kind !== 'upgrade' && point.kind !== 'current')
  const currentData = points.filter((point) => point.kind === 'current')

  return {
    backgroundColor: 'transparent',
    animationDuration: 420,
    grid: { left: 48, right: 24, top: 26, bottom: 42 },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#101a23',
      borderColor: '#2c3a46',
      padding: [9, 12],
      textStyle: { color: '#e3e9ee', fontSize: 12 },
      formatter: (params: unknown) => {
        const point = (params as { data: ChartPoint }).data
        if (!point) return ''
        const [price, performance] = point.value
        const label =
          point.kind === 'upgrade' ? '升级候选' : point.kind === 'current' ? '当前方案' : compatLabel(typeToStatus(point.kind))
        const lines = [
          `<strong>${point.name}</strong>`,
          `${label}`,
          `整机价格 ¥${price.toLocaleString('zh-CN')}`,
          `性能指数 ${performance}`,
          `每万元性能 ${valuePerWan(performance, price)}`,
        ]
        if (point.risks?.length) {
          lines.push(
            `<span style="color:${point.kind === 'blocked' ? '#d4776b' : '#d2a45f'}">${
              point.kind === 'blocked' ? '冲突' : '风险'
            }：${point.risks.join('；')}</span>`,
          )
        }
        return lines.join('<br/>')
      },
    },
    xAxis: {
      type: 'value',
      min: range.x.min,
      max: range.x.max,
      name: '整机价格 ¥',
      nameGap: 24,
      nameTextStyle: { color: '#71808d', fontSize: 10, align: 'left' },
      axisLine: { lineStyle: { color: '#26323d' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#8b9aa6',
        fontSize: 10,
        formatter: (v: number) => (v === 0 ? '0' : `${Math.round(v / 1000)}k`),
      },
      splitLine: { lineStyle: { color: 'rgba(148,163,178,.10)' } },
    },
    yAxis: {
      type: 'value',
      min: range.y.min,
      max: range.y.max,
      name: '性能指数',
      nameTextStyle: { color: '#71808d', fontSize: 10, align: 'left' },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#8b9aa6', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(148,163,178,.10)' } },
    },
    series: [
      {
        name: '升级候选',
        type: 'scatter',
        symbolSize: 8,
        itemStyle: { color: 'rgba(127,168,189,.42)', borderColor: 'rgba(168,216,229,.34)', borderWidth: 1 },
        emphasis: { scale: 1.6, itemStyle: { color: 'rgba(168,216,229,.85)' } },
        data: upgradeData,
      },
      {
        name: '已保存方案',
        type: 'scatter',
        symbolSize: 12,
        itemStyle: { borderColor: 'rgba(10,16,22,.9)', borderWidth: 2 },
        data: savedData.map((point) => ({
          ...point,
          itemStyle: {
            color:
              point.kind === 'pass' ? '#7fa8bd' : point.kind === 'caution' ? '#d2a45f' : '#d4776b',
          },
        })),
        label: {
          show: true,
          position: 'top',
          distance: 6,
          formatter: (params: unknown) => (params as { data: ChartPoint }).data.name,
          color: '#c3cfd8',
          fontSize: 10,
        },
      },
      {
        name: '当前配置',
        type: 'scatter',
        symbolSize: 16,
        itemStyle: { color: '#d9a066', borderColor: '#0a1016', borderWidth: 2 },
        data: currentData,
        label: {
          show: true,
          position: 'left',
          distance: 10,
          formatter: '当前配置',
          color: '#ecd3b4',
          fontSize: 11,
          fontWeight: 'bold',
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: 'rgba(210,164,95,.42)', type: 'dashed', width: 1 },
          label: {
            formatter: `预算 ${formatPrice(store.request.budget)}`,
            color: '#d2a45f',
            fontSize: 10,
            rotate: 0,
            position: 'insideStartTop',
            distance: 4,
          },
          data: [{ xAxis: store.request.budget }],
        },
      },
    ],
  }
})

function typeToStatus(kind: ChartPoint['kind']): 'pass' | 'caution' | 'blocked' {
  if (kind === 'caution') return 'caution'
  if (kind === 'blocked') return 'blocked'
  return 'pass'
}

const compareModels = computed(() => {
  return CATEGORY_META.map((meta) => {
    const cells = store.comparedBuilds.map((build) => {
      const id = build.selection[meta.id]
      return id ? store.byId.get(id) : undefined
    })
    return { meta, cells }
  }).filter((row) => row.cells.some(Boolean))
})

function payloadForSelection(selection: BuildSelection, quantities: Record<string, number>, label: string): ExportPayload {
  const metrics = computeMetrics(selection, store.byId, quantities, store.request.allowUsed)
  const report = evaluateCompatibility(selection, store.byId, quantities)
  const lines = Object.entries(selection)
    .filter(([, id]) => Boolean(id))
    .map(([cat, id]) => {
      const product = id ? store.byId.get(id) : undefined
      const qty = cat === 'fan' ? Math.max(1, quantities.fan ?? 1) : 1
      return {
        category: categoryMeta(cat as Category).label,
        model: product ? `${product.brand} ${product.model}${qty > 1 ? ` × ${qty}` : ''}` : '未知型号',
        price: product ? (productPrice(product, store.request.allowUsed) ?? 0) * qty : null,
        condition: '全新 / 归档参考',
        reason: '',
      }
    })
  return {
    name: label,
    lines,
    total: metrics.total,
    budget: store.request.budget,
    power: metrics.power,
    performance: {
      index: Math.round(metrics.performance.index),
      gaming: Math.round(metrics.performance.gaming),
      productivity: Math.round(metrics.performance.productivity),
      balance: Math.round(metrics.performance.balance),
    },
    compatibility: report.status === 'pass' ? '兼容通过' : report.status === 'caution' ? '存在风险' : '硬性冲突',
    notes: ['价格来自公开渠道归档样本或用户导入数据，非实时成交价。'],
  }
}

function saveCurrent() {
  const saved = store.saveBuild(name.value, note.value)
  if (saved) {
    name.value = ''
    note.value = ''
  }
}

function exportCurrentCsv() {
  exportCsv(payloadForSelection(store.selection, store.quantities, name.value || 'PC FORGE 当前配置'))
  toast.success('当前配置 CSV 已导出')
}

async function exportCurrentPdf() {
  try {
    await exportPdf(payloadForSelection(store.selection, store.quantities, name.value || 'PC FORGE 当前配置'))
    toast.success('当前配置 PDF 已导出')
  } catch (error) {
    toast.error('PDF 导出失败', (error as Error).message)
  }
}

function exportSaved(entry: SavedBuild, format: 'csv' | 'pdf') {
  const payload = payloadForSelection(entry.selection, entry.quantities, entry.name)
  if (format === 'csv') {
    exportCsv(payload)
    toast.success('配置 CSV 已导出', entry.name)
  } else {
    exportPdf(payload)
      .then(() => toast.success('配置 PDF 已导出', entry.name))
      .catch((error: Error) => toast.error('PDF 导出失败', error.message))
  }
}

function startEdit(entry: SavedBuild) {
  editingId.value = entry.id
  editName.value = entry.name
  editNote.value = entry.note
}

function commitEdit() {
  if (!editingId.value) return
  store.renameSavedBuild(editingId.value, editName.value, editNote.value)
  editingId.value = null
}

function remove(entry: SavedBuild) {
  if (window.confirm(`删除配置「${entry.name}」？此操作不可撤销。`)) {
    store.deleteSavedBuild(entry.id)
  }
}

function applyUpgrade() {
  if (!simProduct.value) return
  store.installProduct(simProduct.value)
  store.inspectProduct(simProduct.value.id)
  toast.success('升级模拟已应用到当前配置', simProduct.value.model)
}

function backupAll() {
  exportJson('pc-forge-builds-backup', {
    app: 'PC FORGE',
    version: 1,
    exportedAt: new Date().toISOString(),
    builds: store.savedBuilds,
    customProducts: store.customProducts,
  })
  toast.success('配置与自定义产品备份已导出')
}

function resetCurrent() {
  store.resetToDefault()
  toast.info('已恢复默认配置', '可在 3D 实验室继续调整')
}
</script>

<template>
  <div class="page-shell builds-page">
    <header class="page-head">
      <div>
        <span class="panel-kicker"><Layers :size="11" /> 保存与比较</span>
        <h1>配置方案</h1>
        <p>保存、比较、升级模拟与导出。方案保存在本机，刷新页面后仍可恢复。</p>
      </div>
      <div class="page-head-stats">
        <div><span>已保存</span><strong>{{ store.savedBuilds.length }}</strong></div>
        <div><span>比较</span><strong>{{ store.compareIds.length }} / 3</strong></div>
        <div><span>自定义配件</span><strong>{{ store.customProducts.length }}</strong></div>
        <div><span>当前总价</span><strong>{{ formatPrice(store.total) }}</strong></div>
      </div>
    </header>

    <div class="builds-dashboard">
      <section class="current-build hud-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker"><Cpu :size="11" /> 当前装配</span>
            <h2>当前配置</h2>
          </div>
          <span class="compat-pill" :class="`compat-pill--${store.compatibility.status}`">
            <ShieldCheck :size="11" /> {{ compatibilityLabel }}
          </span>
        </div>

        <div class="current-total">
          <div class="current-total__price">
            <span>整机参考价</span>
            <strong>{{ formatPrice(store.total) }}</strong>
            <em>区间 {{ formatPrice(priceRange.min) }} – {{ formatPrice(priceRange.max) }} · 每万元性能 {{ currentValue }}</em>
          </div>
          <div class="current-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" class="ring-bg" />
              <circle
                cx="50"
                cy="50"
                r="42"
                class="ring-value"
                :stroke-dasharray="263.9"
                :stroke-dashoffset="263.9 - (263.9 * budgetFill) / 100"
              />
            </svg>
            <div><strong>{{ budgetFill }}%</strong><span>预算占用</span></div>
          </div>
        </div>

        <div class="budget-analysis">
          <div class="budget-analysis__head">
            <span><BarChart3 :size="11" /> 预算差异分析</span>
            <strong :class="{ over: budgetDelta < 0 }">
              {{ budgetDelta >= 0 ? `剩余 ${formatPrice(budgetDelta)}` : `超出 ${formatPrice(Math.abs(budgetDelta))}` }}
            </strong>
          </div>
          <div class="budget-track"><i :style="{ width: `${budgetFill}%` }" :class="{ 'is-over': budgetDelta < 0 }"></i></div>
          <div class="budget-analysis__meta">
            <span>预算 {{ formatPrice(store.request.budget) }}</span>
            <span>已用 {{ formatPrice(store.total) }}</span>
          </div>
        </div>

        <div class="current-metrics">
          <div><span>性能</span><strong>{{ Math.round(store.metrics.performance.index) }}</strong><em>综合指数</em></div>
          <div><span>游戏</span><strong>{{ Math.round(store.metrics.performance.gaming) }}</strong><em>帧率能力</em></div>
          <div><span>功耗</span><strong>{{ store.metrics.power.peak }}<small>W</small></strong><em>峰值</em></div>
          <div><span>建议电源</span><strong>{{ store.metrics.power.recommendedPsu }}<small>W</small></strong><em>余量充足</em></div>
        </div>

        <div class="current-list">
          <div class="current-list__head">
            <span>配件清单</span>
            <em>{{ currentSelection.length }} / {{ CORE_CATEGORIES.length }} 项已安装</em>
          </div>
          <div v-for="item in currentSelection" :key="item.category" class="current-line">
            <span>{{ categoryMeta(item.category).label }}</span>
            <strong>{{ item.product?.brand }} {{ item.product?.model }}</strong>
            <em>{{ formatPrice(productPrice(item.product, store.request.allowUsed)) }}</em>
          </div>
          <div v-if="!currentSelection.length" class="empty-note">当前没有已配置组件</div>
        </div>
      </section>

      <section class="compat-panel hud-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker"><ShieldCheck :size="11" /> 配置诊断</span>
            <h2>冲突原因与可执行修复</h2>
          </div>
          <span class="diag-count" :class="`diag-count--${store.compatibility.status}`">
            {{ diagnosisIssues.length ? `${diagnosisIssues.length} 项待处理` : '全部检查通过' }}
          </span>
        </div>

        <div v-if="!diagnosisIssues.length" class="diag-clear">
          <p><Check :size="12" /> 兼容性检查通过，共 {{ store.compatibility.passes.length }} 项，可以直接保存或导出。</p>
          <ul class="diag-pass-list">
            <li v-for="item in diagnosisPasses" :key="item.id">{{ item.title }}</li>
          </ul>
        </div>

        <div v-else class="diag-list">
          <article v-for="issue in diagnosisIssues" :key="issue.id" class="diag-item" :class="`diag-item--${issue.level}`">
            <span class="diag-level">{{ issue.level === 'error' ? '硬性冲突' : '风险项' }}</span>
            <div class="diag-copy">
              <strong>{{ issue.title }}</strong>
              <p>{{ issue.detail }}</p>
              <div class="diag-actions">
                <span>涉及：{{ issue.categories.map((category) => categoryMeta(category).label).join(' / ') }}</span>
                <button
                  v-for="category in issue.categories"
                  :key="`${issue.id}-${category}`"
                  type="button"
                  class="diag-link"
                  @click="openDiagnosis(category)"
                >
                  更换{{ categoryMeta(category).label }}
                </button>
              </div>
            </div>
          </article>
        </div>

        <div v-if="diagnosisCategory" class="diag-picker">
          <div class="diag-picker__head">
            <div>
              <span>替换 {{ diagnosisLabel }}</span>
              <em>只显示替换后不会产生硬性冲突的型号，按兼容优先、价格从低到高排序。</em>
            </div>
            <button type="button" class="diag-close" aria-label="关闭替换列表" @click="diagnosisCategory = null">×</button>
          </div>
          <div v-if="diagnosisOptions.length" class="diag-options">
            <button
              v-for="option in diagnosisOptions"
              :key="option.product.id"
              type="button"
              class="diag-option"
              @click="applyDiagnosis(option.product)"
            >
              <span class="diag-option__name">{{ option.product.brand }} {{ option.product.model }}</span>
              <span class="diag-option__perf">性能 {{ Math.round(option.product.performance.index) }}</span>
              <span class="diag-option__price">{{ formatPrice(option.price) }}</span>
              <span class="diag-option__state" :class="`compat-text--${option.report.status}`">
                {{ option.report.status === 'pass' ? '兼容通过' : '仍有风险' }}
              </span>
            </button>
          </div>
          <p v-else class="diag-empty">没有找到可以直接解决该冲突的同类别型号，请先调整相关联的组件。</p>
        </div>
      </section>

      <div class="bp-side">
        <section class="save-panel hud-panel">
          <div class="panel-head">
            <div>
              <span class="panel-kicker"><Save :size="11" /> 保存与导出</span>
              <h2>保存当前方案</h2>
            </div>
            <span class="panel-badge">本机存储</span>
          </div>
          <div class="save-fields">
            <input v-model="name" type="text" placeholder="方案名称，例如：2K 游戏主机" />
            <input v-model="note" type="text" placeholder="备注（可选）" />
            <button
              type="button"
              class="forge-btn forge-btn--primary"
              :disabled="store.compatibility.status === 'blocked'"
              @click="saveCurrent"
            >
              <Save :size="12" /> 保存方案
            </button>
          </div>
          <p v-if="store.compatibility.status === 'blocked'" class="save-warning">存在硬性冲突，需修复后才能保存为可行配置。</p>
          <div class="current-actions">
            <button type="button" class="forge-btn" @click="exportCurrentCsv"><Download :size="12" /> 导出 CSV</button>
            <button type="button" class="forge-btn" @click="exportCurrentPdf"><FileText :size="12" /> 导出 PDF</button>
            <button type="button" class="forge-btn" @click="importOpen = true"><Plus :size="12" /> 添加配件</button>
            <button type="button" class="forge-btn" @click="resetCurrent"><Sparkles :size="12" /> 恢复默认</button>
          </div>
        </section>
        <section class="upgrade-panel hud-panel">
          <div class="panel-head">
            <div>
              <span class="panel-kicker"><Zap :size="11" /> 升级模拟</span>
              <h2>升级影响</h2>
            </div>
            <Gauge :size="16" />
          </div>
          <div class="upgrade-tabs">
            <button
              v-for="cat in (['gpu', 'cpu', 'memory'] as const)"
              :key="cat"
              type="button"
              :class="{ active: simCategory === cat }"
              @click="simCategory = cat"
            >
              {{ categoryMeta(cat).label }}
            </button>
          </div>
          <div class="upgrade-options">
            <button
              v-for="option in simOptions"
              :key="option.product.id"
              type="button"
              class="upgrade-option"
              :class="{ active: simProductId === option.product.id }"
              @click="simProductId = option.product.id"
            >
              <span>
                <strong>{{ option.product.brand }} {{ option.product.model }}</strong>
                <em>{{ formatPrice(effectiveQuote(option.product)?.value ?? null) }} · 性能 {{ Math.round(option.product.performance.index) }}</em>
              </span>
              <Check v-if="simProductId === option.product.id" :size="12" />
            </button>
            <div v-if="!simOptions.length" class="empty-note">没有可兼容的升级选项</div>
          </div>
          <div class="upgrade-preview">
            <div class="upgrade-scenario">
              <span>模拟整机</span>
              <strong>{{ formatPrice(simMetrics.total) }}</strong>
              <em :class="simDelta.total <= 0 ? 'delta-down' : 'delta-up'">{{ simDelta.total > 0 ? '+' : '' }}{{ formatPrice(simDelta.total) }}</em>
            </div>
            <div class="upgrade-deltas">
              <div>
                <span>性能</span>
                <strong>{{ Math.round(simMetrics.performance.index) }}</strong>
                <em :class="simDelta.performance >= 0 ? 'delta-up' : 'delta-down'">{{ simDelta.performance > 0 ? '+' : '' }}{{ simDelta.performance.toFixed(1) }}</em>
              </div>
              <div>
                <span>游戏</span>
                <strong>{{ Math.round(simMetrics.performance.gaming) }}</strong>
                <em :class="simDelta.gaming >= 0 ? 'delta-up' : 'delta-down'">{{ simDelta.gaming > 0 ? '+' : '' }}{{ simDelta.gaming.toFixed(1) }}</em>
              </div>
              <div>
                <span>峰值功耗</span>
                <strong>{{ simMetrics.power.peak }}W</strong>
                <em :class="simDelta.power <= 0 ? 'delta-down' : 'delta-up'">{{ simDelta.power > 0 ? '+' : '' }}{{ simDelta.power }}W</em>
              </div>
              <div>
                <span>每万元性能</span>
                <strong>{{ simValue }}</strong>
                <em :class="simValue >= currentValue ? 'delta-up' : 'delta-down'">{{ (simValue - currentValue).toFixed(1) }}</em>
              </div>
            </div>
            <div class="upgrade-compat" :class="`compat-text--${simReport.status}`">
              <strong>{{ simReport.status === 'pass' ? '兼容通过' : simReport.status === 'caution' ? '可以装，但有风险' : '硬性冲突，不可用' }}</strong>
              <ul v-if="simIssues.length" class="upgrade-risks">
                <li v-for="issue in simIssues" :key="issue.title">
                  <strong>{{ issue.title }}</strong>
                  <em v-if="issue.detail">{{ issue.detail }}</em>
                </li>
              </ul>
              <em v-else>插槽、供电、尺寸与散热都匹配，可以直接应用。</em>
            </div>
            <button type="button" class="forge-btn forge-btn--primary" :disabled="!simProduct || simReport.status === 'blocked'" @click="applyUpgrade">
              <ArrowRight :size="12" /> 应用升级到当前配置
            </button>
          </div>
        </section>
      </div>

      <section class="value-panel hud-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker"><TrendingUp :size="11" /> 性价比分析</span>
            <h2>价格 × 性能</h2>
          </div>
          <span class="panel-badge">{{ upgradeCandidates.length }} 个升级候选 · 含当前方案</span>
        </div>
        <p class="panel-desc">
          越靠左上，单位价格获得的性能越高。浅色小点是当前平台可用的升级候选，橙色大点是当前配置，虚线是预算线。
        </p>
        <ChartPanel :option="scatterOption" :height="316" />
        <div class="value-legend">
          <span><i class="dot dot--ghost"></i> 升级候选</span>
          <span><i class="dot dot--cyan"></i> 兼容方案</span>
          <span><i class="dot dot--amber"></i> 风险方案</span>
          <span><i class="dot dot--orange"></i> 当前配置</span>
        </div>
        <div class="value-insight">
          <div>
            <span>当前配置每万元性能</span>
            <strong>{{ currentValue }}</strong>
          </div>
          <div v-if="bestValueUpgrade">
            <span>性价比最高的升级</span>
            <strong>{{ bestValueUpgrade.product.brand }} {{ bestValueUpgrade.product.model }}</strong>
            <em>
              整机 {{ formatPrice(bestValueUpgrade.total) }} · 每万元性能 {{ bestValueUpgrade.value }} ·
              性能 {{ Math.round(bestValueUpgrade.performance) }}
            </em>
          </div>
          <div v-else>
            <span>升级建议</span>
            <em>当前平台没有找到明显更划算的显卡 / CPU 升级，现配置已比较均衡。</em>
          </div>
        </div>
      </section>

      <section class="saved-panel hud-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker"><Database :size="11" /> 已保存</span>
            <h2>已保存方案</h2>
          </div>
          <div class="saved-actions">
            <button type="button" class="forge-btn" @click="backupAll"><Download :size="12" /> 备份 JSON</button>
            <button v-if="store.comparedBuilds.length" type="button" class="forge-btn" @click="store.clearCompare()">
              <X :size="12" /> 清除比较
            </button>
          </div>
        </div>

        <div v-if="!store.savedBuilds.length" class="saved-empty">
          <div class="empty-orbit"><span></span><span></span><span></span><Boxes :size="30" /></div>
          <h3>尚未保存配置</h3>
          <p>在上方命名并保存当前配置，即可在这里比较、升级模拟和导出。</p>
        </div>

        <div v-else class="saved-grid">
          <article
            v-for="entry in store.savedBuilds"
            :key="entry.id"
            class="saved-card"
            :class="{ 'saved-card--compare': store.compareIds.includes(entry.id) }"
          >
            <div class="saved-card__head">
              <button
                type="button"
                class="compare-check"
                :class="{ active: store.compareIds.includes(entry.id) }"
                title="加入比较"
                @click="store.toggleCompare(entry.id)"
              >
                <GitCompare :size="12" />
              </button>
              <template v-if="editingId === entry.id">
                <div class="edit-fields">
                  <input v-model="editName" type="text" />
                  <input v-model="editNote" type="text" placeholder="备注" />
                </div>
              </template>
              <template v-else>
                <div class="saved-title">
                  <strong>{{ entry.name }}</strong>
                  <em>{{ entry.note || '暂无备注' }}</em>
                </div>
              </template>
              <span class="saved-date">{{ entry.updatedAt.slice(0, 10) }}</span>
            </div>

            <div class="saved-card__metrics">
              <div><span>整机价格</span><strong>{{ formatPrice(entry.total) }}</strong></div>
              <div><span>性能指数</span><strong>{{ entry.performance }}</strong></div>
              <div><span>峰值功耗</span><strong>{{ entry.power }}W</strong></div>
              <div><span>兼容状态</span><strong :class="`compat-text--${entry.compatibility}`">{{ compatLabel(entry.compatibility) }}</strong></div>
            </div>

            <p
              v-if="entry.compatibility !== 'pass' && savedRisks.get(entry.id)?.risks.length"
              class="saved-card__risk"
              :class="`saved-card__risk--${entry.compatibility}`"
            >
              {{ entry.compatibility === 'blocked' ? '冲突原因：' : '风险原因：' }}{{ savedRisks.get(entry.id)?.risks.join('；') }}
            </p>

            <div class="saved-card__actions">
              <template v-if="editingId === entry.id">
                <button type="button" class="mini-action mini-action--primary" @click="commitEdit"><Check :size="12" /> 保存</button>
                <button type="button" class="mini-action" @click="editingId = null"><X :size="12" /> 取消</button>
              </template>
              <template v-else>
                <button type="button" class="mini-action mini-action--primary" @click="store.loadSavedBuild(entry.id)">
                  <Boxes :size="12" /> 载入 3D
                </button>
                <button type="button" class="mini-action" title="编辑名称" @click="startEdit(entry)"><Pencil :size="12" /></button>
                <button type="button" class="mini-action" title="复制" @click="store.duplicateSavedBuild(entry.id)"><Copy :size="12" /></button>
                <button type="button" class="mini-action" title="导出 CSV" @click="exportSaved(entry, 'csv')"><Download :size="12" /></button>
                <button type="button" class="mini-action" title="导出 PDF" @click="exportSaved(entry, 'pdf')"><FileText :size="12" /></button>
                <button type="button" class="mini-action mini-action--danger" title="删除" @click="remove(entry)"><Trash2 :size="12" /></button>
              </template>
            </div>
          </article>
        </div>
      </section>

      <section v-if="store.comparedBuilds.length" class="compare-panel hud-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker"><GitCompare :size="11" /> 多方案比较</span>
            <h2>配置对比</h2>
          </div>
          <span class="panel-badge">{{ store.comparedBuilds.length }} / 3</span>
        </div>
        <div class="compare-table">
          <div class="compare-row compare-row--head">
            <span>项目</span>
            <span v-for="build in store.comparedBuilds" :key="build.id">{{ build.name }}</span>
          </div>
          <div class="compare-row">
            <span>整机价格</span>
            <strong v-for="build in store.comparedBuilds" :key="build.id">{{ formatPrice(build.total) }}</strong>
          </div>
          <div class="compare-row">
            <span>性能指数</span>
            <strong v-for="build in store.comparedBuilds" :key="build.id">{{ build.performance }}</strong>
          </div>
          <div class="compare-row">
            <span>峰值功耗</span>
            <strong v-for="build in store.comparedBuilds" :key="build.id">{{ build.power }}W</strong>
          </div>
          <div class="compare-row">
            <span>兼容状态</span>
            <strong v-for="build in store.comparedBuilds" :key="build.id" :class="`compat-text--${build.compatibility}`">
              {{ compatLabel(build.compatibility) }}
            </strong>
          </div>
          <div v-for="row in compareModels" :key="row.meta.id" class="compare-row">
            <span>{{ row.meta.label }}</span>
            <span v-for="(cell, index) in row.cells" :key="index" class="compare-part">
              <template v-if="cell">{{ cell.brand }} {{ cell.model }}</template>
              <template v-else>—</template>
            </span>
          </div>
        </div>
      </section>
    </div>

    <ImportDialog :open="importOpen" @close="importOpen = false" />
  </div>
</template>
