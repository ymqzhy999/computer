<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Box,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  Database,
  ExternalLink,
  PackageSearch,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  TrendingUp,
  Upload,
  X,
} from 'lucide-vue-next'
import ChartPanel from '../components/ChartPanel.vue'
import ImportDialog from '../components/ImportDialog.vue'
import PartGlyph from '../components/PartGlyph.vue'
import Part3DViewer from '../components/Part3DViewer.vue'
import { useBuildStore } from '../stores/build'
import { useToastStore } from '../stores/toast'
import { CATEGORY_META, categoryMeta, PRICE_STATUS_LABEL } from '../data/meta'
import { CATALOG, catalogStats } from '../data/catalog'
import { effectiveQuote, formatPrice, priceAgeDays, quoteStateLabel } from '../services/pricing'
import { adapterHealth, refreshQuotes } from '../services/priceAdapter'
import type { EChartsOption } from 'echarts'
import type { Category, Product } from '../types'

const store = useBuildStore()
const toast = useToastStore()
const query = ref('')
const category = ref<Category | 'all'>('all')
const priceFilter = ref<'all' | 'priced' | 'unpriced' | 'sample'>('all')
const sort = ref<'category' | 'price-asc' | 'price-desc' | 'perf' | 'updated'>('category')
const page = ref(1)
const pageSize = 14
const selectedId = ref<string | null>(null)
const sideOpen = ref(false)
const trendDays = ref<30 | 7 | 90>(30)
const importOpen = ref(false)
const refreshing = ref(false)
const adapter = ref({ configured: false, adapter: 'archive-only', message: '正在检查价格适配器…' })

const modalProduct = ref<Product | null>(null)

function openDetailModal(product: Product) {
  modalProduct.value = product
  selectedId.value = product.id
  store.inspectProduct(product.id)
}

function closeDetailModal() {
  modalProduct.value = null
}

const stats = computed(() => catalogStats(store.allProducts))
const selected = computed<Product | undefined>(() => (selectedId.value ? store.byId.get(selectedId.value) : undefined))
const selectedQuote = computed(() => effectiveQuote(selected.value))
const selectedAge = computed(() => priceAgeDays(selectedQuote.value?.updatedAt))

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = store.allProducts.filter((p) => {
    if (category.value !== 'all' && p.category !== category.value) return false
    if (priceFilter.value === 'priced' && !p.price?.reference) return false
    if (priceFilter.value === 'unpriced' && p.price?.reference) return false
    if (priceFilter.value === 'sample' && p.price?.status !== 'sample') return false
    if (!q) return true
    return `${p.brand} ${p.model} ${p.sku} ${p.tagline} ${Object.values(p.specs).join(' ')}`.toLowerCase().includes(q)
  })
  return list.sort((a, b) => {
    if (sort.value === 'price-asc') return (effectiveQuote(a)?.value ?? Infinity) - (effectiveQuote(b)?.value ?? Infinity)
    if (sort.value === 'price-desc') return (effectiveQuote(b)?.value ?? -1) - (effectiveQuote(a)?.value ?? -1)
    if (sort.value === 'perf') return b.performance.index - a.performance.index
    if (sort.value === 'updated') return (b.price?.updatedAt ?? '').localeCompare(a.price?.updatedAt ?? '')
    return CATEGORY_META.findIndex((c) => c.id === a.category) - CATEGORY_META.findIndex((c) => c.id === b.category)
  })
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const pageRows = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))

watch([query, category, priceFilter, sort], () => {
  page.value = 1
})

const trendHistory = computed(() => {
  const history = selected.value?.price?.history ?? []
  if (!history.length) return []
  const cutoff = Date.now() - trendDays.value * 86400000
  return history.filter((point) => new Date(point.date).getTime() >= cutoff)
})

