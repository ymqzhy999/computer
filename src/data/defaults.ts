import type { BuildRequest, BuildSelection } from '../types'

export const DEFAULT_SELECTION: BuildSelection = {
  cpu: 'cpu-amd-r7-7800x3d',
  motherboard: 'mb-asus-b650e-f',
  gpu: 'gpu-asus-rtx5070-tuf',
  memory: 'ram-gskill-ddr5-32',
  ssd: 'ssd-samsung-990pro-1t',
  hdd: null,
  psu: 'psu-corsair-rm850x',
  cooler: 'cooler-deepcool-lt720',
  case: 'case-lianli-o11d-evo',
  fan: 'fan-lianli-sl120',
  expansion: null,
}

export const DEFAULT_QUANTITIES: Record<string, number> = {
  fan: 4,
  expansion: 1,
}

export const DEFAULT_REQUEST: BuildRequest = {
  budget: 12000,
  scenario: 'gaming',
  resolution: '1440p',
  targetFps: 144,
  workload: '',
  software: '',
  brands: [],
  aesthetic: 'black',
  allowUsed: false,
  includePeripherals: false,
}

export const ASSEMBLY_STEPS = [
  { at: 0.02, label: '完整装配', detail: '26 / 26 组件锁定' },
  { at: 0.12, label: '外壳分离', detail: '侧板 / 顶板 / 前面板' },
  { at: 0.28, label: '拆除显卡', detail: 'PCIe 卡扣与供电线' },
  { at: 0.42, label: '散热系统', detail: '风冷 / 冷排 / 风扇' },
  { at: 0.56, label: '内存与存储', detail: 'DIMM / M.2 / SATA' },
  { at: 0.7, label: '处理器', detail: 'Socket 压扣释放' },
  { at: 0.82, label: '主板', detail: '9 × 铜柱固定点' },
  { at: 0.94, label: '电源与背线', detail: 'PSU / 24pin / EPS' },
  { at: 1, label: '完全拆解', detail: '26 / 26 组件分离' },
]
