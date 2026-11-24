import type {
  BuildSelection,
  Category,
  CompatIssue,
  CompatibilityReport,
  IssueLevel,
  PowerEstimate,
  Product,
} from '../types'
import { CORE_CATEGORIES, categoryMeta } from '../data/meta'

type ProductMap = Map<string, Product>

interface Checker {
  selection: BuildSelection
  byId: ProductMap
  quantities: Record<string, number>
  issues: CompatIssue[]
}

let issueSeq = 0

function add(
  ctx: Checker,
  level: IssueLevel,
  code: string,
  title: string,
  detail: string,
  categories: Category[],
) {
  issueSeq += 1
  ctx.issues.push({
    id: `cmp-${Date.now().toString(36)}-${issueSeq}`,
    level,
    code,
    title,
    detail,
    categories,
  })
}

function get(ctx: Checker, category: Category): Product | undefined {
  const id = ctx.selection[category]
  return id ? ctx.byId.get(id) : undefined
}

function num(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function estimatePower(
  selection: BuildSelection,
  byId: ProductMap,
  quantities: Record<string, number>,
): PowerEstimate {
  const cpu = selection.cpu ? byId.get(selection.cpu) : undefined
  const gpu = selection.gpu ? byId.get(selection.gpu) : undefined
  const mb = selection.motherboard ? byId.get(selection.motherboard) : undefined
  const memory = selection.memory ? byId.get(selection.memory) : undefined
  const cooler = selection.cooler ? byId.get(selection.cooler) : undefined
  const psu = selection.psu ? byId.get(selection.psu) : undefined
  const ssd = selection.ssd ? byId.get(selection.ssd) : undefined
  const hdd = selection.hdd ? byId.get(selection.hdd) : undefined
  const fans = selection.fan ? byId.get(selection.fan) : undefined

  const cpuLoad = cpu ? num(cpu.attrs.peakPower, num(cpu.attrs.tdp, 95)) : 0
  const gpuLoad = gpu ? num(gpu.attrs.peakPower, num(gpu.attrs.tdp, 180)) : 0
  const sticks = memory ? num(memory.attrs.memorySticks, 2) : 0
  const memLoad = sticks * 3.2
  const boardLoad = mb ? 32 : 0
  const driveLoad = (ssd ? num(ssd.attrs.tdp, 6) : 0) + (hdd ? 7 : 0)
  const fanQty = fans ? Math.max(1, quantities.fan ?? 1) : 0
  const fanLoad = fanQty * num(fans?.attrs.tdp, 2.4)
  const coolerLoad = cooler
    ? cooler.attrs.coolerType === 'aio'
      ? 12
      : cooler.attrs.rgb
        ? 4
        : 2
    : 0
  const expansionLoad = selection.expansion ? 9 : 0

  const load = cpuLoad + gpuLoad + memLoad + boardLoad + driveLoad + fanLoad + coolerLoad + expansionLoad
  const idle = Math.round(38 + (mb ? 8 : 0) + (gpu ? 12 : 0) + memLoad * 0.35 + (ssd ? 2 : 0))
  const peak = Math.round(load * 1.12)
  const recommendedPsu = Math.ceil((peak * 1.32) / 50) * 50
  const psuWatt = psu ? num(psu.attrs.wattage) : 0

  return {
    idle,
    load: Math.round(load),
    peak,
    recommendedPsu,
    headroom: psuWatt ? psuWatt - peak : 0,
  }
}

export function evaluateCompatibility(
  selection: BuildSelection,
  byId: ProductMap,
  quantities: Record<string, number> = {},
): CompatibilityReport {
  const ctx: Checker = { selection, byId, quantities, issues: [] }
  const cpu = get(ctx, 'cpu')
  const mb = get(ctx, 'motherboard')
  const gpu = get(ctx, 'gpu')
  const memory = get(ctx, 'memory')
  const ssd = get(ctx, 'ssd')
  const hdd = get(ctx, 'hdd')
  const psu = get(ctx, 'psu')
  const cooler = get(ctx, 'cooler')
  const chassis = get(ctx, 'case')
  const fan = get(ctx, 'fan')
  const power = estimatePower(selection, byId, quantities)

  const missing = CORE_CATEGORIES.filter((c) => !selection[c])
  if (missing.length) {
    add(
      ctx,
      'warning',
      'MISSING_CORE',
      `配置缺少 ${missing.length} 个核心组件`,
      `尚未选择：${missing.map((c) => categoryMeta(c).label).join('、')}。补齐后可生成完整兼容报告。`,
      missing,
    )
  }

  // CPU ↔ motherboard socket, chipset, BIOS
  if (cpu && mb) {
    if (cpu.attrs.socket && mb.attrs.socket && cpu.attrs.socket !== mb.attrs.socket) {
      add(
        ctx,
        'error',
        'CPU_SOCKET',
        'CPU 与主板插槽不匹配',
        `${cpu.brand} ${cpu.model} 使用 ${cpu.attrs.socket}，而 ${mb.brand} ${mb.model} 为 ${mb.attrs.socket}。物理上无法安装。`,
        ['cpu', 'motherboard'],
      )
    } else if (cpu.attrs.socket && mb.attrs.socket) {
      add(
        ctx,
        'ok',
        'CPU_SOCKET_OK',
        '处理器插槽匹配',
        `${cpu.attrs.socket} 插槽与主板一致。`,
        ['cpu', 'motherboard'],
      )
      const chipset = mb.attrs.chipset ?? ''
      if (cpu.attrs.generation?.startsWith('14') && /B760|Z790|H770/.test(chipset)) {
        add(
          ctx,
          'warning',
          'BIOS_14TH',
          '可能需要更新 BIOS',
          `14 代酷睿在 ${chipset} 主板上通常需要 2023-08 之后的 BIOS；无 CPU 刷新按钮时需先装旧处理器。`,
          ['cpu', 'motherboard'],
        )
      }
      if (mb.attrs.socket === 'AM5' && /9[0-9]{3}/.test(cpu.model) && /^(B650|X670)/.test(chipset)) {
        add(
          ctx,
          'warning',
          'BIOS_AM5_9000',
          '9000 系列可能需要 BIOS 更新',
          `${chipset} 主板需 AGESA 1.2.0.0 或更新固件才能识别 ${cpu.model}；优先选择带 USB Flash BIOS 的型号。`,
          ['cpu', 'motherboard'],
        )
      }
    }
  }

  // Memory generation, slots, speed
  if (memory && mb) {
    if (
      memory.attrs.memoryType &&
      mb.attrs.memoryType &&
      memory.attrs.memoryType !== mb.attrs.memoryType
    ) {
      add(
        ctx,
        'error',
        'RAM_TYPE',
        '内存代际不兼容',
        `${memory.attrs.memoryType} 内存无法插入仅支持 ${mb.attrs.memoryType} 的主板，防呆缺口不同。`,
        ['memory', 'motherboard'],
      )
    } else if (memory.attrs.memoryType && mb.attrs.memoryType) {
      add(
        ctx,
        'ok',
        'RAM_TYPE_OK',
        '内存代际匹配',
        `${memory.attrs.memoryType} 与主板内存插槽一致。`,
        ['memory', 'motherboard'],
      )
    }
    const sticks = num(memory.attrs.memorySticks, 1)
    if (mb.attrs.memorySlots != null && sticks > mb.attrs.memorySlots) {
      add(
        ctx,
        'error',
        'RAM_SLOTS',
        '内存条数量超过主板插槽',
        `套装含 ${sticks} 条，主板仅 ${mb.attrs.memorySlots} 个 DIMM 插槽。`,
        ['memory', 'motherboard'],
      )
    }
    if (
      memory.attrs.memorySpeed != null &&
      mb.attrs.memoryMaxSpeed != null &&
      memory.attrs.memorySpeed > mb.attrs.memoryMaxSpeed
    ) {
      add(
        ctx,
        'warning',
        'RAM_SPEED',
        '内存频率高于主板标称支持',
        `内存 XMP/EXPO 频率 ${memory.attrs.memorySpeed} MT/s，主板标称最高 ${mb.attrs.memoryMaxSpeed} MT/s；可能需要降频运行。`,
        ['memory', 'motherboard'],
      )
    }
  }

  // Motherboard ↔ chassis form factor
  if (mb && chassis) {
    const support = chassis.attrs.supportedFormFactors ?? []
    const normalizeForm = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^MATX$/, 'MICROATX')
    const boardForm = mb.attrs.formFactor ? normalizeForm(mb.attrs.formFactor) : ''
    const supportedForms = support.map(normalizeForm)
    if (boardForm && supportedForms.length && !supportedForms.includes(boardForm)) {
      add(
        ctx,
        'error',
        'FORM_FACTOR',
        '主板尺寸无法装入机箱',
        `主板为 ${mb.attrs.formFactor}，机箱仅支持 ${support.join(' / ')}。`,
        ['motherboard', 'case'],
      )
    } else if (mb.attrs.formFactor) {
      add(
        ctx,
        'ok',
        'FORM_FACTOR_OK',
        '主板与机箱尺寸匹配',
        `${mb.attrs.formFactor} 主板可安装于 ${chassis.model}。`,
        ['motherboard', 'case'],
      )
    }
  }

  // GPU clearance and power connectors
  if (gpu && chassis) {
    if (
      gpu.attrs.lengthMm != null &&
      chassis.attrs.maxGpuLengthMm != null &&
      gpu.attrs.lengthMm > chassis.attrs.maxGpuLengthMm
    ) {
      add(
        ctx,
        'error',
        'GPU_LENGTH',
        '显卡长度超过机箱限位',
        `显卡长 ${gpu.attrs.lengthMm} mm，机箱最大支持 ${chassis.attrs.maxGpuLengthMm} mm（含前置风扇/冷排时空间更小）。`,
        ['gpu', 'case'],
      )
    } else if (gpu.attrs.lengthMm != null) {
      add(
        ctx,
        'ok',
        'GPU_LENGTH_OK',
        '显卡空间通过',
        `${gpu.attrs.lengthMm} mm 长度低于机箱 ${chassis.attrs.maxGpuLengthMm ?? '—'} mm 限位。`,
        ['gpu', 'case'],
      )
    }
  }

  if (gpu && psu) {
    // 供电接口数据只覆盖了部分型号：缺少数据时不能按 0 个接口处理，
    // 否则会把完全可用的电源误报成“无法供电”并错误过滤掉。
    const hasPsuConnectorData = psu.attrs.pcie12vhpwr != null || psu.attrs.pcie8 != null
    const native12v = num(psu.attrs.pcie12vhpwr)
    const pcie8 = num(psu.attrs.pcie8)
    if (!hasPsuConnectorData) {
      // 数据缺失，跳过接口数量判定，由额定功率检查兜底。
    } else if (num(gpu.attrs.pcie12vhpwr) > 0) {
      if (native12v < 1) {
        if (pcie8 >= 3) {
          add(
            ctx,
            'warning',
            'GPU_12VHPWR_ADAPTER',
            '需要 12V-2x6 转接线',
            `显卡使用 12V-2x6 / 12VHPWR 接口，电源无原生输出；可用 3×8pin 转接线，但需使用原厂线材并完全插入。`,
            ['gpu', 'psu'],
          )
        } else {
          add(
            ctx,
            'error',
            'GPU_12VHPWR_MISSING',
            '电源无法为显卡供电',
            `显卡需要 12V-2x6 接口，电源既无原生 12V-2x6，也没有足够的 8pin 供转接。`,
            ['gpu', 'psu'],
          )
        }
      } else {
        add(
          ctx,
          'ok',
          'GPU_12VHPWR_OK',
          '显卡供电接口匹配',
          `电源提供原生 12V-2x6 输出，可直连显卡。`,
          ['gpu', 'psu'],
        )
      }
    } else if (num(gpu.attrs.pcie8) > pcie8) {
      add(
        ctx,
        'error',
        'GPU_PCIE8',
        'PCIe 8pin 供电不足',
        `显卡需要 ${gpu.attrs.pcie8} 个 8pin，电源仅提供 ${pcie8} 个。`,
        ['gpu', 'psu'],
      )
    }
  }

  // Cooler socket, height / radiator, TDP
  if (cooler && cpu) {
    const sockets = cooler.attrs.cpuSockets ?? []
    if (cpu.attrs.socket && sockets.length && !sockets.includes(cpu.attrs.socket)) {
      add(
        ctx,
        'error',
        'COOLER_SOCKET',
        '散热器扣具不支持该插槽',
        `${cooler.model} 支持 ${sockets.join(' / ')}，不含 ${cpu.attrs.socket}。`,
        ['cooler', 'cpu'],
      )
    }
    const coolerTdp = num(cooler.attrs.coolerTdp)
    const cpuTdp = num(cpu.attrs.tdp)
    if (coolerTdp && cpuTdp && coolerTdp < cpuTdp) {
      add(
        ctx,
        'error',
        'COOLER_TDP',
        '散热能力低于处理器基础功耗',
        `散热器标称 ${coolerTdp} W，低于 ${cpu.model} 的 ${cpuTdp} W TDP，持续负载会触发降频。`,
        ['cooler', 'cpu'],
      )
    } else if (coolerTdp && cpu.attrs.peakPower && coolerTdp < cpu.attrs.peakPower * 0.9) {
      add(
        ctx,
        'warning',
        'COOLER_HEADROOM',
        '散热余量偏紧',
        `散热器标称 ${coolerTdp} W，处理器峰值可达 ${cpu.attrs.peakPower} W；建议提高风扇曲线或选择更强散热。`,
        ['cooler', 'cpu'],
      )
    } else if (coolerTdp) {
      add(
        ctx,
        'ok',
        'COOLER_TDP_OK',
        '散热能力满足需求',
        `${coolerTdp} W 散热上限覆盖处理器 ${cpuTdp} W TDP。`,
        ['cooler', 'cpu'],
      )
    }
  }

  if (cooler && chassis) {
    if (cooler.attrs.coolerType === 'air' && cooler.attrs.coolerHeightMm != null) {
      if (
        chassis.attrs.maxCoolerHeightMm != null &&
        cooler.attrs.coolerHeightMm > chassis.attrs.maxCoolerHeightMm
      ) {
        add(
          ctx,
          'error',
          'COOLER_HEIGHT',
          '风冷高度超过机箱限位',
          `散热器高 ${cooler.attrs.coolerHeightMm} mm，机箱限高 ${chassis.attrs.maxCoolerHeightMm} mm。`,
          ['cooler', 'case'],
        )
      } else {
        add(
          ctx,
          'ok',
          'COOLER_HEIGHT_OK',
          '散热器高度通过',
          `${cooler.attrs.coolerHeightMm} mm 低于机箱 ${chassis.attrs.maxCoolerHeightMm ?? '—'} mm 限高。`,
          ['cooler', 'case'],
        )
      }
    }
    if (cooler.attrs.coolerType === 'aio' && cooler.attrs.radiatorSize != null) {
      const support = chassis.attrs.radiatorSupport ?? []
      if (support.length && !support.includes(cooler.attrs.radiatorSize)) {
        add(
          ctx,
          'error',
          'RADIATOR_SIZE',
          '冷排尺寸不受机箱支持',
          `${cooler.attrs.radiatorSize} mm 冷排不在机箱支持列表（${support.join(' / ')} mm）中。`,
          ['cooler', 'case'],
        )
      } else {
        add(
          ctx,
          'ok',
          'RADIATOR_OK',
          '冷排安装位匹配',
          `${cooler.attrs.radiatorSize} mm 冷排可安装。`,
          ['cooler', 'case'],
        )
      }
    }
  }

  // Storage
  if (ssd && mb) {
    const iface = ssd.attrs.interface ?? ''
    if (/M\.2|NVMe/i.test(iface) && mb.attrs.m2Slots != null && mb.attrs.m2Slots < 1) {
      add(
        ctx,
        'error',
        'M2_SLOTS',
        '主板没有 M.2 插槽',
        `${ssd.model} 为 ${iface}，该主板无 M.2 接口。`,
        ['ssd', 'motherboard'],
      )
    } else if (/SATA/i.test(iface) && mb.attrs.sataPorts != null && mb.attrs.sataPorts < 1) {
      add(
        ctx,
        'error',
        'SATA_PORTS',
        '主板没有 SATA 接口',
        `${ssd.model} 需要 SATA 接口，该主板未提供。`,
        ['ssd', 'motherboard'],
      )
    }
  }
  if (hdd && chassis) {
    if (chassis.attrs.driveBays35 != null && chassis.attrs.driveBays35 < 1) {
      add(
        ctx,
        'error',
        'HDD_BAY',
        '机箱没有 3.5 英寸硬盘位',
        `${hdd.model} 需要 3.5" 硬盘位，当前机箱未提供。`,
        ['hdd', 'case'],
      )
    }
  }

  // Fans
  if (fan && chassis) {
    const qty = Math.max(1, quantities.fan ?? 1)
    const slots = num(chassis.attrs.fanSlots)
    const included = num(chassis.attrs.includedFans)
    if (slots && qty + included > slots) {
      add(
        ctx,
        'warning',
        'FAN_SLOTS',
        '风扇数量超过机箱安装位',
        `已选 ${qty} 把 + 机箱自带 ${included} 把 = ${qty + included}，机箱提供 ${slots} 个安装位。`,
        ['fan', 'case'],
      )
    } else if (slots) {
      add(
        ctx,
        'ok',
        'FAN_SLOTS_OK',
        '风扇安装位充足',
        `${slots} 个安装位，当前使用 ${qty + included} 个。`,
        ['fan', 'case'],
      )
    }
  }

  // PSU capacity and EPS
  if (psu) {
    const watts = num(psu.attrs.wattage)
    if (watts && watts < power.peak) {
      add(
        ctx,
        'error',
        'PSU_PEAK',
        '电源功率低于整机峰值',
        `${watts} W 电源低于估算峰值 ${power.peak} W，高负载可能触发保护关机。`,
        ['psu'],
      )
    } else if (watts && watts < power.recommendedPsu) {
      add(
        ctx,
        'warning',
        'PSU_HEADROOM',
        '电源余量不足',
        `${watts} W 低于建议的 ${power.recommendedPsu} W；瞬态功耗与未来升级空间有限。`,
        ['psu'],
      )
    } else if (watts) {
      add(
        ctx,
        'ok',
        'PSU_OK',
        '电源功率与余量通过',
        `${watts} W 对估算峰值 ${power.peak} W 保留 ${watts - power.peak} W 余量。`,
        ['psu'],
      )
    }
    if (
      cpu &&
      psu.attrs.eps8 != null &&
      num(cpu.attrs.peakPower) > 200 &&
      num(psu.attrs.eps8) < 2
    ) {
      add(
        ctx,
        'warning',
        'EPS8',
        'CPU 供电线数量偏少',
        `处理器峰值 ${cpu.attrs.peakPower} W，建议电源提供 2 根 EPS 8pin；当前仅 ${psu.attrs.eps8 ?? 0} 根。`,
        ['psu', 'cpu'],
      )
    }
    if (chassis?.attrs.maxPsuLengthMm != null && psu.attrs.lengthMm != null) {
      if (psu.attrs.lengthMm > chassis.attrs.maxPsuLengthMm) {
        add(
          ctx,
          'error',
          'PSU_LENGTH',
          '电源长度超过机箱仓限',
          `电源长 ${psu.attrs.lengthMm} mm，机箱支持 ${chassis.attrs.maxPsuLengthMm} mm。`,
          ['psu', 'case'],
        )
      }
    }
  }

  // Aesthetic / fan RGB consistency (informational, yellow only when clearly mismatched)
  if (fan && chassis) {
    if (fan.attrs.fanSizeMm && /ITX/i.test(chassis.model) && fan.attrs.fanSizeMm > 140) {
      add(
        ctx,
        'warning',
        'FAN_SIZE',
        '风扇尺寸可能不适用',
        `${fan.attrs.fanSizeMm} mm 风扇在紧凑型机箱中可能无法安装。`,
        ['fan', 'case'],
      )
    }
  }

  const errors = ctx.issues.filter((i) => i.level === 'error')
  const warnings = ctx.issues.filter((i) => i.level === 'warning')
  const passes = ctx.issues.filter((i) => i.level === 'ok')
  const status = errors.length ? 'blocked' : warnings.length ? 'caution' : 'pass'
  const score = Math.max(0, Math.min(100, 100 - errors.length * 22 - warnings.length * 5))

  return {
    status,
    issues: [...errors, ...warnings, ...passes],
    errors,
    warnings,
    passes,
    checkedAt: new Date().toISOString(),
    score,
  }
}

/**
 * 评估“把 category 换成 productId”之后的整机兼容性。
 * 用于左侧部件树的预过滤，避免小白在列表里点到装不上的型号。
 */
export function evaluateCandidate(
  selection: BuildSelection,
  category: Category,
  productId: string,
  byId: ProductMap,
  quantities: Record<string, number> = {},
): CompatibilityReport {
  return evaluateCompatibility(
    { ...selection, [category]: productId },
    byId,
    quantities,
  )
}

/**
 * 候选配件是否与当前配置存在硬性冲突。
 * 只看“涉及该类别”的错误：当前配置其他位置已有的冲突不应该连坐过滤整个列表。
 */
export function candidateBlocked(report: CompatibilityReport, category: Category): boolean {
  return report.errors.some((issue) => issue.categories.includes(category))
}
