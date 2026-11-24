import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type {
  AppTab,
  BuildMetrics,
  BuildRequest,
  BuildSelection,
  CameraReadout,
  Category,
  CompatibilityReport,
  CustomizationMap,
  PartCustomization,
  PriceSnapshot,
  Product,
  RecommendedBuild,
  SavedBuild,
  ViewMode,
} from '../types'
import { SEED_PRODUCTS } from '../data/catalog'
import { ALL_CATEGORIES, CORE_CATEGORIES, categoryMeta, scenarioMeta } from '../data/meta'
import { DEFAULT_QUANTITIES, DEFAULT_REQUEST, DEFAULT_SELECTION, ASSEMBLY_STEPS } from '../data/defaults'
import { evaluateCompatibility } from '../services/compatibility'
import { REAL_DIY_STEPS, REAL_DIY_ORDER, getVisibleCategoriesForStep, type RealDiyStep } from '../services/realDiyAssembly'
import { computeMetrics } from '../services/metrics'
import { selectionTotal } from '../services/pricing'
import { recommendBuilds } from '../services/recommender'
import { useToastStore } from './toast'
import { CATEGORY_SCENE_ID } from '../three/partRegistry'
import { makeCustomization, randomCustomization } from '../services/customization'

const STORAGE_KEY = 'pcforge.state.v2'

interface PersistedState {
  selection: BuildSelection
  quantities: Record<string, number>
  savedBuilds: SavedBuild[]
  customProducts: Product[]
  request: BuildRequest
  compareIds: string[]
  activeTab: AppTab
  customizations: CustomizationMap
}

function readPersisted(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cloneSelection(selection: BuildSelection): BuildSelection {
  return { ...selection }
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value))
}

