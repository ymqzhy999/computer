/**
 * PC FORGE catalog seed builder.
 *
 * The JSON produced here is a *sample archive*, not a live price feed.
 * Every price carries its source label, timestamp and confidence so the UI can
 * mark it honestly. Real prices can be imported through the Market screen or
 * supplied by the FastAPI price adapter without changing the frontend.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const output = resolve(here, '../src/data/catalog.json')
const UPDATED = '2026-11-18'
const SOURCE = '公开渠道价格归档 · 演示样本'
const NOTE = '样本价仅用于装配与预算演示，不构成实时成交报价；可由价格适配器或导入数据更新。'

const products = []
const seen = new Set()

const pct = (n) => Math.max(0, Math.min(100, Math.round(n)))

function makePrice(ref, min, max, opts = {}) {
  if (ref == null) {
    return {
      reference: null,
      min: null,
      max: null,
      currency: 'CNY',
      region: 'CN',
      source: opts.source ?? SOURCE,
      sourceUrl: opts.sourceUrl,
      updatedAt: opts.updatedAt ?? UPDATED,
      status: 'unavailable',
      confidence: 'low',
      note: '新品公开报价不足，仅提供二手参考。',
    }
  }
  return {
    reference: ref,
    min: min ?? Math.round(ref * 0.92),
    max: max ?? Math.round(ref * 1.08),
    currency: 'CNY',
    region: 'CN',
    source: opts.source ?? SOURCE,
    sourceUrl:
      opts.sourceUrl ??
      `https://search.jd.com/Search?keyword=${encodeURIComponent(opts.keyword ?? '')}`,
    updatedAt: opts.updatedAt ?? UPDATED,
    status: opts.status ?? 'sample',
    confidence: opts.confidence ?? (opts.history?.length >= 4 ? 'medium' : 'low'),
    history: opts.history,
    note: opts.note ?? NOTE,
  }
}

function add(input) {
  if (seen.has(input.id)) throw new Error(`Duplicate product id: ${input.id}`)
  seen.add(input.id)
  const a = input.attrs ?? {}
  const specs = makeSpecs(input.category, a, input.specsExtra ?? {})
  const price = input.price
    ? makePrice(input.price[0], input.price[1], input.price[2], {
        keyword: `${input.brand} ${input.model}`,
        ...(input.priceMeta ?? {}),
      })
    : null
  products.push({
    id: input.id,
    category: input.category,
    brand: input.brand,
    model: input.model,
    sku: input.sku ?? `${input.brand.slice(0, 3).toUpperCase()}-${input.model.replace(/\s+/g, '-').toUpperCase()}`,
    releasedAt: input.releasedAt ?? '2025-01',
    status: input.status ?? 'active',
    tagline: input.tagline ?? defaultTagline(input.category, a),
    description: input.description ?? defaultDescription(input),
    attrs: a,
    specs,
    price,
    usedPrice: input.usedPrice ?? null,
    performance: input.performance ?? null,
    visual: {
      accent: input.accent ?? '#44dcff',
      tone: input.tone ?? (a.color === 'white' ? 'white' : 'black'),
      variant: input.variant ?? input.category,
    },
  })
}

function defaultTagline(category, a) {
  switch (category) {
    case 'cpu':
      return `${a.cores} 核 ${a.threads} 线程 · ${a.socket}`
    case 'motherboard':
      return `${a.chipset} · ${a.formFactor} · ${a.memoryType}`
    case 'gpu':
      return `${a.gpuChip} · ${a.vramGb}GB`
    case 'memory':
      return `${a.memoryType} ${a.memorySpeed} · ${a.memoryCapacity}GB`
    case 'ssd':
      return `${a.capacityGb}GB · ${a.interface}`
    case 'hdd':
      return `${a.capacityGb}GB · ${a.rpm} RPM`
    case 'psu':
      return `${a.wattage}W · ${a.efficiency}`
    case 'cooler':
      return `${a.coolerType === 'aio' ? '一体式水冷' : '风冷'} · ${a.coolerTdp}W 解热`
    case 'case':
      return `${(a.supportedFormFactors ?? []).join(' / ')}`
    case 'fan':
      return `${a.fanSizeMm}mm · ${a.rgb ? 'ARGB' : 'PWM'}`
    default:
      return '扩展硬件'
  }
}

function defaultDescription(input) {
  const a = input.attrs ?? {}
  switch (input.category) {
    case 'cpu':
      return `${input.brand} ${input.model} 采用 ${a.socket} 平台，${a.cores} 核 ${a.threads} 线程，最高加速 ${a.boostClock}GHz。适合 ${a.igpu ? '无独显办公与轻度创作' : '搭配独立显卡的游戏与生产力'} 配置。`
    case 'motherboard':
      return `${a.formFactor} 主板，${a.chipset} 芯片组，提供 ${a.memorySlots} 条 ${a.memoryType} 内存插槽与 ${a.m2Slots} 个 M.2 接口，支持 ${(a.supportedFormFactors ?? ['ATX']).join(' / ')} 机箱。`
    case 'gpu':
      return `${input.brand} 非公版 ${a.gpuChip}，${a.vramGb}GB 显存，整卡长度 ${a.lengthMm}mm、厚度约 ${a.thicknessSlots} 槽。面向 ${a.tdp > 300 ? '4K 高帧与重负载渲染' : '2K 游戏与内容创作'}。`
    case 'memory':
      return `${a.memoryCapacity}GB（${a.memorySticks} 条）${a.memoryType} 套装，频率 ${a.memorySpeed}MT/s，时序 CL${a.casLatency}。需与主板内存代际严格匹配。`
    case 'ssd':
      return `${a.capacityGb}GB ${a.interface} 固态硬盘，顺序读取约 ${a.readMbps}MB/s，适合系统盘与大型项目素材盘。`
    case 'hdd':
      return `${a.capacityGb}GB 机械硬盘，${a.rpm} RPM，适合冷数据、素材归档与备份。`
    case 'psu':
      return `${a.wattage}W 额定功率，${a.efficiency} 认证，${a.modular}，提供 ${a.pcie8} 个 PCIe 8pin 与 ${a.pcie12vhpwr ?? 0} 个 12V-2x6 / 12VHPWR 接口。`
    case 'cooler':
      return a.coolerType === 'aio'
        ? `${a.radiatorSize}mm 一体式水冷，标称解热 ${a.coolerTdp}W，支持 ${(a.cpuSockets ?? []).join(' / ')}。`
        : `${a.coolerType === 'stock' ? '下压式' : '塔式'}风冷，高度 ${a.coolerHeightMm}mm，标称解热 ${a.coolerTdp}W。`
    case 'case':
      return `${a.formFactor} 机箱，支持 ${(a.supportedFormFactors ?? []).join(' / ')} 主板，显卡限长 ${a.maxGpuLengthMm}mm，风冷限高 ${a.maxCoolerHeightMm}mm。`
    case 'fan':
      return `${a.fanSizeMm}mm 机箱风扇，${a.rgb ? 'ARGB 灯效同步' : '无光 PWM 调速'}，最高 ${a.rpm} RPM。`
    default:
      return `${input.brand} ${input.model} 扩展硬件。`
  }
}

function makeSpecs(category, a, extra) {
  const f = (v, unit = '') => (v == null ? '—' : `${v}${unit}`)
  const base = {}
  if (category === 'cpu') {
    Object.assign(base, {
      '核心 / 线程': `${a.cores}C / ${a.threads}T`,
      '基础 / 加速': `${a.baseClock} / ${a.boostClock} GHz`,
      三级缓存: f(a.cacheMb, ' MB'),
      插槽: a.socket,
      默认功耗: f(a.tdp, ' W'),
      峰值功耗: f(a.peakPower, ' W'),
      内存支持: (a.memoryType ? [a.memoryType] : []).join(' / '),
      核显: a.igpu ? '是' : '否',
    })
  } else if (category === 'motherboard') {
    Object.assign(base, {
      插槽: a.socket,
      芯片组: a.chipset,
      板型: a.formFactor,
      内存: `${a.memoryType} · ${a.memorySlots} 槽 · 最高 ${a.memoryCapacity}GB`,
      M2接口: `${a.m2Slots} × M.2`,
      SATA: `${a.sataPorts} × SATA`,
      扩展槽: `${a.pcieSlots} × PCIe`,
      无线: a.wifi ?? '无',
      网卡: a.lan ?? '—',
      供电与BIOS: a.bios ?? '—',
    })
  } else if (category === 'gpu') {
    Object.assign(base, {
      GPU芯片: a.gpuChip,
      显存: f(a.vramGb, ' GB'),
      整卡长度: f(a.lengthMm, ' mm'),
      厚度: f(a.thicknessSlots, ' 槽'),
      默认功耗: f(a.tdp, ' W'),
      供电接口: a.pcie12vhpwr ? `${a.pcie12vhpwr} × 12V-2x6` : `${a.pcie8 ?? 1} × 8pin`,
      推荐电源: f(a.recommendedPsu, ' W'),
    })
  } else if (category === 'memory') {
    Object.assign(base, {
      类型: a.memoryType,
      容量: f(a.memoryCapacity, ' GB'),
      套条: `${a.memorySticks} 条`,
      频率: f(a.memorySpeed, ' MT/s'),
      时序: `CL${a.casLatency}`,
      电压: a.memoryType === 'DDR5' ? '1.35 V' : '1.35 V',
      灯效: a.rgb ? 'ARGB' : '无',
    })
  } else if (category === 'ssd') {
    Object.assign(base, {
      容量: f(a.capacityGb, ' GB'),
      接口: a.interface,
      板型: a.formFactorDrive,
      顺序读取: f(a.readMbps, ' MB/s'),
      顺序写入: f(a.writeMbps, ' MB/s'),
      TBW: f(extra.TBW, ' TBW'),
    })
  } else if (category === 'hdd') {
    Object.assign(base, {
      容量: f(a.capacityGb, ' GB'),
      转速: f(a.rpm, ' RPM'),
      缓存: f(a.cacheGb, ' GB'),
      接口: a.interface,
      记录技术: extra['记录技术'] ?? 'CMR',
    })
  } else if (category === 'psu') {
    Object.assign(base, {
      额定功率: f(a.wattage, ' W'),
      认证: a.efficiency,
      ATX版本: a.atxVersion,
      模组: a.modular,
      'PCIe 8pin': f(a.pcie8),
      '12V-2x6': f(a.pcie12vhpwr ?? 0),
      'EPS 8pin': f(a.eps8 ?? 1),
    })
  } else if (category === 'cooler') {
    Object.assign(base, {
      类型: a.coolerType === 'aio' ? '一体式水冷' : a.coolerType === 'stock' ? '下压风冷' : '塔式风冷',
      标称解热: f(a.coolerTdp, ' W'),
      '冷排 / 高度': a.coolerType === 'aio' ? f(a.radiatorSize, ' mm') : f(a.coolerHeightMm, ' mm'),
      风扇: extra['风扇'] ?? '—',
      支持插槽: (a.cpuSockets ?? []).join(' / '),
      灯效: a.rgb ? 'ARGB' : '无',
    })
  } else if (category === 'case') {
    Object.assign(base, {
      板型支持: (a.supportedFormFactors ?? []).join(' / '),
      显卡限长: f(a.maxGpuLengthMm, ' mm'),
      风冷限高: f(a.maxCoolerHeightMm, ' mm'),
      冷排支持: (a.radiatorSupport ?? []).map((n) => `${n}`).join(' / ') + ' mm',
      风扇位: f(a.fanSlots),
      硬盘位: `${a.driveBays35 ?? 0} × 3.5" / ${a.driveBays25 ?? 0} × 2.5"`,
      尺寸: extra['尺寸'] ?? '—',
    })
  } else if (category === 'fan') {
    Object.assign(base, {
      尺寸: f(a.fanSizeMm, ' mm'),
      最高转速: f(a.rpm, ' RPM'),
      风量: f(extra['风量'], ' CFM'),
      噪音: f(extra['噪音'], ' dB(A)'),
      接口: a.interface,
      灯效: a.rgb ? 'ARGB' : '无',
    })
  } else {
    Object.assign(base, {
      类型: a.type,
      接口: a.interface,
      特点: extra['特点'] ?? '—',
    })
  }
  return { ...base, ...extra }
}

/* ------------------------------------------------------------------ CPUs */
add({
  id: 'cpu-amd-r5-5600', category: 'cpu', brand: 'AMD', model: 'Ryzen 5 5600', sku: '100-100000927BOX',
  releasedAt: '2022-04', status: 'active', price: [549, 499, 619],
  attrs: { socket: 'AM4', cores: 6, threads: 12, baseClock: 3.5, boostClock: 4.4, cacheMb: 35, tdp: 65, peakPower: 88, memoryType: 'DDR4', memoryMaxSpeed: 3200, igpu: false },
  performance: { index: 50, gaming: 45, productivity: 62, single: 55, multi: 52 },
  tagline: 'AM4 入门六核 · 高性价比',
})
add({
  id: 'cpu-amd-r7-5700x3d', category: 'cpu', brand: 'AMD', model: 'Ryzen 7 5700X3D', sku: '100-100001503WOF',
  releasedAt: '2024-01', status: 'active', price: [1199, 1099, 1299], usedPrice: 999,
  attrs: { socket: 'AM4', cores: 8, threads: 16, baseClock: 3.0, boostClock: 4.1, cacheMb: 100, tdp: 105, peakPower: 142, memoryType: 'DDR4', memoryMaxSpeed: 3200, igpu: false },
  performance: { index: 68, gaming: 72, productivity: 66, single: 58, multi: 70 },
  tagline: 'AM4 平台 3D V-Cache 游戏神U',
})
add({
  id: 'cpu-amd-r5-7500f', category: 'cpu', brand: 'AMD', model: 'Ryzen 5 7500F', sku: '100-100000597MPK',
  releasedAt: '2023-07', status: 'active', price: [949, 899, 1049],
  attrs: { socket: 'AM5', cores: 6, threads: 12, baseClock: 3.7, boostClock: 5.0, cacheMb: 38, tdp: 65, peakPower: 88, memoryType: 'DDR5', memoryMaxSpeed: 5200, igpu: false },
  performance: { index: 64, gaming: 66, productivity: 62, single: 72, multi: 58 },
  tagline: 'AM5 入门六核 · 无核显',
})
add({
  id: 'cpu-amd-r5-7600x', category: 'cpu', brand: 'AMD', model: 'Ryzen 5 7600X', sku: '100-100000593WOF',
  releasedAt: '2022-09', status: 'active', price: [1299, 1199, 1449],
  attrs: { socket: 'AM5', cores: 6, threads: 12, baseClock: 4.7, boostClock: 5.3, cacheMb: 38, tdp: 105, peakPower: 142, memoryType: 'DDR5', memoryMaxSpeed: 5200, igpu: true },
  performance: { index: 68, gaming: 70, productivity: 68, single: 77, multi: 65 },
  tagline: 'AM5 高频六核 · 带核显',
})
add({
  id: 'cpu-amd-r7-7700', category: 'cpu', brand: 'AMD', model: 'Ryzen 7 7700', sku: '100-100000592BOX',
  releasedAt: '2023-01', status: 'active', price: [1799, 1699, 1899],
  attrs: { socket: 'AM5', cores: 8, threads: 16, baseClock: 3.8, boostClock: 5.3, cacheMb: 40, tdp: 65, peakPower: 88, memoryType: 'DDR5', memoryMaxSpeed: 5200, igpu: true },
  performance: { index: 75, gaming: 72, productivity: 78, single: 75, multi: 80 },
  tagline: 'AM5 八核 · 低功耗全能',
})
add({
  id: 'cpu-amd-r7-7800x3d', category: 'cpu', brand: 'AMD', model: 'Ryzen 7 7800X3D', sku: '100-100000910WOF',
  releasedAt: '2023-04', status: 'active', price: [2399, 2199, 2599],
  priceMeta: { history: [
    { date: '2026-08-24', price: 2599 }, { date: '2026-09-07', price: 2549 }, { date: '2026-09-21', price: 2499 },
    { date: '2026-10-05', price: 2459 }, { date: '2026-10-19', price: 2429 }, { date: '2026-11-02', price: 2399 },
    { date: '2026-11-16', price: 2399 },
  ] },
  attrs: { socket: 'AM5', cores: 8, threads: 16, baseClock: 4.2, boostClock: 5.0, cacheMb: 104, tdp: 120, peakPower: 162, memoryType: 'DDR5', memoryMaxSpeed: 5200, igpu: true },
  performance: { index: 89, gaming: 94, productivity: 80, single: 85, multi: 82 },
  tagline: '3D V-Cache · 2K 游戏基准',
  usedPrice: 1899,
})
add({
  id: 'cpu-amd-r7-9700x', category: 'cpu', brand: 'AMD', model: 'Ryzen 7 9700X', sku: '100-100001404WOF',
  releasedAt: '2024-08', status: 'active', price: [2199, 2049, 2399],
  attrs: { socket: 'AM5', cores: 8, threads: 16, baseClock: 3.8, boostClock: 5.5, cacheMb: 40, tdp: 65, peakPower: 88, memoryType: 'DDR5', memoryMaxSpeed: 5600, igpu: true },
  performance: { index: 86, gaming: 86, productivity: 88, single: 91, multi: 86 },
  tagline: 'Zen 5 八核 · 能效与单核兼顾',
})
add({
  id: 'cpu-amd-r7-9800x3d', category: 'cpu', brand: 'AMD', model: 'Ryzen 7 9800X3D', sku: '100-100001084WOF',
  releasedAt: '2024-11', status: 'active', price: [3699, 3499, 3999],
  priceMeta: { history: [
    { date: '2026-08-24', price: 3999 }, { date: '2026-09-07', price: 3899 }, { date: '2026-09-21', price: 3899 },
    { date: '2026-10-05', price: 3799 }, { date: '2026-10-19', price: 3749 }, { date: '2026-11-02', price: 3699 },
    { date: '2026-11-16', price: 3699 },
  ] },
  attrs: { socket: 'AM5', cores: 8, threads: 16, baseClock: 4.7, boostClock: 5.2, cacheMb: 104, tdp: 120, peakPower: 162, memoryType: 'DDR5', memoryMaxSpeed: 5600, igpu: true },
  performance: { index: 96, gaming: 100, productivity: 92, single: 98, multi: 90 },
  tagline: '第二代 3D V-Cache · 游戏旗舰',
  usedPrice: 3199,
})
add({
  id: 'cpu-amd-r9-7950x', category: 'cpu', brand: 'AMD', model: 'Ryzen 9 7950X', sku: '100-100000514WOF',
  releasedAt: '2022-09', status: 'active', price: [3299, 3099, 3599],
  attrs: { socket: 'AM5', cores: 16, threads: 32, baseClock: 4.5, boostClock: 5.7, cacheMb: 80, tdp: 170, peakPower: 230, memoryType: 'DDR5', memoryMaxSpeed: 5200, igpu: true },
  performance: { index: 91, gaming: 82, productivity: 100, single: 88, multi: 100 },
  tagline: '16 核 32 线程 · 内容生产',
})
add({
  id: 'cpu-amd-r9-9950x', category: 'cpu', brand: 'AMD', model: 'Ryzen 9 9950X', sku: '100-100001277WOF',
  releasedAt: '2024-08', status: 'active', price: [4299, 4099, 4599],
  attrs: { socket: 'AM5', cores: 16, threads: 32, baseClock: 4.3, boostClock: 5.7, cacheMb: 80, tdp: 170, peakPower: 230, memoryType: 'DDR5', memoryMaxSpeed: 5600, igpu: true },
  performance: { index: 96, gaming: 88, productivity: 100, single: 96, multi: 100 },
  tagline: 'Zen 5 旗舰 · 全核生产力',
})
add({
  id: 'cpu-intel-i3-12100f', category: 'cpu', brand: 'Intel', model: 'Core i3-12100F', sku: 'BX8071512100F',
  releasedAt: '2022-01', status: 'active', price: [399, 349, 469],
  attrs: { socket: 'LGA1700', generation: '12th', cores: 4, threads: 8, baseClock: 3.3, boostClock: 4.3, cacheMb: 17, tdp: 58, peakPower: 89, memoryType: 'DDR4', memoryMaxSpeed: 3200, igpu: false },
  performance: { index: 34, gaming: 35, productivity: 38, single: 48, multi: 32 },
  tagline: '入门四核 · 办公与轻游戏',
})
add({
  id: 'cpu-intel-i5-12400f', category: 'cpu', brand: 'Intel', model: 'Core i5-12400F', sku: 'BX8071512400F',
  releasedAt: '2022-01', status: 'active', price: [649, 599, 729],
  attrs: { socket: 'LGA1700', generation: '12th', cores: 6, threads: 12, baseClock: 2.5, boostClock: 4.4, cacheMb: 25, tdp: 65, peakPower: 117, memoryType: 'DDR4', memoryMaxSpeed: 3200, igpu: false },
  performance: { index: 47, gaming: 48, productivity: 48, single: 57, multi: 45 },
  tagline: 'LGA1700 六核 · 预算甜点',
})
add({
  id: 'cpu-intel-i5-14600kf', category: 'cpu', brand: 'Intel', model: 'Core i5-14600KF', sku: 'BX8071514600KF',
  releasedAt: '2023-10', status: 'active', price: [1599, 1499, 1749],
  attrs: { socket: 'LGA1700', generation: '14th', cores: 14, threads: 20, baseClock: 3.5, boostClock: 5.3, cacheMb: 44, tdp: 125, peakPower: 181, memoryType: 'DDR5', memoryMaxSpeed: 5600, igpu: false },
  performance: { index: 72, gaming: 68, productivity: 76, single: 78, multi: 74 },
  tagline: '14 核 20 线程 · 中端全能',
})
add({
  id: 'cpu-intel-i7-14700k', category: 'cpu', brand: 'Intel', model: 'Core i7-14700K', sku: 'BX8071514700K',
  releasedAt: '2023-10', status: 'active', price: [2399, 2249, 2599],
  attrs: { socket: 'LGA1700', generation: '14th', cores: 20, threads: 28, baseClock: 3.4, boostClock: 5.6, cacheMb: 61, tdp: 125, peakPower: 253, memoryType: 'DDR5', memoryMaxSpeed: 5600, igpu: true },
  performance: { index: 86, gaming: 74, productivity: 91, single: 86, multi: 94 },
  tagline: '20 核 28 线程 · 创作主力',
})
add({
  id: 'cpu-intel-i9-14900k', category: 'cpu', brand: 'Intel', model: 'Core i9-14900K', sku: 'BX8071514900K',
  releasedAt: '2023-10', status: 'active', price: [3299, 3099, 3599],
  attrs: { socket: 'LGA1700', generation: '14th', cores: 24, threads: 32, baseClock: 3.2, boostClock: 6.0, cacheMb: 68, tdp: 125, peakPower: 253, memoryType: 'DDR5', memoryMaxSpeed: 5600, igpu: true },
  performance: { index: 91, gaming: 78, productivity: 97, single: 94, multi: 100 },
  tagline: '24 核 32 线程 · 6.0GHz',
})
add({
  id: 'cpu-intel-ultra5-245k', category: 'cpu', brand: 'Intel', model: 'Core Ultra 5 245K', sku: 'BX80768245K',
  releasedAt: '2024-10', status: 'active', price: [1799, 1699, 1949],
  attrs: { socket: 'LGA1851', generation: 'Core Ultra 2', cores: 14, threads: 14, baseClock: 4.2, boostClock: 5.2, cacheMb: 44, tdp: 125, peakPower: 159, memoryType: 'DDR5', memoryMaxSpeed: 6400, igpu: true },
  performance: { index: 70, gaming: 65, productivity: 73, single: 72, multi: 72 },
  tagline: 'Arrow Lake · 新平台 14 核',
})
add({
  id: 'cpu-intel-ultra7-265k', category: 'cpu', brand: 'Intel', model: 'Core Ultra 7 265K', sku: 'BX80768265K',
  releasedAt: '2024-10', status: 'active', price: [2399, 2249, 2599],
  attrs: { socket: 'LGA1851', generation: 'Core Ultra 2', cores: 20, threads: 20, baseClock: 3.9, boostClock: 5.5, cacheMb: 66, tdp: 125, peakPower: 250, memoryType: 'DDR5', memoryMaxSpeed: 6400, igpu: true },
  performance: { index: 83, gaming: 70, productivity: 86, single: 80, multi: 88 },
  tagline: '20 核 · 生产力与能效平衡',
})
add({
  id: 'cpu-intel-ultra9-285k', category: 'cpu', brand: 'Intel', model: 'Core Ultra 9 285K', sku: 'BX80768285K',
  releasedAt: '2024-10', status: 'active', price: [4299, 4099, 4599],
  attrs: { socket: 'LGA1851', generation: 'Core Ultra 2', cores: 24, threads: 24, baseClock: 3.7, boostClock: 5.7, cacheMb: 76, tdp: 125, peakPower: 250, memoryType: 'DDR5', memoryMaxSpeed: 6400, igpu: true },
  performance: { index: 93, gaming: 73, productivity: 92, single: 86, multi: 95 },
  tagline: '24 核 · LGA1851 旗舰',
})

