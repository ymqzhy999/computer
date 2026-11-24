export type Category =
  | 'cpu'
  | 'motherboard'
  | 'gpu'
  | 'memory'
  | 'ssd'
  | 'hdd'
  | 'psu'
  | 'cooler'
  | 'case'
  | 'fan'
  | 'expansion'

export type PriceStatus = 'live' | 'sample' | 'stale' | 'unavailable'
export type PriceConfidence = 'high' | 'medium' | 'low'
export type ProductCondition = 'new' | 'used'

export interface PricePoint {
  date: string
  price: number
  source?: string
}

export interface PriceSnapshot {
  reference: number | null
  min: number | null
  max: number | null
  currency: 'CNY' | 'USD' | 'EUR'
  region: string
  source: string
  sourceUrl?: string
  updatedAt: string
  status: PriceStatus
  confidence: PriceConfidence
  history?: PricePoint[]
  note?: string
}

export interface PerformanceVector {
  index: number
  gaming: number
  productivity: number
  single: number
  multi: number
  vram?: number
  efficiency?: number
}

export interface ProductAttrs {
  imageUrl?: string
  socket?: string
  chipset?: string
  generation?: string
  formFactor?: string
  supportedFormFactors?: string[]
  memoryType?: 'DDR4' | 'DDR5'
  memorySlots?: number
  memoryCapacity?: number
  memorySticks?: number
  memorySpeed?: number
  memoryMaxSpeed?: number
  casLatency?: number
  cores?: number
  threads?: number
  baseClock?: number
  boostClock?: number
  cacheMb?: number
  igpu?: boolean
  tdp?: number
  peakPower?: number
  lengthMm?: number
  thicknessSlots?: number
  widthMm?: number
  heightMm?: number
  vramGb?: number
  gpuChip?: string
  chipVendor?: string
  radiatorSize?: number
  coolerType?: 'air' | 'aio' | 'stock'
  coolerHeightMm?: number
  coolerTdp?: number
  cpuSockets?: string[]
  wattage?: number
  efficiency?: string
  atxVersion?: string
  modular?: string
  pcie8?: number
  pcie12vhpwr?: number
  eps8?: number
  maxGpuLengthMm?: number
  maxCoolerHeightMm?: number
  maxPsuLengthMm?: number
  radiatorSupport?: number[]
  fanSlots?: number
  includedFans?: number
  fanSizeMm?: number
  driveBays25?: number
  driveBays35?: number
  capacityGb?: number
  interface?: string
  formFactorDrive?: string
  readMbps?: number
  writeMbps?: number
  rpm?: number
  cacheGb?: number
  m2Slots?: number
  sataPorts?: number
  pcieSlots?: number
  wifi?: string
  lan?: string
  bios?: string
  color?: string
  rgb?: boolean
  quantity?: number
  type?: string
}

export interface ProductVisual {
  accent?: string
  tone?: 'black' | 'white' | 'silver' | 'green'
  variant?: string
}

export interface ProductWorkloads {
  tier: string
  badge: string
  games: string[]
  productivity: string[]
  summary: string
}

export interface Product {
  id: string
  category: Category
  brand: string
  model: string
  sku: string
  releasedAt: string
  status: 'active' | 'eol' | 'upcoming'
  tagline: string
  description: string
  attrs: ProductAttrs
  specs: Record<string, string | number>
  price: PriceSnapshot | null
  usedPrice?: number | null
  performance: PerformanceVector
  visual?: ProductVisual
  workloads?: ProductWorkloads
}

export type CustomPattern =
  | 'none'
  | 'circuit'
  | 'hex'
  | 'topography'
  | 'carbon'
  | 'sakura'
  | 'starlight'
  | 'brush'

export interface PartCustomization {
  pattern: CustomPattern
  primary: string
  accent: string
  engraving: string
  finish: 'matte' | 'brushed' | 'gloss'
  intensity: number
  imageData?: string
  signature?: string
}

export type CustomizationMap = Partial<Record<Category, PartCustomization>>

export interface CatalogFile {
  version: string
  updatedAt: string
  region: string
  currency: string
  disclaimer: string
  products: Product[]
}

export type BuildSelection = Partial<Record<Category, string | null>>

export type IssueLevel = 'error' | 'warning' | 'ok'

export interface CompatIssue {
  id: string
  level: IssueLevel
  code: string
  title: string
  detail: string
  categories: Category[]
}

export interface CompatibilityReport {
  status: 'blocked' | 'caution' | 'pass'
  issues: CompatIssue[]
  errors: CompatIssue[]
  warnings: CompatIssue[]
  passes: CompatIssue[]
  checkedAt: string
  score: number
}

export interface PowerEstimate {
  idle: number
  load: number
  peak: number
  recommendedPsu: number
  headroom: number
}

export interface BuildMetrics {
  total: number
  towerTotal: number
  minTotal: number
  maxTotal: number
  power: PowerEstimate
  performance: {
    index: number
    gaming: number
    productivity: number
    single: number
    multi: number
    cooling: number
    balance: number
  }
  bottleneck: string
  priceCoverage: number
}

export type ScenarioId = 'gaming' | 'office' | 'video' | 'modeling' | 'ai' | 'coding'
export type Aesthetic = 'any' | 'black' | 'white' | 'rgb' | 'minimal'

export interface BuildRequest {
  budget: number
  scenario: ScenarioId
  resolution: '1080p' | '1440p' | '4k'
  targetFps: number
  workload?: string
  software: string
  brands: string[]
  aesthetic: Aesthetic
  allowUsed: boolean
  includePeripherals: boolean
}

export interface BuildLine {
  category: Category | 'peripheral'
  productId: string | null
  label: string
  model: string
  price: number
  condition: ProductCondition | 'reserve'
  reason: string
  quantity?: number
}

export interface AlternativePart {
  id: string
  label: string
  delta: number
}

export interface RecommendedBuild {
  id: string
  title: string
  subtitle: string
  tier: 'balanced' | 'value' | 'performance'
  request: BuildRequest
  selection: BuildSelection
  quantities: Record<string, number>
  lines: BuildLine[]
  peripheralsReserve: number
  total: number
  budget: number
  budgetDelta: number
  power: PowerEstimate
  compatibility: CompatibilityReport
  performance: BuildMetrics['performance']
  bottleneck: string
  score: number
  reasons: Record<string, string>
  alternatives: Record<string, AlternativePart[]>
  upgradePath: string[]
  notes: string[]
  createdAt: string
}

export interface SavedBuild {
  id: string
  name: string
  note: string
  createdAt: string
  updatedAt: string
  selection: BuildSelection
  quantities: Record<string, number>
  total: number
  performance: number
  power: number
  compatibility: 'blocked' | 'caution' | 'pass'
  source: 'manual' | 'smart'
}

export type ViewMode = 'assembled' | 'exploded' | 'section' | 'xray'
export type AppTab = 'assembly' | 'teardown' | 'smart' | 'market' | 'builds'

export interface ToastMessage {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  detail?: string
}

export interface CameraReadout {
  azimuth: number
  elevation: number
  distance: number
}
