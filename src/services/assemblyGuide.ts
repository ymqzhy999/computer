import type { BuildSelection, Category, Product } from '../types'
import { categoryMeta } from '../data/meta'

export interface AssemblyGuideStep {
  category: Category
  index: number
  title: string
  detail: string
  tip: string
  product: Product
}

const ORDER: Category[] = [
  'case',
  'motherboard',
  'cpu',
  'cooler',
  'memory',
  'ssd',
  'gpu',
  'psu',
  'fan',
  'hdd',
  'expansion',
]

const COPY: Partial<Record<Category, { detail: string; tip: string }>> = {
  case: {
    detail: '取下两侧面板，确认主板铜柱、走线孔和电源仓位置。',
    tip: '先规划走线，后面装完再拆侧板会麻烦。',
  },
  motherboard: {
    detail: '把主板放入机箱，对齐铜柱后拧入固定螺丝。',
    tip: '不要一次拧死，先全部对齐再逐步固定。',
  },
  cpu: {
    detail: '打开插槽压扣，对准三角标记，将处理器轻放入插槽。',
    tip: '不要按压 CPU，扣具会自然压紧。',
  },
  cooler: {
    detail: '涂抹导热硅脂，安装扣具，按对角顺序逐步拧紧散热器。',
    tip: '风冷注意内存限高，水冷先确认冷排位置。',
  },
  memory: {
    detail: '打开内存插槽卡扣，对准防呆缺口，双手压入直到卡扣回弹。',
    tip: '双通道优先插 2、4 槽，开启 XMP/EXPO。',
  },
  ssd: {
    detail: '将 M.2 固态以约 30° 插入插槽，压平后固定尾部螺丝。',
    tip: '先撕掉散热片保护膜，再安装散热片。',
  },
  gpu: {
    detail: '拆下机箱对应 PCIe 挡板，将显卡插入主插槽并固定。',
    tip: '确认显卡长度和供电接口后再合上侧板。',
  },
  psu: {
    detail: '将电源放入电源仓，先连接主板 24pin、CPU EPS 和显卡供电。',
    tip: '优先使用原生 12V-2x6 线材，避免转接。',
  },
  fan: {
    detail: '按风道方向安装机箱风扇，连接 PWM 与 ARGB 线。',
    tip: '前进后出、下进上出，保持正压减少积灰。',
  },
  hdd: {
    detail: '将机械硬盘固定在 3.5 英寸硬盘架，连接 SATA 数据与电源。',
    tip: '机械盘怕震动，固定螺丝要拧紧。',
  },
  expansion: {
    detail: '将扩展卡插入对应 PCIe 插槽并固定挡板。',
    tip: '确认插槽带宽和供电需求。',
  },
}

type ProductLookup = Record<string, Product> | Map<string, Product>

export function buildAssemblyGuide(
  selection: BuildSelection,
  byId: ProductLookup,
): AssemblyGuideStep[] {
  return ORDER.filter((category) => Boolean(selection[category]))
    .map((category) => {
      const id = selection[category] as string
      const product = byId instanceof Map ? byId.get(id) : byId[id]
      if (!product) return null
      const meta = categoryMeta(category)
      const copy = COPY[category] ?? {
        detail: `安装${meta.label}并连接对应线缆。`,
        tip: '安装前确认接口与空间。',
      }
      return {
        category,
        index: Number(meta.index) - 1,
        title: meta.label,
        detail: copy.detail,
        tip: copy.tip,
        product,
      }
    })
    .filter((step): step is AssemblyGuideStep => Boolean(step))
}