/* ---------------------------------------------------------- Motherboards */
add({
  id: 'mb-asus-b650e-f', category: 'motherboard', brand: 'ASUS', model: 'ROG STRIX B650E-F GAMING WIFI', sku: '90MB1BQ0-M0EAY0',
  releasedAt: '2022-10', status: 'active', price: [1599, 1449, 1749],
  attrs: { socket: 'AM5', chipset: 'B650E', formFactor: 'ATX', supportedFormFactors: ['ATX', 'M-ATX', 'ITX'], memoryType: 'DDR5', memorySlots: 4, memoryCapacity: 192, memoryMaxSpeed: 6400, m2Slots: 4, sataPorts: 4, pcieSlots: 3, wifi: 'WiFi 6E', lan: '2.5GbE', bios: 'BIOS FlashBack', color: 'black' },
  performance: { index: 85, gaming: 85, productivity: 85, single: 85, multi: 85 },
  variant: 'b650e',
})
add({
  id: 'mb-msi-b650-tomahawk', category: 'motherboard', brand: 'MSI', model: 'MAG B650 TOMAHAWK WIFI', sku: '7D75-001R',
  releasedAt: '2022-10', status: 'active', price: [1299, 1199, 1449],
  attrs: { socket: 'AM5', chipset: 'B650', formFactor: 'ATX', supportedFormFactors: ['ATX', 'M-ATX', 'ITX'], memoryType: 'DDR5', memorySlots: 4, memoryCapacity: 192, memoryMaxSpeed: 6400, m2Slots: 3, sataPorts: 6, pcieSlots: 3, wifi: 'WiFi 6E', lan: '2.5GbE', bios: 'USB Flash BIOS', color: 'black' },
  performance: { index: 80, gaming: 80, productivity: 80, single: 80, multi: 80 },
})
add({
  id: 'mb-asrock-b650m-hdv', category: 'motherboard', brand: 'ASRock', model: 'B650M-HDV/M.2', sku: '90-MXBL70-A0UAYZ',
  releasedAt: '2023-04', status: 'active', price: [749, 699, 829],
  attrs: { socket: 'AM5', chipset: 'B650', formFactor: 'M-ATX', supportedFormFactors: ['M-ATX', 'ITX'], memoryType: 'DDR5', memorySlots: 2, memoryCapacity: 96, memoryMaxSpeed: 6400, m2Slots: 2, sataPorts: 4, pcieSlots: 2, wifi: '无', lan: '2.5GbE', bios: 'Instant Flash', color: 'black' },
  performance: { index: 67, gaming: 67, productivity: 67, single: 67, multi: 67 },
})
add({
  id: 'mb-gigabyte-x870e-master', category: 'motherboard', brand: 'Gigabyte', model: 'X870E AORUS MASTER', sku: 'X870E-A-MASTER',
  releasedAt: '2024-09', status: 'active', price: [3699, 3499, 3999],
  attrs: { socket: 'AM5', chipset: 'X870E', formFactor: 'ATX', supportedFormFactors: ['ATX', 'M-ATX', 'ITX'], memoryType: 'DDR5', memorySlots: 4, memoryCapacity: 256, memoryMaxSpeed: 8000, m2Slots: 4, sataPorts: 4, pcieSlots: 3, wifi: 'WiFi 7', lan: '5GbE', bios: 'Q-Flash Plus', color: 'black' },
  performance: { index: 94, gaming: 94, productivity: 94, single: 94, multi: 94 },
})
add({
  id: 'mb-asus-x870e-e', category: 'motherboard', brand: 'ASUS', model: 'ROG STRIX X870E-E GAMING WIFI', sku: '90MB1IP0-M0EAY0',
  releasedAt: '2024-09', status: 'active', price: [3899, 3699, 4199],
  attrs: { socket: 'AM5', chipset: 'X870E', formFactor: 'ATX', supportedFormFactors: ['ATX', 'M-ATX', 'ITX'], memoryType: 'DDR5', memorySlots: 4, memoryCapacity: 256, memoryMaxSpeed: 8000, m2Slots: 5, sataPorts: 4, pcieSlots: 3, wifi: 'WiFi 7', lan: '2.5GbE', bios: 'BIOS FlashBack', color: 'black' },
  performance: { index: 96, gaming: 96, productivity: 96, single: 96, multi: 96 },
})
add({
  id: 'mb-msi-b850-tomahawk', category: 'motherboard', brand: 'MSI', model: 'MAG B850 TOMAHAWK WIFI', sku: '7E62-001R',
  releasedAt: '2025-01', status: 'active', price: [1699, 1549, 1849],
  attrs: { socket: 'AM5', chipset: 'B850', formFactor: 'ATX', supportedFormFactors: ['ATX', 'M-ATX', 'ITX'], memoryType: 'DDR5', memorySlots: 4, memoryCapacity: 256, memoryMaxSpeed: 7600, m2Slots: 3, sataPorts: 4, pcieSlots: 3, wifi: 'WiFi 7', lan: '5GbE', bios: 'USB Flash BIOS', color: 'black' },
  performance: { index: 84, gaming: 84, productivity: 84, single: 84, multi: 84 },
})
add({
  id: 'mb-asrock-a620m-hdv', category: 'motherboard', brand: 'ASRock', model: 'A620M-HDV/M.2+', sku: '90-MXBM10-A0UAYZ',
  releasedAt: '2023-05', status: 'active', price: [599, 549, 669],
  attrs: { socket: 'AM5', chipset: 'A620', formFactor: 'M-ATX', supportedFormFactors: ['M-ATX', 'ITX'], memoryType: 'DDR5', memorySlots: 2, memoryCapacity: 96, memoryMaxSpeed: 6000, m2Slots: 1, sataPorts: 4, pcieSlots: 1, wifi: '无', lan: '1GbE', bios: 'Instant Flash', color: 'black' },
  performance: { index: 60, gaming: 60, productivity: 60, single: 60, multi: 60 },
})
add({
  id: 'mb-msi-b550m-pro-vdh', category: 'motherboard', brand: 'MSI', model: 'B550M PRO-VDH WIFI', sku: '7C95-001R',
  releasedAt: '2022-02', status: 'active', price: [499, 449, 579],
  attrs: { socket: 'AM4', chipset: 'B550', formFactor: 'M-ATX', supportedFormFactors: ['M-ATX', 'ITX'], memoryType: 'DDR4', memorySlots: 4, memoryCapacity: 128, memoryMaxSpeed: 4400, m2Slots: 2, sataPorts: 4, pcieSlots: 2, wifi: 'WiFi 5', lan: '1GbE', bios: 'Flash BIOS Button', color: 'black' },
  performance: { index: 55, gaming: 55, productivity: 55, single: 55, multi: 55 },
})
add({
  id: 'mb-gigabyte-b760m-ds3h', category: 'motherboard', brand: 'Gigabyte', model: 'B760M DS3H AX DDR4', sku: 'B760M-DS3H-AX-DDR4',
  releasedAt: '2023-01', status: 'active', price: [799, 729, 879],
  attrs: { socket: 'LGA1700', chipset: 'B760', formFactor: 'M-ATX', supportedFormFactors: ['M-ATX', 'ITX'], memoryType: 'DDR4', memorySlots: 4, memoryCapacity: 128, memoryMaxSpeed: 5333, m2Slots: 2, sataPorts: 4, pcieSlots: 2, wifi: 'WiFi 6E', lan: '2.5GbE', bios: 'Q-Flash Plus', color: 'black' },
  performance: { index: 66, gaming: 66, productivity: 66, single: 66, multi: 66 },
})
add({
  id: 'mb-asus-z790-p', category: 'motherboard', brand: 'ASUS', model: 'PRIME Z790-P WIFI', sku: '90MB1CK0-M0EAY0',
  releasedAt: '2022-10', status: 'active', price: [1599, 1449, 1799],
  attrs: { socket: 'LGA1700', chipset: 'Z790', formFactor: 'ATX', supportedFormFactors: ['ATX', 'M-ATX', 'ITX'], memoryType: 'DDR5', memorySlots: 4, memoryCapacity: 192, memoryMaxSpeed: 7200, m2Slots: 4, sataPorts: 4, pcieSlots: 4, wifi: 'WiFi 6', lan: '2.5GbE', bios: 'BIOS FlashBack', color: 'black' },
  performance: { index: 82, gaming: 82, productivity: 82, single: 82, multi: 82 },
})
add({
  id: 'mb-asus-tuf-b760m', category: 'motherboard', brand: 'ASUS', model: 'TUF GAMING B760M-PLUS WIFI D5', sku: '90MB1E70-M0EAY0',
  releasedAt: '2023-01', status: 'active', price: [1099, 999, 1199],
  attrs: { socket: 'LGA1700', chipset: 'B760', formFactor: 'M-ATX', supportedFormFactors: ['M-ATX', 'ITX'], memoryType: 'DDR5', memorySlots: 4, memoryCapacity: 192, memoryMaxSpeed: 7200, m2Slots: 3, sataPorts: 4, pcieSlots: 2, wifi: 'WiFi 6', lan: '2.5GbE', bios: 'BIOS FlashBack', color: 'black' },
  performance: { index: 72, gaming: 72, productivity: 72, single: 72, multi: 72 },
})
add({
  id: 'mb-msi-b760m-a-ddr4', category: 'motherboard', brand: 'MSI', model: 'PRO B760M-A WIFI DDR4', sku: '7D99-001R',
  releasedAt: '2023-01', status: 'active', price: [899, 829, 999],
  attrs: { socket: 'LGA1700', chipset: 'B760', formFactor: 'M-ATX', supportedFormFactors: ['M-ATX', 'ITX'], memoryType: 'DDR4', memorySlots: 4, memoryCapacity: 128, memoryMaxSpeed: 5333, m2Slots: 2, sataPorts: 4, pcieSlots: 2, wifi: 'WiFi 6E', lan: '2.5GbE', bios: 'USB Flash BIOS', color: 'black' },
  performance: { index: 69, gaming: 69, productivity: 69, single: 69, multi: 69 },
})
add({
  id: 'mb-msi-z890-carbon', category: 'motherboard', brand: 'MSI', model: 'MPG Z890 CARBON WIFI', sku: '7E17-001R',
  releasedAt: '2024-10', status: 'active', price: [3499, 3299, 3799],
  attrs: { socket: 'LGA1851', chipset: 'Z890', formFactor: 'ATX', supportedFormFactors: ['ATX', 'M-ATX', 'ITX'], memoryType: 'DDR5', memorySlots: 4, memoryCapacity: 256, memoryMaxSpeed: 8400, m2Slots: 5, sataPorts: 4, pcieSlots: 3, wifi: 'WiFi 7', lan: '5GbE', bios: 'USB Flash BIOS', color: 'black' },
  performance: { index: 93, gaming: 93, productivity: 93, single: 93, multi: 93 },
})
add({
  id: 'mb-asus-tuf-b860m', category: 'motherboard', brand: 'ASUS', model: 'TUF GAMING B860M-PLUS WIFI', sku: '90MB1K30-M0EAY0',
  releasedAt: '2025-01', status: 'active', price: [1399, 1299, 1499],
  attrs: { socket: 'LGA1851', chipset: 'B860', formFactor: 'M-ATX', supportedFormFactors: ['M-ATX', 'ITX'], memoryType: 'DDR5', memorySlots: 4, memoryCapacity: 256, memoryMaxSpeed: 8000, m2Slots: 3, sataPorts: 4, pcieSlots: 2, wifi: 'WiFi 7', lan: '2.5GbE', bios: 'BIOS FlashBack', color: 'black' },
  performance: { index: 78, gaming: 78, productivity: 78, single: 78, multi: 78 },
})

