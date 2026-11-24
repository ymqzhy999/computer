import type { AppTab, Aesthetic, Category, ScenarioId } from '../types'

export interface CategoryMeta {
  id: Category
  index: string
  label: string
  en: string
  short: string
  required: boolean
  core: boolean
  sceneKey: string
}

export const CATEGORY_META: CategoryMeta[] = [
  { id: 'cpu', index: '01', label: '处理器', en: 'PROCESSOR', short: 'CPU', required: false, core: true, sceneKey: 'cpu' },
  { id: 'motherboard', index: '02', label: '主板', en: 'MOTHERBOARD', short: 'MAINBOARD', required: false, core: true, sceneKey: 'mb' },
  { id: 'gpu', index: '03', label: '显卡', en: 'GRAPHICS CARD', short: 'GPU', required: false, core: true, sceneKey: 'gpu' },
  { id: 'memory', index: '04', label: '内存', en: 'MEMORY', short: 'RAM', required: false, core: true, sceneKey: 'ram' },
  { id: 'ssd', index: '05', label: '固态硬盘', en: 'SOLID STATE DRIVE', short: 'SSD', required: false, core: true, sceneKey: 'ssd' },
  { id: 'hdd', index: '06', label: '机械硬盘', en: 'HARD DISK DRIVE', short: 'HDD', required: false, core: false, sceneKey: 'hdd' },
  { id: 'psu', index: '07', label: '电源', en: 'POWER SUPPLY', short: 'PSU', required: false, core: true, sceneKey: 'psu' },
  { id: 'cooler', index: '08', label: '散热器', en: 'CPU COOLER', short: 'COOLING', required: false, core: true, sceneKey: 'cooler' },
  { id: 'case', index: '09', label: '机箱', en: 'CHASSIS', short: 'CASE', required: false, core: true, sceneKey: 'case' },
  { id: 'fan', index: '10', label: '机箱风扇', en: 'CASE FAN', short: 'FAN', required: false, core: false, sceneKey: 'fan' },
  { id: 'expansion', index: '11', label: '扩展硬件', en: 'EXPANSION', short: 'EXPANSION', required: false, core: false, sceneKey: 'expansion' },
]

export const CORE_CATEGORIES: Category[] = CATEGORY_META.filter((c) => c.core).map((c) => c.id)
export const ALL_CATEGORIES: Category[] = CATEGORY_META.map((c) => c.id)

export function categoryMeta(category: Category): CategoryMeta {
  return CATEGORY_META.find((c) => c.id === category) ?? CATEGORY_META[0]
}

export const TAB_META: { id: AppTab; index: string; label: string; en: string }[] = [
  { id: 'assembly', index: '01', label: '装配实验室', en: 'ASSEMBLY' },
  { id: 'teardown', index: '02', label: '拆解实验室', en: 'TEARDOWN' },
  { id: 'smart', index: '03', label: '智能配机', en: 'INTELLIGENT BUILD' },
  { id: 'market', index: '04', label: '市场价格', en: 'MARKET PRICE' },
  { id: 'builds', index: '05', label: '配置方案', en: 'BUILD LIBRARY' },
]

export interface ScenarioMeta {
  id: ScenarioId
  label: string
  en: string
  desc: string
  weights: Record<'cpu' | 'gpu' | 'ram' | 'ssd' | 'cooling', number>
  targetRam: 16 | 32 | 64
  targetSsd: 1 | 2 | 4
  preferVram: boolean
}

export const SCENARIOS: ScenarioMeta[] = [
  {
    id: 'gaming',
    label: '游戏',
    en: 'GAMING',
    desc: '高帧率、光追与 2K/4K 分辨率优先',
    weights: { cpu: 0.25, gpu: 0.55, ram: 0.08, ssd: 0.07, cooling: 0.05 },
    targetRam: 32,
    targetSsd: 1,
    preferVram: false,
  },
  {
    id: 'office',
    label: '办公',
    en: 'OFFICE',
    desc: '文档、会议、网页与轻量多任务',
    weights: { cpu: 0.36, gpu: 0.08, ram: 0.18, ssd: 0.25, cooling: 0.13 },
    targetRam: 16,
    targetSsd: 1,
    preferVram: false,
  },
  {
    id: 'video',
    label: '视频剪辑',
    en: 'VIDEO EDIT',
    desc: '多轨时间线、调色与硬件编码',
    weights: { cpu: 0.3, gpu: 0.33, ram: 0.17, ssd: 0.15, cooling: 0.05 },
    targetRam: 32,
    targetSsd: 2,
    preferVram: true,
  },
  {
    id: 'modeling',
    label: '3D 建模',
    en: '3D MODELING',
    desc: '视口交互、渲染与大型场景',
    weights: { cpu: 0.27, gpu: 0.34, ram: 0.19, ssd: 0.14, cooling: 0.06 },
    targetRam: 32,
    targetSsd: 2,
    preferVram: true,
  },
  {
    id: 'ai',
    label: 'AI 本地部署',
    en: 'LOCAL AI',
    desc: '大显存、系统内存与推理吞吐',
    weights: { cpu: 0.18, gpu: 0.47, ram: 0.2, ssd: 0.1, cooling: 0.05 },
    targetRam: 64,
    targetSsd: 2,
    preferVram: true,
  },
  {
    id: 'coding',
    label: '编程开发',
    en: 'DEVELOPMENT',
    desc: '编译、容器、多项目并行',
    weights: { cpu: 0.37, gpu: 0.12, ram: 0.22, ssd: 0.21, cooling: 0.08 },
    targetRam: 32,
    targetSsd: 2,
    preferVram: false,
  },
]

