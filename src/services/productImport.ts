import type { Category, PriceSnapshot, Product, ProductAttrs, PerformanceVector } from '../types'

const CATEGORIES: Category[] = [
  'cpu',
  'motherboard',
  'gpu',
  'memory',
  'ssd',
  'hdd',
  'psu',
  'cooler',
  'case',
  'fan',
  'expansion',
]

const ACCENTS: Record<Category, string> = {
  cpu: '#7fa8bd',
  motherboard: '#38b6d6',
  gpu: '#c99a63',
  memory: '#59e0b6',
  ssd: '#8fb8ff',
  hdd: '#7f9bb0',
  psu: '#d7b56d',
  cooler: '#74d7ff',
  case: '#9ab7c6',
  fan: '#5ce0d0',
  expansion: '#c1a3ff',
}

export interface ImportResult {
  products: Product[]
  errors: string[]
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42)
}

function num(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(String(value).replace(/[¥￥,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : undefined
}

function defaultPerformance(category: Category): PerformanceVector {
  const base: Record<Category, number> = {
    cpu: 58,
    motherboard: 45,
    gpu: 60,
    memory: 50,
    ssd: 58,
    hdd: 18,
    psu: 42,
    cooler: 48,
    case: 40,
    fan: 22,
    expansion: 30,
  }
  const value = base[category]
  return { index: value, gaming: value, productivity: value, single: value, multi: value }
}

function makePrice(raw: Record<string, unknown>): PriceSnapshot | null {
  const reference = num(raw.price ?? raw.reference ?? raw['参考价'])
  if (reference == null || reference <= 0) return null
  const min = num(raw.min) ?? reference
  const max = num(raw.max) ?? reference
  return {
    reference,
    min: Math.min(min, reference),
    max: Math.max(max, reference),
    currency: 'CNY',
    region: 'CN',
    source: String(raw.source ?? '用户导入 / 手动录入'),
    sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : undefined,
    updatedAt: new Date().toISOString(),
    status: 'sample',
    confidence: 'low',
    note: '用户提供数据，未经平台实时核验；请以零售渠道页面为准。',
  }
}

export function normalizeProduct(raw: Record<string, unknown>, index = 0): Product | null {
  const category = String(raw.category ?? '').trim().toLowerCase() as Category
  if (!CATEGORIES.includes(category)) return null
  const brand = String(raw.brand ?? '').trim()
  const model = String(raw.model ?? '').trim()
  if (!brand || !model) return null
  const id = String(raw.id ?? `custom-${category}-${slug(brand)}-${slug(model)}-${index}`)
  const attrs = (raw.attrs && typeof raw.attrs === 'object' ? raw.attrs : {}) as ProductAttrs
  const specs = (raw.specs && typeof raw.specs === 'object' ? raw.specs : {}) as Record<string, string | number>
  const performance = raw.performance && typeof raw.performance === 'object'
    ? ({ ...defaultPerformance(category), ...(raw.performance as PerformanceVector) } as PerformanceVector)
    : defaultPerformance(category)
  const price = makePrice(raw)

  return {
    id,
    category,
    brand,
    model,
    sku: String(raw.sku ?? `CUSTOM-${String(index + 1).padStart(3, '0')}`),
    releasedAt: String(raw.releasedAt ?? new Date().toISOString().slice(0, 10)),
    status: raw.status === 'eol' || raw.status === 'upcoming' ? raw.status : 'active',
    tagline: String(raw.tagline ?? '用户自定义配件'),
    description: String(raw.description ?? '由用户导入或手动添加的配件。规格与价格未经平台核验，仅用于本地配置规划。'),
    attrs,
    specs: Object.keys(specs).length ? specs : { 数据来源: '用户导入' },
    price,
    usedPrice: num(raw.usedPrice),
    performance,
    visual: { accent: ACCENTS[category] },
  }
}

export function parseJsonProducts(text: string): ImportResult {
  const errors: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return { products: [], errors: [`JSON 解析失败：${(error as Error).message}`] }
  }
  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed && Array.isArray((parsed as { products?: unknown[] }).products)
      ? (parsed as { products: unknown[] }).products
      : []
  if (!list.length) return { products: [], errors: ['未找到产品数组。支持顶层数组或 { "products": [] }。'] }

  const products: Product[] = []
  list.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push(`第 ${index + 1} 条不是对象`)
      return
    }
    const product = normalizeProduct(item as Record<string, unknown>, index)
    if (!product) errors.push(`第 ${index + 1} 条缺少有效的 category 或 brand/model`)
    else products.push(product)
  })
  return { products, errors }
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

export function parseCsvProducts(text: string): ImportResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return { products: [], errors: ['CSV 至少需要表头和一行数据。'] }
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const required = ['category', 'brand', 'model']
  const missing = required.filter((r) => !headers.includes(r))
  if (missing.length) return { products: [], errors: [`缺少必需列：${missing.join(', ')}`] }

  const products: Product[] = []
  const errors: string[] = []
  lines.slice(1).forEach((line, index) => {
    const cells = parseCsvLine(line)
    const raw: Record<string, string> = {}
    headers.forEach((header, i) => {
      raw[header] = cells[i] ?? ''
    })
    const product = normalizeProduct(raw, index)
    if (!product) errors.push(`第 ${index + 2} 行缺少有效 category/brand/model`)
    else products.push(product)
  })
  return { products, errors }
}