/* --------------------------------------------------------------- GPUs */
add({
  id: 'gpu-asus-rtx4060-dual', category: 'gpu', brand: 'ASUS', model: 'DUAL-RTX4060-O8G', sku: 'DUAL-RTX4060-O8G',
  releasedAt: '2023-07', status: 'active', price: [2099, 1999, 2299],
  attrs: { gpuChip: 'GeForce RTX 4060', chipVendor: 'NVIDIA', vramGb: 8, tdp: 115, peakPower: 145, lengthMm: 227, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 550 },
  performance: { index: 44, gaming: 46, productivity: 38, single: 0, multi: 0, vram: 35, efficiency: 92 },
  tagline: '1080p 能效甜点 · 双风扇', accent: '#ff8a3d', usedPrice: 1699,
})
add({
  id: 'gpu-msi-rtx4060ti-ventus', category: 'gpu', brand: 'MSI', model: 'RTX 4060 Ti VENTUS 2X BLACK 8G OC', sku: '912-V515-007',
  releasedAt: '2023-05', status: 'active', price: [2899, 2749, 3099],
  attrs: { gpuChip: 'GeForce RTX 4060 Ti', chipVendor: 'NVIDIA', vramGb: 8, tdp: 160, peakPower: 190, lengthMm: 245, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 600 },
  performance: { index: 49, gaming: 51, productivity: 43, single: 0, multi: 0, vram: 35, efficiency: 88 },
  tagline: '1080p 高帧 · 8GB 显存', accent: '#ff5a4d', usedPrice: 2299,
})
add({
  id: 'gpu-asus-rtx4070s-tuf', category: 'gpu', brand: 'ASUS', model: 'TUF-RTX4070S-O12G-GAMING', sku: 'TUF-RTX4070S-O12G',
  releasedAt: '2024-01', status: 'active', price: [4299, 4099, 4599],
  priceMeta: { history: [
    { date: '2026-08-24', price: 4599 }, { date: '2026-09-07', price: 4549 }, { date: '2026-09-21', price: 4499 },
    { date: '2026-10-05', price: 4399 }, { date: '2026-10-19', price: 4349 }, { date: '2026-11-02', price: 4299 },
    { date: '2026-11-16', price: 4299 },
  ] },
  attrs: { gpuChip: 'GeForce RTX 4070 SUPER', chipVendor: 'NVIDIA', vramGb: 12, tdp: 220, peakPower: 260, lengthMm: 305, thicknessSlots: 3.1, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 700 },
  performance: { index: 65, gaming: 68, productivity: 58, single: 0, multi: 0, vram: 52, efficiency: 82 },
  tagline: '2K 高画质 · 12GB 显存', accent: '#ff8a3d', usedPrice: 3399,
})
add({
  id: 'gpu-gigabyte-rtx4070tis', category: 'gpu', brand: 'Gigabyte', model: 'RTX 4070 Ti SUPER GAMING OC 16G', sku: 'GV-N407TSGAMING-OC-16GD',
  releasedAt: '2024-01', status: 'active', price: [5799, 5499, 6199],
  attrs: { gpuChip: 'GeForce RTX 4070 Ti SUPER', chipVendor: 'NVIDIA', vramGb: 16, tdp: 285, peakPower: 330, lengthMm: 336, thicknessSlots: 3.5, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 750 },
  performance: { index: 74, gaming: 76, productivity: 68, single: 0, multi: 0, vram: 70, efficiency: 76 },
  tagline: '2K/4K 入门 · 16GB 大显存', accent: '#ff8a3d',
})
add({
  id: 'gpu-msi-rtx4080s', category: 'gpu', brand: 'MSI', model: 'RTX 4080 SUPER GAMING X SLIM 16G', sku: '912-V511-005',
  releasedAt: '2024-01', status: 'active', price: [7499, 7199, 7999],
  attrs: { gpuChip: 'GeForce RTX 4080 SUPER', chipVendor: 'NVIDIA', vramGb: 16, tdp: 320, peakPower: 370, lengthMm: 336, thicknessSlots: 3.5, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 800 },
  performance: { index: 86, gaming: 88, productivity: 80, single: 0, multi: 0, vram: 70, efficiency: 74 },
  tagline: '4K 高帧 · 16GB', accent: '#ff5a4d',
})
add({
  id: 'gpu-asus-rtx4090-tuf', category: 'gpu', brand: 'ASUS', model: 'TUF-RTX4090-O24G-GAMING', sku: 'TUF-RTX4090-O24G',
  releasedAt: '2022-10', status: 'active', price: [13999, 12999, 15499],
  attrs: { gpuChip: 'GeForce RTX 4090', chipVendor: 'NVIDIA', vramGb: 24, tdp: 450, peakPower: 520, lengthMm: 348, thicknessSlots: 3.65, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 1000 },
  performance: { index: 100, gaming: 100, productivity: 100, single: 0, multi: 0, vram: 92, efficiency: 58 },
  tagline: '上代旗舰 · 24GB 创作巨兽', accent: '#ff8a3d',
})
add({
  id: 'gpu-asus-rtx5060-prime', category: 'gpu', brand: 'ASUS', model: 'PRIME-RTX5060-O8G', sku: 'PRIME-RTX5060-O8G',
  releasedAt: '2025-05', status: 'active', price: [2499, 2349, 2699],
  attrs: { gpuChip: 'GeForce RTX 5060', chipVendor: 'NVIDIA', vramGb: 8, tdp: 145, peakPower: 175, lengthMm: 240, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 600 },
  performance: { index: 50, gaming: 52, productivity: 44, single: 0, multi: 0, vram: 35, efficiency: 90 },
  tagline: 'Blackwell 主流 · DLSS 4', accent: '#ff8a3d',
})
add({
  id: 'gpu-msi-rtx5060ti-16g', category: 'gpu', brand: 'MSI', model: 'RTX 5060 Ti 16G GAMING TRIO OC', sku: '912-V531-008',
  releasedAt: '2025-04', status: 'active', price: [3499, 3299, 3699],
  attrs: { gpuChip: 'GeForce RTX 5060 Ti', chipVendor: 'NVIDIA', vramGb: 16, tdp: 180, peakPower: 215, lengthMm: 300, thicknessSlots: 2.5, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 650 },
  performance: { index: 57, gaming: 58, productivity: 50, single: 0, multi: 0, vram: 70, efficiency: 86 },
  tagline: '16GB 主流 · 2K 入门', accent: '#ff5a4d',
})
add({
  id: 'gpu-asus-rtx5070-tuf', category: 'gpu', brand: 'ASUS', model: 'TUF-RTX5070-O12G-GAMING', sku: 'TUF-RTX5070-O12G',
  releasedAt: '2025-03', status: 'active', price: [4499, 4299, 4799],
  priceMeta: { history: [
    { date: '2026-08-24', price: 4999 }, { date: '2026-09-07', price: 4899 }, { date: '2026-09-21', price: 4799 },
    { date: '2026-10-05', price: 4699 }, { date: '2026-10-19', price: 4599 }, { date: '2026-11-02', price: 4499 },
    { date: '2026-11-16', price: 4499 },
  ] },
  attrs: { gpuChip: 'GeForce RTX 5070', chipVendor: 'NVIDIA', vramGb: 12, tdp: 250, peakPower: 300, lengthMm: 305, thicknessSlots: 3, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 750 },
  performance: { index: 69, gaming: 72, productivity: 62, single: 0, multi: 0, vram: 52, efficiency: 78 },
  tagline: '2K 主流 · Blackwell 架构', accent: '#ff8a3d', usedPrice: 3899,
})
add({
  id: 'gpu-gigabyte-rtx5070ti', category: 'gpu', brand: 'Gigabyte', model: 'RTX 5070 Ti GAMING OC 16G', sku: 'GV-N507TGAMING-OC-16GD',
  releasedAt: '2025-02', status: 'active', price: [6299, 5999, 6699],
  attrs: { gpuChip: 'GeForce RTX 5070 Ti', chipVendor: 'NVIDIA', vramGb: 16, tdp: 300, peakPower: 350, lengthMm: 330, thicknessSlots: 3.2, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 800 },
  performance: { index: 81, gaming: 82, productivity: 72, single: 0, multi: 0, vram: 70, efficiency: 72 },
  tagline: '2K 高帧 / 4K 入门', accent: '#ff8a3d', usedPrice: 5499,
})
add({
  id: 'gpu-msi-rtx5080-suprim', category: 'gpu', brand: 'MSI', model: 'RTX 5080 16G SUPRIM SOC', sku: '912-V530-005',
  releasedAt: '2025-01', status: 'active', price: [8499, 8199, 8999],
  attrs: { gpuChip: 'GeForce RTX 5080', chipVendor: 'NVIDIA', vramGb: 16, tdp: 360, peakPower: 420, lengthMm: 350, thicknessSlots: 3.7, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 900 },
  performance: { index: 89, gaming: 90, productivity: 82, single: 0, multi: 0, vram: 70, efficiency: 68 },
  tagline: '4K 高帧 · 旗舰级非公', accent: '#ff5a4d',
})
add({
  id: 'gpu-asus-rtx5090-astral', category: 'gpu', brand: 'ASUS', model: 'ROG-ASTRAL-RTX5090-O32G', sku: 'ROG-ASTRAL-RTX5090-O32G',
  releasedAt: '2025-01', status: 'active', price: [16999, 15999, 18999],
  attrs: { gpuChip: 'GeForce RTX 5090', chipVendor: 'NVIDIA', vramGb: 32, tdp: 575, peakPower: 650, lengthMm: 360, thicknessSlots: 4, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 1200 },
  performance: { index: 100, gaming: 100, productivity: 100, single: 0, multi: 0, vram: 100, efficiency: 55 },
  tagline: '4K 光追旗舰 · 32GB GDDR7', accent: '#ff8a3d',
})
add({
  id: 'gpu-sapphire-rx7600', category: 'gpu', brand: 'Sapphire', model: 'PULSE RX 7600 8G', sku: '11324-01-20G',
  releasedAt: '2023-05', status: 'active', price: [1799, 1699, 1949],
  attrs: { gpuChip: 'Radeon RX 7600', chipVendor: 'AMD', vramGb: 8, tdp: 165, peakPower: 195, lengthMm: 240, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 550 },
  performance: { index: 39, gaming: 40, productivity: 32, single: 0, multi: 0, vram: 35, efficiency: 78 },
  tagline: '1080p 入门 · RDNA 3', accent: '#ff3b4d', usedPrice: 1399,
})
add({
  id: 'gpu-powercolor-rx7700xt', category: 'gpu', brand: 'PowerColor', model: 'Hellhound RX 7700 XT 12GB', sku: 'RX7700XT-12G-HL',
  releasedAt: '2023-09', status: 'active', price: [2999, 2849, 3199],
  attrs: { gpuChip: 'Radeon RX 7700 XT', chipVendor: 'AMD', vramGb: 12, tdp: 245, peakPower: 285, lengthMm: 320, thicknessSlots: 2.5, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 700 },
  performance: { index: 53, gaming: 55, productivity: 44, single: 0, multi: 0, vram: 52, efficiency: 74 },
  tagline: '2K 入门 · 12GB 显存', accent: '#ff3b4d',
})
add({
  id: 'gpu-sapphire-rx7800xt', category: 'gpu', brand: 'Sapphire', model: 'NITRO+ RX 7800 XT 16GB', sku: '11330-01-20G',
  releasedAt: '2023-09', status: 'active', price: [3499, 3299, 3799],
  attrs: { gpuChip: 'Radeon RX 7800 XT', chipVendor: 'AMD', vramGb: 16, tdp: 263, peakPower: 305, lengthMm: 320, thicknessSlots: 3, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 750 },
  performance: { index: 59, gaming: 62, productivity: 52, single: 0, multi: 0, vram: 70, efficiency: 72 },
  tagline: '2K 高画质 · 16GB', accent: '#ff3b4d', usedPrice: 2799,
})
add({
  id: 'gpu-asus-rx7900gre', category: 'gpu', brand: 'ASUS', model: 'TUF-RX7900GRE-O16G-GAMING', sku: 'TUF-RX7900GRE-O16G',
  releasedAt: '2024-02', status: 'active', price: [3999, 3799, 4299],
  attrs: { gpuChip: 'Radeon RX 7900 GRE', chipVendor: 'AMD', vramGb: 16, tdp: 260, peakPower: 300, lengthMm: 320, thicknessSlots: 3.1, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 750 },
  performance: { index: 64, gaming: 68, productivity: 58, single: 0, multi: 0, vram: 70, efficiency: 70 },
  tagline: '2K 光栅强卡 · 16GB', accent: '#ff8a3d',
})
add({
  id: 'gpu-sapphire-rx7900xtx', category: 'gpu', brand: 'Sapphire', model: 'NITRO+ RX 7900 XTX 24GB', sku: '11322-01-40G',
  releasedAt: '2022-12', status: 'active', price: [6499, 6199, 6999],
  attrs: { gpuChip: 'Radeon RX 7900 XTX', chipVendor: 'AMD', vramGb: 24, tdp: 355, peakPower: 410, lengthMm: 320, thicknessSlots: 3.5, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 900 },
  performance: { index: 84, gaming: 88, productivity: 78, single: 0, multi: 0, vram: 92, efficiency: 64 },
  tagline: '上代 A 卡旗舰 · 24GB', accent: '#ff3b4d',
})
add({
  id: 'gpu-sapphire-rx9070', category: 'gpu', brand: 'Sapphire', model: 'PULSE RX 9070 16G', sku: '11348-01-20G',
  releasedAt: '2025-03', status: 'active', price: [4499, 4299, 4799],
  attrs: { gpuChip: 'Radeon RX 9070', chipVendor: 'AMD', vramGb: 16, tdp: 220, peakPower: 260, lengthMm: 300, thicknessSlots: 2.5, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 700 },
  performance: { index: 69, gaming: 72, productivity: 62, single: 0, multi: 0, vram: 70, efficiency: 82 },
  tagline: 'RDNA 4 · 2K 光追提升', accent: '#ff3b4d',
})
add({
  id: 'gpu-asus-rx9070xt', category: 'gpu', brand: 'ASUS', model: 'TUF-RX9070XT-O16G-GAMING', sku: 'TUF-RX9070XT-O16G',
  releasedAt: '2025-03', status: 'active', price: [5299, 4999, 5599],
  attrs: { gpuChip: 'Radeon RX 9070 XT', chipVendor: 'AMD', vramGb: 16, tdp: 304, peakPower: 350, lengthMm: 330, thicknessSlots: 3.1, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 800 },
  performance: { index: 77, gaming: 80, productivity: 68, single: 0, multi: 0, vram: 70, efficiency: 74 },
  tagline: '2K/4K 高帧 · RDNA 4', accent: '#ff8a3d',
})
add({
  id: 'gpu-sparkle-arc-b580', category: 'gpu', brand: 'Sparkle', model: 'Arc B580 TITAN OC 12GB', sku: 'SB580T-12GOC',
  releasedAt: '2024-12', status: 'active', price: [2049, 1949, 2199],
  attrs: { gpuChip: 'Intel Arc B580', chipVendor: 'Intel', vramGb: 12, tdp: 190, peakPower: 225, lengthMm: 280, thicknessSlots: 2.2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 650 },
  performance: { index: 48, gaming: 50, productivity: 48, single: 0, multi: 0, vram: 52, efficiency: 72 },
  tagline: '大显存性价比 · XeSS 2', accent: '#44dcff',
})
add({
  id: 'gpu-asus-rtx3080-tuf', category: 'gpu', brand: 'ASUS', model: 'TUF-RTX3080-10G-GAMING', sku: 'TUF-RTX3080-10G',
  releasedAt: '2020-09', status: 'eol', price: null, usedPrice: 2199,
  attrs: { gpuChip: 'GeForce RTX 3080', chipVendor: 'NVIDIA', vramGb: 10, tdp: 320, peakPower: 370, lengthMm: 300, thicknessSlots: 2.7, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 750 },
  performance: { index: 58, gaming: 60, productivity: 56, single: 0, multi: 0, vram: 45, efficiency: 55 },
  tagline: '二手高性价比 · 10GB', accent: '#ff8a3d',
})

