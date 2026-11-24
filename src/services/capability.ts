import type { BuildMetrics, BuildSelection, Category, Product } from '../types'
import { CORE_CATEGORIES } from '../data/meta'

export type CapabilityLevel = 'excellent' | 'good' | 'ok' | 'limited'

export interface CapabilityItem {
  label: string
  level: CapabilityLevel
  detail: string
}

export interface CapabilityReport {
  summary: string
  gaming: CapabilityItem[]
  software: CapabilityItem[]
  llm: CapabilityItem[]
  disclaimer: string
}

const levelText: Record<CapabilityLevel, string> = {
  excellent: '优秀',
  good: '良好',
  ok: '可用',
  limited: '受限',
}

export function levelLabel(level: CapabilityLevel): string {
  return levelText[level]
}

type ProductLookup = Record<string, Product> | Map<string, Product>

export function estimateCapabilities(
  metrics: BuildMetrics,
  selection: BuildSelection,
  byId: ProductLookup,
): CapabilityReport {
  const get = (id: string | null | undefined) =>
    id ? (byId instanceof Map ? byId.get(id) : byId[id]) : undefined
  const gpu = get(selection.gpu)
  const cpu = get(selection.cpu)
  const ram = get(selection.memory)
  const gpuIndex = gpu?.performance.gaming ?? 0
  const cpuMulti = cpu?.performance.multi ?? 0
  const cpuSingle = cpu?.performance.single ?? 0
  const vram = gpu?.attrs.vramGb ?? 0
  const ramGb = ram?.attrs.memoryCapacity ?? 0
  const complete = CORE_CATEGORIES.every((category: Category) => Boolean(selection[category]))

  const gamingLevel: CapabilityLevel =
    gpuIndex >= 88 ? 'excellent' : gpuIndex >= 72 ? 'good' : gpuIndex >= 52 ? 'ok' : 'limited'
  const gamingTarget =
    gpuIndex >= 88
      ? '4K 高画质 / 2K 高帧率'
      : gpuIndex >= 72
        ? '2K 高画质 / 4K 中画质（超分）'
        : gpuIndex >= 52
          ? '1080p 高画质 / 2K 中画质'
          : '1080p 中画质'

  const gaming: CapabilityItem[] = [
    {
      label: '竞技网游',
      level: gpuIndex >= 52 ? 'excellent' : 'good',
      detail: '英雄联盟 / CS2 / 无畏契约：1080p 高帧率',
    },
    {
      label: '3A 大作',
      level: gamingLevel,
      detail: `赛博朋克 2077 / 黑神话：悟空：${gamingTarget}`,
    },
    {
      label: '光追与 4K',
      level: gpuIndex >= 82 && vram >= 12 ? 'good' : gpuIndex >= 66 ? 'ok' : 'limited',
      detail:
        gpuIndex >= 82 && vram >= 12
          ? '可开启光追，建议配合 DLSS / FSR'
          : '建议 1080p/2K，光追需要降低画质',
    },
  ]

  const software: CapabilityItem[] = [
    {
      label: '视频剪辑',
      level: cpuMulti >= 78 && (vram >= 8 || gpuIndex >= 55) ? 'excellent' : cpuMulti >= 60 ? 'good' : 'ok',
      detail:
        cpuMulti >= 78
          ? '4K 多轨剪辑 / 调色 / 硬件编码'
          : cpuMulti >= 60
            ? '1080p 多轨 / 4K 轻剪辑'
            : '1080p 剪辑，复杂特效需代理',
    },
    {
      label: '3D 建模与渲染',
      level: cpuMulti >= 82 && vram >= 12 ? 'excellent' : cpuMulti >= 65 ? 'good' : 'ok',
      detail:
        vram >= 16
          ? 'Blender / 3ds Max：复杂场景与 GPU 渲染'
          : vram >= 8
            ? 'Blender / SketchUp：中型场景'
            : '中型场景，渲染建议 CPU 或云渲染',
    },
    {
      label: '编程开发',
      level: cpuSingle >= 70 && ramGb >= 32 ? 'excellent' : cpuSingle >= 55 ? 'good' : 'ok',
      detail: ramGb >= 32 ? 'Docker / 多服务 / 大型项目' : '日常开发与轻量容器',
    },
    {
      label: 'AI 推理与训练',
      level: vram >= 16 ? 'good' : vram >= 8 ? 'ok' : 'limited',
      detail:
        vram >= 16
          ? '本地推理 / 小规模微调'
          : vram >= 8
            ? '7B–14B 量化推理'
            : '建议云端 GPU 或小模型 CPU 推理',
    },
  ]

  const llm: CapabilityItem[] = []
  const addModel = (label: string, needVram: number, needRam: number) => {
    if (vram >= needVram) {
      llm.push({ label, level: 'good', detail: `Q4 量化可放入显存，约需 ${needVram}GB VRAM` })
    } else if (ramGb >= needRam) {
      llm.push({ label, level: 'ok', detail: `显存不足，可内存卸载运行，速度较慢（建议 ${needRam}GB 内存）` })
    } else {
      llm.push({ label, level: 'limited', detail: `不建议本地运行，建议 ${needVram}GB 显存 / ${needRam}GB 内存` })
    }
  }
  addModel('7B / 8B 模型', 6, 16)
  addModel('14B 模型', 10, 32)
  addModel('32B 模型', 20, 64)
  addModel('70B 模型', 40, 128)
  if (llm.length === 0) {
    llm.push({ label: '本地大模型', level: 'limited', detail: '未检测到可用 GPU 或内存配置' })
  }

  const summary = complete
    ? `${gamingTarget} · ${software[0].label}${software[0].level === 'excellent' ? '优秀' : '可用'} · ${
        llm.find((item) => item.level !== 'limited')?.label ?? '本地大模型受限'
      }`
    : '整机尚未完整，能力评估仅供参考'

  return {
    summary,
    gaming,
    software,
    llm,
    disclaimer: '以上为基于硬件性能指数的估算，不是实测帧率；游戏帧率受画质、驱动、分辨率和超分设置影响。',
  }
}
