<script setup lang="ts">
import { computed, ref } from 'vue'
import { CircleHelp, Search } from 'lucide-vue-next'
import { useBuildStore } from '../stores/build'
import { TAB_META } from '../data/meta'
import { formatPrice, productPrice } from '../services/pricing'
import type { Product } from '../types'

const store = useBuildStore()
const active = computed(() => store.activeTab)
const liveQuotes = computed(() => store.allProducts.filter((p) => p.price?.status === 'live').length)
const searchOpen = ref(false)
const globalResults = computed<Product[]>(() => {
  const rawQ = store.globalQuery.trim().toLowerCase()
  if (!rawQ) return []
  const normQ = rawQ.replace(/[\s\-_]+/g, '')
  return store.allProducts
    .filter((p) => {
      const attrs = p.attrs as Record<string, unknown>
      const texts = [
        p.brand,
        p.model,
        p.sku,
        p.tagline,
        (attrs.gpuChip as string) || '',
        ...Object.values(p.specs || {}),
      ]
        .join(' ')
        .toLowerCase()
      const normText = texts.replace(/[\s\-_]+/g, '')
      return texts.includes(rawQ) || (normQ ? normText.includes(normQ) : false)
    })
    .slice(0, 10)
})

function selectResult(product: Product) {
  store.globalQuery = ''
  searchOpen.value = false
  if (store.activeTab !== 'assembly' && store.activeTab !== 'teardown') store.setTab('assembly')
  store.inspectProduct(product.id)
}

</script>

<template>
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">
        <span class="brand-mark__core"></span>
        <span class="brand-mark__ring"></span>
        <span class="brand-mark__axis brand-mark__axis--x"></span>
        <span class="brand-mark__axis brand-mark__axis--y"></span>
      </div>
      <div class="brand-copy">
        <div class="brand-name">PC <em>FORGE</em></div>
        <div class="brand-sub">电脑硬件配置与装配</div>
      </div>
    </div>

    <nav class="main-tabs" aria-label="主导航">
      <button
        v-for="tab in TAB_META"
        :key="tab.id"
        class="main-tab"
        :class="{ 'main-tab--active': active === tab.id }"
        type="button"
        :aria-current="active === tab.id ? 'page' : undefined"
        @click="store.setTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <div class="topbar-side">
      <div class="global-search">
        <Search :size="13" />
        <input
          v-model="store.globalQuery"
          type="search"
          placeholder="搜索硬件型号"
          aria-label="搜索硬件型号"
          @focus="searchOpen = true"
          @blur="searchOpen = false"
          @keydown.esc="searchOpen = false"
        />
        <div v-if="searchOpen && globalResults.length" class="global-results">
          <button
            v-for="item in globalResults"
            :key="item.id"
            type="button"
            @mousedown.prevent="selectResult(item)"
          >
            <span>{{ item.brand }} {{ item.model }}</span>
            <em>{{ formatPrice(productPrice(item)) }}</em>
          </button>
        </div>
      </div>
      <button class="top-icon" type="button" title="快捷键：1-5 切换页面，空格播放/暂停拆解，Esc 取消选择" aria-label="快捷键说明">
        <CircleHelp :size="16" />
      </button>
      <div class="topbar-total">
        <span>整机参考价</span>
        <strong>{{ formatPrice(store.total) }}</strong>
        <em>{{ store.installedCount }} 个组件 · {{ liveQuotes ? '实时报价' : '归档样本' }}</em>
      </div>
    </div>
  </header>
</template>
