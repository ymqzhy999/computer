<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  AlertTriangle,
  ChevronDown,
  CircleDollarSign,
  CircleDot,
  Eye,
  EyeOff,
  Layers,
  LocateFixed,
  Plus,
  RotateCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-vue-next'
import { useBuildStore } from '../stores/build'
import { CATEGORY_META, categoryMeta } from '../data/meta'
import { candidateBlocked, evaluateCandidate } from '../services/compatibility'
import { caseFrontLabel, caseFrontStyle } from '../services/caseStyle'
import { effectiveQuote, formatPrice } from '../services/pricing'
import { CATEGORY_SCENE_ID } from '../three/partRegistry'
import type { Category, CompatibilityReport, Product } from '../types'

const store = useBuildStore()
const CASE_TINTS: { label: string; value: string | null; swatch: string }[] = [
  { label: '原厂', value: null, swatch: 'linear-gradient(135deg, #384552 0 50%, #c9d3d8 50% 100%)' },
  { label: '墨黑', value: '#1b242c', swatch: '#1b242c' },
  { label: '雪白', value: '#d6dde1', swatch: '#d6dde1' },
  { label: '银灰', value: '#a7b2ba', swatch: '#a7b2ba' },
  { label: '樱粉', value: '#d8a8b2', swatch: '#d8a8b2' },
  { label: '奶咖', value: '#c9b49b', swatch: '#c9b49b' },
  { label: '雾蓝', value: '#5d7f95', swatch: '#5d7f95' },
]
const search = ref('')
const expanded = ref<Record<string, boolean>>({ cpu: true, motherboard: true })
const allOptions = ref<Record<string, boolean>>({})
/** 小白模式：默认把“装不上”的型号从列表里过滤掉，而不是让用户点了才报错。 */
const onlyCompatible = ref(true)

watch(
  () => [store.diyMode, store.diyStep],
  ([active]) => {
    if (active) {
      const cat = store.currentDiyStepInfo.category
      expanded.value = { [cat]: true }
    }
  },
  { immediate: true },
)

const query = computed(() => search.value.trim().toLowerCase())
const normQuery = computed(() => query.value.replace(/[\s\-_]+/g, ''))
const searchResults = computed(() => {
  if (!query.value) return []
  return store.allProducts
    .filter((p) => {
      const attrs = p.attrs as Record<string, unknown>
      const hay = `${p.brand} ${p.model} ${p.sku} ${p.tagline} ${(attrs.gpuChip as string) || ''} ${Object.values(p.specs || {}).join(' ')}`.toLowerCase()
      const normHay = hay.replace(/[\s\-_]+/g, '')
      return hay.includes(query.value) || (normQuery.value ? normHay.includes(normQuery.value) : false)
    })
    .slice(0, 40)
})
const searchVisible = computed(() => {
  if (!onlyCompatible.value) return searchResults.value
  return [...searchResults.value].sort((a, b) => {
    const aBlocked = isBlocked(a) ? 1 : 0
    const bBlocked = isBlocked(b) ? 1 : 0
    return aBlocked - bBlocked
  })
})

const allByCategory = computed(() => {
  const map = new Map<Category, Product[]>()
  for (const product of store.allProducts) {
    const list = map.get(product.category)
    if (list) list.push(product)
    else map.set(product.category, [product])
  }
  return map
})

const optionsByCategory = computed(() => {
  const map = new Map<Category, Product[]>()
  for (const meta of CATEGORY_META) {
    const installedId = store.selection[meta.id]
    const pool = (allByCategory.value.get(meta.id) ?? []).slice().sort((a, b) => {
      if (a.id === installedId) return -1
      if (b.id === installedId) return 1
      if (meta.id === 'gpu') {
        const priceA = effectiveQuote(a)?.value
        const priceB = effectiveQuote(b)?.value
        const valueA = priceA ? a.performance.index / priceA : -1
        const valueB = priceB ? b.performance.index / priceB : -1
        return valueB - valueA
      }
      return b.performance.index - a.performance.index
    })
    map.set(meta.id, pool)
  }
  return map
})

/**
 * 每款候选配件“装上去之后”的整机兼容报告。
 * 只对全部 385 款左右零件算一遍，换配置时整份缓存重建，避免展开列表时逐行计算。
 */
const candidateReports = computed(() => {
  const result = new Map<string, CompatibilityReport>()
  for (const product of store.allProducts) {
    if (product.id === store.selection[product.category]) continue
    result.set(
      product.id,
      evaluateCandidate(store.selection, product.category, product.id, store.byId, store.quantities),
    )
  }
  return result
})

