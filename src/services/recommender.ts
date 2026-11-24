import type {
  AlternativePart,
  BuildLine,
  BuildMetrics,
  BuildRequest,
  BuildSelection,
  Category,
  CompatibilityReport,
  Product,
  RecommendedBuild,
} from '../types'
import { CATEGORY_META, CORE_CATEGORIES, SCENARIOS, categoryMeta, scenarioMeta, scenarioTarget } from '../data/meta'
import { effectiveQuote, formatPrice, selectionTotal } from './pricing'
import { evaluateCompatibility, estimatePower } from './compatibility'
import { computeMetrics } from './metrics'

interface PricedProduct {
  product: Product
  price: number
}

interface BuildDraft {
  selection: BuildSelection
  quantities: Record<string, number>
  total: number
  reserve: number
}

interface TierConfig {
  tier: RecommendedBuild['tier']
  label: string
  budgetFactor: number
}

function quoteValue(product: Product, allowUsed: boolean): number | null {
  return effectiveQuote(product, allowUsed)?.value ?? null
}

function affordable(products: Product[], allowUsed: boolean): PricedProduct[] {
  return products
    .map((product) => ({ product, price: quoteValue(product, allowUsed) ?? 0 }))
    .filter((x) => x.price > 0)
}

function priceOf(product: Product | undefined, allowUsed: boolean): number {
  return product ? (quoteValue(product, allowUsed) ?? 0) : 0
}

function minPrice(items: PricedProduct[]): number {
  return items.length ? Math.min(...items.map((i) => i.price)) : 0
}

function brandBonus(product: Product, request: BuildRequest): number {
  if (!request.brands.length) return 0
  const b = product.brand
  const chipVendor = product.attrs.chipVendor ?? ''
  const chip = product.attrs.gpuChip ?? ''
  const socket = product.attrs.socket ?? ''
  const model = product.model.toUpperCase()
  
  for (const target of request.brands) {
    if (b === target) return 15
    if (target === 'NVIDIA' && (chipVendor === 'NVIDIA' || chip.includes('RTX') || chip.includes('GTX') || model.includes('RTX') || model.includes('GTX'))) return 15
    if (target === 'AMD' && (chipVendor === 'AMD' || chip.includes('RX') || chip.includes('Radeon') || socket.startsWith('AM') || model.includes('RYZEN'))) return 15
    if (target === 'Intel' && (chipVendor === 'Intel' || chip.includes('Arc') || socket.startsWith('LGA') || model.includes('CORE') || model.includes('酷睿'))) return 15
  }
  return 0
}

function aestheticBonus(product: Product, request: BuildRequest): number {
  const color = `${product.attrs.color ?? ''} ${product.visual?.tone ?? ''}`.toLowerCase()
  if (request.aesthetic === 'white') return /white|白/.test(color) ? 12 : 0
  if (request.aesthetic === 'black') return /black|黑/.test(color) ? 12 : 0
  if (request.aesthetic === 'rgb') return product.attrs.rgb ? 10 : 0
  if (request.aesthetic === 'minimal') return product.attrs.rgb ? 0 : 8
  return 0
}

function chooseBest(
  items: PricedProduct[],
  cap: number,
  rank: (item: PricedProduct) => number,
): PricedProduct | undefined {
  if (!items.length) return undefined
  const affordableItems = items.filter((i) => i.price <= Math.max(0, cap))
  const pool = affordableItems.length ? affordableItems : [items.slice().sort((a, b) => a.price - b.price)[0]]
  return pool
    .slice()
    .sort((a, b) => rank(b) - rank(a) || b.price - a.price)[0]
}

function cpuScore(product: Product, scenario: BuildRequest['scenario']): number {
  const p = product.performance
  if (!p) return 0
  switch (scenario) {
    case 'office':
      return p.single * 0.5 + p.multi * 0.3 + p.productivity * 0.2
    case 'video':
    case 'ai':
      return p.multi * 0.5 + p.productivity * 0.3 + p.single * 0.2
    case 'modeling':
      return p.multi * 0.45 + p.single * 0.3 + p.productivity * 0.25
    case 'coding':
      return p.multi * 0.5 + p.single * 0.3 + p.productivity * 0.2
    default:
      return p.gaming * 0.8 + p.single * 0.2
  }
}

function gpuScore(product: Product, scenario: BuildRequest['scenario']): number {
  const p = product.performance
  if (!p) return 0
  switch (scenario) {
    case 'office':
    case 'coding':
      return p.index * 0.6 + p.productivity * 0.4
    case 'video':
      return p.productivity * 0.55 + p.gaming * 0.2 + (p.vram ?? 40) * 0.25
    case 'modeling':
      return p.productivity * 0.5 + p.gaming * 0.2 + (p.vram ?? 40) * 0.3
    case 'ai':
      return (p.vram ?? 40) * 0.5 + p.productivity * 0.3 + p.index * 0.2
    default:
      return p.gaming * 0.85 + p.index * 0.15
  }
}

function scenarioWeights(request: BuildRequest) {
  return scenarioMeta(request.scenario).weights
}