/* ------------------------------------------------ GPUs / budget & legacy */
function addGpu(gpu) {
  add({
    category: 'gpu',
    ...gpu,
    status: gpu.status ?? 'active',
    performance: { single: 0, multi: 0, ...gpu.performance },
  })
}

addGpu({
  id: 'gpu-asus-rtx5050-prime', brand: 'ASUS', model: 'PRIME-RTX5050-O8G', sku: 'PRIME-RTX5050-O8G',
  releasedAt: '2025-07', price: [1799, 1699, 1949],
  attrs: { gpuChip: 'GeForce RTX 5050', chipVendor: 'NVIDIA', vramGb: 8, tdp: 130, peakPower: 160, lengthMm: 249, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 550 },
  performance: { index: 42, gaming: 44, productivity: 36, vram: 35, efficiency: 94 },
  tagline: '1080p 入门 · Blackwell', accent: '#ff8a3d',
})
addGpu({
  id: 'gpu-asus-rtx3050-dual', brand: 'ASUS', model: 'DUAL-RTX3050-O8G-V2', sku: 'DUAL-RTX3050-O8G-V2',
  releasedAt: '2022-01', price: [1399, 1299, 1499],
  attrs: { gpuChip: 'GeForce RTX 3050', chipVendor: 'NVIDIA', vramGb: 8, tdp: 130, peakPower: 160, lengthMm: 200, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 450 },
  performance: { index: 32, gaming: 34, productivity: 28, vram: 35, efficiency: 80 },
  tagline: '1080p 电竞入门 · 8GB', accent: '#ff8a3d', usedPrice: 999,
})
addGpu({
  id: 'gpu-msi-rtx3060-ventus', brand: 'MSI', model: 'RTX 3060 VENTUS 2X 12G OC', sku: '912-V397-039',
  releasedAt: '2021-02', price: [1799, 1699, 1949],
  attrs: { gpuChip: 'GeForce RTX 3060', chipVendor: 'NVIDIA', vramGb: 12, tdp: 170, peakPower: 200, lengthMm: 235, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 550 },
  performance: { index: 43, gaming: 45, productivity: 40, vram: 52, efficiency: 78 },
  tagline: '12GB 大显存 · 1080p 甜点', accent: '#ff5a4d', usedPrice: 1299,
})
addGpu({
  id: 'gpu-gigabyte-rtx3060ti', brand: 'Gigabyte', model: 'RTX 3060 Ti GAMING OC 8G', sku: 'GV-N306TGAMING OC-8GD',
  releasedAt: '2020-12', price: [2199, 2049, 2399],
  attrs: { gpuChip: 'GeForce RTX 3060 Ti', chipVendor: 'NVIDIA', vramGb: 8, tdp: 200, peakPower: 235, lengthMm: 286, thicknessSlots: 2.2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 600 },
  performance: { index: 50, gaming: 53, productivity: 46, vram: 35, efficiency: 76 },
  tagline: '1080p 高帧 · 三风扇', accent: '#ff8a3d', usedPrice: 1599,
})
addGpu({
  id: 'gpu-asus-rtx3070-tuf', brand: 'ASUS', model: 'TUF-RTX3070-O8G-GAMING', sku: 'TUF-RTX3070-O8G',
  releasedAt: '2020-10', price: [2599, 2449, 2799],
  attrs: { gpuChip: 'GeForce RTX 3070', chipVendor: 'NVIDIA', vramGb: 8, tdp: 220, peakPower: 260, lengthMm: 300, thicknessSlots: 2.7, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 650 },
  performance: { index: 56, gaming: 59, productivity: 52, vram: 35, efficiency: 70 },
  tagline: '2K 入门 · 上代主力', accent: '#ff8a3d', usedPrice: 1899,
})
addGpu({
  id: 'gpu-msi-rtx3070ti', brand: 'MSI', model: 'RTX 3070 Ti GAMING X TRIO 8G', sku: '912-V505-003',
  releasedAt: '2021-06', price: [2999, 2799, 3299],
  attrs: { gpuChip: 'GeForce RTX 3070 Ti', chipVendor: 'NVIDIA', vramGb: 8, tdp: 290, peakPower: 330, lengthMm: 323, thicknessSlots: 2.7, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 750 },
  performance: { index: 60, gaming: 63, productivity: 55, vram: 35, efficiency: 66 },
  tagline: '2K 高帧 · 三风扇', accent: '#ff5a4d', usedPrice: 2199,
})
addGpu({
  id: 'gpu-gigabyte-rtx3080-12g', brand: 'Gigabyte', model: 'RTX 3080 GAMING OC 12G', sku: 'GV-N3080GAMING OC-12GD',
  releasedAt: '2022-01', price: [3799, 3549, 4099],
  attrs: { gpuChip: 'GeForce RTX 3080', chipVendor: 'NVIDIA', vramGb: 12, tdp: 350, peakPower: 400, lengthMm: 320, thicknessSlots: 3, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 800 },
  performance: { index: 64, gaming: 67, productivity: 58, vram: 52, efficiency: 60 },
  tagline: '2K/4K 入门 · 12GB', accent: '#ff8a3d', usedPrice: 2799,
})
addGpu({
  id: 'gpu-asus-rtx3080ti-tuf', brand: 'ASUS', model: 'TUF-RTX3080TI-O12G-GAMING', sku: 'TUF-RTX3080TI-O12G',
  releasedAt: '2021-06', price: [4599, 4299, 4899],
  attrs: { gpuChip: 'GeForce RTX 3080 Ti', chipVendor: 'NVIDIA', vramGb: 12, tdp: 350, peakPower: 400, lengthMm: 300, thicknessSlots: 2.7, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 850 },
  performance: { index: 68, gaming: 70, productivity: 64, vram: 52, efficiency: 58 },
  tagline: '4K 入门 · 12GB 旗舰', accent: '#ff8a3d', usedPrice: 3299,
})
addGpu({
  id: 'gpu-msi-rtx3090-trio', brand: 'MSI', model: 'RTX 3090 GAMING X TRIO 24G', sku: '912-V388-006',
  releasedAt: '2020-09', status: 'eol', price: null, usedPrice: 4199,
  attrs: { gpuChip: 'GeForce RTX 3090', chipVendor: 'NVIDIA', vramGb: 24, tdp: 350, peakPower: 420, lengthMm: 323, thicknessSlots: 3, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 850 },
  performance: { index: 72, gaming: 74, productivity: 72, vram: 92, efficiency: 52 },
  tagline: '二手 24GB 创作卡', accent: '#ff5a4d',
})
addGpu({
  id: 'gpu-asus-rtx4070-dual', brand: 'ASUS', model: 'DUAL-RTX4070-O12G', sku: 'DUAL-RTX4070-O12G',
  releasedAt: '2023-04', price: [3799, 3599, 4099],
  attrs: { gpuChip: 'GeForce RTX 4070', chipVendor: 'NVIDIA', vramGb: 12, tdp: 200, peakPower: 240, lengthMm: 267, thicknessSlots: 2.5, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 650 },
  performance: { index: 61, gaming: 64, productivity: 55, vram: 52, efficiency: 84 },
  tagline: '2K 主流 · 双风扇', accent: '#ff8a3d', usedPrice: 2999,
})
addGpu({
  id: 'gpu-msi-rtx4070ti-ventus', brand: 'MSI', model: 'RTX 4070 Ti VENTUS 3X 12G OC', sku: '912-V513-003',
  releasedAt: '2023-01', price: [4999, 4699, 5299],
  attrs: { gpuChip: 'GeForce RTX 4070 Ti', chipVendor: 'NVIDIA', vramGb: 12, tdp: 285, peakPower: 330, lengthMm: 308, thicknessSlots: 3, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 750 },
  performance: { index: 70, gaming: 73, productivity: 64, vram: 52, efficiency: 78 },
  tagline: '2K 高帧 · 12GB', accent: '#ff5a4d', usedPrice: 3999,
})
addGpu({
  id: 'gpu-gigabyte-rtx5060ti-8g', brand: 'Gigabyte', model: 'RTX 5060 Ti EAGLE 8G', sku: 'GV-N506TEAGLE-8GD',
  releasedAt: '2025-04', price: [3099, 2899, 3299],
  attrs: { gpuChip: 'GeForce RTX 5060 Ti', chipVendor: 'NVIDIA', vramGb: 8, tdp: 180, peakPower: 215, lengthMm: 280, thicknessSlots: 2.2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 600 },
  performance: { index: 55, gaming: 56, productivity: 50, vram: 35, efficiency: 86 },
  tagline: 'Blackwell 主流 · 8GB', accent: '#ff8a3d',
})
addGpu({
  id: 'gpu-gigabyte-rtx4060ti-16g', brand: 'Gigabyte', model: 'RTX 4060 Ti GAMING OC 16G', sku: 'GV-N406TGAMING OC-16GD',
  releasedAt: '2023-07', price: [3399, 3199, 3699],
  attrs: { gpuChip: 'GeForce RTX 4060 Ti', chipVendor: 'NVIDIA', vramGb: 16, tdp: 165, peakPower: 200, lengthMm: 281, thicknessSlots: 2.5, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 650 },
  performance: { index: 52, gaming: 53, productivity: 48, vram: 70, efficiency: 84 },
  tagline: '16GB 入门创作 · 1080p', accent: '#ff8a3d',
})
addGpu({
  id: 'gpu-asus-rtx2060-dual', brand: 'ASUS', model: 'DUAL-RTX2060-O6G-EVO', sku: 'DUAL-RTX2060-O6G-EVO',
  releasedAt: '2019-01', status: 'eol', price: null, usedPrice: 899,
  attrs: { gpuChip: 'GeForce RTX 2060', chipVendor: 'NVIDIA', vramGb: 6, tdp: 160, peakPower: 190, lengthMm: 242, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 500 },
  performance: { index: 29, gaming: 30, productivity: 26, vram: 28, efficiency: 60 },
  tagline: '二手 1080p 入门', accent: '#ff5a4d',
})
addGpu({
  id: 'gpu-gigabyte-rtx2070s', brand: 'Gigabyte', model: 'RTX 2070 SUPER GAMING OC 3X 8G', sku: 'GV-N207SGAMING OC-8GD',
  releasedAt: '2019-07', status: 'eol', price: null, usedPrice: 1299,
  attrs: { gpuChip: 'GeForce RTX 2070 SUPER', chipVendor: 'NVIDIA', vramGb: 8, tdp: 215, peakPower: 250, lengthMm: 280, thicknessSlots: 2.5, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 650 },
  performance: { index: 38, gaming: 40, productivity: 34, vram: 35, efficiency: 55 },
  tagline: '二手 2K 入门', accent: '#ff8a3d',
})
addGpu({
  id: 'gpu-asus-rtx2080ti-strix', brand: 'ASUS', model: 'ROG-STRIX-RTX2080TI-O11G-GAMING', sku: 'ROG-STRIX-RTX2080TI-O11G',
  releasedAt: '2018-09', status: 'eol', price: null, usedPrice: 1999,
  attrs: { gpuChip: 'GeForce RTX 2080 Ti', chipVendor: 'NVIDIA', vramGb: 11, tdp: 250, peakPower: 300, lengthMm: 305, thicknessSlots: 2.7, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 650 },
  performance: { index: 48, gaming: 50, productivity: 46, vram: 45, efficiency: 52 },
  tagline: '二手 11GB 大显存', accent: '#ff5a4d',
})
addGpu({
  id: 'gpu-asus-gtx1660s', brand: 'ASUS', model: 'PH-GTX1660S-O6G', sku: 'PH-GTX1660S-O6G',
  releasedAt: '2019-10', status: 'eol', price: null, usedPrice: 699,
  attrs: { gpuChip: 'GeForce GTX 1660 SUPER', chipVendor: 'NVIDIA', vramGb: 6, tdp: 125, peakPower: 150, lengthMm: 240, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 450 },
  performance: { index: 24, gaming: 25, productivity: 20, vram: 28, efficiency: 72 },
  tagline: '二手 1080p 电竞', accent: '#ff8a3d',
})
addGpu({
  id: 'gpu-msi-gtx1650', brand: 'MSI', model: 'GTX 1650 D6 VENTUS XS OCV3', sku: 'GTX 1650 D6 VENTUS XS OCV3',
  releasedAt: '2020-04', status: 'eol', price: null, usedPrice: 499,
  attrs: { gpuChip: 'GeForce GTX 1650', chipVendor: 'NVIDIA', vramGb: 4, tdp: 75, peakPower: 95, lengthMm: 179, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 0, recommendedPsu: 350 },
  performance: { index: 14, gaming: 15, productivity: 12, vram: 20, efficiency: 80 },
  tagline: '二手 轻度网游 / 亮机', accent: '#ff5a4d',
})