export const useBuildStore = defineStore('build', () => {
  const toast = useToastStore()
  const persisted = readPersisted()

  const seedProducts = ref<Product[]>(SEED_PRODUCTS.map((p) => ({ ...p, attrs: { ...p.attrs }, specs: { ...p.specs }, price: p.price ? { ...p.price } : null })))
  const customProducts = ref<Product[]>(Array.isArray(persisted.customProducts) ? persisted.customProducts : [])
  const allProducts = computed(() => [...seedProducts.value, ...customProducts.value])
  const byId = computed(() => new Map(allProducts.value.map((p) => [p.id, p])))

  const initialProducts = new Map(allProducts.value.map((p) => [p.id, p]))
  const initialSelection: BuildSelection = { ...DEFAULT_SELECTION }
  if (persisted.selection) {
    for (const category of ALL_CATEGORIES) {
      const value = persisted.selection[category]
      if (value === null) initialSelection[category] = null
      else if (typeof value === 'string' && initialProducts.has(value)) initialSelection[category] = value
    }
  }

  const selection = ref<BuildSelection>(initialSelection)
  const quantities = ref<Record<string, number>>({ ...DEFAULT_QUANTITIES, ...(persisted.quantities ?? {}) })
  const savedBuilds = ref<SavedBuild[]>(Array.isArray(persisted.savedBuilds) ? persisted.savedBuilds : [])
  const compareIds = ref<string[]>(Array.isArray(persisted.compareIds) ? persisted.compareIds.slice(0, 3) : [])
  const request = ref<BuildRequest>({ ...DEFAULT_REQUEST, ...(persisted.request ?? {}) })
  const activeTab = ref<AppTab>(persisted.activeTab ?? 'assembly')
  const customizations = ref<CustomizationMap>(persisted.customizations && typeof persisted.customizations === 'object' ? persisted.customizations : {})

  const inspectedId = ref<string | null>(selection.value.gpu ?? selection.value.cpu ?? null)
  const viewMode = ref<ViewMode>('assembled')
  const explode = ref(0)
  const autoRotate = ref(true)
  const caseTint = ref<string | null>(null)
  const timelinePlaying = ref(false)
  const hiddenIds = ref<string[]>([])
  const isolatedId = ref<string | null>(null)
  const detachedIds = ref<Category[]>([])
  const focusTarget = ref<string | null>(null)
  const focusNonce = ref(0)
  const resetCameraNonce = ref(0)
  const camera = ref<CameraReadout>({ azimuth: 0, elevation: 0, distance: 0 })
  const fps = ref(60)
  const sceneReady = ref(false)
  const partPreview = ref<{ category: Category; url: string } | null>(null)
  const previewRequest = ref<{ category: Category; nonce: number } | null>(null)
  const assemblyDemoNonce = ref(0)
  const installFxCategory = ref<Category | null>(null)
  const installFxNonce = ref(0)
  const guideMode = ref<'tutorial' | 'capability' | null>(null)
  const tutorialStep = ref(0)
  const tutorialVisible = ref<Category[] | null>(null)
  const diyMode = ref(false)
  const diyStep = ref(1)
  const diyPlaying = ref(false)
  let diyTimer: number | null = null
  const lightingPreset = ref<'bright' | 'studio' | 'night'>('bright')
  const powerOn = ref(false)
  const debugMode = ref(false)
  const leftPanelOpen = ref(true)
  const inspectorOpen = ref(true)
  const globalQuery = ref('')
  const smartResults = ref<RecommendedBuild[]>([])
  const smartRunning = ref(false)
  const savedSmartId = ref<string | null>(null)
  let playTimer: number | null = null

  const installedProducts = computed<Product[]>(() =>
    ALL_CATEGORIES.map((category) => {
      const id = selection.value[category]
      return id ? byId.value.get(id) : undefined
    }).filter((p): p is Product => Boolean(p)),
  )

  const inspectedProduct = computed<Product | null>(() => (inspectedId.value ? byId.value.get(inspectedId.value) ?? null : null))

  const compatibility = computed<CompatibilityReport>(() =>
    evaluateCompatibility(selection.value, byId.value, quantities.value),
  )

  const metrics = computed<BuildMetrics>(() =>
    computeMetrics(selection.value, byId.value, quantities.value, request.value.allowUsed),
  )

  const total = computed(() => selectionTotal(selection.value, byId.value, quantities.value, request.value.allowUsed))
  const installedCount = computed(() => installedProducts.value.length)
  const detachedCount = computed(() => detachedIds.value.length)
  const selectedCoreCount = computed(() => CORE_CATEGORIES.filter((c) => Boolean(selection.value[c])).length)
  const priceCoverage = computed(() => metrics.value.priceCoverage)
  const scenario = computed(() => scenarioMeta(request.value.scenario))
  const comparedBuilds = computed(() =>
    compareIds.value.map((id) => savedBuilds.value.find((b) => b.id === id)).filter((b): b is SavedBuild => Boolean(b)),
  )
  const activeSavedBuild = computed(() => savedBuilds.value.find((b) => b.id === savedSmartId.value) ?? null)

  const customizedCount = computed(() => Object.keys(customizations.value).length)

  const currentDiyStepInfo = computed<RealDiyStep>(() => {
    return REAL_DIY_STEPS.find((s) => s.step === diyStep.value) ?? REAL_DIY_STEPS[0]
  })
  const currentDiyProduct = computed<Product | null>(() => {
    const cat = currentDiyStepInfo.value.category
    const id = selection.value[cat]
    return id ? byId.value.get(id) ?? null : null
  })
  const isCurrentDiyInstalled = computed<boolean>(() => {
    return Boolean(currentDiyProduct.value)
  })

  function productFor(category: Category): Product | undefined {
    const id = selection.value[category]
    return id ? byId.value.get(id) : undefined
  }

  function customizationFor(category: Category): PartCustomization {
    const product = productFor(category)
    return customizations.value[category] ?? makeCustomization(category, product)
  }

  function updateCustomization(category: Category, patch: Partial<PartCustomization>) {
    const current = customizationFor(category)
    customizations.value = {
      ...customizations.value,
      [category]: makeCustomization(category, productFor(category), { ...current, ...patch }),
    }
  }

  function resetCustomization(category: Category) {
    if (!customizations.value[category]) return
    const next = { ...customizations.value }
    delete next[category]
    customizations.value = next
    toast.info('已恢复原厂材质', `${categoryMeta(category).label} 的自定义图层已移除`)
  }

  function randomizeCustomization(category: Category) {
    customizations.value = {
      ...customizations.value,
      [category]: randomCustomization(category, productFor(category)),
    }
    toast.success('已生成专属图案', '配色、纹理、表面处理与指纹已重新计算')
  }

  function syncCustomizationToAll(source: Category) {
    const template = customizationFor(source)
    const next = { ...customizations.value }
    for (const product of installedProducts.value) {
      next[product.category] = makeCustomization(product.category, product, {
        pattern: template.pattern,
        primary: template.primary,
        accent: template.accent,
        finish: template.finish,
        intensity: template.intensity,
        engraving: template.engraving,
      })
    }
    customizations.value = next
    toast.success('全机主题已同步', `${installedProducts.value.length} 个部件已写入同一套视觉语言，指纹按部件分别生成`)
  }

  function randomizeAllCustomizations() {
    const next = { ...customizations.value }
    for (const product of installedProducts.value) {
      next[product.category] = randomCustomization(product.category, product)
    }
    customizations.value = next
    toast.success('全机随机主题已生成', `${installedProducts.value.length} 个部件获得独立纹理与指纹`)
  }

  function resetAllCustomizations() {
    const count = Object.keys(customizations.value).length
    if (!count) {
      toast.info('没有可复原的定制', '当前配置仍保持原厂材质')
      return
    }
    customizations.value = {}
    toast.info('已复原全部原厂材质', `${count} 个部件的专属图层与指纹已移除`)
  }

  function savePersisted() {
    try {
      const state: PersistedState = {
        selection: selection.value,
        quantities: quantities.value,
        savedBuilds: savedBuilds.value,
        customProducts: customProducts.value,
        request: request.value,
        compareIds: compareIds.value,
        activeTab: activeTab.value,
        customizations: customizations.value,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      if (typeof window !== 'undefined' && window.electronAPI?.storage) {
        window.electronAPI.storage.write('user_builds_state.json', JSON.stringify(state, null, 2)).catch(() => {})
      }
    } catch {
      // Storage can be unavailable in private mode; the app keeps working in memory.
    }
  }

  watch(
    [selection, quantities, savedBuilds, customProducts, request, compareIds, activeTab, customizations],
    savePersisted,
    { deep: true },
  )

  watch(
    selection,
    () => {
      const next = { ...customizations.value }
      let changed = false
      for (const category of Object.keys(next) as Category[]) {
        const current = next[category]
        const product = productFor(category)
        if (!current || !product) continue
        const refreshed = makeCustomization(category, product, current)
        if (refreshed.signature !== current.signature) {
          next[category] = refreshed
          changed = true
        }
      }
      if (changed) customizations.value = next
    },
    { deep: true },
  )

  function setTab(tab: AppTab) {
    activeTab.value = tab
    if (tab === 'assembly') {
      pauseTimeline()
      viewMode.value = 'assembled'
      explode.value = 0
    } else if (tab === 'teardown') {
      pauseTimeline()
      viewMode.value = 'exploded'
      explode.value = Math.max(explode.value, 0.72)
    }
  }

  function setViewMode(mode: ViewMode) {
    viewMode.value = mode
    if (mode === 'assembled') {
      explode.value = 0
    } else if (mode === 'exploded') {
      explode.value = Math.max(explode.value, 0.92)
    } else if (mode === 'section') {
      explode.value = 0
    } else if (mode === 'xray') {
      explode.value = Math.max(explode.value, 0.16)
    }
  }

  function setExplode(value: number) {
    explode.value = clamp(value)
    if (explode.value > 0.02) viewMode.value = 'exploded'
    else if (viewMode.value === 'exploded') viewMode.value = 'assembled'
  }

  function pauseTimeline() {
    timelinePlaying.value = false
    if (playTimer != null) {
      window.clearInterval(playTimer)
      playTimer = null
    }
  }

  function playTimeline() {
    if (timelinePlaying.value) return
    if (explode.value >= 0.995) explode.value = 0
    timelinePlaying.value = true
    playTimer = window.setInterval(() => {
      const next = explode.value + 0.0045
      setExplode(next)
      if (next >= 1) pauseTimeline()
    }, 45)
  }

  function toggleTimeline() {
    if (timelinePlaying.value) pauseTimeline()
    else playTimeline()
  }

  function setTimeline(value: number) {
    pauseTimeline()
    setExplode(value)
  }

  function stepTimeline(direction: 1 | -1) {
    pauseTimeline()
    const steps = ASSEMBLY_STEPS.map((s) => s.at)
    const current = explode.value
    const target =
      direction > 0
        ? steps.find((s) => s > current + 0.001) ?? 1
        : [...steps].reverse().find((s) => s < current - 0.001) ?? 0
    setExplode(target)
  }

  function resetAssembly() {
    pauseTimeline()
    viewMode.value = 'assembled'
    explode.value = 0
    hiddenIds.value = []
    isolatedId.value = null
    detachedIds.value = []
  }

  function installProduct(product: Product) {
    const before = compatibility.value.status
    const previousId = selection.value[product.category]
    const nextSelection = { ...selection.value, [product.category]: product.id }
    const nextReport = evaluateCompatibility(nextSelection, byId.value, quantities.value)
    // 只有“这件配件自己”造成的硬性冲突才拒绝安装，避免把已存在的其它冲突算到它头上。
    const ownErrors = nextReport.errors.filter((issue) => issue.categories.includes(product.category))
    if (ownErrors.length) {
      inspectedId.value = product.id
      const previousName = previousId ? byId.value.get(previousId) : undefined
      toast.error(
        '这个配件装不上：硬件不兼容',
        `${product.brand} ${product.model} — ${ownErrors[0].title}。${
          previousName ? `已保留原来的${categoryMeta(product.category).label}。` : '换一个同类别型号试试。'
        }`,
      )
      return
    }
    selection.value = nextSelection
    if (product.category === 'fan' && !quantities.value.fan) quantities.value.fan = 3
    inspectedId.value = product.id
    installFxCategory.value = product.category
    installFxNonce.value += 1
    if (diyMode.value) {
      tutorialVisible.value = getVisibleCategoriesForStep(diyStep.value)
      if (product.category === currentDiyStepInfo.value.category) {
        toast.success(`[第 ${diyStep.value}/10 步装配就绪]`, `${product.brand} ${product.model}`)
        return
      }
    }
    const report = compatibility.value
    if (report.status === 'blocked') {
      toast.error('组件已装入，但存在硬性冲突', report.errors[0]?.title ?? '请检查兼容性报告')
    } else if (before !== report.status && report.status === 'caution') {
      toast.warning('组件已装入，存在风险项', report.warnings[0]?.title ?? '')
    } else {
      toast.success('组件已装入', `${product.brand} ${product.model}`)
    }
  }

  function removeProduct(category: Category) {
    const product = selection.value[category] ? byId.value.get(selection.value[category] as string) : undefined
    selection.value = { ...selection.value, [category]: null }
    if (category === 'fan') quantities.value.fan = 0
    if (inspectedId.value && product?.id === inspectedId.value) inspectedId.value = selection.value.gpu ?? selection.value.cpu ?? null
    toast.info('已移除组件', product ? `${product.brand} ${product.model}` : categoryMeta(category).label)
  }

  function clearSelection() {
    selection.value = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, null])) as BuildSelection
    inspectedId.value = null
    toast.info('已清空当前配置')
  }

  function resetToDefault() {
    selection.value = { ...DEFAULT_SELECTION }
    quantities.value = { ...DEFAULT_QUANTITIES }
    inspectedId.value = DEFAULT_SELECTION.gpu ?? null
    resetAssembly()
    toast.info('已恢复默认配置')
  }

  function toggleCategoryVisibility(category: Category) {
    const id = CATEGORY_SCENE_ID[category]
    if (hiddenIds.value.includes(id)) {
      hiddenIds.value = hiddenIds.value.filter((x) => x !== id)
    } else {
      hiddenIds.value = [...hiddenIds.value, id]
    }
  }

  function hidePart(id: string) {
    if (!hiddenIds.value.includes(id)) hiddenIds.value = [...hiddenIds.value, id]
  }

  function showPart(id: string) {
    hiddenIds.value = hiddenIds.value.filter((x) => x !== id)
  }

  function showAllParts() {
    hiddenIds.value = []
    isolatedId.value = null
    detachedIds.value = []
  }

  function isolatePart(id: string) {
    isolatedId.value = id
    hiddenIds.value = hiddenIds.value.filter((x) => x !== id)
  }

  function toggleDetach(category: Category) {
    if (detachedIds.value.includes(category)) {
      detachedIds.value = detachedIds.value.filter((x) => x !== category)
    } else {
      detachedIds.value = [...detachedIds.value, category]
      hiddenIds.value = hiddenIds.value.filter((id) => id !== CATEGORY_SCENE_ID[category])
    }
  }

  function focusPart(id: string) {
    focusTarget.value = id
    focusNonce.value += 1
  }

  function inspectProduct(id: string | null) {
    inspectedId.value = id
    const product = id ? byId.value.get(id) : undefined
    if (product) requestPartPreview(product.category)
  }

  function requestPartPreview(category: Category) {
    previewRequest.value = { category, nonce: (previewRequest.value?.nonce ?? 0) + 1 }
  }

  function setPartPreview(category: Category, url: string) {
    partPreview.value = { category, url }
  }

  function playAssemblyDemo() {
    tutorialVisible.value = null
    explode.value = 0
    timelinePlaying.value = false
    autoRotate.value = false
    viewMode.value = 'assembled'
    assemblyDemoNonce.value += 1
  }

  function openGuide(mode: 'tutorial' | 'capability') {
    if (mode === 'tutorial') {
      guideMode.value = null
      startDiyAssembly()
      return
    }
    guideMode.value = mode
    tutorialVisible.value = null
  }

  function closeGuide() {
    guideMode.value = null
    tutorialVisible.value = null
  }

  function setTutorialStep(index: number) {
    tutorialStep.value = Math.max(0, index)
  }

  function setTutorialVisible(categories: Category[] | null) {
    tutorialVisible.value = categories ? [...categories] : null
  }

  function animatePart(category: Category) {
    installFxCategory.value = category
    installFxNonce.value += 1
  }

  function finishTutorial() {
    playAssemblyDemo()
    guideMode.value = 'capability'
  }

  function setLightingPreset(preset: 'bright' | 'studio' | 'night') {
    lightingPreset.value = preset
  }

  function togglePowerOn() {
    powerOn.value = !powerOn.value
    toast.info(powerOn.value ? '已通电' : '已断电', powerOn.value ? '风扇与灯效开始运行' : '灯光与风扇停止')
  }

  function toggleDebugMode() {
    debugMode.value = !debugMode.value
  }

  function toggleLeftPanel() {
    leftPanelOpen.value = !leftPanelOpen.value
  }

  function toggleInspector() {
    inspectorOpen.value = !inspectorOpen.value
  }

  function startDiyAssembly() {
    diyMode.value = true
    diyStep.value = 1
    viewMode.value = 'assembled'
    explode.value = 0
    autoRotate.value = false
    timelinePlaying.value = false
    tutorialVisible.value = getVisibleCategoriesForStep(1)
    const firstCat = REAL_DIY_STEPS[0].category
    if (selection.value[firstCat]) {
      inspectedId.value = selection.value[firstCat]
      installFxCategory.value = firstCat
      installFxNonce.value += 1
    }
    toast.info('已开启真实自主装机模式', '第 1 步：准备主板平台')
  }

  function setDiyStep(step: number) {
    if (step < 1 || step > REAL_DIY_STEPS.length) return
    diyStep.value = step
    tutorialVisible.value = getVisibleCategoriesForStep(step)
    const cat = REAL_DIY_STEPS[step - 1].category
    if (selection.value[cat]) {
      inspectedId.value = selection.value[cat]
      installFxCategory.value = cat
      installFxNonce.value += 1
    }
  }

  function nextDiyStep() {
    if (diyStep.value < REAL_DIY_STEPS.length) {
      setDiyStep(diyStep.value + 1)
      const nextInfo = REAL_DIY_STEPS[diyStep.value - 1]
      toast.info(`进入第 ${diyStep.value} 步`, nextInfo.title)
    } else {
      toast.success('🎉 自主装机全流程完成！', '所有核心配件安装就绪，整机点亮成功！')
      exitDiyAssembly()
    }
  }

  function prevDiyStep() {
    if (diyStep.value > 1) {
      setDiyStep(diyStep.value - 1)
    }
  }

  function exitDiyAssembly() {
    diyMode.value = false
    if (diyTimer) {
      clearInterval(diyTimer)
      diyTimer = null
    }
    diyPlaying.value = false
    tutorialVisible.value = null
    toast.info('已退出自主装机模式', '恢复完整视角')
  }

  function playDiyAutoSequence() {
    if (diyPlaying.value) {
      if (diyTimer) {
        clearInterval(diyTimer)
        diyTimer = null
      }
      diyPlaying.value = false
      return
    }
    diyPlaying.value = true
    setDiyStep(1)
    diyTimer = window.setInterval(() => {
      if (diyStep.value >= REAL_DIY_STEPS.length) {
        if (diyTimer) {
          clearInterval(diyTimer)
          diyTimer = null
        }
        diyPlaying.value = false
        toast.success('🎉 全流程真实装机演练完成！')
        return
      }
      setDiyStep(diyStep.value + 1)
    }, 2200)
  }

  function resetCamera() {
    resetCameraNonce.value += 1
  }

  function setCamera(readout: CameraReadout) {
    camera.value = readout
  }

  function setFps(value: number) {
    fps.value = value
  }

  function saveBuild(name: string, note = '', source: SavedBuild['source'] = 'manual'): SavedBuild | null {
    if (compatibility.value.status === 'blocked') {
      toast.error('无法保存不可行配置', compatibility.value.errors[0]?.detail ?? '请先解决硬性冲突')
      return null
    }
    const now = new Date().toISOString()
    const entry: SavedBuild = {
      id: makeId('build'),
      name: name.trim() || `配置方案 ${savedBuilds.value.length + 1}`,
      note: note.trim(),
      createdAt: now,
      updatedAt: now,
      selection: cloneSelection(selection.value),
      quantities: { ...quantities.value },
      total: metrics.value.total,
      performance: Math.round(metrics.value.performance.index),
      power: metrics.value.power.peak,
      compatibility: compatibility.value.status,
      source,
    }
    savedBuilds.value = [entry, ...savedBuilds.value]
    toast.success('配置方案已保存', entry.name)
    return entry
  }

  function saveRecommendedBuild(build: RecommendedBuild): SavedBuild {
    const now = new Date().toISOString()
    const entry: SavedBuild = {
      id: makeId('build'),
      name: build.title,
      note: `${build.subtitle} · ${build.total.toLocaleString('zh-CN')} 元`,
      createdAt: now,
      updatedAt: now,
      selection: { ...build.selection },
      quantities: { ...build.quantities },
      total: build.total,
      performance: Math.round(build.performance.index),
      power: build.power.peak,
      compatibility: build.compatibility.status,
      source: 'smart',
    }
    savedBuilds.value = [entry, ...savedBuilds.value]
    toast.success('智能方案已加入配置库', build.title)
    return entry
  }

  function loadSavedBuild(id: string) {
    const entry = savedBuilds.value.find((b) => b.id === id)
    if (!entry) return
    selection.value = cloneSelection(entry.selection)
    quantities.value = { ...entry.quantities }
    inspectedId.value = entry.selection.gpu ?? entry.selection.cpu ?? null
    activeTab.value = 'assembly'
    resetAssembly()
    toast.success('已载入配置方案', entry.name)
  }

  function deleteSavedBuild(id: string) {
    savedBuilds.value = savedBuilds.value.filter((b) => b.id !== id)
    compareIds.value = compareIds.value.filter((x) => x !== id)
    if (savedSmartId.value === id) savedSmartId.value = null
    toast.info('配置方案已删除')
  }

  function duplicateSavedBuild(id: string) {
    const entry = savedBuilds.value.find((b) => b.id === id)
    if (!entry) return
    const now = new Date().toISOString()
    const copy: SavedBuild = {
      ...entry,
      id: makeId('build'),
      name: `${entry.name} 副本`,
      createdAt: now,
      updatedAt: now,
      selection: { ...entry.selection },
      quantities: { ...entry.quantities },
    }
    savedBuilds.value = [copy, ...savedBuilds.value]
    toast.success('已复制配置方案', copy.name)
  }

  function renameSavedBuild(id: string, name: string, note?: string) {
    const entry = savedBuilds.value.find((b) => b.id === id)
    if (!entry) return
    entry.name = name.trim() || entry.name
    if (note !== undefined) entry.note = note
    entry.updatedAt = new Date().toISOString()
    toast.success('方案信息已更新')
  }

  function toggleCompare(id: string) {
    if (compareIds.value.includes(id)) {
      compareIds.value = compareIds.value.filter((x) => x !== id)
      return
    }
    if (compareIds.value.length >= 3) {
      toast.warning('最多比较三套方案', '请先移除一套已选方案')
      return
    }
    compareIds.value = [...compareIds.value, id]
  }

  function clearCompare() {
    compareIds.value = []
  }

  function addCustomProduct(product: Product) {
    if (byId.value.has(product.id)) {
      toast.warning('产品 ID 已存在', product.id)
      return false
    }
    customProducts.value = [...customProducts.value, product]
    toast.success('自定义配件已加入产品库', product.model)
    return true
  }

  function importProducts(incoming: Product[]): { added: number; updated: number } {
    let added = 0
    let updated = 0
    const custom = [...customProducts.value]
    const seeds = seedProducts.value.map((p) => ({ ...p }))
    const seedIndex = new Map(seeds.map((p, i) => [p.id, i]))
    const customIndex = new Map(custom.map((p, i) => [p.id, i]))
    for (const product of incoming) {
      if (!product?.id || !product.category) continue
      if (seedIndex.has(product.id)) {
        const index = seedIndex.get(product.id) as number
        seeds[index] = { ...seeds[index], ...product }
        updated += 1
      } else if (customIndex.has(product.id)) {
        const index = customIndex.get(product.id) as number
        custom[index] = { ...custom[index], ...product }
        updated += 1
      } else {
        custom.push(product)
        added += 1
      }
    }
    seedProducts.value = seeds
    customProducts.value = custom
    toast.success('产品数据已导入', `新增 ${added} 条，更新 ${updated} 条`)
    return { added, updated }
  }

  function applyPriceSnapshot(productId: string, snapshot: PriceSnapshot) {
    const seedIndex = seedProducts.value.findIndex((p) => p.id === productId)
    if (seedIndex >= 0) {
      const copy = [...seedProducts.value]
      copy[seedIndex] = { ...copy[seedIndex], price: snapshot }
      seedProducts.value = copy
    }
    const customIndex = customProducts.value.findIndex((p) => p.id === productId)
    if (customIndex >= 0) {
      const copy = [...customProducts.value]
      copy[customIndex] = { ...copy[customIndex], price: snapshot }
      customProducts.value = copy
    }
    toast.success('价格已更新', byId.value.get(productId)?.model ?? productId)
  }

  function runSmartBuild() {
    smartRunning.value = true
    try {
      const results = recommendBuilds(request.value, allProducts.value)
      smartResults.value = results
      if (results.length) {
        toast.success('已生成智能配置', `${results.length} 套方案 · 预算 ${request.value.budget.toLocaleString('zh-CN')} 元`)
      } else {
        toast.error('无法生成可行配置', '请提高预算或放宽二手/外设条件')
      }
      return results
    } finally {
      smartRunning.value = false
    }
  }

  function applyRecommended(build: RecommendedBuild) {
    selection.value = { ...build.selection }
    quantities.value = { ...build.quantities }
    request.value = { ...build.request }
    inspectedId.value = build.selection.gpu ?? build.selection.cpu ?? null
    activeTab.value = 'assembly'
    resetAssembly()
    toast.success('方案已载入 3D 装配实验室', build.title)
  }

  function clearSmartResults() {
    smartResults.value = []
  }

  return {
    allProducts,
    byId,
    customProducts,
    selection,
    quantities,
    savedBuilds,
    compareIds,
    comparedBuilds,
    request,
    activeTab,
    inspectedId,
    inspectedProduct,
    installedProducts,
    installedCount,
    detachedCount,
    selectedCoreCount,
    compatibility,
    metrics,
    total,
    priceCoverage,
    scenario,
    viewMode,
    explode,
    autoRotate,
    caseTint,
    timelinePlaying,
    hiddenIds,
    isolatedId,
    detachedIds,
    focusTarget,
    focusNonce,
    resetCameraNonce,
    camera,
    fps,
    sceneReady,
    partPreview,
    previewRequest,
    assemblyDemoNonce,
    installFxCategory,
    installFxNonce,
    guideMode,
    tutorialStep,
    tutorialVisible,
    diyMode,
    diyStep,
    diyPlaying,
    currentDiyStepInfo,
    currentDiyProduct,
    isCurrentDiyInstalled,
    lightingPreset,
    powerOn,
    debugMode,
    leftPanelOpen,
    inspectorOpen,
    globalQuery,
    smartResults,
    smartRunning,
    savedSmartId,
    activeSavedBuild,
    customizations,
    customizedCount,
    customizationFor,
    updateCustomization,
    resetCustomization,
    randomizeCustomization,
    syncCustomizationToAll,
    randomizeAllCustomizations,
    resetAllCustomizations,
    setTab,
    setViewMode,
    setExplode,
    playTimeline,
    pauseTimeline,
    toggleTimeline,
    setTimeline,
    stepTimeline,
    resetAssembly,
    installProduct,
    removeProduct,
    clearSelection,
    resetToDefault,
    toggleCategoryVisibility,
    hidePart,
    showPart,
    showAllParts,
    isolatePart,
    toggleDetach,
    focusPart,
    inspectProduct,
    requestPartPreview,
    setPartPreview,
    playAssemblyDemo,
    openGuide,
    closeGuide,
    setTutorialStep,
    setTutorialVisible,
    animatePart,
    finishTutorial,
    setLightingPreset,
    togglePowerOn,
    toggleDebugMode,
    toggleLeftPanel,
    toggleInspector,
    startDiyAssembly,
    setDiyStep,
    nextDiyStep,
    prevDiyStep,
    exitDiyAssembly,
    playDiyAutoSequence,
    resetCamera,
    setCamera,
    setFps,
    saveBuild,
    saveRecommendedBuild,
    loadSavedBuild,
    deleteSavedBuild,
    duplicateSavedBuild,
    renameSavedBuild,
    toggleCompare,
    clearCompare,
    addCustomProduct,
    importProducts,
    applyPriceSnapshot,
    runSmartBuild,
    applyRecommended,
    clearSmartResults,
  }
})