function scenarioValue(selection: BuildSelection, byId: Map<string, Product>, request: BuildRequest): number {
  const s = selection
  const cpu = s.cpu ? byId.get(s.cpu) : undefined
  const gpu = s.gpu ? byId.get(s.gpu) : undefined
  const memory = s.memory ? byId.get(s.memory) : undefined
  const ssd = s.ssd ? byId.get(s.ssd) : undefined
  const cooler = s.cooler ? byId.get(s.cooler) : undefined
  const weights = scenarioWeights(request)
  const ramCap = memory?.attrs.memoryCapacity ?? 0
  const ssdCap = ssd?.attrs.capacityGb ?? 0
  return (
    cpuScore(cpu ?? ({} as Product), request.scenario) * weights.cpu +
    gpuScore(gpu ?? ({} as Product), request.scenario) * weights.gpu +
    ((memory?.performance?.index ?? 0) * 0.68 + Math.min(100, (ramCap / 64) * 100) * 0.32) * weights.ram +
    ((ssd?.performance?.index ?? 0) * 0.72 + Math.min(100, (ssdCap / 2000) * 100) * 0.28) * weights.ssd +
    (cooler?.performance?.index ?? 0) * weights.cooling
  )
}

function buildReason(
  category: Category,
  product: Product,
  selection: BuildSelection,
  byId: Map<string, Product>,
  request: BuildRequest,
): string {
  const cpu = selection.cpu ? byId.get(selection.cpu) : undefined
  const mb = selection.motherboard ? byId.get(selection.motherboard) : undefined
  const psu = selection.psu ? byId.get(selection.psu) : undefined
  const chassis = selection.case ? byId.get(selection.case) : undefined
  const a = product.attrs
  switch (category) {
    case 'cpu':
      return `${a.cores ?? '—'} 核 ${a.threads ?? '—'} 线程，${a.socket ?? '—'} 平台。${request.scenario === 'gaming' ? '游戏单核与缓存表现优先。' : '多核吞吐满足生产力任务。'}`
    case 'gpu':
      return `${a.vramGb ?? '—'} GB 显存 · ${a.gpuChip ?? '—'}。${request.scenario === 'ai' ? '显存容量优先，便于本地模型驻留。' : request.scenario === 'gaming' ? `面向 ${request.resolution} 分辨率游戏与光追。` : '兼顾图形与通用计算吞吐。'}`
    case 'motherboard':
      return `${a.chipset ?? '—'} 芯片组 · ${a.formFactor ?? '—'} · ${a.m2Slots ?? '—'} 个 M.2。${a.wifi ? `集成 ${a.wifi}。` : '扩展槽满足后续升级。'}`
    case 'memory':
      return `${a.memoryCapacity ?? '—'} GB ${a.memoryType ?? ''} · ${a.memorySpeed ?? '—'} MT/s。${(a.memorySticks ?? 1) > 1 ? '双通道套装。' : ''}`
    case 'ssd':
      return `${(a.capacityGb ?? 0) >= 1000 ? `${Math.round((a.capacityGb ?? 0) / 1024)} TB` : `${a.capacityGb ?? 0} GB`} · ${a.interface ?? '—'}，顺序读 ${a.readMbps ?? '—'} MB/s。`
    case 'psu':
      return `${a.wattage ?? '—'} W · ${a.efficiency ?? '—'} · ${a.atxVersion ?? ''}。为峰值功耗保留余量。`
    case 'cooler':
      return `${a.coolerType === 'aio' ? '一体式水冷' : a.coolerType === 'stock' ? '下压式风冷' : '双塔风冷'} · 标称 ${a.coolerTdp ?? '—'} W 解热能力。`
    case 'case':
      return `${a.formFactor ?? '—'} · 支持最长 ${a.maxGpuLengthMm ?? '—'} mm 显卡 · ${a.fanSlots ?? '—'} 个风扇位。`
    case 'fan':
      return `${a.fanSizeMm ?? '—'} mm · ${a.rgb ? 'ARGB' : '无光'} · ${a.rpm ?? '—'} RPM。`
    case 'hdd':
      return `${a.capacityGb ? Math.round(a.capacityGb / 1024) : '—'} TB · ${a.rpm ?? '—'} RPM 机械存储。`
    default:
      return product.tagline
  }
}

function buildLines(selection: BuildSelection, byId: Map<string, Product>, quantities: Record<string, number>, allowUsed: boolean): BuildLine[] {
  const lines: BuildLine[] = []
  for (const meta of CATEGORY_META) {
    const id = selection[meta.id]
    if (!id) continue
    const product = byId.get(id)
    if (!product) continue
    const quote = effectiveQuote(product, allowUsed)
    const qty = meta.id === 'fan' ? Math.max(1, quantities.fan ?? 1) : 1
    lines.push({
      category: meta.id,
      productId: product.id,
      label: meta.label,
      model: `${product.brand} ${product.model}`.trim(),
      price: (quote?.value ?? 0) * qty,
      condition: quote?.condition ?? 'new',
      reason: '',
      quantity: qty,
    })
  }
  return lines
}

