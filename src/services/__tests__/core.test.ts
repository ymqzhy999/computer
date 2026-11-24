import { describe, expect, it } from 'vitest'
import { DEFAULT_QUANTITIES, DEFAULT_REQUEST, DEFAULT_SELECTION } from '../../data/defaults'
import { SEED_MAP, SEED_PRODUCTS } from '../../data/catalog'
import { evaluateCompatibility, estimatePower, evaluateCandidate, candidateBlocked } from '../compatibility'
import { computeMetrics } from '../metrics'
import { recommendBuilds } from '../recommender'
import { selectionTotal } from '../pricing'
import { makeCustomization, randomCustomization } from '../customization'
import { buildAssemblyGuide } from '../assemblyGuide'
import { estimateCapabilities } from '../capability'

describe('compatibility engine', () => {
  it('accepts the default balanced build', () => {
    const report = evaluateCompatibility(DEFAULT_SELECTION, SEED_MAP, DEFAULT_QUANTITIES)
    expect(report.status).toBe('pass')
    expect(report.errors).toHaveLength(0)
  })

  it('rejects a CPU and motherboard with different sockets', () => {
    const report = evaluateCompatibility(
      { ...DEFAULT_SELECTION, cpu: 'cpu-intel-i5-14600kf' },
      SEED_MAP,
      DEFAULT_QUANTITIES,
    )
    expect(report.status).toBe('blocked')
    expect(report.errors.some((issue) => issue.code === 'CPU_SOCKET')).toBe(true)
  })

  it('rejects DDR4 memory on a DDR5-only board', () => {
    const report = evaluateCompatibility(
      { ...DEFAULT_SELECTION, memory: 'ram-kingston-ddr4-16' },
      SEED_MAP,
      DEFAULT_QUANTITIES,
    )
    expect(report.status).toBe('blocked')
    expect(report.errors.some((issue) => issue.code === 'RAM_TYPE')).toBe(true)
  })

  it('estimates peak power and a PSU recommendation with headroom', () => {
    const power = estimatePower(DEFAULT_SELECTION, SEED_MAP, DEFAULT_QUANTITIES)
    expect(power.peak).toBeGreaterThan(300)
    expect(power.recommendedPsu).toBeGreaterThan(power.peak)
    expect(power.headroom).toBe(850 - power.peak)
  })

  it('does not invent GPU power-connector errors when the PSU has no connector data', () => {
    const report = evaluateCompatibility(
      { ...DEFAULT_SELECTION, gpu: 'gpu-asus-rtx5070-tuf', psu: 'zol-psu-1999767' },
      SEED_MAP,
      DEFAULT_QUANTITIES,
    )
    expect(report.errors.some((issue) => issue.code === 'GPU_PCIE8' || issue.code === 'GPU_12VHPWR')).toBe(false)
  })

  it('flags a candidate only when its own category creates hard errors', () => {
    const blocked = evaluateCandidate(
      DEFAULT_SELECTION,
      'cpu',
      'cpu-intel-i5-14600kf',
      SEED_MAP,
      DEFAULT_QUANTITIES,
    )
    expect(blocked.status).toBe('blocked')
    expect(candidateBlocked(blocked, 'cpu')).toBe(true)

    const fit = evaluateCandidate(DEFAULT_SELECTION, 'cpu', 'cpu-amd-r7-9700x', SEED_MAP, DEFAULT_QUANTITIES)
    expect(candidateBlocked(fit, 'cpu')).toBe(false)
  })
})

describe('pricing and metrics', () => {
  it('keeps total, table total and peak power coherent', () => {
    const total = selectionTotal(DEFAULT_SELECTION, SEED_MAP, DEFAULT_QUANTITIES, false)
    const metrics = computeMetrics(DEFAULT_SELECTION, SEED_MAP, DEFAULT_QUANTITIES, false)
    expect(total).toBeGreaterThan(5000)
    expect(metrics.total).toBe(total)
    expect(metrics.performance.index).toBeGreaterThan(30)
    expect(metrics.power.peak).toBeGreaterThan(300)
  })
})

describe('recommender', () => {
  it('returns compatible builds that respect a strict budget', () => {
    const request = { ...DEFAULT_REQUEST, budget: 9000 }
    const builds = recommendBuilds(request, Array.from(SEED_MAP.values()))
    expect(builds.length).toBeGreaterThan(0)
    for (const build of builds) {
      expect(build.total).toBeLessThanOrEqual(request.budget)
      expect(build.compatibility.status).not.toBe('blocked')
      expect(build.lines.length).toBeGreaterThan(5)
      expect(Object.keys(build.reasons).length).toBeGreaterThan(0)
    }
  })
})