function isBlocked(product: Product): boolean {
  const report = candidateReports.value.get(product.id)
  return report ? candidateBlocked(report, product.category) : false
}

function visibleOptions(category: Category): Product[] {
  const pool = optionsByCategory.value.get(category) ?? []
  if (!onlyCompatible.value) return pool
  return pool.filter((product) => product.id === store.selection[category] || !isBlocked(product))
}

function optionCount(category: Category): number {
  return visibleOptions(category).filter((product) => product.id !== store.selection[category]).length
}

function hiddenCount(category: Category): number {
  const pool = optionsByCategory.value.get(category) ?? []
  return pool.filter((product) => product.id !== store.selection[category] && isBlocked(product)).length
}

const totalHidden = computed(() =>
  CATEGORY_META.reduce((sum, meta) => sum + hiddenCount(meta.id), 0),
)
const searchBlockedCount = computed(() =>
  searchResults.value.filter((p) => isBlocked(p)).length,
)

function toggle(category: Category) {
  expanded.value = { ...expanded.value, [category]: !expanded.value[category] }
}

function toggleOptions(category: Category) {
  const open = !allOptions.value[category]
  allOptions.value = { ...allOptions.value, [category]: open }
  if (open) {
    expanded.value = { [category]: true }
    void nextTick(() => {
      const root = document.querySelector(`.tree-scroll [data-cat="${category}"]`)
      root?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }
}

function choose(product: Product) {
  store.installProduct(product)
  store.inspectProduct(product.id)
}

function inspect(product: Product) {
  store.inspectProduct(product.id)
  if (store.selection[product.category] === product.id) {
    store.focusPart(CATEGORY_SCENE_ID[product.category])
  }
}

function priceOf(product: Product) {
  const quote = effectiveQuote(product, store.request.allowUsed)
  if (!quote) return '暂无报价'
  return quote.condition === 'used' ? `二手 ${formatPrice(quote.value)}` : formatPrice(quote.value)
}

function statusOf(category: Category) {
  if (!store.selection[category]) return 'empty'
  const issues = store.compatibility.issues.filter((i) => i.categories.includes(category))
  if (issues.some((i) => i.level === 'error')) return 'error'
  if (issues.some((i) => i.level === 'warning')) return 'warning'
  return 'ok'
}

function statusLabel(category: Category) {
  const state = statusOf(category)
  if (state === 'empty') return '未安装'
  if (state === 'error') return '冲突'
  if (state === 'warning') return '风险'
  return '兼容'
}

function hidden(category: Category) {
  return store.hiddenIds.includes(CATEGORY_SCENE_ID[category])
}

function clearSearch() {
  search.value = ''
}

function optionState(id: string): string {
  const report = candidateReports.value.get(id)
  if (!report) return 'ok'
  if (report.status === 'blocked') return 'error'
  if (report.status === 'caution') return 'warning'
  return 'ok'
}

function optionHint(product: Product): string {
  const report = candidateReports.value.get(product.id)
  if (!report) return '当前已安装'
  const error = report.errors.find((issue) => issue.categories.includes(product.category))
  if (error) return `不适配：${error.title}`
  const warning = report.warnings.find(
    (issue) => issue.categories.includes(product.category) && issue.code !== 'MISSING_CORE',
  )
  if (warning) return `可安装，但需注意：${warning.title}`
  return '与当前配置兼容'
}
</script>

<template>
  <aside class="tree-panel hud-panel">
    <div class="panel-head">
      <div>
        <span class="panel-kicker">已安装 {{ store.installedCount }} 个组件</span>
        <h2>部件结构树</h2>
      </div>
      <div class="head-badge">{{ store.installedCount }} / 11</div>
    </div>

    <div class="tree-search">
      <Search :size="14" />
      <input v-model="search" type="text" placeholder="搜索品牌 / 型号 / 规格" spellcheck="false" />
      <button v-if="search" type="button" title="清除搜索" @click="clearSearch"><X :size="13" /></button>
      <kbd>/</kbd>
    </div>

    <div class="tree-scroll">
      <div class="tree-filter-note" :class="{ 'tree-filter-note--all': !onlyCompatible }">
        <ShieldCheck :size="12" />
        <span v-if="onlyCompatible">已滤除 {{ totalHidden }} 个不适配件</span>
        <span v-else>全部型号 · 红点不可装</span>
        <button type="button" @click="onlyCompatible = !onlyCompatible">
          {{ onlyCompatible ? '显示全部' : '恢复过滤' }}
        </button>
      </div>

      <template v-if="query">
        <div class="search-caption">
          <span>搜索结果</span>
          <strong>
            {{ searchVisible.length }} 个匹配型号
            <em v-if="searchBlockedCount" class="search-filter-note">· 含 {{ searchBlockedCount }} 个需电源/机箱适配</em>
          </strong>
        </div>
        <button
          v-for="product in searchVisible"
          :key="product.id"
          type="button"
          class="search-hit"
          :title="optionHint(product)"
          @click="inspect(product)"
        >
          <span class="search-hit__code">
            {{ categoryMeta(product.category).short }}
            <em v-if="optionState(product.id) === 'error'" class="search-hit__blocked">不适配</em>
            <em v-else-if="optionState(product.id) === 'warning'" class="search-hit__risk">有风险</em>
          </span>
          <span class="search-hit__copy">
            <strong>{{ product.brand }} {{ product.model }}</strong>
            <em>{{ product.sku }} · {{ product.tagline }}</em>
          </span>
          <span class="search-hit__price">{{ priceOf(product) }}</span>
          <span
            class="mini-add"
            role="button"
            tabindex="0"
            title="装载到当前配置"
            @click.stop="choose(product)"
            @keydown.enter.stop="choose(product)"
          ><Plus :size="13" /></span>
        </button>
        <div v-if="!searchVisible.length" class="empty-note">
          <SlidersHorizontal :size="16" />
          <span>未找到匹配型号。可尝试品牌、芯片（如 5090 / 9800X3D）或规格关键词。</span>
        </div>
      </template>

      <template v-else>
        <div
          v-for="meta in CATEGORY_META"
          :key="meta.id"
          class="tree-group"
          :class="{ 'tree-group--diy-active': store.diyMode && store.currentDiyStepInfo.category === meta.id }"
          :data-cat="meta.id"
        >
          <div
            class="tree-row"
            :class="{ 'tree-row--open': expanded[meta.id], 'tree-row--active': store.inspectedProduct?.category === meta.id, 'tree-row--diy': store.diyMode && store.currentDiyStepInfo.category === meta.id }"
            role="button"
            tabindex="0"
            @click="toggle(meta.id)"
            @keydown.enter="toggle(meta.id)"
          >
            <span class="tree-index">{{ meta.index }}</span>
            <span class="tree-copy">
              <strong>{{ meta.label }}</strong>
              <span v-if="store.diyMode && store.currentDiyStepInfo.category === meta.id" class="diy-step-tag">第 {{ store.diyStep }} 步</span>
            </span>
            <span class="tree-state">
              <span class="state-dot" :class="`state-dot--${statusOf(meta.id)}`"></span>
              {{ statusLabel(meta.id) }}
            </span>
            <span class="tree-actions">
              <button
                class="icon-btn"
                type="button"
                :title="hidden(meta.id) ? '显示部件' : '隐藏部件'"
                @click.stop="store.toggleCategoryVisibility(meta.id)"
              >
                <EyeOff v-if="hidden(meta.id)" :size="13" />
                <Eye v-else :size="13" />
              </button>
              <ChevronDown :size="13" class="tree-chevron" :class="{ 'tree-chevron--open': expanded[meta.id] }" />
            </span>
          </div>

          <div v-if="!expanded[meta.id]" class="tree-installed-line">
            <template v-if="store.selection[meta.id] && store.byId.get(store.selection[meta.id] as string)">
              <span>{{ store.byId.get(store.selection[meta.id] as string)?.brand }}</span>
              <strong>{{ store.byId.get(store.selection[meta.id] as string)?.model }}</strong>
            </template>
            <template v-else>
              <span class="empty-slot">— 空槽位</span>
            </template>
          </div>

          <div v-if="expanded[meta.id]" class="tree-detail">
            <button
              v-if="!allOptions[meta.id] && store.selection[meta.id] && store.byId.get(store.selection[meta.id] as string)"
              type="button"
              class="installed-card"
              @click="inspect(store.byId.get(store.selection[meta.id] as string)!)"
            >
              <span class="installed-card__left">
                <span class="installed-card__badge"><CircleDot :size="11" /> 已安装</span>
                <strong>{{ store.byId.get(store.selection[meta.id] as string)?.brand }} {{ store.byId.get(store.selection[meta.id] as string)?.model }}</strong>
                <em>{{ store.byId.get(store.selection[meta.id] as string)?.tagline }}</em>
              </span>
              <span class="installed-card__right">
                <span>{{ priceOf(store.byId.get(store.selection[meta.id] as string)!) }}</span>
                <LocateFixed :size="13" />
              </span>
            </button>

            <div class="option-caption">
              <span>
                {{ meta.id === 'gpu' ? '按性价比排序' : '可选型号' }}
                <em v-if="onlyCompatible && hiddenCount(meta.id)" class="option-filter-note">已滤除 {{ hiddenCount(meta.id) }} 个不适配</em>
              </span>
              <button
                v-if="optionCount(meta.id) > 6"
                type="button"
                class="option-expand-mini"
                @click="toggleOptions(meta.id)"
              >
                {{ allOptions[meta.id] ? '收起' : `展开 ${optionCount(meta.id)}` }}
              </button>
              <span v-else>{{ optionCount(meta.id) }}</span>
            </div>

            <div class="option-list" :class="{ 'option-list--all': allOptions[meta.id] }">
              <button
                v-for="product in visibleOptions(meta.id).filter((p) => p.id !== store.selection[meta.id]).slice(0, allOptions[meta.id] ? 80 : 6)"
                :key="product.id"
                type="button"
                class="option-row"
                :title="optionHint(product)"
                @click="inspect(product)"
              >
                <span class="option-dot" :class="`option-dot--${optionState(product.id)}`" :title="optionHint(product)"></span>
                <span class="option-copy">
                  <strong>{{ product.brand }} {{ product.model }}</strong>
                  <em>
                    <span v-if="product.category === 'case'" class="option-style">{{ caseFrontLabel(caseFrontStyle(product)) }}</span>
                    {{ product.sku }}
                  </em>
                </span>
                <span class="option-price">{{ priceOf(product) }}</span>
                <span
                  class="mini-add"
                  role="button"
                  tabindex="0"
                  title="装载此型号"
                  @click.stop="choose(product)"
                  @keydown.enter.stop="choose(product)"
                ><Plus :size="13" /></span>
              </button>
              <div v-if="!optionCount(meta.id)" class="empty-note empty-note--small">
                <span>当前配置下没有可安装的{{ meta.label }}型号。</span>
                <button v-if="hiddenCount(meta.id)" type="button" class="link-btn" @click="onlyCompatible = false">
                  查看被滤除的 {{ hiddenCount(meta.id) }} 个型号
                </button>
              </div>
              <button
                v-if="optionCount(meta.id) > 6"
                type="button"
                class="option-more"
                @click="toggleOptions(meta.id)"
              >
                <span>{{ allOptions[meta.id] ? '收起型号列表' : `查看全部 ${optionCount(meta.id)} 款` }}</span>
                <ChevronDown :size="12" :class="{ 'option-more__icon--open': allOptions[meta.id] }" />
              </button>
            </div>

            <div class="tree-detail-actions">
              <button type="button" class="link-btn" @click="store.inspectProduct(store.selection[meta.id] ?? null)">
                {{ store.selection[meta.id] ? '检查已装组件' : '查看规格' }}
              </button>
              <button v-if="store.selection[meta.id]" type="button" class="link-btn link-btn--danger" @click.stop="store.removeProduct(meta.id)">
                移除
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="tree-footer">
      <div class="tree-footer__row">
        <span><Layers :size="12" /> 显示控制</span>
        <span>{{ store.hiddenIds.length }} 项隐藏</span>
      </div>
      <div class="display-controls">
        <button type="button" class="display-toggle" :class="{ 'display-toggle--on': store.autoRotate }" @click="store.autoRotate = !store.autoRotate">
          <RotateCw :size="12" /> 自动旋转
        </button>
        <button type="button" class="display-toggle" @click="store.showAllParts()">全部显示</button>
        <button
          type="button"
          class="display-toggle display-toggle--wide"
          :class="{ 'display-toggle--on': store.request.allowUsed }"
          @click="store.request.allowUsed = !store.request.allowUsed"
        >
          <CircleDollarSign :size="12" /> {{ store.request.allowUsed ? '含二手报价' : '仅全新报价' }}
        </button>
      </div>
      <div class="case-tint">
        <span class="case-tint__label">机箱配色</span>
        <div class="case-tint__swatches">
          <button
            v-for="tint in CASE_TINTS"
            :key="tint.label"
            type="button"
            class="case-tint__swatch"
            :class="{ 'is-active': store.caseTint === tint.value }"
            :title="tint.value ? `把机箱改成${tint.label}` : '恢复机箱原厂配色'"
            @click="store.caseTint = tint.value"
          >
            <i :style="{ background: tint.swatch }"></i>
            <span>{{ tint.label }}</span>
          </button>
        </div>
      </div>
      <div v-if="store.compatibility.issues.length" class="tree-alert">
        <AlertTriangle :size="12" />
        <span>{{ store.compatibility.errors.length }} 项冲突 · {{ store.compatibility.warnings.length }} 项风险</span>
      </div>
    </div>
  </aside>
</template>