function alternativesFor(
  selection: BuildSelection,
  byId: Map<string, Product>,
  quantities: Record<string, number>,
  category: Category,
  allowUsed: boolean,
): AlternativePart[] {
  const currentId = selection[category]
  if (!currentId) return []
  const current = byId.get(currentId)
  if (!current) return []
  const currentPrice = priceOf(current, allowUsed)
  const candidates = Array.from(byId.values())
    .filter((p) => p.category === category && p.id !== currentId)
    .map((p) => ({ p, price: priceOf(p, allowUsed) }))
    .filter((x) => x.price > 0 && Math.abs(x.price - currentPrice) <= Math.max(700, currentPrice * 0.7))
  const result: AlternativePart[] = []
  for (const candidate of candidates.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))) {
    if (result.length >= 3) break
    const report = evaluateCompatibility({ ...selection, [category]: candidate.p.id }, byId, quantities)
    if (report.status === 'blocked') continue
    result.push({
      id: candidate.p.id,
      label: `${candidate.p.brand} ${candidate.p.model}`,
      delta: Math.round(candidate.price - currentPrice),
    })
  }
  return result
}

function upgradePath(selection: BuildSelection, byId: Map<string, Product>, metrics: BuildMetrics, quantities: Record<string, number>): string[] {
  const out: string[] = []
  const cpu = selection.cpu ? byId.get(selection.cpu) : undefined
  const mb = selection.motherboard ? byId.get(selection.motherboard) : undefined
  const chassis = selection.case ? byId.get(selection.case) : undefined
  const psu = selection.psu ? byId.get(selection.psu) : undefined
  const mem = selection.memory ? byId.get(selection.memory) : undefined
  const socket = cpu?.attrs.socket ?? mb?.attrs.socket
  if (socket === 'AM5') out.push('AM5 平台仍在生命周期内，可后续升级 Ryzen 9000 / X3D 系列。')
  else if (socket === 'AM4') out.push('AM4 已进入平台末期，建议下一代整体升级。')
  else if (socket === 'LGA1851') out.push('LGA1851 可升级 Core Ultra 200S 更高阶型号。')
  else if (socket === 'LGA1700') out.push('LGA1700 平台升级空间有限，下一次建议同步更换主板与内存。')
  if (mb && mem) {
    const slots = mb.attrs.memorySlots ?? 0
    const used = mem.attrs.memorySticks ?? 1
    if (slots > used) out.push(`主板仍有 ${slots - used} 个空闲 DIMM 插槽，可扩展内存容量。`)
  }
  if (mb?.attrs.m2Slots && mb.attrs.m2Slots > 1) out.push(`剩余 ${mb.attrs.m2Slots - 1} 个 M.2 插槽可用于加装固态硬盘。`)
  if (psu) out.push(`电源余量约 ${metrics.power.headroom} W，可支撑一定程度的显卡升级。`)
  if (chassis?.attrs.maxGpuLengthMm) out.push(`机箱支持最长 ${chassis.attrs.maxGpuLengthMm} mm 显卡，保留升级空间。`)
  if (!selection.fan && quantities.fan) out.push('可加装机箱风扇改善进风与显卡温度。')
  return out.slice(0, 5)
}

interface ConstructContext {
  request: BuildRequest
  products: Product[]
  byId: Map<string, Product>
  budget: number
  allowUsed: boolean
  byCategory: Map<Category, PricedProduct[]>
  minCategoryPrice: Partial<Record<Category, number>>
}

function minRestCost(ctx: ConstructContext, categories: Category[]): number {
  return categories.reduce((sum, cat) => sum + (ctx.minCategoryPrice[cat] ?? 0), 0)
}

