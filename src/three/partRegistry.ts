import type { Category } from '../types'

export const CATEGORY_SCENE_ID: Record<Category, string> = {
  cpu: 'cpu',
  motherboard: 'mb',
  gpu: 'gpu',
  memory: 'ram',
  ssd: 'ssd',
  hdd: 'hdd',
  psu: 'psu',
  cooler: 'cooler',
  case: 'case',
  fan: 'fan',
  expansion: 'expansion',
}

export const SCENE_ID_CATEGORY: Record<string, Category> = Object.fromEntries(
  Object.entries(CATEGORY_SCENE_ID).map(([category, id]) => [id, category as Category]),
)

export const SCENE_PART_LABEL: Record<string, string> = {
  cpu: '处理器',
  mb: '主板',
  gpu: '显卡',
  ram: '内存',
  ssd: '固态硬盘',
  hdd: '机械硬盘',
  psu: '电源',
  cooler: '散热器',
  case: '机箱',
  fan: '机箱风扇',
  expansion: '扩展卡',
  floor: '数字基座',
}

export function sceneIdForCategory(category: Category): string {
  return CATEGORY_SCENE_ID[category]
}

export function categoryForSceneId(id: string): Category | null {
  return SCENE_ID_CATEGORY[id] ?? null
}
