<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ArrowRight,
  Banknote,
  Boxes,
  BrainCircuit,
  Briefcase,
  Check,
  ChevronRight,
  Clapperboard,
  Code2,
  Cpu,
  Database,
  Download,
  Gamepad2,
  Gauge,
  MonitorPlay,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Zap,
} from 'lucide-vue-next'
import { useBuildStore } from '../stores/build'
import { useToastStore } from '../stores/toast'
import { AESTHETICS, BRANDS, RESOLUTIONS, SCENARIOS, SCENARIO_TARGETS, categoryMeta, scenarioMeta, scenarioTarget } from '../data/meta'
import { exportCsv, exportPdf } from '../services/export'
import type { ExportPayload } from '../services/export'
import { formatPrice, selectionRange } from '../services/pricing'
import type { Aesthetic, RecommendedBuild, ScenarioId } from '../types'

const store = useBuildStore()
const toast = useToastStore()
const building = ref(false)
const selectedTier = ref<'balanced' | 'value' | 'performance'>('balanced')
const software = computed({
  get: () => store.request.software,
  set: (value: string) => {
    store.request.software = value
  },
})

const scenarioIcons: Record<ScenarioId, typeof Gamepad2> = {
  gaming: Gamepad2,
  office: Briefcase,
  video: Clapperboard,
  modeling: Boxes,
  ai: BrainCircuit,
  coding: Code2,
}

const softwareHints: Record<ScenarioId, { label: string; placeholder: string; examples: string[] }> = {
  gaming: { label: '游戏 / GAME', placeholder: '赛博朋克 2077 / 黑神话：悟空', examples: ['赛博朋克 2077', '黑神话：悟空', '极限竞速：地平线 5'] },
  office: { label: '办公软件 / OFFICE', placeholder: 'Office 365 / WPS / 企业微信', examples: ['Office 365', 'WPS', '企业微信'] },
  video: { label: '剪辑软件 / VIDEO', placeholder: 'DaVinci Resolve / Premiere Pro', examples: ['DaVinci Resolve', 'Premiere Pro', 'After Effects'] },
  modeling: { label: '建模软件 / 3D', placeholder: 'Blender / SolidWorks / 3ds Max', examples: ['Blender', 'SolidWorks', '3ds Max'] },
  ai: { label: 'AI 框架 / MODEL', placeholder: 'PyTorch / Ollama / Stable Diffusion', examples: ['PyTorch', 'Ollama', 'Stable Diffusion'] },
  coding: { label: '开发环境 / DEV', placeholder: 'VS Code / Docker / JetBrains', examples: ['VS Code', 'Docker', 'JetBrains'] },
}

const softwareHint = computed(() => softwareHints[store.request.scenario])
const isGaming = computed(() => store.request.scenario === 'gaming')
const targetOptions = computed(() => SCENARIO_TARGETS[store.request.scenario])
const targetSummary = computed(() => {
  if (isGaming.value) return `${store.request.resolution} · ${store.request.targetFps} FPS`
  return scenarioTarget(store.request.scenario, store.request.workload)?.label ?? '请选择目标'
})
const knownSoftwareExamples = new Set(Object.values(softwareHints).flatMap((hint) => hint.examples))

const selectedBuild = computed<RecommendedBuild | null>(() => {
  const results = store.smartResults
  if (!results.length) return null
  return results.find((b) => b.tier === selectedTier.value) ?? results[0]
})