function constructBuild(cpu: Product, gpu: Product, ctx: ConstructContext): BuildDraft | null {
  const { request, budget, allowUsed, byCategory } = ctx
  const cpuP = priceOf(cpu, allowUsed)
  const gpuP = priceOf(gpu, allowUsed)
  const minRest = minRestCost(ctx, ['motherboard', 'memory', 'ssd', 'psu', 'cooler', 'case'])
  if (cpuP + gpuP + minRest > budget) return null

  const selection: BuildSelection = { cpu: cpu.id, gpu: gpu.id, motherboard: null, memory: null, ssd: null, psu: null, cooler: null, case: null, fan: null, hdd: null, expansion: null }
  const quantities: Record<string, number> = { fan: 0 }
  let spent = cpuP + gpuP

  const target = scenarioTarget(request.scenario, request.workload)
  const scenarioRam = scenarioMeta(request.scenario).targetRam
  const wantedRam = Math.max(target?.minRam ?? 0, budget < 5200 ? 16 : budget < 9000 ? Math.min(32, scenarioRam) : scenarioRam)
  const memoryPool = byCategory.get('memory') ?? []
  const maxRam = Math.max(16, ...memoryPool.map((p) => p.product.attrs.memoryCapacity ?? 0))
  const targetRam = Math.min(wantedRam, maxRam)
  const targetSsd = Math.max(target?.minSsd ?? 0, budget < 5200 ? 1 : scenarioMeta(request.scenario).targetSsd)

  const minMb = minRestCost(ctx, ['memory', 'ssd', 'psu', 'cooler', 'case'])
  const allMbs = byCategory.get('motherboard') ?? []
  const mbItems = allMbs.filter(
    (p) =>
      (!cpu.attrs.socket || p.product.attrs.socket === cpu.attrs.socket) &&
      (!cpu.attrs.memoryType || !p.product.attrs.memoryType || p.product.attrs.memoryType === cpu.attrs.memoryType),
  )
  const mbCap = Math.min(Math.max(budget * 0.16, 420), budget - spent - minMb)
  const mbPick = chooseBest(mbItems, mbCap, (item) => {
    const a = item.product.attrs
    return (item.product.performance?.index ?? 0) * 0.45 + (a.m2Slots ?? 0) * 2 + (a.wifi ? 5 : 0) + (a.formFactor === 'ATX' ? 5 : 0) + brandBonus(item.product, request) + aestheticBonus(item.product, request)
  })
  if (!mbPick) return null
  selection.motherboard = mbPick.product.id
  spent += mbPick.price

  const allCases = byCategory.get('case') ?? []
  const caseItems = allCases.filter((p) => {
    const support = p.product.attrs.supportedFormFactors ?? []
    if (support.length && mbPick.product.attrs.formFactor && !support.includes(mbPick.product.attrs.formFactor)) return false
    if (p.product.attrs.maxGpuLengthMm != null && gpu.attrs.lengthMm != null && p.product.attrs.maxGpuLengthMm < gpu.attrs.lengthMm) return false
    return true
  })
  const minCase = minRestCost(ctx, ['memory', 'ssd', 'psu', 'cooler'])
  const caseCap = Math.min(Math.max(budget * 0.13, 380), budget - spent - minCase)
  const casePick = chooseBest(caseItems, caseCap, (item) => {
    const a = item.product.attrs
    return (a.fanSlots ?? 0) * 2 + (a.includedFans ?? 0) * 4 + (a.maxGpuLengthMm ?? 0) / 40 + (a.maxCoolerHeightMm ?? 0) / 30 + brandBonus(item.product, request) + aestheticBonus(item.product, request)
  })
  if (!casePick) return null
  selection.case = casePick.product.id
  spent += casePick.price

  const allCoolers = byCategory.get('cooler') ?? []
  const coolerItems = allCoolers.filter((p) => {
    if (!p.product.attrs.cpuSockets?.includes(cpu.attrs.socket ?? '')) return false
    if ((p.product.attrs.coolerTdp ?? 0) < (cpu.attrs.tdp ?? 0)) return false
    if (p.product.attrs.coolerType === 'air' && p.product.attrs.coolerHeightMm != null && casePick.product.attrs.maxCoolerHeightMm != null && p.product.attrs.coolerHeightMm > casePick.product.attrs.maxCoolerHeightMm) return false
    if (p.product.attrs.coolerType === 'aio' && p.product.attrs.radiatorSize != null) {
      const support = casePick.product.attrs.radiatorSupport ?? []
      if (support.length && !support.includes(p.product.attrs.radiatorSize)) return false
    }
    return true
  })
  const minCoolerRest = minRestCost(ctx, ['memory', 'ssd', 'psu'])
  const coolerCap = Math.min(Math.max(budget * 0.12, 180), budget - spent - minCoolerRest)
  const coolerPick = chooseBest(coolerItems, coolerCap, (item) => {
    const a = item.product.attrs
    return (item.product.performance?.index ?? 0) + (a.coolerTdp ?? 0) / 25 + brandBonus(item.product, request) + aestheticBonus(item.product, request)
  })
  if (!coolerPick) return null
  selection.cooler = coolerPick.product.id
  spent += coolerPick.price

  const memoryItems = memoryPool.filter((p) => {
    if (p.product.attrs.memoryType !== mbPick.product.attrs.memoryType) return false
    if (p.product.attrs.memorySticks != null && mbPick.product.attrs.memorySlots != null && p.product.attrs.memorySticks > mbPick.product.attrs.memorySlots) return false
    if ((p.product.attrs.memoryCapacity ?? 0) < targetRam) return false
    return true
  })
  const minMemRest = minRestCost(ctx, ['ssd', 'psu'])
  const memCap = Math.min(Math.max(budget * 0.14, 240), budget - spent - minMemRest)
  const memPick = chooseBest(memoryItems, memCap, (item) => {
    const a = item.product.attrs
    return (a.memoryCapacity ?? 0) / 12 + (a.memorySpeed ?? 0) / 160 + (item.product.performance?.index ?? 0) / 8 + brandBonus(item.product, request) + aestheticBonus(item.product, request)
  })
  if (!memPick) return null
  selection.memory = memPick.product.id
  spent += memPick.price

  const allSsds = byCategory.get('ssd') ?? []
  const wantedSsd = allSsds.filter((p) => (p.product.attrs.capacityGb ?? 0) >= targetSsd * 900)
  const ssdItems = wantedSsd.length ? wantedSsd : allSsds
  const minSsdRest = minRestCost(ctx, ['psu'])
  const ssdCap = Math.min(Math.max(budget * 0.14, 180), budget - spent - minSsdRest)
  const ssdPick = chooseBest(ssdItems, ssdCap, (item) => {
    const a = item.product.attrs
    return (item.product.performance?.index ?? 0) + (a.capacityGb ?? 0) / 700 + brandBonus(item.product, request)
  })
  if (!ssdPick) return null
  selection.ssd = ssdPick.product.id
  spent += ssdPick.price

  const partialReport = estimatePower(selection, ctx.byId, quantities)
  const allPsus = byCategory.get('psu') ?? []
  const psuItems = allPsus.filter(
    (p) =>
      (p.product.attrs.wattage ?? 0) >= Math.min(partialReport.recommendedPsu, 1000) &&
      (gpu.attrs.pcie12vhpwr ? (p.product.attrs.pcie12vhpwr ?? 0) > 0 || (p.product.attrs.pcie8 ?? 0) >= 3 : true),
  )
  const psuFallback = allPsus.filter((p) => (p.product.attrs.wattage ?? 0) >= partialReport.peak)
  const psuPool = psuItems.length ? psuItems : psuFallback
  const psuCap = Math.min(Math.max(budget * 0.14, 180), budget - spent)
  const psuPick = chooseBest(psuPool, psuCap, (item) => {
    const a = item.product.attrs
    const eff = a.efficiency?.includes('Platinum')
      ? 18
      : a.efficiency?.includes('Gold')
        ? 12
        : a.efficiency?.includes('Bronze')
          ? 6
          : 0
    return (a.wattage ?? 0) / 45 + eff + (a.pcie12vhpwr ? 8 : 0) + (a.atxVersion?.startsWith('ATX 3') ? 5 : 0) + brandBonus(item.product, request)
  })
  if (!psuPick) return null
  selection.psu = psuPick.product.id
  spent += psuPick.price

  const fanSlots = Math.max(0, (casePick.product.attrs.fanSlots ?? 0) - (casePick.product.attrs.includedFans ?? 0))
  if (fanSlots > 0 && budget - spent > 220) {
    const fanItems = byCategory.get('fan') ?? []
    const qty = Math.min(fanSlots, request.scenario === 'office' ? 2 : 4)
    const fanCap = Math.min(300, budget - spent - 120)
    const fanPick = chooseBest(fanItems, fanCap / Math.max(1, qty), (item) => {
      const a = item.product.attrs
      return (a.rpm ?? 0) / 120 + (a.rgb ? 6 : 0) + brandBonus(item.product, request) + aestheticBonus(item.product, request)
    })
    if (fanPick && fanPick.price * qty <= budget - spent) {
      selection.fan = fanPick.product.id
      quantities.fan = qty
      spent += fanPick.price * qty
    }
  }

  return { selection, quantities, total: spent, reserve: 0 }
}