const trendOption = computed<EChartsOption>(() => ({
  backgroundColor: 'transparent',
  grid: { left: 48, right: 16, top: 24, bottom: 28 },
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#07111b',
    borderColor: '#1d4a61',
    textStyle: { color: '#cfe5ee', fontSize: 11 },
    valueFormatter: (value) => `¥${Number(value).toLocaleString('zh-CN')}`,
  },
  xAxis: {
    type: 'category',
    data: trendHistory.value.map((p) => p.date.slice(5)),
    axisLine: { lineStyle: { color: '#1b3444' } },
    axisLabel: { color: '#6d8695', fontSize: 9 },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    scale: true,
    axisLabel: { color: '#6d8695', fontSize: 9, formatter: (value: number) => `¥${Math.round(value / 100) / 10}k` },
    splitLine: { lineStyle: { color: 'rgba(23,50,70,.55)' } },
  },
  series: [
    {
      type: 'line',
      data: trendHistory.value.map((p) => p.price),
      smooth: 0.25,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { color: '#7fa8bd', width: 1.6 },
      itemStyle: { color: '#7fa8bd' },
      areaStyle: { color: 'rgba(127, 168, 189,.12)' },
    },
  ],
}))

const categoryOption = computed<EChartsOption>(() => ({
  backgroundColor: 'transparent',
  grid: { left: 62, right: 20, top: 12, bottom: 22 },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#111922', borderColor: '#2a3742', textStyle: { color: '#e3e9ee', fontSize: 11 } },
  xAxis: {
    type: 'value',
    axisLabel: { color: '#71808d', fontSize: 9 },
    splitLine: { lineStyle: { color: 'rgba(148,163,178,.12)' } },
  },
  yAxis: {
    type: 'category',
    data: CATEGORY_META.slice().reverse().map((c) => c.label),
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#9aa8b5', fontSize: 9 },
  },
  series: [
    {
      type: 'bar',
      data: CATEGORY_META.slice().reverse().map((c) => stats.value.byCategory[c.id]),
      barWidth: 8,
      itemStyle: { color: '#2aa3c2', borderRadius: [0, 2, 2, 0] },
    },
  ],
}))

function selectProduct(product: Product) {
  openDetailModal(product)
}

function install(product: Product) {
  store.installProduct(product)
  store.inspectProduct(product.id)
}

function viewInWorkbench(product: Product) {
  store.installProduct(product)
  store.inspectProduct(product.id)
  store.setTab('assembly')
}

async function checkAdapter() {
  adapter.value = await adapterHealth()
}

async function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    const ids = pageRows.value.filter((p) => p.price?.reference).map((p) => p.id)
    const result = await refreshQuotes(ids)
    result.quotes.forEach((quote) => store.applyPriceSnapshot(quote.productId, quote.price))
    if (!result.quotes.length) {
      toast.info('价格适配器未返回报价', adapter.value.message)
    } else {
      toast.success('价格已刷新', `更新 ${result.quotes.length} 条报价 · ${result.adapter}`)
    }
    await checkAdapter()
  } catch (error) {
    toast.error('无法获取实时价格', `${(error as Error).message}；当前保留归档样本，未编造报价`)
  } finally {
    refreshing.value = false
  }
}