addGpu({
  id: 'gpu-sapphire-rx6500xt', brand: 'Sapphire', model: 'PULSE RX 6500 XT 4GB', sku: '11314-01-20G',
  releasedAt: '2022-01', price: [999, 899, 1099],
  attrs: { gpuChip: 'Radeon RX 6500 XT', chipVendor: 'AMD', vramGb: 4, tdp: 107, peakPower: 130, lengthMm: 194, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 400 },
  performance: { index: 22, gaming: 23, productivity: 18, vram: 20, efficiency: 70 },
  tagline: '1080p 入门 · 4GB', accent: '#ff3b4d', usedPrice: 699,
})
addGpu({
  id: 'gpu-powercolor-rx6600', brand: 'PowerColor', model: 'Fighter RX 6600 8GB', sku: 'AXRX 6600 8GBD6-3DH',
  releasedAt: '2021-10', price: [1399, 1299, 1499],
  attrs: { gpuChip: 'Radeon RX 6600', chipVendor: 'AMD', vramGb: 8, tdp: 132, peakPower: 160, lengthMm: 200, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 450 },
  performance: { index: 38, gaming: 40, productivity: 32, vram: 35, efficiency: 78 },
  tagline: '1080p 甜点 · 8GB', accent: '#ff3b4d', usedPrice: 999,
})
addGpu({
  id: 'gpu-sapphire-rx6600xt', brand: 'Sapphire', model: 'PULSE RX 6600 XT 8GB', sku: '11309-03-20G',
  releasedAt: '2021-08', price: [1599, 1499, 1749],
  attrs: { gpuChip: 'Radeon RX 6600 XT', chipVendor: 'AMD', vramGb: 8, tdp: 160, peakPower: 190, lengthMm: 240, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 500 },
  performance: { index: 43, gaming: 45, productivity: 36, vram: 35, efficiency: 74 },
  tagline: '1080p 高帧 · RDNA 2', accent: '#ff3b4d', usedPrice: 1199,
})
addGpu({
  id: 'gpu-sapphire-rx6650xt', brand: 'Sapphire', model: 'PULSE RX 6650 XT 8GB', sku: '11319-03-20G',
  releasedAt: '2022-05', price: [1799, 1699, 1949],
  attrs: { gpuChip: 'Radeon RX 6650 XT', chipVendor: 'AMD', vramGb: 8, tdp: 180, peakPower: 210, lengthMm: 240, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 500 },
  performance: { index: 46, gaming: 48, productivity: 39, vram: 35, efficiency: 72 },
  tagline: '1080p 高帧 · 8GB', accent: '#ff3b4d',
})
addGpu({
  id: 'gpu-asus-rx6700xt-tuf', brand: 'ASUS', model: 'TUF-RX6700XT-O12G-GAMING', sku: 'TUF-RX6700XT-O12G',
  releasedAt: '2021-03', price: [2099, 1949, 2299],
  attrs: { gpuChip: 'Radeon RX 6700 XT', chipVendor: 'AMD', vramGb: 12, tdp: 230, peakPower: 265, lengthMm: 300, thicknessSlots: 2.7, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 650 },
  performance: { index: 53, gaming: 55, productivity: 46, vram: 52, efficiency: 70 },
  tagline: '2K 入门 · 12GB', accent: '#ff8a3d', usedPrice: 1599,
})
addGpu({
  id: 'gpu-sapphire-rx6750xt', brand: 'Sapphire', model: 'NITRO+ RX 6750 XT 12GB', sku: '11318-01-20G',
  releasedAt: '2022-05', price: [2399, 2249, 2649],
  attrs: { gpuChip: 'Radeon RX 6750 XT', chipVendor: 'AMD', vramGb: 12, tdp: 250, peakPower: 285, lengthMm: 310, thicknessSlots: 2.7, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 700 },
  performance: { index: 56, gaming: 58, productivity: 49, vram: 52, efficiency: 68 },
  tagline: '2K 高画质 · 12GB', accent: '#ff3b4d', usedPrice: 1799,
})
addGpu({
  id: 'gpu-powercolor-rx6800', brand: 'PowerColor', model: 'Red Devil RX 6800 16GB', sku: 'AXRX 6800 16GBD6-3DHE/OC',
  releasedAt: '2020-11', price: [2899, 2699, 3199],
  attrs: { gpuChip: 'Radeon RX 6800', chipVendor: 'AMD', vramGb: 16, tdp: 250, peakPower: 290, lengthMm: 320, thicknessSlots: 3, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 750 },
  performance: { index: 61, gaming: 63, productivity: 55, vram: 70, efficiency: 64 },
  tagline: '2K/4K 入门 · 16GB', accent: '#ff3b4d', usedPrice: 2199,
})
addGpu({
  id: 'gpu-sapphire-rx6800xt', brand: 'Sapphire', model: 'NITRO+ RX 6800 XT 16GB', sku: '11304-01-20G',
  releasedAt: '2020-11', price: [3299, 3099, 3599],
  attrs: { gpuChip: 'Radeon RX 6800 XT', chipVendor: 'AMD', vramGb: 16, tdp: 300, peakPower: 340, lengthMm: 320, thicknessSlots: 3, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 800 },
  performance: { index: 65, gaming: 67, productivity: 59, vram: 70, efficiency: 60 },
  tagline: '2K 高帧 · 16GB', accent: '#ff3b4d', usedPrice: 2499,
})
addGpu({
  id: 'gpu-asus-rx6900xt-tuf', brand: 'ASUS', model: 'TUF-RX6900XT-O16G-GAMING', sku: 'TUF-RX6900XT-O16G',
  releasedAt: '2020-12', price: [3999, 3749, 4299],
  attrs: { gpuChip: 'Radeon RX 6900 XT', chipVendor: 'AMD', vramGb: 16, tdp: 300, peakPower: 345, lengthMm: 320, thicknessSlots: 3, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 850 },
  performance: { index: 70, gaming: 72, productivity: 64, vram: 70, efficiency: 56 },
  tagline: '上代 A 卡旗舰 · 16GB', accent: '#ff8a3d', usedPrice: 2999,
})
addGpu({
  id: 'gpu-sapphire-rx6950xt', brand: 'Sapphire', model: 'NITRO+ RX 6950 XT 16GB', sku: '11317-01-20G',
  releasedAt: '2022-05', price: [4499, 4199, 4799],
  attrs: { gpuChip: 'Radeon RX 6950 XT', chipVendor: 'AMD', vramGb: 16, tdp: 335, peakPower: 380, lengthMm: 320, thicknessSlots: 3.2, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 900 },
  performance: { index: 72, gaming: 74, productivity: 66, vram: 70, efficiency: 52 },
  tagline: '上代 A 卡旗舰 · 16GB', accent: '#ff3b4d',
})
addGpu({
  id: 'gpu-sapphire-rx7600xt', brand: 'Sapphire', model: 'PULSE RX 7600 XT 16GB', sku: '11341-01-20G',
  releasedAt: '2024-01', price: [2299, 2149, 2499],
  attrs: { gpuChip: 'Radeon RX 7600 XT', chipVendor: 'AMD', vramGb: 16, tdp: 190, peakPower: 225, lengthMm: 250, thicknessSlots: 2.3, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 650 },
  performance: { index: 46, gaming: 47, productivity: 40, vram: 70, efficiency: 82 },
  tagline: '16GB 大显存 · 1080p', accent: '#ff3b4d',
})
addGpu({
  id: 'gpu-asus-rx7900xt-tuf', brand: 'ASUS', model: 'TUF-RX7900XT-O20G-GAMING', sku: 'TUF-RX7900XT-O20G',
  releasedAt: '2022-12', price: [4999, 4699, 5399],
  attrs: { gpuChip: 'Radeon RX 7900 XT', chipVendor: 'AMD', vramGb: 20, tdp: 315, peakPower: 360, lengthMm: 320, thicknessSlots: 3.2, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 850 },
  performance: { index: 78, gaming: 80, productivity: 72, vram: 92, efficiency: 64 },
  tagline: '4K 入门 · 20GB', accent: '#ff8a3d', usedPrice: 3999,
})
addGpu({
  id: 'gpu-sapphire-rx9060xt-16g', brand: 'Sapphire', model: 'PULSE RX 9060 XT 16GB', sku: '11350-01-20G',
  releasedAt: '2025-06', price: [2999, 2799, 3199],
  attrs: { gpuChip: 'Radeon RX 9060 XT', chipVendor: 'AMD', vramGb: 16, tdp: 160, peakPower: 195, lengthMm: 240, thicknessSlots: 2.2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 600 },
  performance: { index: 56, gaming: 58, productivity: 50, vram: 70, efficiency: 84 },
  tagline: 'RDNA 4 · 16GB 主流', accent: '#ff3b4d',
})
addGpu({
  id: 'gpu-powercolor-rx9060xt-8g', brand: 'PowerColor', model: 'Reaper RX 9060 XT 8GB', sku: 'RX9060XT 8G-A',
  releasedAt: '2025-06', price: [2499, 2349, 2699],
  attrs: { gpuChip: 'Radeon RX 9060 XT', chipVendor: 'AMD', vramGb: 8, tdp: 150, peakPower: 180, lengthMm: 220, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 550 },
  performance: { index: 50, gaming: 52, productivity: 44, vram: 35, efficiency: 86 },
  tagline: 'RDNA 4 · 1080p 高帧', accent: '#ff3b4d',
})
addGpu({
  id: 'gpu-sapphire-rx9070gre', brand: 'Sapphire', model: 'PULSE RX 9070 GRE 12G', sku: '11352-01-20G',
  releasedAt: '2025-05', price: [3799, 3599, 4099],
  attrs: { gpuChip: 'Radeon RX 9070 GRE', chipVendor: 'AMD', vramGb: 12, tdp: 220, peakPower: 255, lengthMm: 300, thicknessSlots: 2.5, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 700 },
  performance: { index: 71, gaming: 74, productivity: 64, vram: 52, efficiency: 80 },
  tagline: '中国特供 · 2K 高帧', accent: '#ff3b4d',
})

addGpu({
  id: 'gpu-asus-arc-a380-dual', brand: 'ASUS', model: 'DUAL-ARC-A380-O6G', sku: 'DUAL-ARC-A380-O6G',
  releasedAt: '2022-06', price: [999, 899, 1099],
  attrs: { gpuChip: 'Intel Arc A380', chipVendor: 'Intel', vramGb: 6, tdp: 75, peakPower: 95, lengthMm: 220, thicknessSlots: 2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 400 },
  performance: { index: 18, gaming: 18, productivity: 20, vram: 28, efficiency: 74 },
  tagline: '入门亮机 · AV1 编码', accent: '#44dcff', usedPrice: 699,
})
addGpu({
  id: 'gpu-sparkle-arc-a580', brand: 'Sparkle', model: 'Arc A580 ORC 8GB', sku: 'SA580-8GOC',
  releasedAt: '2023-10', price: [1299, 1199, 1399],
  attrs: { gpuChip: 'Intel Arc A580', chipVendor: 'Intel', vramGb: 8, tdp: 185, peakPower: 220, lengthMm: 280, thicknessSlots: 2.2, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 600 },
  performance: { index: 30, gaming: 31, productivity: 34, vram: 35, efficiency: 66 },
  tagline: '8GB 入门 · XeSS', accent: '#44dcff',
})
addGpu({
  id: 'gpu-asus-arc-a750-dual', brand: 'ASUS', model: 'DUAL-ARC-A750-O8G', sku: 'DUAL-ARC-A750-O8G',
  releasedAt: '2022-10', price: [1499, 1399, 1649],
  attrs: { gpuChip: 'Intel Arc A750', chipVendor: 'Intel', vramGb: 8, tdp: 225, peakPower: 260, lengthMm: 270, thicknessSlots: 2.2, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 650 },
  performance: { index: 36, gaming: 37, productivity: 40, vram: 35, efficiency: 62 },
  tagline: '8GB · AV1 创作入门', accent: '#44dcff',
})
addGpu({
  id: 'gpu-acer-arc-a770', brand: 'Acer', model: 'Predator BiFrost Arc A770 16GB', sku: 'APBF-IA770-16G',
  releasedAt: '2022-11', price: [1999, 1849, 2199],
  attrs: { gpuChip: 'Intel Arc A770', chipVendor: 'Intel', vramGb: 16, tdp: 225, peakPower: 260, lengthMm: 280, thicknessSlots: 2.5, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 650 },
  performance: { index: 42, gaming: 43, productivity: 48, vram: 70, efficiency: 58 },
  tagline: '16GB 创作 · AV1', accent: '#44dcff', usedPrice: 1499,
})
addGpu({
  id: 'gpu-sparkle-arc-b570', brand: 'Sparkle', model: 'Arc B570 GUARDIAN 10GB', sku: 'SB570G-10GOC',
  releasedAt: '2025-01', price: [1799, 1699, 1949],
  attrs: { gpuChip: 'Intel Arc B570', chipVendor: 'Intel', vramGb: 10, tdp: 150, peakPower: 180, lengthMm: 260, thicknessSlots: 2.2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 600 },
  performance: { index: 45, gaming: 47, productivity: 46, vram: 52, efficiency: 76 },
  tagline: '10GB 主流 · XeSS 2', accent: '#44dcff',
})

