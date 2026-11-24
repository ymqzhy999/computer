import type { BuildMetrics, BuildSelection, PowerEstimate, Product } from '../types'
import { estimatePower } from './compatibility'
import { selectionRange, selectionTotal } from './pricing'

function perfValue(product: Product | undefined, key: 'index' | 'gaming' | 'productivity' | 'single' | 'multi'): number {
  return product?.performance?.[key] ?? 0
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

export function computeMetrics(
  selection: BuildSelection,
  byId: Map<string, Product>,
  quantities: Record<string, number>,
  allowUsed = false,
): BuildMetrics {
  const pick = (key: keyof BuildSelection) => (selection[key] ? byId.get(selection[key] as string) : undefined)
  const cpu = pick('cpu')
  const gpu = pick('gpu')
  const memory = pick('memory')
  const ssd = pick('ssd')
  const cooler = pick('cooler')
  const chassis = pick('case')
  const fan = pick('fan')

  const power: PowerEstimate = estimatePower(selection, byId, quantities)
  const range = selectionRange(selection, byId, quantities, allowUsed)
  const total = selectionTotal(selection, byId, quantities, allowUsed)

  const memoryPerf = perfValue(memory, 'index') || 58
  const ssdPerf = perfValue(ssd, 'index') || 55
  const coolerPerf = perfValue(cooler, 'index') || 55
  const fanBonus = fan ? 3 : 0

  const gaming = clamp(
    perfValue(gpu, 'gaming') * 0.56 +
      perfValue(cpu, 'gaming') * 0.24 +
      memoryPerf * 0.08 +
      ssdPerf * 0.06 +
      (coolerPerf + fanBonus) * 0.06,
  )
  const productivity = clamp(
    perfValue(cpu, 'productivity') * 0.4 +
      perfValue(gpu, 'productivity') * 0.24 +
      memoryPerf * 0.16 +
      ssdPerf * 0.14 +
      coolerPerf * 0.06,
  )
  const single = clamp(perfValue(cpu, 'single') * 0.78 + memoryPerf * 0.14 + ssdPerf * 0.08)
  const multi = clamp(
    perfValue(cpu, 'multi') * 0.58 +
      perfValue(gpu, 'productivity') * 0.16 +
      memoryPerf * 0.14 +
      ssdPerf * 0.12,
  )
  const cooling = clamp(coolerPerf * 0.78 + fanBonus + (chassis ? 8 : 0))
  const index = clamp(gaming * 0.4 + productivity * 0.32 + multi * 0.16 + single * 0.12)

  const cpuGaming = perfValue(cpu, 'gaming')
  const gpuGaming = perfValue(gpu, 'gaming')
  let balance = 70
  if (cpuGaming && gpuGaming) {
    balance = clamp(100 - Math.abs(cpuGaming - gpuGaming) * 0.9, 25, 100)
  }

  let bottleneck = '核心组件平衡，未发现明显短板'
  if (!gpu && cpu) {
    bottleneck = cpu.attrs.igpu ? '无独立显卡，图形性能受核显限制' : '缺少独立显卡，无法输出画面'
  } else if (gpuGaming && cpuGaming) {
    if (gpuGaming - cpuGaming > 16) bottleneck = '处理器可能限制高帧率与复杂场景'
    else if (cpuGaming - gpuGaming > 22) bottleneck = '显卡是主要图形瓶颈，适合后续升级'
    else if (memoryPerf < 60) bottleneck = '内存带宽/容量偏低，影响多任务与大型场景'
    else if (ssdPerf < 60) bottleneck = '存储性能偏低，影响加载与素材吞吐'
    else if (power.headroom < 80) bottleneck = '电源余量偏紧，限制后续升级'
  }

  return {
    total,
    towerTotal: total,
    minTotal: allowUsed ? total : range.min,
    maxTotal: allowUsed ? total : range.max,
    power,
    performance: { index, gaming, productivity, single, multi, cooling, balance },
    bottleneck,
    priceCoverage: range.coverage,
  }
}