function openSource() {
  const url = selectedQuote.value?.sourceUrl
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

function goPage(delta: number) {
  page.value = Math.min(totalPages.value, Math.max(1, page.value + delta))
}

onMounted(checkAdapter)
</script>

<template>
  <div class="page-shell market-page">
    <header class="page-head">
      <div>
        <span class="panel-kicker"><CircleDollarSign :size="11" /> 价格归档与行情</span>
        <h1>硬件市场</h1>
        <p>按具体品牌 SKU 对比价格与规格，展示参考价、区间、来源与更新时间。支持一键装配与 3D 工作台实时查看。</p>
      </div>
      <div class="page-head-stats">
        <div><span>产品</span><strong>{{ stats.total }}</strong></div>
        <div><span>有报价</span><strong>{{ stats.coverage }}%</strong></div>
        <div><span>品牌</span><strong>{{ stats.brands }}</strong></div>
        <div><span>更新</span><strong>{{ CATALOG.updatedAt.slice(0, 10) }}</strong></div>
      </div>
    </header>

    <div class="market-toolbar hud-panel">
      <div class="market-search">
        <Search :size="14" />
        <input v-model="query" type="text" placeholder="搜索品牌 / 型号 / SKU / 规格" spellcheck="false" />
        <button v-if="query" type="button" @click="query = ''"><X :size="13" /></button>
      </div>
      <div class="filter-group">
        <select v-model="category" aria-label="类别筛选">
          <option value="all">全部类别</option>
          <option v-for="meta in CATEGORY_META" :key="meta.id" :value="meta.id">{{ meta.label }}</option>
        </select>
        <select v-model="priceFilter" aria-label="价格状态筛选">
          <option value="all">全部价格状态</option>
          <option value="priced">有参考报价</option>
          <option value="sample">归档样本</option>
          <option value="unpriced">暂无报价</option>
        </select>
        <select v-model="sort" aria-label="排序方式">
          <option value="category">按类别</option>
          <option value="price-asc">价格从低到高</option>
          <option value="price-desc">价格从高到低</option>
          <option value="perf">性能指数</option>
          <option value="updated">最近更新</option>
        </select>
      </div>
      <div class="market-toolbar__actions">
        <button type="button" class="forge-btn" :class="{ 'forge-btn--active': sideOpen }" @click="sideOpen = !sideOpen">
          <PanelRightClose v-if="sideOpen" :size="12" />
          <PanelRightOpen v-else :size="12" />
          {{ sideOpen ? '折叠详情' : '展开详情' }}
        </button>
        <button type="button" class="forge-btn" :disabled="refreshing" @click="refresh">
          <RefreshCw :size="12" :class="{ spin: refreshing }" /> {{ refreshing ? '刷新中' : '刷新报价' }}
        </button>
        <button type="button" class="forge-btn" @click="importOpen = true"><Upload :size="12" /> 导入 / 添加</button>
      </div>
    </div>

    <div class="market-layout" :class="{ 'market-layout--collapsed': !sideOpen }">
      <section class="market-table-panel hud-panel">
        <div class="table-caption">
          <span><Database :size="11" /> 硬件市场列表</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>{{ filtered.length }} 条 · 第 {{ page }} / {{ totalPages }} 页</span>
            <button v-if="!sideOpen" type="button" class="forge-btn forge-btn--sm" @click="sideOpen = true">
              <PanelRightOpen :size="11" /> 展开详情面板
            </button>
          </div>
        </div>
        <div class="market-table">
          <div class="market-row market-row--head">
            <span>类别 / SKU</span>
            <span>品牌 / 完整型号</span>
            <span>参考价</span>
            <span>价格区间</span>
            <span>来源与时间</span>
            <span>状态</span>
            <span>3D孪生 / 详情</span>
          </div>
          <button
            v-for="product in pageRows"
            :key="product.id"
            type="button"
            class="market-row"
            :class="{ 'market-row--active': selectedId === product.id }"
            @click="selectProduct(product)"
          >
            <span class="market-cat">
              <em>{{ categoryMeta(product.category).short }}</em>
              <strong>{{ product.sku }}</strong>
            </span>
            <span class="market-model">
              <strong>{{ product.brand }} {{ product.model }}</strong>
              <em>{{ product.workloads ? (product.workloads.badge + ' · ' + product.workloads.tier) : product.tagline }}</em>
            </span>
            <span class="market-price">{{ formatPrice(effectiveQuote(product)?.value ?? null) }}</span>
            <span class="market-range">
              <template v-if="product.price?.reference">{{ formatPrice(product.price.min) }} – {{ formatPrice(product.price.max) }}</template>
              <template v-else>—</template>
            </span>
            <span class="market-source">
              <strong>{{ product.price?.source?.slice(0, 22) ?? '暂无可靠来源' }}</strong>
              <em>{{ product.price?.updatedAt?.slice(0, 10) ?? '—' }}</em>
            </span>
            <span class="market-status" :class="`market-status--${product.price?.status ?? 'unavailable'}`">
              <i></i>{{ PRICE_STATUS_LABEL[product.price?.status ?? 'unavailable'] }}
            </span>
            <span class="market-view-cell">
              <button type="button" class="forge-btn forge-btn--primary forge-btn--sm" @click.stop="openDetailModal(product)">
                <Box :size="11" /> 3D详情
              </button>
            </span>
          </button>
          <div v-if="!pageRows.length" class="table-empty">
            <PackageSearch :size="24" />
            <strong>没有匹配的型号</strong>
            <span>调整筛选条件，或导入新的产品数据。</span>
          </div>
        </div>
        <div class="market-pager">
          <span>显示 {{ pageRows.length }} / {{ filtered.length }} 条 · 价格均为参考归档或用户导入</span>
          <div>
            <button type="button" :disabled="page <= 1" @click="goPage(-1)"><ChevronLeft :size="13" /></button>
            <strong>{{ String(page).padStart(2, '0') }}</strong>
            <button type="button" :disabled="page >= totalPages" @click="goPage(1)"><ChevronRight :size="13" /></button>
          </div>
        </div>
      </section>

      <aside v-if="sideOpen" class="market-side">
        <template v-if="selected">
          <div class="market-detail hud-panel">
            <div class="detail-head">
              <span class="panel-kicker">{{ categoryMeta(selected.category).label }} / {{ selected.sku }}</span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <button type="button" class="forge-btn forge-btn--sm" title="折叠右侧侧栏" @click="sideOpen = false">
                  <PanelRightClose :size="12" /> 折叠
                </button>
                <button type="button" class="modal-close" title="关闭详情" @click="selectedId = null"><X :size="14" /></button>
              </div>
            </div>
            <div class="detail-glyph">
              <Part3DViewer :product="selected" />
            </div>
            <h3>{{ selected.brand }} {{ selected.model }}</h3>
            <p>{{ selected.tagline }}</p>
            <div class="detail-price">
              <span>参考价</span>
              <strong>{{ formatPrice(selectedQuote?.value ?? null) }}</strong>
              <em>{{ selectedQuote?.source ?? '暂无可靠渠道报价' }}</em>
            </div>
            <div class="detail-meta">
              <div><span>价格区间</span><strong>{{ formatPrice(selectedQuote?.min ?? null) }} – {{ formatPrice(selectedQuote?.max ?? null) }}</strong></div>
              <div><span>数据状态</span><strong>{{ quoteStateLabel(selected).label }}</strong></div>
              <div><span>更新时间</span><strong>{{ selectedQuote?.updatedAt?.slice(0, 10) ?? '—' }} <em v-if="selectedAge !== null">· {{ selectedAge }} 天前</em></strong></div>
              <div><span>二手参考</span><strong>{{ formatPrice(selected.usedPrice) }}</strong></div>
            </div>
            <div class="trend-block">
              <div class="trend-head">
                <span><TrendingUp :size="12" /> 价格走势</span>
                <div class="trend-tabs">
                  <button v-for="days in [7, 30, 90] as const" :key="days" type="button" :class="{ active: trendDays === days }" @click="trendDays = days">{{ days }}D</button>
                </div>
              </div>
              <ChartPanel v-if="trendHistory.length >= 2" :option="trendOption" :height="150" />
              <div v-else class="trend-empty">
                <CircleAlert :size="14" />
                <span>该区间历史数据不足，暂不生成趋势曲线。</span>
              </div>
            </div>
            <div class="detail-actions">
              <button type="button" class="forge-btn forge-btn--primary" @click="install(selected)"><Plus :size="12" /> 装载到配置</button>
              <button type="button" class="forge-btn" @click="viewInWorkbench(selected)"><Box :size="12" /> 在 3D 工作台查看</button>
              <button type="button" class="forge-btn" @click="openSource"><ExternalLink :size="12" /> 来源页面</button>
            </div>
            <p class="detail-note">{{ selected.price?.note ?? '该型号暂无可靠报价，未展示猜测价格。' }}</p>
            <div v-if="selected.workloads" class="modal-workload-card" style="margin: 12px 0;">
              <div class="workload-card-head">
                <span class="workload-tier-badge">{{ selected.workloads.tier }}</span>
                <span class="workload-suit-badge">{{ selected.workloads.badge }}</span>
              </div>
              <p class="workload-summary-text">{{ selected.workloads.summary }}</p>
              <div class="workload-specs-flow">
                <div v-if="selected.workloads.games && selected.workloads.games.length" class="flow-pill">
                  <span class="pill-title">游戏表现</span>
                  <span class="pill-desc">{{ selected.workloads.games[0] }}</span>
                </div>
                <div v-if="selected.workloads.productivity && selected.workloads.productivity.length" class="flow-pill">
                  <span class="pill-title">生产力计算</span>
                  <span class="pill-desc">{{ selected.workloads.productivity[0] }}</span>
                </div>
              </div>
            </div>
            <div class="detail-specs">
              <div v-for="[key, value] in Object.entries(selected.specs).slice(0, 5)" :key="key">
                <span>{{ key }}</span><strong>{{ value }}</strong>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="market-insight hud-panel">
            <div class="insight-head">
              <span class="panel-kicker"><Store :size="11" /> 价格数据</span>
              <h3>数据覆盖</h3>
            </div>
            <div class="coverage-ring">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="48" class="ring-bg" />
                <circle cx="60" cy="60" r="48" class="ring-value" :stroke-dasharray="301.6" :stroke-dashoffset="301.6 - (301.6 * stats.coverage) / 100" />
              </svg>
              <div><strong>{{ stats.coverage }}%</strong><span>有报价</span></div>
            </div>
            <div class="coverage-legend">
              <div><span>有参考价</span><strong>{{ stats.priced }}</strong></div>
              <div><span>归档样本</span><strong>{{ stats.sample }}</strong></div>
              <div><span>暂无报价</span><strong>{{ stats.unavailable }}</strong></div>
              <div><span>实时报价</span><strong>{{ stats.live }}</strong></div>
            </div>
            <ChartPanel :option="categoryOption" :height="240" />
            <div class="adapter-card">
              <div class="adapter-head">
                <span :class="{ 'adapter-dot--on': adapter.configured }" class="adapter-dot"></span>
                <strong>{{ adapter.configured ? '实时报价已连接' : '仅归档价格' }}</strong>
              </div>
              <p>{{ adapter.message }}</p>
              <button type="button" class="link-btn" @click="checkAdapter">重新检测适配器</button>
            </div>
            <div class="catalog-note">
              <div><ShieldCheck :size="11" /> 目录版本 {{ CATALOG.version }}</div>
              <p>{{ CATALOG.disclaimer }}</p>
              <div class="catalog-timestamp"><Clock3 :size="11" /> 更新于 {{ CATALOG.updatedAt }}</div>
            </div>
          </div>
        </template>
      </aside>
    </div>

    <ImportDialog :open="importOpen" @close="importOpen = false" />

    <!-- 硬件 3D 数字孪生与全景参数动态弹窗 (点击动态加载，消除页面不对称) -->
    <Teleport to="body">
      <div v-if="modalProduct" class="forge-modal-backdrop" @click.self="closeDetailModal">
        <div class="forge-modal-window hud-panel">
          <!-- 弹窗顶栏 -->
          <div class="modal-window-head">
            <div class="modal-title-group">
              <span class="modal-kicker">
                <span class="cat-pill">{{ categoryMeta(modalProduct.category).label }}</span>
                <span class="sku-pill">SKU: {{ modalProduct.sku }}</span>
              </span>
              <h2>{{ modalProduct.brand }} {{ modalProduct.model }}</h2>
              <p class="modal-tagline">{{ modalProduct.tagline }}</p>
            </div>
            <div class="modal-actions-top">
              <button type="button" class="forge-btn forge-btn--primary" @click="install(modalProduct)">
                <Plus :size="13" /> 装载到配置
              </button>
              <button type="button" class="forge-btn" @click="viewInWorkbench(modalProduct)">
                <Box :size="13" /> 在 3D 工作台装配
              </button>
              <button type="button" class="modal-close-btn" @click="closeDetailModal" title="关闭 (Esc)">
                <X :size="16" />
              </button>
            </div>
          </div>

          <!-- 弹窗主体：50/50 完美对称双列布局 -->
          <div class="modal-window-body">
            <!-- 左侧：大屏 3D 数字孪生与价格行情趋势 -->
            <div class="modal-left-pane">
              <div class="modal-3d-wrapper">
                <div class="modal-3d-header">
                  <span><Box :size="13" /> 3D 数字孪生模型 (WebGL 实时交互)</span>
                  <span class="modal-3d-hint">按住左键拖拽旋转 · 滚轮缩放</span>
                </div>
                <Part3DViewer :product="modalProduct" :height="340" />
              </div>

              <!-- 价格走势图表 -->
              <div class="modal-trend-card">
                <div class="trend-head">
                  <span><TrendingUp :size="13" /> 历史价格走势</span>
                  <div class="trend-tabs">
                    <button v-for="days in [7, 30, 90] as const" :key="days" type="button" :class="{ active: trendDays === days }" @click="trendDays = days">{{ days }}D</button>
                  </div>
                </div>
                <ChartPanel v-if="trendHistory.length >= 2" :option="trendOption" :height="160" />
                <div v-else class="trend-empty">
                  <CircleAlert :size="14" />
                  <span>近 {{ trendDays }} 天历史公允数据不足，暂未生成趋势波动曲线。</span>
                </div>
              </div>
            </div>

            <!-- 右侧：价格概况、工程级规格参数与特性 (大字号、高对比度) -->
            <div class="modal-right-pane">
              <!-- 价格信息块 -->
              <div class="modal-price-box">
                <div class="price-main">
                  <span class="price-label">当前公允参考价</span>
                  <strong class="price-val">{{ formatPrice(effectiveQuote(modalProduct)?.value ?? null) }}</strong>
                  <span class="price-source">数据来源：{{ effectiveQuote(modalProduct)?.source ?? '暂无渠道核验报价' }}</span>
                </div>
                <div class="price-grid">
                  <div class="price-meta-item">
                    <span>价格区间</span>
                    <strong>{{ formatPrice(modalProduct.price?.min ?? null) }} – {{ formatPrice(modalProduct.price?.max ?? null) }}</strong>
                  </div>
                  <div class="price-meta-item">
                    <span>二手参考</span>
                    <strong>{{ formatPrice(modalProduct.usedPrice) }}</strong>
                  </div>
                  <div class="price-meta-item">
                    <span>报价状态</span>
                    <strong>{{ quoteStateLabel(modalProduct).label }}</strong>
                  </div>
                  <div class="price-meta-item">
                    <span>更新时间</span>
                    <strong>{{ modalProduct.price?.updatedAt?.slice(0, 10) ?? '—' }}</strong>
                  </div>
                </div>
              </div>

              <!-- 专业工程级场景适配卡片 -->
              <div v-if="modalProduct.workloads" class="modal-workload-card">
                <div class="workload-card-head">
                  <span class="workload-tier-badge">{{ modalProduct.workloads.tier }}</span>
                  <span class="workload-suit-badge">{{ modalProduct.workloads.badge }}</span>
                </div>
                <p class="workload-summary-text">{{ modalProduct.workloads.summary }}</p>
                <div class="workload-specs-flow">
                  <div v-if="modalProduct.workloads.games && modalProduct.workloads.games.length" class="flow-pill">
                    <span class="pill-title">游戏与电竞</span>
                    <span class="pill-desc">{{ modalProduct.workloads.games[0] }}</span>
                  </div>
                  <div v-if="modalProduct.workloads.productivity && modalProduct.workloads.productivity.length" class="flow-pill">
                    <span class="pill-title">生产力与计算</span>
                    <span class="pill-desc">{{ modalProduct.workloads.productivity[0] }}</span>
                  </div>
                </div>
              </div>

              <!-- 完整硬件参数规格表（高对比度、大字体） -->
              <div class="modal-specs-section">
                <div class="specs-section-title">
                  <SlidersHorizontal :size="13" />
                  <span>硬件核心规格参数</span>
                </div>
                <div class="specs-grid-table">
                  <div v-for="[key, value] in Object.entries(modalProduct.specs)" :key="key" class="spec-row-item">
                    <span class="spec-key">{{ key }}</span>
                    <strong class="spec-val">{{ value }}</strong>
                  </div>
                </div>
              </div>

              <div v-if="modalProduct.price?.sourceUrl" class="modal-foot-actions">
                <button type="button" class="forge-btn" @click="openSource">
                  <ExternalLink :size="13" /> 查看中关村在线 (ZOL) / 官方核验行情页
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