function tryUpgrade(draft: BuildDraft, ctx: ConstructContext): void {
  const order: Category[] = ['cooler', 'case', 'memory', 'ssd', 'psu', 'fan']
  for (let pass = 0; pass < 2; pass += 1) {
    for (const category of order) {
      const currentId = draft.selection[category]
      const current = currentId ? ctx.byId.get(currentId) : undefined
      const currentPrice = priceOf(current, ctx.allowUsed) * (category === 'fan' ? Math.max(1, draft.quantities.fan ?? 1) : 1)
      const leftover = ctx.budget - draft.total
      if (leftover < 60) continue
      const pool = ctx.byCategory.get(category) ?? []
      const candidates = pool.filter((p) => {
        if (p.product.id === currentId) return false
        if (category === 'fan' && draft.quantities.fan) {
          return p.price <= currentPrice + leftover / Math.max(1, draft.quantities.fan)
        }
        return p.price <= currentPrice + leftover
      })
      if (!candidates.length) continue
      const currentRank = current
        ? (current.performance?.index ?? 0) + aestheticBonus(current, ctx.request)
        : 0
      const best = candidates
        .slice()
        .sort((a, b) => ((b.product.performance?.index ?? 0) + aestheticBonus(b.product, ctx.request)) - ((a.product.performance?.index ?? 0) + aestheticBonus(a.product, ctx.request)))[0]
      if (!best) continue
      const bestRank = (best.product.performance?.index ?? 0) + aestheticBonus(best.product, ctx.request)
      if (bestRank <= currentRank + 1) continue
      const testSelection = { ...draft.selection, [category]: best.product.id }
      const report = evaluateCompatibility(testSelection, ctx.byId, draft.quantities)
      if (report.status === 'blocked') continue
      const qty = category === 'fan' ? Math.max(1, draft.quantities.fan ?? 1) : 1
      const newTotal = draft.total - currentPrice + best.price * qty
      if (newTotal > ctx.budget) continue
      draft.selection[category] = best.product.id
      draft.total = newTotal
    }
  }
}

