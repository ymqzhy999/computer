import type { Product } from '../types'

/** 机箱前脸结构：海景房双玻璃 / 单面玻璃侧透 / 冲孔网 / 木格栅。 */
export type CaseFront = 'pano' | 'glass' | 'mesh' | 'wood'

export function caseFrontStyle(product: Product | undefined): CaseFront {
  const text = `${product?.model ?? ''} ${product?.brand ?? ''} ${product?.attrs?.color ?? ''} ${product?.visual?.tone ?? ''}`.toLowerCase()
  if (/north|胡桃|木纹|wood/.test(text)) return 'wood'
  if (/海景|全景|pano|o11|011|y60|y70|nv5|nv7|h9|king ?95|aquarium|vision|双子星|视界/.test(text)) return 'pano'
  if (/mesh|airflow|air flow|flow|网|通风|nr200|ap201|gt502|d31|argb/.test(text)) return 'mesh'
  return 'glass'
}

export function caseFrontLabel(style: CaseFront): string {
  switch (style) {
    case 'pano':
      return '海景房'
    case 'mesh':
      return '冲孔网'
    case 'wood':
      return '木格栅'
    default:
      return '玻璃侧透'
  }
}