export function scenarioMeta(id: ScenarioId): ScenarioMeta {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]
}

export interface ScenarioTarget {
  id: string
  label: string
  hint: string
  minRam: 16 | 32 | 64 | 128
  minVram: number
  minSsd: 1 | 2 | 4
}

export const SCENARIO_TARGETS: Record<ScenarioId, ScenarioTarget[]> = {
  gaming: [],
  office: [
    { id: 'light', label: '文档办公', hint: '文档 / 网页 / 会议', minRam: 16, minVram: 0, minSsd: 1 },
    { id: 'multitask', label: '多任务', hint: '多表格 / 浏览器 / 轻量设计', minRam: 32, minVram: 4, minSsd: 1 },
    { id: 'vm', label: '虚拟化', hint: '虚拟机 / 多系统 / 长期多开', minRam: 64, minVram: 8, minSsd: 2 },
  ],
  video: [
    { id: 'hd', label: '1080p 剪辑', hint: '代理剪辑 / 基础调色', minRam: 32, minVram: 8, minSsd: 2 },
    { id: 'uhd', label: '4K 剪辑', hint: '多轨 4K / 硬件编码', minRam: 64, minVram: 12, minSsd: 4 },
    { id: 'cinema', label: '8K 多轨', hint: '高码率 / 特效 / 调色', minRam: 128, minVram: 16, minSsd: 4 },
  ],
  modeling: [
    { id: 'medium', label: '中型场景', hint: '产品建模 / 中型装配体', minRam: 32, minVram: 8, minSsd: 2 },
    { id: 'complex', label: '复杂场景', hint: '大装配体 / 高面数', minRam: 64, minVram: 12, minSsd: 2 },
    { id: 'render', label: 'GPU 渲染', hint: 'Cycles / 离线渲染', minRam: 128, minVram: 16, minSsd: 4 },
  ],
  ai: [
    { id: '7b', label: '7B 模型', hint: 'Q4 量化 / 日常推理', minRam: 32, minVram: 8, minSsd: 2 },
    { id: '14b', label: '14B 模型', hint: 'Q4 量化 / 较长上下文', minRam: 64, minVram: 12, minSsd: 2 },
    { id: '32b', label: '32B 模型', hint: 'Q4 量化 / 大显存优先', minRam: 128, minVram: 24, minSsd: 4 },
  ],
  coding: [
    { id: 'daily', label: '日常开发', hint: '编辑器 / 浏览器 / 轻量容器', minRam: 16, minVram: 0, minSsd: 1 },
    { id: 'containers', label: '多容器', hint: 'Docker / 数据库 / 多服务', minRam: 32, minVram: 4, minSsd: 2 },
    { id: 'monorepo', label: '大型编译', hint: '大型仓库 / 编译 / 虚拟机', minRam: 64, minVram: 8, minSsd: 2 },
  ],
}

export function scenarioTarget(scenario: ScenarioId, id?: string): ScenarioTarget | undefined {
  return SCENARIO_TARGETS[scenario].find((target) => target.id === id) ?? SCENARIO_TARGETS[scenario][0]
}

export const AESTHETICS: { id: Aesthetic; label: string; swatch: string }[] = [
  { id: 'any', label: '不限', swatch: 'linear-gradient(135deg,#233848,#0a141d)' },
  { id: 'black', label: '黑色', swatch: '#080c11' },
  { id: 'white', label: '白色', swatch: '#dce4e7' },
  { id: 'rgb', label: 'RGB', swatch: 'conic-gradient(#ff5a4d,#ffd166,#55e6a5,#7fa8bd,#b06cff,#ff5a4d)' },
  { id: 'minimal', label: '简约无光', swatch: 'linear-gradient(135deg,#75828a,#1a2228)' },
]

export const RESOLUTIONS = [
  { id: '1080p', label: '1080P', desc: '1920 × 1080' },
  { id: '1440p', label: '2K', desc: '2560 × 1440' },
  { id: '4k', label: '4K', desc: '3840 × 2160' },
] as const

export const BRANDS = ['AMD', 'Intel', 'NVIDIA', 'ASUS', 'MSI', 'Gigabyte', 'ASRock', 'Sapphire', 'Colorful', 'Galax', 'Zotac', 'Maxsun', 'Yeston', 'XFX', 'Inno3D', 'PNY', 'Corsair', 'G.Skill', 'Samsung', 'Lian Li']

export const PRICE_STATUS_LABEL: Record<string, string> = {
  live: '实时',
  sample: '归档样本',
  stale: '待更新',
  unavailable: '暂无报价',
}