function tryDowngrade(draft: BuildDraft, ctx: ConstructContext): boolean {
  const order: Category[] = ['fan', 'case', 'cooler', 'ssd', 'memory', 'psu', 'motherboard']
  for (let guard = 0; guard < 16 && draft.total > ctx.budget; guard += 1) {
    let changed = false
    for (const category of order) {
      if (draft.total <= ctx.budget) break
      const currentId = draft.selection[category]
      if (!currentId) continue
      const current = ctx.byId.get(currentId)
      if (!current) continue
      const qty = category === 'fan' ? Math.max(1, draft.quantities.fan ?? 1) : 1
      const currentPrice = priceOf(current, ctx.allowUsed) * qty
      const pool = ctx.byCategory.get(category) ?? []
      const candidates = pool.filter((p) => p.product.id !== currentId && p.price < currentPrice / qty)
      for (const candidate of candidates.sort((a, b) => b.price - a.price)) {
        const testSelection = { ...draft.selection, [category]: candidate.product.id }
        if (category === 'motherboard') {
          const cpu = draft.selection.cpu ? ctx.byId.get(draft.selection.cpu) : undefined
          const memory = draft.selection.memory ? ctx.byId.get(draft.selection.memory) : undefined
          if (cpu && candidate.product.attrs.socket !== cpu.attrs.socket) continue
          if (memory && candidate.product.attrs.memoryType !== memory.attrs.memoryType) continue
        }
        if (category === 'case') {
          const gpu = draft.selection.gpu ? ctx.byId.get(draft.selection.gpu) : undefined
          const mb = draft.selection.motherboard ? ctx.byId.get(draft.selection.motherboard) : undefined
          if (mb?.attrs.formFactor && candidate.product.attrs.supportedFormFactors?.length && !candidate.product.attrs.supportedFormFactors.includes(mb.attrs.formFactor)) continue
          if (gpu?.attrs.lengthMm && candidate.product.attrs.maxGpuLengthMm != null && candidate.product.attrs.maxGpuLengthMm < gpu.attrs.lengthMm) continue
        }
        const report = evaluateCompatibility(testSelection, ctx.byId, draft.quantities)
        if (report.status === 'blocked') continue
        const saving = currentPrice - candidate.price * qty
        if (saving <= 0) continue
        draft.selection[category] = candidate.product.id
        draft.total -= saving
        changed = true
        break
      }
    }
    if (!changed) break
  }
  return draft.total <= ctx.budget
}

function describeTier(tier: RecommendedBuild['tier'], request: BuildRequest): { title: string; subtitle: string } {
  const scenarioLabel = scenarioMeta(request.scenario).label
  if (tier === 'value') return { title: '预算优先方案', subtitle: `${scenarioLabel} · 保留升级余量` }
  if (tier === 'performance') return { title: '性能优先方案', subtitle: `${scenarioLabel} · 预算内最大化性能` }
  return { title: '均衡推荐方案', subtitle: `${scenarioLabel} · 兼容、性能与价格平衡` }
}

function scoreDraft(
  draft: BuildDraft,
  ctx: ConstructContext,
  compatibility: CompatibilityReport,
  metrics: BuildMetrics,
  tier: RecommendedBuild['tier'],
): number {
  const scen = scenarioValue(draft.selection, ctx.byId, ctx.request)
  const value = (scen / Math.max(1, draft.total)) * 10000
  const balance = metrics.performance.balance
  const memory = draft.selection.memory ? ctx.byId.get(draft.selection.memory) : undefined
  const ramCapacity = memory?.attrs.memoryCapacity ?? 0
  const targetRam = Math.max(
    scenarioMeta(ctx.request.scenario).targetRam,
    scenarioTarget(ctx.request.scenario, ctx.request.workload)?.minRam ?? 0,
  )
  const ramPenalty = Math.max(0, targetRam - ramCapacity) * 2.4
  const riskPenalty = compatibility.status === 'caution' ? 18 : 0
  const base =
    tier === 'value'
      ? scen * 0.38 + value * 0.42 + compatibility.score * 0.2
      : tier === 'performance'
        ? scen * 0.72 + balance * 0.16 + compatibility.score * 0.12
        : scen * 0.54 + balance * 0.2 + value * 0.14 + compatibility.score * 0.12
  return base - ramPenalty - riskPenalty
}