/* ------------------------------------- Chinese AIB brands / 国产显卡品牌 */
addGpu({
  id: 'gpu-colorful-rtx5070-ultra', brand: 'Colorful', model: 'iGame GeForce RTX 5070 Ultra W OC 12GB', sku: 'IGAME-RTX5070-ULTRA-W',
  releasedAt: '2025-03', price: [4799, 4599, 5099],
  attrs: { gpuChip: 'GeForce RTX 5070', chipVendor: 'NVIDIA', vramGb: 12, tdp: 250, peakPower: 300, lengthMm: 315, thicknessSlots: 3, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 750 },
  performance: { index: 69, gaming: 72, productivity: 62, vram: 52, efficiency: 80 },
  tagline: '七彩虹 iGame · 2K 光追', accent: '#ff5a4d',
})
addGpu({
  id: 'gpu-colorful-rtx5070ti-ultra', brand: 'Colorful', model: 'iGame GeForce RTX 5070 Ti Ultra W OC 16GB', sku: 'IGAME-RTX5070TI-ULTRA-W',
  releasedAt: '2025-02', price: [6899, 6599, 7299],
  attrs: { gpuChip: 'GeForce RTX 5070 Ti', chipVendor: 'NVIDIA', vramGb: 16, tdp: 300, peakPower: 350, lengthMm: 330, thicknessSlots: 3.2, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 850 },
  performance: { index: 77, gaming: 80, productivity: 70, vram: 70, efficiency: 76 },
  tagline: '七彩虹 · 4K 主流', accent: '#ff5a4d',
})
addGpu({
  id: 'gpu-colorful-rtx5080-ultra', brand: 'Colorful', model: 'iGame GeForce RTX 5080 Ultra W OC 16GB', sku: 'IGAME-RTX5080-ULTRA-W',
  releasedAt: '2025-01', price: [9299, 8899, 9799],
  attrs: { gpuChip: 'GeForce RTX 5080', chipVendor: 'NVIDIA', vramGb: 16, tdp: 360, peakPower: 420, lengthMm: 340, thicknessSlots: 3.4, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 1000 },
  performance: { index: 88, gaming: 91, productivity: 82, vram: 70, efficiency: 72 },
  tagline: '七彩虹旗舰 · 4K 高刷', accent: '#ff5a4d',
})
addGpu({
  id: 'gpu-colorful-rtx5060ti-ultra', brand: 'Colorful', model: 'RTX 5060 Ti Ultra W DUO 16GB', sku: 'RTX5060TI-ULTRA-W-DUO',
  releasedAt: '2025-04', price: [3699, 3499, 3899],
  attrs: { gpuChip: 'GeForce RTX 5060 Ti', chipVendor: 'NVIDIA', vramGb: 16, tdp: 180, peakPower: 220, lengthMm: 255, thicknessSlots: 2.5, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 650 },
  performance: { index: 60, gaming: 62, productivity: 54, vram: 70, efficiency: 88 },
  tagline: '七彩虹 · 16GB 大显存', accent: '#ff5a4d',
})
addGpu({
  id: 'gpu-colorful-rtx4060-ultra', brand: 'Colorful', model: 'RTX 4060 Ultra W DUO 8GB', sku: 'RTX4060-ULTRA-W-DUO',
  releasedAt: '2023-06', price: [2299, 2149, 2499],
  attrs: { gpuChip: 'GeForce RTX 4060', chipVendor: 'NVIDIA', vramGb: 8, tdp: 115, peakPower: 150, lengthMm: 250, thicknessSlots: 2.3, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 550 },
  performance: { index: 47, gaming: 49, productivity: 41, vram: 35, efficiency: 90 },
  tagline: '七彩虹 · 1080p 甜点', accent: '#ff5a4d',
})
addGpu({
  id: 'gpu-galax-rtx5070-metal', brand: 'Galax', model: 'RTX 5070 金属大师 12GB', sku: '50NON7MDM7MOC',
  releasedAt: '2025-03', price: [4699, 4499, 4999],
  attrs: { gpuChip: 'GeForce RTX 5070', chipVendor: 'NVIDIA', vramGb: 12, tdp: 250, peakPower: 300, lengthMm: 310, thicknessSlots: 3, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 750 },
  performance: { index: 69, gaming: 72, productivity: 62, vram: 52, efficiency: 80 },
  tagline: '影驰金属大师 · 2K', accent: '#ffcf4d',
})
addGpu({
  id: 'gpu-galax-rtx5060-metal', brand: 'Galax', model: 'RTX 5060 金属大师 8GB', sku: '50NON6MDM7MOC',
  releasedAt: '2025-05', price: [2599, 2449, 2799],
  attrs: { gpuChip: 'GeForce RTX 5060', chipVendor: 'NVIDIA', vramGb: 8, tdp: 145, peakPower: 180, lengthMm: 250, thicknessSlots: 2.2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 600 },
  performance: { index: 54, gaming: 56, productivity: 46, vram: 35, efficiency: 88 },
  tagline: '影驰 · 1080p 主流', accent: '#ffcf4d',
})
addGpu({
  id: 'gpu-galax-rtx4070s-starfrost', brand: 'Galax', model: 'RTX 4070 SUPER 星曜 OC 12GB', sku: '47SOM7DS9C1OC',
  releasedAt: '2024-01', price: [4999, 4749, 5299],
  attrs: { gpuChip: 'GeForce RTX 4070 SUPER', chipVendor: 'NVIDIA', vramGb: 12, tdp: 220, peakPower: 260, lengthMm: 320, thicknessSlots: 3, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 750 },
  performance: { index: 72, gaming: 75, productivity: 65, vram: 52, efficiency: 79 },
  tagline: '影驰星曜 · 2K 高帧', accent: '#ffcf4d',
})
addGpu({
  id: 'gpu-zotac-rtx5070ti-amp', brand: 'Zotac', model: 'RTX 5070 Ti AMP Extreme 16GB', sku: 'ZT-B50710F-10P',
  releasedAt: '2025-02', price: [7399, 7099, 7799],
  attrs: { gpuChip: 'GeForce RTX 5070 Ti', chipVendor: 'NVIDIA', vramGb: 16, tdp: 300, peakPower: 350, lengthMm: 330, thicknessSlots: 3.2, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 850 },
  performance: { index: 77, gaming: 80, productivity: 70, vram: 70, efficiency: 76 },
  tagline: '索泰 AMP · 4K 主流', accent: '#ff8a3d',
})
addGpu({
  id: 'gpu-zotac-rtx5060ti-twin', brand: 'Zotac', model: 'RTX 5060 Ti Twin Edge 16GB', sku: 'ZT-B50610E-10P',
  releasedAt: '2025-04', price: [3699, 3499, 3899],
  attrs: { gpuChip: 'GeForce RTX 5060 Ti', chipVendor: 'NVIDIA', vramGb: 16, tdp: 180, peakPower: 220, lengthMm: 240, thicknessSlots: 2.2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 650 },
  performance: { index: 60, gaming: 62, productivity: 54, vram: 70, efficiency: 88 },
  tagline: '索泰双风扇 · 16GB', accent: '#ff8a3d',
})
addGpu({
  id: 'gpu-maxsun-rtx5070-icraft', brand: 'Maxsun', model: 'iCraft RTX 5070 OC 12GB', sku: 'MS-RTX5070-ICRAFT',
  releasedAt: '2025-03', price: [4799, 4599, 5099],
  attrs: { gpuChip: 'GeForce RTX 5070', chipVendor: 'NVIDIA', vramGb: 12, tdp: 250, peakPower: 300, lengthMm: 320, thicknessSlots: 3, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 750 },
  performance: { index: 69, gaming: 72, productivity: 62, vram: 52, efficiency: 80 },
  tagline: '铭瑄 iCraft · 2K', accent: '#e8ecf2',
})
addGpu({
  id: 'gpu-maxsun-rtx4060-icraft', brand: 'Maxsun', model: 'iCraft RTX 4060 8GB', sku: 'MS-RTX4060-ICRAFT',
  releasedAt: '2023-07', price: [2399, 2249, 2599],
  attrs: { gpuChip: 'GeForce RTX 4060', chipVendor: 'NVIDIA', vramGb: 8, tdp: 115, peakPower: 150, lengthMm: 250, thicknessSlots: 2.2, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 550 },
  performance: { index: 47, gaming: 49, productivity: 41, vram: 35, efficiency: 90 },
  tagline: '铭瑄 · 1080p 电竞', accent: '#e8ecf2',
})
addGpu({
  id: 'gpu-yeston-rx9070xt-sakura', brand: 'Yeston', model: 'RX 9070 XT 樱瞳花嫁 16GB', sku: 'RX9070XT-16GD6-SAKURA',
  releasedAt: '2025-03', price: [5299, 4999, 5599],
  attrs: { gpuChip: 'Radeon RX 9070 XT', chipVendor: 'AMD', vramGb: 16, tdp: 304, peakPower: 350, lengthMm: 330, thicknessSlots: 3.1, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 850 },
  performance: { index: 77, gaming: 80, productivity: 68, vram: 70, efficiency: 73 },
  tagline: '盈通樱瞳 · 4K 高帧', accent: '#ff9dbb',
})
addGpu({
  id: 'gpu-yeston-rtx5060-sakura', brand: 'Yeston', model: 'RTX 5060 樱瞳 8GB', sku: 'RTX5060-8GD6-SAKURA',
  releasedAt: '2025-05', price: [2599, 2449, 2799],
  attrs: { gpuChip: 'GeForce RTX 5060', chipVendor: 'NVIDIA', vramGb: 8, tdp: 145, peakPower: 180, lengthMm: 245, thicknessSlots: 2.1, pcie12vhpwr: 0, pcie8: 1, recommendedPsu: 600 },
  performance: { index: 54, gaming: 56, productivity: 46, vram: 35, efficiency: 88 },
  tagline: '盈通樱瞳 · 1080p', accent: '#ff9dbb',
})
addGpu({
  id: 'gpu-xfx-rx9070xt-merc', brand: 'XFX', model: 'RX 9070 XT 海外版 Pro 16GB', sku: 'RX-97TMERC319B',
  releasedAt: '2025-03', price: [5499, 5199, 5799],
  attrs: { gpuChip: 'Radeon RX 9070 XT', chipVendor: 'AMD', vramGb: 16, tdp: 304, peakPower: 350, lengthMm: 330, thicknessSlots: 3.2, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 850 },
  performance: { index: 77, gaming: 80, productivity: 68, vram: 70, efficiency: 73 },
  tagline: '讯景海外版 · 4K', accent: '#d8e6f2',
})
addGpu({
  id: 'gpu-xfx-rx7800xt-merc', brand: 'XFX', model: 'RX 7800 XT 海外版 16GB', sku: 'RX-78TMERC319B',
  releasedAt: '2023-09', price: [3899, 3699, 4099],
  attrs: { gpuChip: 'Radeon RX 7800 XT', chipVendor: 'AMD', vramGb: 16, tdp: 263, peakPower: 300, lengthMm: 320, thicknessSlots: 3, pcie12vhpwr: 0, pcie8: 2, recommendedPsu: 750 },
  performance: { index: 63, gaming: 66, productivity: 56, vram: 70, efficiency: 70 },
  tagline: '讯景 · 2K 大显存', accent: '#d8e6f2',
})
addGpu({
  id: 'gpu-inno3d-rtx5070ti-x3', brand: 'Inno3D', model: 'RTX 5070 Ti 曜夜 X3 16GB', sku: 'N507T3-166XX-1870VA',
  releasedAt: '2025-02', price: [6999, 6699, 7399],
  attrs: { gpuChip: 'GeForce RTX 5070 Ti', chipVendor: 'NVIDIA', vramGb: 16, tdp: 300, peakPower: 350, lengthMm: 330, thicknessSlots: 3, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 850 },
  performance: { index: 77, gaming: 80, productivity: 70, vram: 70, efficiency: 76 },
  tagline: '映众曜夜 · 4K', accent: '#ff8a3d',
})
addGpu({
  id: 'gpu-pny-rtx5070-tri', brand: 'PNY', model: 'RTX 5070 12GB VERTO Triple Fan', sku: 'VCG507012TFXPB1',
  releasedAt: '2025-03', price: [4599, 4399, 4899],
  attrs: { gpuChip: 'GeForce RTX 5070', chipVendor: 'NVIDIA', vramGb: 12, tdp: 250, peakPower: 300, lengthMm: 305, thicknessSlots: 3, pcie12vhpwr: 1, pcie8: 0, recommendedPsu: 750 },
  performance: { index: 69, gaming: 72, productivity: 62, vram: 52, efficiency: 80 },
  tagline: 'PNY · 2K 工作站', accent: '#9fe8ff',
})

/* --------------------------------------------------------------- Memory */
add({
  id: 'ram-kingston-ddr4-16', category: 'memory', brand: 'Kingston', model: 'FURY Beast DDR4 3200 16GB (2×8)', sku: 'KF432C16BBK2/16',
  releasedAt: '2021-06', status: 'active', price: [199, 179, 239],
  attrs: { memoryType: 'DDR4', memoryCapacity: 16, memorySticks: 2, memorySpeed: 3200, casLatency: 16, heightMm: 34, rgb: false, color: 'black' },
  performance: { index: 38, gaming: 42, productivity: 35, single: 0, multi: 40 },
})
add({
  id: 'ram-corsair-ddr4-32', category: 'memory', brand: 'Corsair', model: 'Vengeance LPX DDR4 3600 32GB (2×16)', sku: 'CMK32GX4M2D3600C18',
  releasedAt: '2021-03', status: 'active', price: [349, 319, 399],
  attrs: { memoryType: 'DDR4', memoryCapacity: 32, memorySticks: 2, memorySpeed: 3600, casLatency: 18, heightMm: 34, rgb: false, color: 'black' },
  performance: { index: 48, gaming: 52, productivity: 45, single: 0, multi: 50 },
})
add({
  id: 'ram-gskill-ddr4-32', category: 'memory', brand: 'G.Skill', model: 'Trident Z Neo DDR4 3600 32GB (2×16)', sku: 'F4-3600C16D-32GTZNC',
  releasedAt: '2020-09', status: 'active', price: [449, 419, 499],
  attrs: { memoryType: 'DDR4', memoryCapacity: 32, memorySticks: 2, memorySpeed: 3600, casLatency: 16, heightMm: 44, rgb: true, color: 'black' },
  performance: { index: 52, gaming: 55, productivity: 50, single: 0, multi: 54 },
})
add({
  id: 'ram-kingston-ddr5-16', category: 'memory', brand: 'Kingston', model: 'FURY Beast DDR5 5600 16GB (2×8)', sku: 'KF556C36BBEK2-16',
  releasedAt: '2023-01', status: 'active', price: [299, 269, 339],
  attrs: { memoryType: 'DDR5', memoryCapacity: 16, memorySticks: 2, memorySpeed: 5600, casLatency: 36, heightMm: 34, rgb: false, color: 'black' },
  performance: { index: 50, gaming: 55, productivity: 48, single: 0, multi: 52 },
})
add({
  id: 'ram-crucial-ddr5-32', category: 'memory', brand: 'Crucial', model: 'Pro DDR5 5600 32GB (2×16)', sku: 'CP2K16G56C46U5',
  releasedAt: '2023-10', status: 'active', price: [499, 459, 559],
  attrs: { memoryType: 'DDR5', memoryCapacity: 32, memorySticks: 2, memorySpeed: 5600, casLatency: 46, heightMm: 32, rgb: false, color: 'black' },
  performance: { index: 56, gaming: 60, productivity: 55, single: 0, multi: 60 },
})
add({
  id: 'ram-gskill-ddr5-32', category: 'memory', brand: 'G.Skill', model: 'Trident Z5 Neo RGB DDR5 6000 32GB (2×16) CL30', sku: 'F5-6000J3038F16GX2-TZ5NR',
  releasedAt: '2023-02', status: 'active', price: [699, 649, 759],
  priceMeta: { history: [
    { date: '2026-09-07', price: 749 }, { date: '2026-09-21', price: 729 }, { date: '2026-10-05', price: 719 },
    { date: '2026-10-19', price: 709 }, { date: '2026-11-02', price: 699 }, { date: '2026-11-16', price: 699 },
  ] },
  attrs: { memoryType: 'DDR5', memoryCapacity: 32, memorySticks: 2, memorySpeed: 6000, casLatency: 30, heightMm: 44, rgb: true, color: 'black' },
  performance: { index: 68, gaming: 72, productivity: 68, single: 0, multi: 70 },
})
add({
  id: 'ram-corsair-ddr5-32', category: 'memory', brand: 'Corsair', model: 'Vengeance RGB DDR5 6000 32GB (2×16) CL36', sku: 'CMH32GX5M2E6000C36',
  releasedAt: '2022-12', status: 'active', price: [599, 549, 659],
  attrs: { memoryType: 'DDR5', memoryCapacity: 32, memorySticks: 2, memorySpeed: 6000, casLatency: 36, heightMm: 44, rgb: true, color: 'black' },
  performance: { index: 63, gaming: 67, productivity: 63, single: 0, multi: 64 },
})
add({
  id: 'ram-teamgroup-ddr5-32', category: 'memory', brand: 'TeamGroup', model: 'T-Force Delta RGB DDR5 6000 32GB (2×16)', sku: 'FF3D532G6000HC30DC01',
  releasedAt: '2023-08', status: 'active', price: [629, 579, 689],
  attrs: { memoryType: 'DDR5', memoryCapacity: 32, memorySticks: 2, memorySpeed: 6000, casLatency: 30, heightMm: 46, rgb: true, color: 'white' },
  performance: { index: 66, gaming: 70, productivity: 66, single: 0, multi: 68 },
})
add({
  id: 'ram-gskill-ddr5-64', category: 'memory', brand: 'G.Skill', model: 'Ripjaws S5 DDR5 6000 64GB (2×32)', sku: 'F5-6000J3238G32GX2-RS5K',
  releasedAt: '2023-06', status: 'active', price: [1299, 1199, 1399],
  attrs: { memoryType: 'DDR5', memoryCapacity: 64, memorySticks: 2, memorySpeed: 6000, casLatency: 32, heightMm: 33, rgb: false, color: 'black' },
  performance: { index: 76, gaming: 74, productivity: 84, single: 0, multi: 82 },
})
add({
  id: 'ram-corsair-ddr5-7200', category: 'memory', brand: 'Corsair', model: 'Dominator Titanium DDR5 7200 32GB (2×16)', sku: 'CMP32GX5M2X7200C34',
  releasedAt: '2024-04', status: 'active', price: [999, 949, 1099],
  attrs: { memoryType: 'DDR5', memoryCapacity: 32, memorySticks: 2, memorySpeed: 7200, casLatency: 34, heightMm: 47, rgb: true, color: 'black' },
  performance: { index: 76, gaming: 78, productivity: 72, single: 0, multi: 74 },
})