const selectedScenario = computed(() => scenarioMeta(store.request.scenario))
const buildScenario = computed(() =>
  selectedBuild.value ? scenarioMeta(selectedBuild.value.request.scenario) : selectedScenario.value,
)
const buildTargetLabel = computed(() => {
  if (!selectedBuild.value) return targetSummary.value
  const request = selectedBuild.value.request
  if (request.scenario === 'gaming') return request.resolution
  return scenarioTarget(request.scenario, request.workload)?.label ?? ''
})
const range = computed(() =>
  selectedBuild.value
    ? selectionRange(selectedBuild.value.selection, store.byId, selectedBuild.value.quantities, store.request.allowUsed)
    : { min: 0, max: 0, reference: 0, coverage: 0 },
)
const budgetFill = computed(() => {
  if (!selectedBuild.value?.budget) return 0
  return Math.min(100, Math.round((selectedBuild.value.total / selectedBuild.value.budget) * 100))
})
const budgetRemain = computed(() => {
  if (!selectedBuild.value) return 0
  return selectedBuild.value.budget - selectedBuild.value.total
})
const tierMeta: Record<string, { label: string; en: string }> = {
  balanced: { label: '均衡推荐', en: 'BALANCED' },
  value: { label: '预算优先', en: 'VALUE' },
  performance: { label: '性能拉满', en: 'PERFORMANCE' },
}
const compatLabel = computed(() => {
  const s = selectedBuild.value?.compatibility.status
  return s === 'pass' ? '兼容通过' : s === 'caution' ? '存在风险' : '硬性冲突'
})

function generate() {
  if (building.value) return
  building.value = true
  window.setTimeout(() => {
    store.runSmartBuild()
    selectedTier.value = 'balanced'
    building.value = false
  }, 40)
}

function toggleBrand(brand: string) {
  const current = store.request.brands
  store.request.brands = current.includes(brand) ? current.filter((b) => b !== brand) : [...current, brand]
}

function toggleScenario(id: ScenarioId) {
  if (store.request.scenario === id) return
  store.request.scenario = id
  const options = SCENARIO_TARGETS[id]
  store.request.workload = options[0]?.id ?? ''
  if (knownSoftwareExamples.has(store.request.software)) {
    store.request.software = ''
  }
  generate()
}

function chooseTarget(id: string) {
  store.request.workload = id
  generate()
}

function pickSoftware(value: string) {
  store.request.software = store.request.software === value ? '' : value
}

function loadBuild(build: RecommendedBuild) {
  store.applyRecommended(build)
  store.setTab('assembly')
}

function saveBuild(build: RecommendedBuild) {
  store.saveRecommendedBuild(build)
}

function makePayload(build: RecommendedBuild): ExportPayload {
  return {
    name: build.title,
    lines: build.lines.map((line) => ({
      category: line.category === 'peripheral' ? '外设预留' : categoryMeta(line.category).label,
      model: line.model,
      price: line.price,
      condition: line.condition === 'used' ? '二手' : line.condition === 'reserve' ? '预算预留' : '全新',
      reason: line.reason,
    })),
    total: build.total,
    budget: build.budget,
    power: build.power,
    performance: build.performance,
    compatibility: compatLabel.value,
    notes: build.notes,
  }
}

function downloadCsv() {
  if (!selectedBuild.value) return
  exportCsv(makePayload(selectedBuild.value))
  toast.success('CSV 清单已导出', selectedBuild.value.title)
}

async function downloadPdf() {
  if (!selectedBuild.value) return
  const build = selectedBuild.value
  toast.info('正在生成 PDF', '配置单正在排版，请稍候')
  try {
    await exportPdf(makePayload(build))
    toast.success('PDF 清单已导出', build.title)
  } catch (error) {
    toast.error('PDF 导出失败', (error as Error).message)
  }
}

onMounted(() => {
  if (!store.request.workload) {
    store.request.workload = SCENARIO_TARGETS[store.request.scenario][0]?.id ?? ''
  }
  if (!store.smartResults.length) generate()
})
</script>

