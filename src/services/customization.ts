import type { Category, CustomPattern, PartCustomization, Product } from '../types'

export interface PatternMeta {
  id: CustomPattern
  label: string
  en: string
  hint: string
}

export const PATTERNS: PatternMeta[] = [
  { id: 'none', label: '素面', en: 'BLANK', hint: '保留原厂材质，仅保留刻字与签名' },
  { id: 'circuit', label: '电路', en: 'CIRCUIT', hint: '精密走线与焊盘，适合主板、显卡与机箱' },
  { id: 'hex', label: '蜂窝', en: 'HEX', hint: '航空蜂窝结构，适合冷排与机箱面板' },
  { id: 'topography', label: '等高线', en: 'TOPO', hint: '地形等高线，适合大面积侧板' },
  { id: 'carbon', label: '碳纤', en: 'CARBON', hint: '斜纹碳纤维，适合显卡背板与内存' },
  { id: 'sakura', label: '樱纹', en: 'SAKURA', hint: '手绘樱花散落，适合白色或限定主题' },
  { id: 'starlight', label: '星图', en: 'STARLIGHT', hint: '星点与星座连线，适合深色玻璃侧板' },
  { id: 'brush', label: '笔触', en: 'BRUSH', hint: '大漆笔触，适合独一无二的艺术涂装' },
]

export const FINISHES: { id: PartCustomization['finish']; label: string; en: string }[] = [
  { id: 'matte', label: '哑光', en: 'MATTE' },
  { id: 'brushed', label: '拉丝', en: 'BRUSHED' },
  { id: 'gloss', label: '高光', en: 'GLOSS' },
]

export const PALETTES: { name: string; primary: string; accent: string }[] = [
  { name: '深空青', primary: '#06131c', accent: '#44dcff' },
  { name: '熔炉橙', primary: '#160b06', accent: '#ff8a3d' },
  { name: '极地白', primary: '#d9e2e2', accent: '#0d7f9c' },
  { name: '樱雾', primary: '#241219', accent: '#ff9dbb' },
  { name: '翡翠', primary: '#06160f', accent: '#52e0a4' },
  { name: '紫电', primary: '#100b1c', accent: '#b18cff' },
]

export const ENGRAVING_MAX = 22

export function patternMeta(id: CustomPattern): PatternMeta {
  return PATTERNS.find((p) => p.id === id) ?? PATTERNS[0]
}

export function hashSignature(input: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x1000193
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ (code + i), 0x85ebca6b) >>> 0
  }
  const a = h1.toString(16).toUpperCase().padStart(8, '0').slice(0, 4)
  const b = h2.toString(16).toUpperCase().padStart(8, '0').slice(0, 4)
  return `PF-${a}-${b}`
}

export function makeCustomization(
  category: Category,
  product: Product | undefined,
  patch: Partial<PartCustomization> = {},
): PartCustomization {
  const nativeAccent = product?.visual?.accent ?? '#44dcff'
  const base: PartCustomization = {
    pattern: 'circuit',
    primary: '#06131c',
    accent: nativeAccent,
    engraving: '',
    finish: 'matte',
    intensity: 0.72,
  }
  const mixed = { ...base, ...patch }
  mixed.intensity = Math.max(0.15, Math.min(1, Number.isFinite(mixed.intensity) ? mixed.intensity : 0.72))
  mixed.engraving = mixed.engraving.slice(0, ENGRAVING_MAX)
  mixed.signature = hashSignature(
    [category, product?.id ?? 'empty', mixed.pattern, mixed.primary, mixed.accent, mixed.finish, mixed.engraving, mixed.imageData ? 'image' : 'vector'].join('|'),
  )
  return mixed
}

export function randomCustomization(category: Category, product: Product | undefined): PartCustomization {
  const pattern = PATTERNS[Math.floor(Math.random() * (PATTERNS.length - 1)) + 1]
  const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)]
  const finish = FINISHES[Math.floor(Math.random() * FINISHES.length)]
  return makeCustomization(category, product, {
    pattern: pattern.id,
    primary: palette.primary,
    accent: palette.accent,
    finish: finish.id,
    intensity: 0.55 + Math.random() * 0.4,
  })
}

export function customizationSummary(custom: PartCustomization | undefined): string {
  if (!custom) return '原厂材质'
  return `${patternMeta(custom.pattern).label} · ${custom.finish.toUpperCase()} · ${custom.signature ?? 'UNSIGNED'}`
}