/* ------------------------------------------------------------------ SSD */
add({
  id: 'ssd-samsung-990pro-1t', category: 'ssd', brand: 'Samsung', model: '990 PRO 1TB', sku: 'MZ-V9P1T0BW',
  releasedAt: '2022-11', status: 'active', price: [699, 649, 759],
  priceMeta: { history: [
    { date: '2026-09-07', price: 749 }, { date: '2026-09-21', price: 739 }, { date: '2026-10-05', price: 729 },
    { date: '2026-10-19', price: 719 }, { date: '2026-11-02', price: 699 }, { date: '2026-11-16', price: 699 },
  ] },
  attrs: { capacityGb: 1024, interface: 'M.2 PCIe 4.0 x4', formFactorDrive: 'M.2 2280', readMbps: 7450, writeMbps: 6900, tdp: 7.5 },
  performance: { index: 92, gaming: 92, productivity: 92, single: 0, multi: 0 },
  specsExtra: { TBW: 600 },
})
add({
  id: 'ssd-samsung-990pro-2t', category: 'ssd', brand: 'Samsung', model: '990 PRO 2TB', sku: 'MZ-V9P2T0BW',
  releasedAt: '2022-11', status: 'active', price: [1199, 1099, 1299],
  attrs: { capacityGb: 2048, interface: 'M.2 PCIe 4.0 x4', formFactorDrive: 'M.2 2280', readMbps: 7450, writeMbps: 6900, tdp: 7.8 },
  performance: { index: 94, gaming: 94, productivity: 94, single: 0, multi: 0 },
  specsExtra: { TBW: 1200 },
})
add({
  id: 'ssd-wd-sn850x-1t', category: 'ssd', brand: 'WD', model: 'Black SN850X 1TB', sku: 'WDS100T2X0E',
  releasedAt: '2022-10', status: 'active', price: [599, 549, 659],
  attrs: { capacityGb: 1024, interface: 'M.2 PCIe 4.0 x4', formFactorDrive: 'M.2 2280', readMbps: 7300, writeMbps: 6300, tdp: 7.3 },
  performance: { index: 89, gaming: 90, productivity: 88, single: 0, multi: 0 },
  specsExtra: { TBW: 600 },
})
add({
  id: 'ssd-wd-sn850x-2t', category: 'ssd', brand: 'WD', model: 'Black SN850X 2TB', sku: 'WDS200T2X0E',
  releasedAt: '2022-10', status: 'active', price: [1099, 999, 1199],
  attrs: { capacityGb: 2048, interface: 'M.2 PCIe 4.0 x4', formFactorDrive: 'M.2 2280', readMbps: 7300, writeMbps: 6600, tdp: 7.5 },
  performance: { index: 91, gaming: 92, productivity: 90, single: 0, multi: 0 },
  specsExtra: { TBW: 1200 },
})
add({
  id: 'ssd-crucial-p3plus-1t', category: 'ssd', brand: 'Crucial', model: 'P3 Plus 1TB', sku: 'CT1000P3PSSD8',
  releasedAt: '2022-08', status: 'active', price: [449, 399, 499],
  attrs: { capacityGb: 1024, interface: 'M.2 PCIe 4.0 x4', formFactorDrive: 'M.2 2280', readMbps: 5000, writeMbps: 3600, tdp: 5.5 },
  performance: { index: 72, gaming: 73, productivity: 70, single: 0, multi: 0 },
  specsExtra: { TBW: 220 },
})
add({
  id: 'ssd-lexar-nm790-2t', category: 'ssd', brand: 'Lexar', model: 'NM790 2TB', sku: 'LNM790X002T-RNNNG',
  releasedAt: '2023-06', status: 'active', price: [899, 829, 969],
  attrs: { capacityGb: 2048, interface: 'M.2 PCIe 4.0 x4', formFactorDrive: 'M.2 2280', readMbps: 7400, writeMbps: 6500, tdp: 6.5 },
  performance: { index: 88, gaming: 89, productivity: 87, single: 0, multi: 0 },
  specsExtra: { TBW: 1500 },
})
add({
  id: 'ssd-kingston-nv2-1t', category: 'ssd', brand: 'Kingston', model: 'NV2 1TB', sku: 'SNV2S/1000G',
  releasedAt: '2022-09', status: 'active', price: [399, 359, 449],
  attrs: { capacityGb: 1024, interface: 'M.2 PCIe 4.0 x4', formFactorDrive: 'M.2 2280', readMbps: 3500, writeMbps: 2100, tdp: 5.2 },
  performance: { index: 63, gaming: 64, productivity: 62, single: 0, multi: 0 },
  specsExtra: { TBW: 320 },
})
add({
  id: 'ssd-samsung-870evo-1t', category: 'ssd', brand: 'Samsung', model: '870 EVO 1TB', sku: 'MZ-77E1T0B',
  releasedAt: '2021-01', status: 'active', price: [549, 499, 599],
  attrs: { capacityGb: 1024, interface: 'SATA 6Gb/s', formFactorDrive: '2.5 inch', readMbps: 560, writeMbps: 530, tdp: 3.5 },
  performance: { index: 42, gaming: 43, productivity: 45, single: 0, multi: 0 },
  specsExtra: { TBW: 600 },
})
add({
  id: 'ssd-wd-sa510-1t', category: 'ssd', brand: 'WD', model: 'Blue SA510 1TB', sku: 'WDS100T3B0A',
  releasedAt: '2022-01', status: 'active', price: [499, 449, 549],
  attrs: { capacityGb: 1024, interface: 'SATA 6Gb/s', formFactorDrive: '2.5 inch', readMbps: 560, writeMbps: 520, tdp: 3.2 },
  performance: { index: 40, gaming: 41, productivity: 43, single: 0, multi: 0 },
  specsExtra: { TBW: 500 },
})
add({
  id: 'ssd-crucial-t705-2t', category: 'ssd', brand: 'Crucial', model: 'T705 2TB', sku: 'CT2000T705SSD5',
  releasedAt: '2024-04', status: 'active', price: [1699, 1599, 1899],
  attrs: { capacityGb: 2048, interface: 'M.2 PCIe 5.0 x4', formFactorDrive: 'M.2 2280', readMbps: 14500, writeMbps: 12700, tdp: 11 },
  performance: { index: 100, gaming: 98, productivity: 100, single: 0, multi: 0 },
  specsExtra: { TBW: 1200 },
})

/* ------------------------------------------------------------------ HDD */
add({
  id: 'hdd-seagate-2t', category: 'hdd', brand: 'Seagate', model: 'BarraCuda 2TB 7200RPM', sku: 'ST2000DM008',
  releasedAt: '2019-02', status: 'active', price: [399, 369, 439],
  attrs: { capacityGb: 2048, rpm: 7200, cacheGb: 0.256, interface: 'SATA 6Gb/s', formFactorDrive: '3.5 inch', tdp: 5.5 },
  performance: { index: 38, gaming: 36, productivity: 45, single: 0, multi: 0 },
  specsExtra: { 记录技术: 'SMR' },
})
add({
  id: 'hdd-seagate-4t', category: 'hdd', brand: 'Seagate', model: 'BarraCuda 4TB 5400RPM', sku: 'ST4000DM004',
  releasedAt: '2019-02', status: 'active', price: [549, 509, 599],
  attrs: { capacityGb: 4096, rpm: 5400, cacheGb: 0.256, interface: 'SATA 6Gb/s', formFactorDrive: '3.5 inch', tdp: 4.5 },
  performance: { index: 39, gaming: 36, productivity: 47, single: 0, multi: 0 },
  specsExtra: { 记录技术: 'SMR' },
})
add({
  id: 'hdd-wd-blue-4t', category: 'hdd', brand: 'WD', model: 'Blue 4TB 5400RPM', sku: 'WD40EZAX',
  releasedAt: '2023-04', status: 'active', price: [569, 529, 619],
  attrs: { capacityGb: 4096, rpm: 5400, cacheGb: 0.256, interface: 'SATA 6Gb/s', formFactorDrive: '3.5 inch', tdp: 4.5 },
  performance: { index: 40, gaming: 37, productivity: 48, single: 0, multi: 0 },
  specsExtra: { 记录技术: 'CMR' },
})
add({
  id: 'hdd-toshiba-p300-4t', category: 'hdd', brand: 'Toshiba', model: 'P300 4TB 7200RPM', sku: 'HDWD240UZSVA',
  releasedAt: '2020-06', status: 'active', price: [599, 559, 649],
  attrs: { capacityGb: 4096, rpm: 7200, cacheGb: 0.128, interface: 'SATA 6Gb/s', formFactorDrive: '3.5 inch', tdp: 6.5 },
  performance: { index: 43, gaming: 39, productivity: 50, single: 0, multi: 0 },
  specsExtra: { 记录技术: 'CMR' },
})

/* ------------------------------------------------------------------ PSU */
add({
  id: 'psu-gwm-x6-650', category: 'psu', brand: 'Great Wall', model: 'X6 650W 80+ Bronze', sku: 'GW-X6-650',
  releasedAt: '2021-06', status: 'active', price: [399, 369, 449],
  attrs: { wattage: 650, efficiency: '80+ Bronze', atxVersion: 'ATX 2.31', modular: '非模组', pcie8: 2, pcie12vhpwr: 0, eps8: 1, lengthMm: 140, color: 'black' },
  performance: { index: 55, gaming: 55, productivity: 55, single: 55, multi: 55, efficiency: 60 },
})
add({
  id: 'psu-seasonic-gx750', category: 'psu', brand: 'Seasonic', model: 'Focus GX-750 ATX 3.0', sku: 'FOCUS-GX-750-ATX3',
  releasedAt: '2023-01', status: 'active', price: [699, 649, 769],
  attrs: { wattage: 750, efficiency: '80+ Gold', atxVersion: 'ATX 3.0', modular: '全模组', pcie8: 2, pcie12vhpwr: 1, eps8: 2, lengthMm: 140, color: 'black' },
  performance: { index: 78, gaming: 78, productivity: 78, single: 78, multi: 78, efficiency: 88 },
})
add({
  id: 'psu-corsair-rm850x', category: 'psu', brand: 'Corsair', model: 'RM850x (2024) 850W', sku: 'CP-9020270-CN',
  releasedAt: '2024-06', status: 'active', price: [949, 899, 1049],
  priceMeta: { history: [
    { date: '2026-09-07', price: 999 }, { date: '2026-09-21', price: 989 }, { date: '2026-10-05', price: 979 },
    { date: '2026-10-19', price: 969 }, { date: '2026-11-02', price: 949 }, { date: '2026-11-16', price: 949 },
  ] },
  attrs: { wattage: 850, efficiency: '80+ Gold', atxVersion: 'ATX 3.1', modular: '全模组', pcie8: 4, pcie12vhpwr: 1, eps8: 2, lengthMm: 160, color: 'black' },
  performance: { index: 88, gaming: 88, productivity: 88, single: 88, multi: 88, efficiency: 92 },
})
add({
  id: 'psu-msi-a850g', category: 'psu', brand: 'MSI', model: 'MPG A850G PCIE5 850W', sku: 'MPG-A850G-PCIE5',
  releasedAt: '2022-10', status: 'active', price: [899, 849, 999],
  attrs: { wattage: 850, efficiency: '80+ Gold', atxVersion: 'ATX 3.0', modular: '全模组', pcie8: 4, pcie12vhpwr: 1, eps8: 2, lengthMm: 150, color: 'black' },
  performance: { index: 85, gaming: 85, productivity: 85, single: 85, multi: 85, efficiency: 90 },
})
add({
  id: 'psu-superflower-850', category: 'psu', brand: 'Super Flower', model: 'Leadex III 850W Gold', sku: 'SF-850F14HG',
  releasedAt: '2021-09', status: 'active', price: [799, 749, 879],
  attrs: { wattage: 850, efficiency: '80+ Gold', atxVersion: 'ATX 2.32', modular: '全模组', pcie8: 4, pcie12vhpwr: 0, eps8: 2, lengthMm: 150, color: 'black' },
  performance: { index: 82, gaming: 82, productivity: 82, single: 82, multi: 82, efficiency: 91 },
})
add({
  id: 'psu-asus-thor-1000', category: 'psu', brand: 'ASUS', model: 'ROG Thor 1000W Platinum II', sku: 'ROG-THOR-1000P2-GAMING',
  releasedAt: '2021-11', status: 'active', price: [1899, 1799, 2099],
  attrs: { wattage: 1000, efficiency: '80+ Platinum', atxVersion: 'ATX 3.0', modular: '全模组', pcie8: 6, pcie12vhpwr: 1, eps8: 2, lengthMm: 190, color: 'black' },
  performance: { index: 94, gaming: 94, productivity: 94, single: 94, multi: 94, efficiency: 96 },
})
add({
  id: 'psu-bequiet-pure12-850', category: 'psu', brand: 'be quiet!', model: 'Pure Power 12 M 850W', sku: 'BN344',
  releasedAt: '2023-04', status: 'active', price: [899, 849, 999],
  attrs: { wattage: 850, efficiency: '80+ Gold', atxVersion: 'ATX 3.1', modular: '全模组', pcie8: 4, pcie12vhpwr: 1, eps8: 2, lengthMm: 160, color: 'black' },
  performance: { index: 86, gaming: 86, productivity: 86, single: 86, multi: 86, efficiency: 93 },
})
add({
  id: 'psu-corsair-rm1200x', category: 'psu', brand: 'Corsair', model: 'RM1200x SHIFT 1200W', sku: 'CP-9020254-CN',
  releasedAt: '2023-06', status: 'active', price: [1699, 1599, 1899],
  attrs: { wattage: 1200, efficiency: '80+ Gold', atxVersion: 'ATX 3.0', modular: '全模组', pcie8: 4, pcie12vhpwr: 2, eps8: 2, lengthMm: 180, color: 'black' },
  performance: { index: 92, gaming: 92, productivity: 92, single: 92, multi: 92, efficiency: 94 },
})

/* ---------------------------------------------------------------- Cooler */
add({
  id: 'cooler-thermalright-pa120se', category: 'cooler', brand: 'Thermalright', model: 'Peerless Assassin 120 SE', sku: 'PA120-SE',
  releasedAt: '2022-08', status: 'active', price: [179, 159, 209],
  attrs: { coolerType: 'air', coolerHeightMm: 155, coolerTdp: 245, cpuSockets: ['AM4', 'AM5', 'LGA1700', 'LGA1851'], rgb: false, color: 'black' },
  performance: { index: 76, gaming: 76, productivity: 76, single: 76, multi: 76 },
  specsExtra: { 风扇: '2 × 120mm PWM' },
})
add({
  id: 'cooler-deepcool-ak620', category: 'cooler', brand: 'DeepCool', model: 'AK620', sku: 'R-AK620-BKNNMT-G',
  releasedAt: '2021-10', status: 'active', price: [299, 269, 329],
  attrs: { coolerType: 'air', coolerHeightMm: 160, coolerTdp: 260, cpuSockets: ['AM4', 'AM5', 'LGA1700', 'LGA1851'], rgb: false, color: 'black' },
  performance: { index: 80, gaming: 80, productivity: 80, single: 80, multi: 80 },
  specsExtra: { 风扇: '2 × 120mm PWM' },
})
add({
  id: 'cooler-noctua-nhd15', category: 'cooler', brand: 'Noctua', model: 'NH-D15', sku: 'NH-D15',
  releasedAt: '2014-04', status: 'active', price: [899, 849, 969],
  attrs: { coolerType: 'air', coolerHeightMm: 165, coolerTdp: 250, cpuSockets: ['AM4', 'AM5', 'LGA1700', 'LGA1851'], rgb: false, color: 'silver' },
  performance: { index: 86, gaming: 86, productivity: 86, single: 86, multi: 86 },
  specsExtra: { 风扇: '2 × 140mm PWM' },
})
add({
  id: 'cooler-cm-hyper212', category: 'cooler', brand: 'Cooler Master', model: 'Hyper 212 Black Edition', sku: 'RR-212S-20PK-R2',
  releasedAt: '2020-02', status: 'active', price: [199, 179, 229],
  attrs: { coolerType: 'air', coolerHeightMm: 152, coolerTdp: 150, cpuSockets: ['AM4', 'AM5', 'LGA1700'], rgb: false, color: 'black' },
  performance: { index: 62, gaming: 62, productivity: 62, single: 62, multi: 62 },
  specsExtra: { 风扇: '1 × 120mm PWM' },
})
add({
  id: 'cooler-deepcool-lt720', category: 'cooler', brand: 'DeepCool', model: 'LT720 360 ARGB', sku: 'R-LT720-BKAMNF-G-1',
  releasedAt: '2022-10', status: 'active', price: [799, 749, 879],
  attrs: { coolerType: 'aio', radiatorSize: 360, coolerTdp: 300, cpuSockets: ['AM4', 'AM5', 'LGA1700', 'LGA1851'], rgb: true, color: 'black' },
  performance: { index: 88, gaming: 88, productivity: 88, single: 88, multi: 88 },
  specsExtra: { 风扇: '3 × 120mm ARGB' },
})
add({
  id: 'cooler-nzxt-kraken360', category: 'cooler', brand: 'NZXT', model: 'Kraken 360 RGB', sku: 'RL-KR360-B1',
  releasedAt: '2023-03', status: 'active', price: [1299, 1199, 1399],
  attrs: { coolerType: 'aio', radiatorSize: 360, coolerTdp: 300, cpuSockets: ['AM4', 'AM5', 'LGA1700', 'LGA1851'], rgb: true, color: 'black' },
  performance: { index: 91, gaming: 91, productivity: 91, single: 91, multi: 91 },
  specsExtra: { 风扇: '3 × 120mm ARGB' },
})
add({
  id: 'cooler-arctic-lf3-360', category: 'cooler', brand: 'Arctic', model: 'Liquid Freezer III 360', sku: 'ACFRE00136A',
  releasedAt: '2024-02', status: 'active', price: [899, 849, 999],
  attrs: { coolerType: 'aio', radiatorSize: 360, coolerTdp: 350, cpuSockets: ['AM4', 'AM5', 'LGA1700', 'LGA1851'], rgb: false, color: 'black' },
  performance: { index: 94, gaming: 94, productivity: 94, single: 94, multi: 94 },
  specsExtra: { 风扇: '3 × 120mm PWM' },
})
add({
  id: 'cooler-thermalright-frozen-notte-240', category: 'cooler', brand: 'Thermalright', model: 'Frozen Notte 240 ARGB', sku: 'FN240-ARGB',
  releasedAt: '2023-06', status: 'active', price: [399, 369, 449],
  attrs: { coolerType: 'aio', radiatorSize: 240, coolerTdp: 280, cpuSockets: ['AM4', 'AM5', 'LGA1700', 'LGA1851'], rgb: true, color: 'black' },
  performance: { index: 81, gaming: 81, productivity: 81, single: 81, multi: 81 },
  specsExtra: { 风扇: '2 × 120mm ARGB' },
})