function makeBuild(
  draft: BuildDraft,
  ctx: ConstructContext,
  tier: RecommendedBuild['tier'],
): RecommendedBuild | null {
  const report = evaluateCompatibility(draft.selection, ctx.byId, draft.quantities)
  if (report.status === 'blocked') return null
  const metrics = computeMetrics(draft.selection, ctx.byId, draft.quantities, ctx.allowUsed)
  if (metrics.total + draft.reserve > ctx.request.budget) return null
  const score = Math.round(Math.max(0, Math.min(100, scoreDraft(draft, ctx, report, metrics, tier))))
  const lines = buildLines(draft.selection, ctx.byId, draft.quantities, ctx.allowUsed)
  for (const line of lines) {
    const product = line.productId ? ctx.byId.get(line.productId) : undefined
    if (product && line.category !== 'peripheral') {
      line.reason = buildReason(line.category, product, draft.selection, ctx.byId, ctx.request)
    }
  }
  const reserve = draft.reserve
  if (reserve > 0) {
    lines.push({
      category: 'peripheral',
      productId: null,
      label: '显示器与外设预留',
      model: '按预算预留，可稍后调整',
      price: reserve,
      condition: 'reserve',
      reason: '智能配机将预算的一部分保留给显示器、键鼠或音箱；可在结果中关闭。',
    })
  }
  const total = metrics.total + reserve
  const budgetDelta = ctx.request.budget - total
  const alternatives: Record<string, AlternativePart[]> = {}
  for (const category of CORE_CATEGORIES) {
    const alt = alternativesFor(draft.selection, ctx.byId, draft.quantities, category, ctx.allowUsed)
    if (alt.length) alternatives[category] = alt
  }
  const reasons: Record<string, string> = {}
  for (const line of lines) {
    if (line.category !== 'peripheral') reasons[line.category] = line.reason
  }
  if (report.warnings.length) {
    reasons.warning = `${report.warnings.length} 项风险提示：${report.warnings.map((w) => w.title).join('；')}`
  }
  const upgrade = upgradePath(draft.selection, ctx.byId, metrics, draft.quantities)
  const notes: string[] = []
  if (budgetDelta > 0) notes.push(`低于预算 ${formatPrice(budgetDelta)}，仍保留 ${Math.round((budgetDelta / ctx.request.budget) * 100)}% 余量。`)
  else notes.push('已控制在预算上限内。')
  if (reserve > 0) notes.push(`其中 ${formatPrice(reserve)} 预留给显示器与外设。`)
  if (ctx.request.allowUsed) notes.push('已启用二手价格；二手成色、保修与矿卡风险需自行核验。')
  if (metrics.priceCoverage < 1) notes.push('部分组件暂无可靠报价，整机总价可能偏低。')
  notes.push('价格来自公开渠道归档样本，更新时间见各商品详情；请以下单时实时价格为准。')
  if (report.status === 'caution') notes.push('方案存在黄色风险项，提交前请查看兼容性报告。')

  const title = describeTier(tier, ctx.request)
  return {
    id: `smart-${tier}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: title.title,
    subtitle: title.subtitle,
    tier,
    request: { ...ctx.request },
    selection: { ...draft.selection },
    quantities: { ...draft.quantities },
    lines,
    peripheralsReserve: reserve,
    total,
    budget: ctx.request.budget,
    budgetDelta,
    power: metrics.power,
    compatibility: report,
    performance: metrics.performance,
    bottleneck: metrics.bottleneck,
    score,
    reasons,
    alternatives,
    upgradePath: upgrade,
    notes,
    createdAt: new Date().toISOString(),
  }
}

export function recommendBuilds(request: BuildRequest, products: Product[]): RecommendedBuild[] {
  const allowUsed = request.allowUsed
  const byId = new Map(products.map((p) => [p.id, p]))
  const reserve = request.includePeripherals ? Math.min(2400, Math.round(request.budget * 0.16)) : 0
  const towerBudget = Math.max(2000, request.budget - reserve)

  // Pre-index by category once to avoid millions of linear filters
  const byCategory = new Map<Category, PricedProduct[]>()
  const minCategoryPrice: Partial<Record<Category, number>> = {}
  for (const meta of CATEGORY_META) {
    const items = affordable(products.filter((p) => p.category === meta.id), allowUsed)
    byCategory.set(meta.id, items)
    minCategoryPrice[meta.id] = minPrice(items)
  }

  const allCpus = byCategory.get('cpu') ?? []
  const allGpus = byCategory.get('gpu') ?? []
  const minVram = scenarioTarget(request.scenario, request.workload)?.minVram ?? 0
  const filteredGpus = minVram > 0 ? allGpus.filter((p) => (p.product.attrs.vramGb ?? 0) >= minVram) : allGpus
  const candidateGpus = filteredGpus.length ? filteredGpus : allGpus

  const tierConfigs: TierConfig[] = [
    { tier: 'value', label: '预算优先', budgetFactor: 0.8 },
    { tier: 'balanced', label: '均衡推荐', budgetFactor: 1 },
    { tier: 'performance', label: '性能优先', budgetFactor: 1 },
  ]
  const results: RecommendedBuild[] = []

  for (const config of tierConfigs) {
    const tierBudget = Math.floor(towerBudget * config.budgetFactor)
    const ctx: ConstructContext = {
      request,
      products,
      byId,
      budget: tierBudget,
      allowUsed,
      byCategory,
      minCategoryPrice,
    }

    // Select candidate CPUs matching the budget tier (blend performance, value and budget floors)
    const maxCpuPrice = tierBudget * (config.tier === 'performance' ? 0.45 : config.tier === 'value' ? 0.32 : 0.38)
    const cpuCandidates = allCpus.filter((c) => c.price <= Math.max(1200, maxCpuPrice))
    const cpuPool = (cpuCandidates.length ? cpuCandidates : allCpus).slice()
    const sortedCpusByValue = cpuPool.slice().sort((a, b) => {
      const scoreA = cpuScore(a.product, request.scenario) + brandBonus(a.product, request)
      const scoreB = cpuScore(b.product, request.scenario) + brandBonus(b.product, request)
      return (scoreB / b.price) - (scoreA / a.price)
    })
    const sortedCpusByScore = cpuPool.slice().sort((a, b) => {
      const scoreA = cpuScore(a.product, request.scenario) + brandBonus(a.product, request)
      const scoreB = cpuScore(b.product, request.scenario) + brandBonus(b.product, request)
      return scoreB - scoreA
    })
    const cheapestCpus = cpuPool.slice().sort((a, b) => a.price - b.price).slice(0, 3)
    const cpuMap = new Map<string, PricedProduct>()
    for (const c of (config.tier === 'value' || tierBudget <= 3500 ? sortedCpusByValue : sortedCpusByScore)) {
      if (cpuMap.size < 6) cpuMap.set(c.product.id, c)
    }
    for (const c of (config.tier === 'value' || tierBudget <= 3500 ? sortedCpusByScore : sortedCpusByValue)) {
      if (cpuMap.size < 8) cpuMap.set(c.product.id, c)
    }
    for (const c of cheapestCpus) {
      if (cpuMap.size < 10) cpuMap.set(c.product.id, c)
    }
    const sortedCpus = Array.from(cpuMap.values())

    // Select candidate GPUs matching the scenario and budget tier
    const isGpuIntensive = ['gaming', 'ai', 'modeling', 'video'].includes(request.scenario)
    const maxGpuPrice = tierBudget * (isGpuIntensive ? (config.tier === 'performance' ? 0.65 : config.tier === 'value' ? 0.48 : 0.55) : 0.28)
    const gpuCandidates = candidateGpus.filter((g) => g.price <= Math.max(1500, maxGpuPrice))
    const gpuPool = (gpuCandidates.length ? gpuCandidates : candidateGpus).slice()
    const sortedGpusByValue = gpuPool.slice().sort((a, b) => {
      const scoreA = gpuScore(a.product, request.scenario) + brandBonus(a.product, request)
      const scoreB = gpuScore(b.product, request.scenario) + brandBonus(b.product, request)
      return (scoreB / b.price) - (scoreA / a.price)
    })
    const sortedGpusByScore = gpuPool.slice().sort((a, b) => {
      const scoreA = gpuScore(a.product, request.scenario) + brandBonus(a.product, request)
      const scoreB = gpuScore(b.product, request.scenario) + brandBonus(b.product, request)
      return scoreB - scoreA
    })
    const cheapestGpus = gpuPool.slice().sort((a, b) => a.price - b.price).slice(0, 3)
    const gpuMap = new Map<string, PricedProduct>()
    for (const g of (config.tier === 'value' || tierBudget <= 3500 ? sortedGpusByValue : sortedGpusByScore)) {
      if (gpuMap.size < 6) gpuMap.set(g.product.id, g)
    }
    for (const g of (config.tier === 'value' || tierBudget <= 3500 ? sortedGpusByScore : sortedGpusByValue)) {
      if (gpuMap.size < 8) gpuMap.set(g.product.id, g)
    }
    for (const g of cheapestGpus) {
      if (gpuMap.size < 10) gpuMap.set(g.product.id, g)
    }
    const sortedGpus = Array.from(gpuMap.values())

    // Search optimal build from top pairs (approx 49 combinations instead of 4500!)
    const drafts: BuildDraft[] = []
    for (const cpu of sortedCpus) {
      for (const gpu of sortedGpus) {
        const draft = constructBuild(cpu.product, gpu.product, ctx)
        if (!draft) continue
        tryUpgrade(draft, ctx)
        if (draft.total > ctx.budget) {
          if (!tryDowngrade(draft, ctx)) continue
        }
        if (draft.total > ctx.budget) continue
        drafts.push(draft)
      }
    }

    let best: RecommendedBuild | null = null
    let bestScore = -Infinity
    for (const draft of drafts) {
      const report = evaluateCompatibility(draft.selection, byId, draft.quantities)
      if (report.status === 'blocked') continue
      const metrics = computeMetrics(draft.selection, byId, draft.quantities, allowUsed)
      if (metrics.total > ctx.budget) continue
      const score = scoreDraft(draft, ctx, report, metrics, config.tier)
      if (score > bestScore) {
        bestScore = score
        best = makeBuild(draft, ctx, config.tier)
      }
    }
    if (best) results.push(best)
  }

  if (!results.length) {
    const ctx: ConstructContext = {
      request,
      products,
      byId,
      budget: towerBudget,
      allowUsed,
      byCategory,
      minCategoryPrice,
    }
    const cheapestCpu = allCpus.slice().sort((a, b) => a.price - b.price)[0]
    const cheapestGpu = candidateGpus.slice().sort((a, b) => a.price - b.price)[0]
    if (cheapestCpu && cheapestGpu) {
      const draft = constructBuild(cheapestCpu.product, cheapestGpu.product, ctx)
      if (draft) {
        const fallback = makeBuild(draft, ctx, 'value')
        if (fallback) results.push(fallback)
      }
    }
  }
  return results
}

export function buildTotals(selection: BuildSelection, byId: Map<string, Product>, quantities: Record<string, number>, allowUsed = false): number {
  return selectionTotal(selection, byId, quantities, allowUsed)
}