describe('assembly guide and capability', () => {
  it('orders every installed component from case to expansion', () => {
    const steps = buildAssemblyGuide(DEFAULT_SELECTION, SEED_MAP)
    expect(steps.length).toBeGreaterThanOrEqual(9)
    expect(steps[0].category).toBe('case')
    expect(steps.some((step) => step.category === 'gpu')).toBe(true)
    expect(steps.some((step) => step.category === 'cpu')).toBe(true)
    for (let index = 1; index < steps.length; index += 1) {
      expect(steps[index].title.length).toBeGreaterThan(0)
      expect(steps[index].detail.length).toBeGreaterThan(0)
    }
  })

  it('labels capability estimates as estimates, not measured FPS', () => {
    const metrics = computeMetrics(DEFAULT_SELECTION, SEED_MAP, DEFAULT_QUANTITIES, false)
    const capability = estimateCapabilities(metrics, DEFAULT_SELECTION, SEED_MAP)
    expect(capability.gaming.length).toBeGreaterThan(0)
    expect(capability.llm.length).toBeGreaterThan(0)
    expect(capability.disclaimer).toContain('估算')
  })
})

describe('catalog coverage', () => {
  it('offers a broad GPU range from budget to flagship', () => {
    const gpus = SEED_PRODUCTS.filter((product) => product.category === 'gpu')
    const prices = gpus
      .map((product) => product.price?.reference ?? null)
      .filter((price): price is number => price != null)
    expect(gpus.length).toBeGreaterThanOrEqual(50)
    expect(prices.length).toBeGreaterThanOrEqual(45)
    expect(Math.min(...prices)).toBeLessThan(1500)
    expect(Math.max(...prices)).toBeGreaterThan(12000)

    const brands = new Set(gpus.map((product) => product.brand))
    for (const brand of ['Colorful', 'Galax', 'Zotac', 'Maxsun', 'Yeston', 'XFX']) {
      expect(brands.has(brand), `missing Chinese-market GPU brand ${brand}`).toBe(true)
    }
  })
})

describe('customization', () => {
  it('generates a stable signature and changes it with the pattern', () => {
    const product = SEED_MAP.get('gpu-asus-rtx5070-tuf')
    expect(product).toBeDefined()
    if (!product) return
    const first = makeCustomization('gpu', product, { pattern: 'hex', engraving: 'FORGE 01' })
    const same = makeCustomization('gpu', product, { pattern: 'hex', engraving: 'FORGE 01' })
    const other = makeCustomization('gpu', product, { pattern: 'sakura', engraving: 'FORGE 01' })
    expect(first.signature).toMatch(/^PF-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(first.signature).toBe(same.signature)
    expect(other.signature).not.toBe(first.signature)
    expect(first.engraving).toBe('FORGE 01')
  })

  it('random customization stays inside valid ranges', () => {
    const product = SEED_MAP.get('case-lianli-o11d-evo')
    expect(product).toBeDefined()
    if (!product) return
    const custom = randomCustomization('case', product)
    expect(custom.pattern).not.toBe('none')
    expect(custom.intensity).toBeGreaterThanOrEqual(0.15)
    expect(custom.intensity).toBeLessThanOrEqual(1)
    expect(custom.primary).toMatch(/^#[0-9a-f]{6}$/i)
    expect(custom.accent).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('assembly guide and capability', () => {
  it('orders installed components into a practical tutorial', () => {
    const steps = buildAssemblyGuide(DEFAULT_SELECTION, SEED_MAP)
    expect(steps.length).toBe(9)
    expect(steps[0].category).toBe('case')
    expect(steps[1].category).toBe('motherboard')
    expect(steps.at(-1)?.category).toBe('fan')
    expect(steps.every((step) => step.detail.length > 8)).toBe(true)
    expect(steps.every((step) => step.product.category === step.category)).toBe(true)
  })

  it('estimates games, software and local model sizes from the current build', () => {
    const metrics = computeMetrics(DEFAULT_SELECTION, SEED_MAP, DEFAULT_QUANTITIES)
    const report = estimateCapabilities(metrics, DEFAULT_SELECTION, SEED_MAP)
    expect(report.gaming.length).toBeGreaterThanOrEqual(3)
    expect(report.software.length).toBeGreaterThanOrEqual(3)
    expect(report.llm.length).toBeGreaterThanOrEqual(3)
    expect(report.summary).toContain('2K')
    expect(report.llm.find((item) => item.label.includes('14B'))?.level).not.toBe('limited')
    expect(report.disclaimer).toContain('估算')
  })
})

describe('scenario targets', () => {
  it('uses explicit workload targets instead of fps for non-gaming', () => {
    const builds = recommendBuilds(
      { ...DEFAULT_REQUEST, scenario: 'ai', workload: '32b', budget: 30000, targetFps: 60 },
      SEED_PRODUCTS,
    )
    expect(builds.length).toBeGreaterThan(0)
    const gpu = builds[0].selection.gpu ? SEED_MAP.get(builds[0].selection.gpu) : undefined
    expect((gpu?.attrs.vramGb ?? 0)).toBeGreaterThanOrEqual(24)
  })
})