/* ------------------------------------------------------------------ Case */
add({
  id: 'case-lianli-o11d-evo', category: 'case', brand: 'Lian Li', model: 'O11 Dynamic EVO', sku: 'O11DEX',
  releasedAt: '2022-03', status: 'active', price: [749, 699, 829],
  attrs: { formFactor: 'Mid Tower', supportedFormFactors: ['E-ATX', 'ATX', 'M-ATX', 'ITX'], maxGpuLengthMm: 426, maxCoolerHeightMm: 167, radiatorSupport: [120, 240, 280, 360], fanSlots: 9, includedFans: 0, driveBays25: 4, driveBays35: 2, color: 'black' },
  performance: { index: 80, gaming: 80, productivity: 80, single: 80, multi: 80 },
  specsExtra: { 尺寸: '465 × 285 × 459 mm', 材质: '钢 / 钢化玻璃' },
})
add({
  id: 'case-fractal-north', category: 'case', brand: 'Fractal Design', model: 'North', sku: 'FD-NORTH-BK',
  releasedAt: '2022-12', status: 'active', price: [899, 849, 999],
  attrs: { formFactor: 'Mid Tower', supportedFormFactors: ['ATX', 'M-ATX', 'ITX'], maxGpuLengthMm: 355, maxCoolerHeightMm: 170, radiatorSupport: [120, 240, 280, 360], fanSlots: 6, includedFans: 2, driveBays25: 2, driveBays35: 2, color: 'black' },
  performance: { index: 78, gaming: 78, productivity: 78, single: 78, multi: 78 },
  specsExtra: { 尺寸: '447 × 215 × 469 mm', 材质: '钢 / 网孔 / 胡桃木' },
})
add({
  id: 'case-nzxt-h7-flow', category: 'case', brand: 'NZXT', model: 'H7 Flow (2024)', sku: 'CM-H72FB-01',
  releasedAt: '2024-01', status: 'active', price: [799, 749, 879],
  attrs: { formFactor: 'Mid Tower', supportedFormFactors: ['ATX', 'M-ATX', 'ITX'], maxGpuLengthMm: 410, maxCoolerHeightMm: 185, radiatorSupport: [120, 240, 280, 360], fanSlots: 7, includedFans: 3, driveBays25: 2, driveBays35: 2, color: 'black' },
  performance: { index: 83, gaming: 83, productivity: 83, single: 83, multi: 83 },
  specsExtra: { 尺寸: '468 × 244 × 468 mm', 材质: '钢 / 钢化玻璃' },
})
add({
  id: 'case-corsair-4000d', category: 'case', brand: 'Corsair', model: '4000D Airflow', sku: 'CC-9011200-WW',
  releasedAt: '2021-01', status: 'active', price: [549, 499, 599],
  attrs: { formFactor: 'Mid Tower', supportedFormFactors: ['ATX', 'M-ATX', 'ITX'], maxGpuLengthMm: 360, maxCoolerHeightMm: 170, radiatorSupport: [120, 240, 280, 360], fanSlots: 6, includedFans: 2, driveBays25: 2, driveBays35: 2, color: 'black' },
  performance: { index: 73, gaming: 73, productivity: 73, single: 73, multi: 73 },
  specsExtra: { 尺寸: '453 × 230 × 466 mm', 材质: '钢 / 钢化玻璃' },
})
add({
  id: 'case-jonsbo-d31', category: 'case', brand: 'Jonsbo', model: 'D31 Mesh', sku: 'D31-MESH-BK',
  releasedAt: '2023-05', status: 'active', price: [399, 369, 449],
  attrs: { formFactor: 'M-ATX', supportedFormFactors: ['M-ATX', 'ITX'], maxGpuLengthMm: 330, maxCoolerHeightMm: 168, radiatorSupport: [120, 240, 280, 360], fanSlots: 5, includedFans: 0, driveBays25: 2, driveBays35: 1, color: 'black' },
  performance: { index: 66, gaming: 66, productivity: 66, single: 66, multi: 66 },
  specsExtra: { 尺寸: '401 × 205 × 452 mm', 材质: '钢 / 钢化玻璃' },
})
add({
  id: 'case-cm-nr200p', category: 'case', brand: 'Cooler Master', model: 'NR200P', sku: 'MCB-NR200P-KGNN-S00',
  releasedAt: '2020-09', status: 'active', price: [599, 549, 649],
  attrs: { formFactor: 'ITX', supportedFormFactors: ['ITX'], maxGpuLengthMm: 330, maxCoolerHeightMm: 155, radiatorSupport: [120, 240, 280], fanSlots: 4, includedFans: 2, driveBays25: 2, driveBays35: 1, color: 'black' },
  performance: { index: 64, gaming: 64, productivity: 64, single: 64, multi: 64 },
  specsExtra: { 尺寸: '376 × 185 × 292 mm', 材质: '钢 / 钢化玻璃 / 网孔' },
})
add({
  id: 'case-montech-air100', category: 'case', brand: 'Montech', model: 'AIR 100 ARGB', sku: 'AIR100-ARGB-BK',
  releasedAt: '2022-06', status: 'active', price: [299, 269, 349],
  attrs: { formFactor: 'M-ATX', supportedFormFactors: ['M-ATX', 'ITX'], maxGpuLengthMm: 330, maxCoolerHeightMm: 160, radiatorSupport: [120, 240], fanSlots: 4, includedFans: 4, driveBays25: 2, driveBays35: 1, color: 'black' },
  performance: { index: 57, gaming: 57, productivity: 57, single: 57, multi: 57 },
  specsExtra: { 尺寸: '385 × 210 × 425 mm', 材质: '钢 / 钢化玻璃' },
})
add({
  id: 'case-asus-ap201', category: 'case', brand: 'ASUS', model: 'Prime AP201', sku: 'AP201-BLK',
  releasedAt: '2022-08', status: 'active', price: [449, 399, 499],
  attrs: { formFactor: 'M-ATX', supportedFormFactors: ['M-ATX', 'ITX'], maxGpuLengthMm: 338, maxCoolerHeightMm: 170, radiatorSupport: [120, 240, 280, 360], fanSlots: 6, includedFans: 0, driveBays25: 3, driveBays35: 1, color: 'black' },
  performance: { index: 69, gaming: 69, productivity: 69, single: 69, multi: 69 },
  specsExtra: { 尺寸: '460 × 205 × 350 mm', 材质: '钢 / 网孔' },
})

/* ------------------------------------------------------------------ Fans */
add({
  id: 'fan-arctic-p12', category: 'fan', brand: 'Arctic', model: 'P12 PWM PST', sku: 'ACFAN00120A',
  releasedAt: '2018-05', status: 'active', price: [59, 49, 69],
  attrs: { fanSizeMm: 120, rpm: 1800, rgb: false, interface: 'PWM 4pin', color: 'black', tdp: 1.5 },
  performance: { index: 72, gaming: 72, productivity: 72, single: 72, multi: 72 },
  specsExtra: { 风量: 56.3, 噪音: 22.5 },
})
add({
  id: 'fan-noctua-a12x25', category: 'fan', brand: 'Noctua', model: 'NF-A12x25 PWM', sku: 'NF-A12X25-PWM',
  releasedAt: '2018-05', status: 'active', price: [249, 229, 269],
  attrs: { fanSizeMm: 120, rpm: 2000, rgb: false, interface: 'PWM 4pin', color: 'brown', tdp: 1.7 },
  performance: { index: 92, gaming: 92, productivity: 92, single: 92, multi: 92 },
  specsExtra: { 风量: 60.1, 噪音: 22.6 },
})
add({
  id: 'fan-lianli-sl120', category: 'fan', brand: 'Lian Li', model: 'UNI FAN SL120', sku: 'UF-SL120-3B',
  releasedAt: '2020-08', status: 'active', price: [149, 129, 169],
  attrs: { fanSizeMm: 120, rpm: 1900, rgb: true, interface: 'PWM 4pin + ARGB', color: 'black', tdp: 2.4 },
  performance: { index: 76, gaming: 76, productivity: 76, single: 76, multi: 76 },
  specsExtra: { 风量: 58.5, 噪音: 28 },
})
add({
  id: 'fan-cm-mf120', category: 'fan', brand: 'Cooler Master', model: 'MF120 Halo ARGB', sku: 'MFX-B2DN-18NPA-R1',
  releasedAt: '2020-10', status: 'active', price: [99, 89, 119],
  attrs: { fanSizeMm: 120, rpm: 1800, rgb: true, interface: 'PWM 4pin + ARGB', color: 'black', tdp: 2.2 },
  performance: { index: 68, gaming: 68, productivity: 68, single: 68, multi: 68 },
  specsExtra: { 风量: 47.2, 噪音: 30 },
})
add({
  id: 'fan-thermalright-tl-c12c', category: 'fan', brand: 'Thermalright', model: 'TL-C12C', sku: 'TL-C12C',
  releasedAt: '2022-01', status: 'active', price: [49, 39, 59],
  attrs: { fanSizeMm: 120, rpm: 1550, rgb: false, interface: 'PWM 4pin', color: 'black', tdp: 1.4 },
  performance: { index: 62, gaming: 62, productivity: 62, single: 62, multi: 62 },
  specsExtra: { 风量: 66.17, 噪音: 25.6 },
})
add({
  id: 'fan-lianli-tl120', category: 'fan', brand: 'Lian Li', model: 'UNI FAN TL LCD 120', sku: 'UF-TL-LCD-120',
  releasedAt: '2024-07', status: 'active', price: [299, 279, 329],
  attrs: { fanSizeMm: 120, rpm: 1900, rgb: true, interface: 'PWM 4pin + USB', color: 'black', tdp: 3.2 },
  performance: { index: 82, gaming: 82, productivity: 82, single: 82, multi: 82 },
  specsExtra: { 风量: 62, 噪音: 30 },
})

/* ------------------------------------------------------------- Expansion */
add({
  id: 'exp-creative-ae9', category: 'expansion', brand: 'Creative', model: 'Sound Blaster AE-9', sku: '70SB174000000',
  releasedAt: '2019-01', status: 'active', price: [1899, 1799, 2099],
  attrs: { type: '独立声卡', interface: 'PCIe x1', tdp: 15, pcieSlots: 1 },
  performance: { index: 88, gaming: 82, productivity: 92, single: 0, multi: 0 },
  specsExtra: { 特点: 'Xamp 耳放 / 32bit 384kHz / 可换运放' },
})
add({
  id: 'exp-tplink-tx50e', category: 'expansion', brand: 'TP-Link', model: 'Archer TX50E WiFi 6E', sku: 'ARCHER-TX50E',
  releasedAt: '2021-08', status: 'active', price: [299, 269, 339],
  attrs: { type: '无线网卡', interface: 'PCIe x1', tdp: 8, pcieSlots: 1 },
  performance: { index: 76, gaming: 76, productivity: 76, single: 0, multi: 0 },
  specsExtra: { 特点: 'WiFi 6E / 蓝牙 5.2 / 磁吸天线' },
})
add({
  id: 'exp-elgato-4k60', category: 'expansion', brand: 'Elgato', model: '4K60 Pro MK.2', sku: '10GAG9901',
  releasedAt: '2019-09', status: 'active', price: [1599, 1499, 1799],
  attrs: { type: '视频采集卡', interface: 'PCIe x4', tdp: 12, pcieSlots: 1 },
  performance: { index: 82, gaming: 80, productivity: 88, single: 0, multi: 0 },
  specsExtra: { 特点: '4K60 HDR10 / 1080p240 采集 / 低延迟环出' },
})
add({
  id: 'exp-asus-xg-c100c', category: 'expansion', brand: 'ASUS', model: 'XG-C100C 10G 网卡', sku: 'XG-C100C',
  releasedAt: '2017-06', status: 'active', price: [799, 749, 899],
  attrs: { type: '万兆网卡', interface: 'PCIe x4', tdp: 9, pcieSlots: 1 },
  performance: { index: 74, gaming: 74, productivity: 80, single: 0, multi: 0 },
  specsExtra: { 特点: '10Gbps / 5G / 2.5G / 1G 自适应' },
})
add({
  id: 'exp-kryonaut-1g', category: 'expansion', brand: 'Thermal Grizzly', model: 'Kryonaut 1g', sku: 'TG-K-001-RS',
  releasedAt: '2018-03', status: 'active', price: [89, 79, 109],
  attrs: { type: '导热硅脂', interface: '不适用', tdp: 0, pcieSlots: 0, quantity: 1 },
  performance: { index: 30, gaming: 30, productivity: 30, single: 0, multi: 0 },
  specsExtra: { 特点: '导热系数 12.5 W/mK / 1g 装' },
})
add({
  id: 'exp-arctic-mx6-4g', category: 'expansion', brand: 'Arctic', model: 'MX-6 4g', sku: 'ACTCP00080A',
  releasedAt: '2023-05', status: 'active', price: [69, 59, 79],
  attrs: { type: '导热硅脂', interface: '不适用', tdp: 0, pcieSlots: 0, quantity: 1 },
  performance: { index: 30, gaming: 30, productivity: 30, single: 0, multi: 0 },
  specsExtra: { 特点: '导热系数 6.0 W/mK / 4g 装' },
})

const catalog = {
  version: '2026.11-seed.1',
  updatedAt: '2026-11-18T18:00:00+08:00',
  region: 'CN',
  currency: 'CNY',
  disclaimer:
    '本目录为 PC FORGE 内置演示样本：型号来自公开在售/历史产品，价格为公开渠道归档样本而非实时成交价。每个价格均带来源、采集时间与状态标记；未配置实时价格适配器时不会伪造报价。',
  products,
}

await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify(catalog, null, 2), 'utf8')
console.log(`Wrote ${products.length} products -> ${output}`)
console.log(
  'By category:',
  Object.fromEntries(
    [...new Set(products.map((p) => p.category))].map((c) => [c, products.filter((p) => p.category === c).length]),
  ),
)
