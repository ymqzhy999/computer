import type { BuildSelection, Category, PriceSnapshot, Product } from '../types'
import { CORE_CATEGORIES } from '../data/meta'

export interface EffectiveQuote {
  value: number
  min: number | null
  max: number | null
  condition: 'new' | 'used'
  snapshot: PriceSnapshot | null
  source: string
  sourceUrl?: string
  updatedAt: string
}

export function formatPrice(value: number | null | undefined, currency = 'CNY'): string {
  if (value == null || Number.isNaN(value)) return '暂无报价'
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null) return '—'
  if (value >= 10000) return `¥${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 2)}万`
  return `¥${Math.round(value).toLocaleString('zh-CN')}`
}

export function effectiveQuote(product: Product | undefined, allowUsed = false): EffectiveQuote | null {
  if (!product) return null
  if (allowUsed && product.usedPrice) {
    return {
      value: product.usedPrice,
      min: product.usedPrice,
      max: product.usedPrice,
      condition: 'used',
      snapshot: product.price,
      source: '二手参考 · 演示样本',
      sourceUrl: product.price?.sourceUrl,
      updatedAt: product.price?.updatedAt ?? '—',
    }
  }
  if (product.price?.reference != null) {
    return {
      value: product.price.reference,
      min: product.price.min,
      max: product.price.max,
      condition: 'new',
      snapshot: product.price,
      source: product.price.source,
      sourceUrl: product.price.sourceUrl,
      updatedAt: product.price.updatedAt,
    }
  }
  return null
}

export function productPrice(product: Product | undefined, allowUsed = false): number | null {
  return effectiveQuote(product, allowUsed)?.value ?? null
}

export function priceAgeDays(updatedAt: string | undefined): number | null {
  if (!updatedAt || updatedAt === '—') return null
  const then = new Date(updatedAt).getTime()
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.floor((Date.now() - then) / 86400000))
}

export function quoteStateLabel(product: Product): { label: string; tone: 'live' | 'sample' | 'stale' | 'missing' } {
  if (!product.price?.reference) return { label: '暂无报价', tone: 'missing' }
  if (product.price.status === 'live') return { label: '实时报价', tone: 'live' }
  if (product.price.status === 'stale') return { label: '价格待更新', tone: 'stale' }
  return { label: '归档样本', tone: 'sample' }
}

export function selectionTotal(
  selection: BuildSelection,
  byId: Map<string, Product>,
  quantities: Record<string, number>,
  allowUsed = false,
): number {
  let total = 0
  for (const [category, productId] of Object.entries(selection)) {
    if (!productId) continue
    const product = byId.get(productId)
    if (!product) continue
    const quote = effectiveQuote(product, allowUsed)
    if (!quote) continue
    const qty = category === 'fan' ? Math.max(1, quantities.fan ?? 1) : 1
    total += quote.value * qty
  }
  return total
}

export function selectionRange(
  selection: BuildSelection,
  byId: Map<string, Product>,
  quantities: Record<string, number>,
  allowUsed = false,
): { min: number; max: number; reference: number; coverage: number } {
  let min = 0
  let max = 0
  let reference = 0
  let selected = 0
  let priced = 0
  for (const [category, productId] of Object.entries(selection)) {
    if (!productId) continue
    selected += 1
    const product = byId.get(productId)
    if (!product) continue
    const qty = category === 'fan' ? Math.max(1, quantities.fan ?? 1) : 1
    const quote = effectiveQuote(product, allowUsed)
    if (!quote) continue
    priced += 1
    reference += quote.value * qty
    min += (quote.min ?? quote.value) * qty
    max += (quote.max ?? quote.value) * qty
  }
  return { min, max, reference, coverage: selected ? priced / selected : 0 }
}

export function selectionCompleteness(selection: BuildSelection): number {
  const installed = CORE_CATEGORIES.filter((c) => Boolean(selection[c])).length
  return Math.round((installed / CORE_CATEGORIES.length) * 100)
}

export function categoryPriceFloor(products: Product[], category: Category): number | null {
  const prices = products
    .filter((p) => p.category === category)
    .map((p) => p.price?.reference)
    .filter((n): n is number => typeof n === 'number')
  return prices.length ? Math.min(...prices) : null
}
