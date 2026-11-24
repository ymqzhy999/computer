import rawCatalog from './catalog.json'
import type { CatalogFile, Category, Product } from '../types'
import { CATEGORY_META } from './meta'

export const CATALOG = rawCatalog as unknown as CatalogFile
export const SEED_PRODUCTS = CATALOG.products as Product[]
export const SEED_MAP = new Map(SEED_PRODUCTS.map((p) => [p.id, p]))

export function productsByCategory(products: Product[], category: Category): Product[] {
  return products.filter((p) => p.category === category)
}

export function categoryOrder(category: Category): number {
  return CATEGORY_META.findIndex((c) => c.id === category)
}

export function seedProduct(id: string | null | undefined): Product | undefined {
  return id ? SEED_MAP.get(id) : undefined
}

export function catalogStats(products: Product[]) {
  const byCategory = Object.fromEntries(
    CATEGORY_META.map((c) => [c.id, products.filter((p) => p.category === c.id).length]),
  ) as Record<Category, number>
  const priced = products.filter((p) => p.price?.reference != null)
  const live = products.filter((p) => p.price?.status === 'live')
  const sample = products.filter((p) => p.price?.status === 'sample')
  const stale = products.filter((p) => p.price?.status === 'stale')
  const unavailable = products.filter((p) => !p.price?.reference)
  const brands = new Set(products.map((p) => p.brand))
  return {
    total: products.length,
    byCategory,
    priced: priced.length,
    live: live.length,
    sample: sample.length,
    stale: stale.length,
    unavailable: unavailable.length,
    coverage: products.length ? Math.round((priced.length / products.length) * 100) : 0,
    brands: brands.size,
  }
}