<template>
  <div class="page-shell smart-page">
    <header class="page-head">
      <div>
        <span class="panel-kicker"><Sparkles :size="11" /> 按预算与场景生成</span>
        <h1>智能配机</h1>
        <p>先保证兼容，再按使用场景分配预算。价格来自归档样本或用户导入，不虚构实时报价。</p>
      </div>
      <div class="page-head-stats">
        <div><span>产品库</span><strong>{{ store.allProducts.length }}</strong></div>
        <div><span>硬件类别</span><strong>11</strong></div>
        <div><span>价格模式</span><strong>归档样本</strong></div>
      </div>
    </header>

    <div class="smart-layout">
      <aside class="build-form hud-panel">
        <div class="form-head">
          <div>
            <span class="panel-kicker">配置需求</span>
            <h2>配机需求</h2>
          </div>
          <SlidersHorizontal :size="16" />
        </div>

        <div class="form-scroll">
          <section class="form-section">
            <div class="form-label">
              <span>总预算</span>
              <em>CNY · 含税参考</em>
            </div>
            <div class="budget-field">
              <span>¥</span>
              <input v-model.number="store.request.budget" type="number" min="3000" max="60000" step="500" />
              <em>CNY</em>
            </div>
            <input
              v-model.number="store.request.budget"
              class="range-input"
              type="range"
              min="3000"
              max="50000"
              step="500"
              :style="{ '--fill': `${((store.request.budget - 3000) / 47000) * 100}%` }"
              aria-label="总预算"
            />
            <div class="budget-presets">
              <button v-for="value in [6000, 10000, 15000, 25000]" :key="value" type="button" :class="{ active: store.request.budget === value }" @click="store.request.budget = value">
                ¥{{ value / 1000 }}K
              </button>
            </div>
          </section>

          <section class="form-section">
            <div class="form-label">
              <span>使用场景</span>
              <em>{{ selectedScenario.desc }}</em>
            </div>
            <div class="scenario-grid">
              <button
                v-for="scenario in SCENARIOS"
                :key="scenario.id"
                type="button"
                class="scenario-btn"
                :class="{ 'scenario-btn--active': store.request.scenario === scenario.id }"
                @click="toggleScenario(scenario.id)"
              >
                <span class="scenario-icon">
                  <component :is="scenarioIcons[scenario.id]" :size="16" />
                </span>
                <span class="scenario-copy">
                  <strong>{{ scenario.label }}</strong>
                  <em>{{ scenario.en }}</em>
                </span>
                <Check v-if="store.request.scenario === scenario.id" :size="11" class="scenario-check" />
              </button>
            </div>
          </section>

          <section class="form-section">
            <div class="form-label">
              <span>{{ isGaming ? '性能目标' : '场景目标' }}</span>
              <em>{{ targetSummary }}</em>
            </div>
            <template v-if="isGaming">
              <div class="resolution-row">
                <button
                  v-for="resolution in RESOLUTIONS"
                  :key="resolution.id"
                  type="button"
                  :class="{ active: store.request.resolution === resolution.id }"
                  @click="store.request.resolution = resolution.id"
                >{{ resolution.label }}</button>
              </div>
              <div class="slider-line">
                <span>目标帧率</span>
                <input v-model.number="store.request.targetFps" type="range" min="60" max="240" step="30" class="range-input" :style="{ '--fill': `${((store.request.targetFps - 60) / 180) * 100}%` }" />
                <strong>{{ store.request.targetFps }} FPS</strong>
              </div>
            </template>
            <div v-else class="target-row">
              <button
                v-for="target in targetOptions"
                :key="target.id"
                type="button"
                class="target-btn"
                :class="{ active: store.request.workload === target.id }"
                @click="chooseTarget(target.id)"
              >
                <span>{{ target.label }}</span>
                <em>{{ target.hint }}</em>
              </button>
            </div>
            <div class="software-field">
              <label class="text-field">
                <span>{{ softwareHint.label }}</span>
                <input v-model="software" type="text" :placeholder="softwareHint.placeholder" />
              </label>
              <div class="software-presets">
                <button
                  v-for="example in softwareHint.examples"
                  :key="example"
                  type="button"
                  class="software-preset"
                  :class="{ 'software-preset--active': software === example }"
                  @click="pickSoftware(example)"
                >{{ example }}</button>
              </div>
            </div>
          </section>

          <section class="form-section">
            <div class="form-label">
              <span>品牌偏好</span>
              <em>加权而非硬过滤</em>
            </div>
            <div class="chip-wrap">
              <button v-for="brand in BRANDS.slice(0, 16)" :key="brand" type="button" class="chip" :class="{ 'chip--active': store.request.brands.includes(brand) }" @click="toggleBrand(brand)">
                {{ brand }}
              </button>
            </div>
          </section>

          <section class="form-section">
            <div class="form-label">
              <span>外观偏好</span>
              <em>影响机箱、内存与风扇加权</em>
            </div>
            <div class="aesthetic-row">
              <button v-for="item in AESTHETICS" :key="item.id" type="button" :class="{ active: store.request.aesthetic === item.id }" @click="store.request.aesthetic = item.id as Aesthetic">
                <i :style="{ background: item.swatch }"></i>{{ item.label }}
              </button>
            </div>
          </section>

          <section class="form-section form-section--switches">
            <label class="switch-row">
              <span><strong>接受二手配件</strong><em>部分 CPU / GPU 有二手参考价</em></span>
              <input v-model="store.request.allowUsed" type="checkbox" />
              <i></i>
            </label>
            <label class="switch-row">
              <span><strong>包含显示器与外设</strong><em>预留最高 2400 元 / 16%</em></span>
              <input v-model="store.request.includePeripherals" type="checkbox" />
              <i></i>
            </label>
          </section>
        </div>

        <div class="form-foot">
          <div class="form-foot__note">
            <Database :size="11" />
            <span>产品库 {{ store.allProducts.length }} 条 · 价格带来源与时间戳</span>
          </div>
          <button type="button" class="generate-btn" :disabled="building" @click="generate">
            <RefreshCw v-if="building" :size="16" class="spin" />
            <Sparkles v-else :size="16" />
            {{ building ? '正在求解配置…' : '生成智能配置' }}
            <span v-if="!building"><ArrowRight :size="15" /></span>
          </button>
        </div>
      </aside>

      <section class="results-panel hud-panel">
        <div class="results-head">
          <div>
            <span class="panel-kicker"><Gauge :size="11" /> 推荐结果</span>
            <h2>推荐配置</h2>
          </div>
          <div v-if="selectedBuild" class="results-actions">
            <button type="button" class="forge-btn" @click="downloadCsv"><Download :size="12" /> CSV</button>
            <button type="button" class="forge-btn" @click="downloadPdf"><Download :size="12" /> PDF</button>
            <button type="button" class="forge-btn" @click="saveBuild(selectedBuild)"><Save :size="12" /> 收藏</button>
            <button type="button" class="forge-btn forge-btn--primary" @click="loadBuild(selectedBuild)"><MonitorPlay :size="12" /> 载入 3D</button>
          </div>
        </div>

        <div v-if="building" class="solver-loading">
          <strong>正在求解兼容组合</strong>
          <p>枚举处理器与显卡组合，匹配主板、机箱、散热与电源，并检查预算与兼容性。</p>
          <div class="solver-progress"><i></i></div>
        </div>

        <div v-else-if="!store.smartResults.length" class="results-empty">
          <h3>等待生成配置</h3>
          <p>设置预算与场景后点击「生成智能配置」。系统会给出预算优先、均衡与性能三档方案。</p>
          <button type="button" class="forge-btn forge-btn--primary" @click="generate">立即生成</button>
        </div>

        <div v-else-if="selectedBuild" class="results-scroll">
          <div class="tier-tabs">
            <button
              v-for="build in store.smartResults"
              :key="build.id"
              type="button"
              class="tier-card"
              :class="{ 'tier-card--active': selectedBuild.id === build.id }"
              @click="selectedTier = build.tier"
            >
              <strong>{{ tierMeta[build.tier]?.label ?? build.title }}</strong>
              <em>{{ formatPrice(build.total) }}</em>
              <div class="tier-score">性能 {{ Math.round(build.performance.index) }} · 综合 {{ build.score.toFixed(0) }}</div>
            </button>
          </div>

          <div class="build-summary">
            <div class="summary-copy">
              <span class="summary-kicker">{{ tierMeta[selectedBuild.tier]?.label }} · {{ buildScenario.label }} · {{ buildTargetLabel }}</span>
              <h3>{{ selectedBuild.title }}</h3>
              <p>{{ selectedBuild.subtitle }}</p>
              <div class="summary-badges">
                <span class="summary-badge" :class="`summary-badge--${selectedBuild.compatibility.status}`">
                  <ShieldCheck :size="11" /> {{ compatLabel }}
                </span>
                <span class="summary-badge"><Zap :size="11" /> {{ selectedBuild.power.peak }}W 峰值</span>
                <span class="summary-badge"><Cpu :size="11" /> {{ selectedBuild.bottleneck }}</span>
              </div>
            </div>
            <div class="summary-price">
              <span>整机参考价</span>
              <strong>{{ formatPrice(selectedBuild.total) }}</strong>
              <em>区间 {{ formatPrice(range.min) }} – {{ formatPrice(range.max) }}</em>
              <div class="budget-track">
                <i :class="{ 'is-over': budgetFill > 100 }" :style="{ width: `${budgetFill}%` }"></i>
              </div>
              <div class="budget-line">
                <span>预算 {{ formatPrice(selectedBuild.budget) }}</span>
                <strong :class="budgetRemain < 0 ? 'over' : ''">
                  {{ budgetRemain >= 0 ? `剩余 ${formatPrice(budgetRemain)}` : `超出 ${formatPrice(Math.abs(budgetRemain))}` }}
                </strong>
              </div>
            </div>
          </div>

          <div class="metric-row">
            <div class="metric-card">
              <span>性能指数</span>
              <strong>{{ Math.round(selectedBuild.performance.index) }}</strong>
              <div class="metric-bars">
                <i :style="{ width: `${Math.round(selectedBuild.performance.gaming)}%` }"></i>
              </div>
              <em>游戏 {{ Math.round(selectedBuild.performance.gaming) }} · 生产力 {{ Math.round(selectedBuild.performance.productivity) }}</em>
            </div>
            <div class="metric-card">
              <span>整机功耗</span>
              <strong>{{ selectedBuild.power.peak }}<small>W</small></strong>
              <div class="metric-bars"><i :style="{ width: `${Math.min(100, (selectedBuild.power.peak / selectedBuild.power.recommendedPsu) * 100)}%` }"></i></div>
              <em>建议 {{ selectedBuild.power.recommendedPsu }}W · 余量 {{ selectedBuild.power.headroom }}W</em>
            </div>
            <div class="metric-card">
              <span>配置均衡</span>
              <strong>{{ Math.round(selectedBuild.performance.balance) }}</strong>
              <div class="metric-bars"><i :style="{ width: `${Math.round(selectedBuild.performance.balance)}%` }"></i></div>
              <em>处理器 / 显卡档位与内存容量综合</em>
            </div>
            <div class="metric-card">
              <span>价格覆盖</span>
              <strong>{{ Math.round(range.coverage * 100) }}<small>%</small></strong>
              <div class="metric-bars"><i :style="{ width: `${range.coverage * 100}%` }"></i></div>
              <em>有可靠参考价的组件占比</em>
            </div>
          </div>

          <div class="result-section">
            <div class="result-section-head">
              <h4><Cpu :size="13" /> 配置清单</h4>
              <span>{{ selectedBuild.lines.length }} 项 · 含风扇数量与外设预留</span>
            </div>
            <div class="line-table">
              <div class="line-row line-row--head">
                <span>类别</span><span>型号</span><span>参考价</span><span>成色</span><span>选择理由</span>
              </div>
              <div v-for="line in selectedBuild.lines" :key="`${line.category}-${line.model}`" class="line-row">
                <span class="line-cat">{{ line.category === 'peripheral' ? '外设' : categoryMeta(line.category).label }}</span>
                <span class="line-model">
                  <strong>{{ line.model }}</strong>
                  <em v-if="line.quantity">× {{ line.quantity }}</em>
                </span>
                <span class="line-price">{{ formatPrice(line.price) }}</span>
                <span class="line-cond">{{ line.condition === 'used' ? '二手' : line.condition === 'reserve' ? '预留' : '全新' }}</span>
                <span class="line-reason">{{ line.reason }}</span>
              </div>
            </div>
          </div>

          <!-- 1. 紧凑型整机健康与拓展诊断 (单卡片一体化，彻底根除留白与单项孤立) -->
          <div class="result-section system-health-section">
            <div class="result-section-head">
              <h4><ShieldCheck :size="13" /> 整机健康与拓展诊断</h4>
              <span :class="`compat-text--${selectedBuild.compatibility.status}`">{{ compatLabel }}</span>
            </div>

            <div class="health-card">
              <!-- 兼容性全项通过 / 异常列表 -->
              <div class="health-status-block">
                <div v-if="!selectedBuild.compatibility.issues.some((i) => i.level !== 'ok')" class="health-pass-row">
                  <div class="health-badge-pass">
                    <Check :size="14" />
                    <span>全项兼容通过</span>
                  </div>
                  <div class="health-check-chips">
                    <span class="check-chip">CPU 插槽匹配</span>
                    <span class="check-chip">内存代际兼容</span>
                    <span class="check-chip">显卡尺寸安全</span>
                    <span class="check-chip">电源供电充沛</span>
                    <span class="check-chip">主板接口就绪</span>
                  </div>
                </div>
                <div v-else class="issue-list">
                  <div v-for="issue in selectedBuild.compatibility.issues.filter((i) => i.level !== 'ok')" :key="issue.id" class="issue-row" :class="`issue-row--${issue.level}`">
                    <span class="issue-icon"><TriangleAlert :size="12" /></span>
                    <span><strong>{{ issue.title }}</strong>: {{ issue.detail }}</span>
                  </div>
                </div>
              </div>

              <!-- 扩展余量与生命周期规划 (紧凑自适应芯片流) -->
              <div v-if="selectedBuild.upgradePath.length" class="health-expand-block">
                <div class="expand-label">
                  <TrendingUp :size="12" />
                  <span>升级与扩展空间</span>
                </div>
                <div class="expand-chips-flow">
                  <div v-for="step in selectedBuild.upgradePath" :key="step" class="expand-chip-item">
                    <i class="chip-dot"></i>
                    <span>{{ step }}</span>
                  </div>
                </div>
              </div>

              <!-- 方案设计说明与取舍 (若有) -->
              <div v-if="selectedBuild.notes.length" class="health-notes-block">
                <div class="notes-label">
                  <Sparkles :size="12" />
                  <span>方案说明与建议</span>
                </div>
                <div class="notes-content">
                  <p v-for="note in selectedBuild.notes" :key="note">{{ note }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. 全对称同级硬件备选方案 (2 列等宽网格，自适应宽屏 4 列，100% 容器无溢出) -->
          <div class="result-section alternatives-section">
            <div class="result-section-head">
              <h4><Banknote :size="13" /> 同级硬件备选方案</h4>
              <span>同类别已通过兼容性校验 · 点击可切换至该硬件</span>
            </div>
            <div class="alt-matrix-grid">
              <div v-for="cat in (['cpu', 'gpu', 'motherboard', 'memory', 'ssd', 'psu', 'cooler', 'case'] as const)" :key="cat" class="alt-matrix-card">
                <div class="alt-card-head">
                  <span class="alt-cat-badge">{{ categoryMeta(cat).label }}</span>
                  <span class="alt-cat-count">{{ selectedBuild.alternatives[cat]?.length ?? 0 }} 款可选</span>
                </div>
                <div class="alt-card-body">
                  <button
                    v-for="alt in selectedBuild.alternatives[cat] ?? []"
                    :key="alt.id"
                    type="button"
                    class="alt-matrix-row"
                    @click="store.inspectProduct(alt.id)"
                  >
                    <span class="alt-model-name" :title="alt.label">{{ alt.label }}</span>
                    <em :class="alt.delta < 0 ? 'delta-down' : 'delta-up'">{{ alt.delta === 0 ? '同价' : `${alt.delta > 0 ? '+' : ''}¥${alt.delta}` }}</em>
                    <ChevronRight :size="12" />
                  </button>
                  <div v-if="!selectedBuild.alternatives[cat]?.length" class="alt-empty-hint">
                    <span>当前预算下已为最优解</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
