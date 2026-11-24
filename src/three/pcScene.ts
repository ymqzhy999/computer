import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import type { BuildSelection, Category, CustomizationMap, PartCustomization, Product, ViewMode } from '../types'
import { categoryForSceneId } from './partRegistry'
import { caseFrontStyle, type CaseFront } from '../services/caseStyle'

interface SceneCallbacks {
  onSelect?: (category: Category | null) => void
  onFps?: (fps: number) => void
  onCamera?: (readout: { azimuth: number; elevation: number; distance: number }) => void
  onReady?: () => void
}

interface MaterialLibrary {
  panel: THREE.MeshStandardMaterial
  panelLight: THREE.MeshStandardMaterial
  frame: THREE.MeshStandardMaterial
  dark: THREE.MeshStandardMaterial
  metal: THREE.MeshStandardMaterial
  brushed: THREE.MeshStandardMaterial
  pcb: THREE.MeshStandardMaterial
  pcbGreen: THREE.MeshStandardMaterial
  copper: THREE.MeshStandardMaterial
  gold: THREE.MeshStandardMaterial
  plastic: THREE.MeshStandardMaterial
  rubber: THREE.MeshStandardMaterial
  glass: THREE.MeshPhysicalMaterial
  cyan: THREE.MeshStandardMaterial
  orange: THREE.MeshStandardMaterial
  white: THREE.MeshStandardMaterial
  label: THREE.MeshStandardMaterial
  fanBlade: THREE.MeshStandardMaterial
  fanBladeRgb: THREE.MeshStandardMaterial
  [key: string]: THREE.Material
}

const CASE = {
  width: 28,
  height: 46,
  depth: 46,
  floor: 3,
}

export interface CaseTintPreset {
  name: string
  color: number
  metalness?: number
  roughness?: number
}

interface CustomAnchor {
  position: [number, number, number]
  rotation: [number, number, number]
  width: number
  height: number
  surface: string
}

const CUSTOM_ANCHORS: Partial<Record<Category, CustomAnchor>> = {
  case: { position: [14.02, 26, 0], rotation: [0, Math.PI / 2, 0], width: 44.2, height: 44.2, surface: '钢化玻璃侧板' },
  motherboard: { position: [-9.22, 27.8, -1.5], rotation: [0, Math.PI / 2, 0], width: 22.5, height: 28.5, surface: '主板屏蔽层' },
  gpu: { position: [4.2, 30.42, 1.2], rotation: [-Math.PI / 2, 0, 0], width: 22, height: 3.8, surface: '显卡上沿' },
  cpu: { position: [-8.32, 31.45, -4], rotation: [0, Math.PI / 2, 0], width: 4.4, height: 4.4, surface: '处理器顶盖' },
  cooler: { position: [-2.8, 46.55, 0], rotation: [-Math.PI / 2, 0, -Math.PI / 2], width: 39.6, height: 11.4, surface: '散热器顶盖' },
  memory: { position: [-8.2, 33.5, 4.7], rotation: [0, Math.PI / 2, 0], width: 12, height: 4, surface: '内存马甲' },
  psu: { position: [-6.4, 8.3, -3.96], rotation: [0, 0, 0], width: 14, height: 7, surface: '电源外壳' },
  ssd: { position: [-8.54, 18.45, 5.8], rotation: [0, Math.PI / 2, 0], width: 8, height: 3, surface: '固态硬盘马甲' },
  hdd: { position: [13.15, 12.4, 12], rotation: [0, Math.PI / 2, 0], width: 10, height: 5.5, surface: '机械硬盘外壳' },
  fan: { position: [0, 27.4, 22.54], rotation: [0, 0, 0], width: 11, height: 11, surface: '前置风扇框' },
  expansion: { position: [-8.66, 17.2, 9.2], rotation: [0, Math.PI / 2, 0], width: 10, height: 7, surface: '扩展卡外壳' },
}

function seededRandom(seed: number): () => number {
  let value = seed || 1
  return () => {
    value |= 0
    value = (value + 0x6d2b79f5) | 0
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function accent(product: Product | undefined, fallback = 0x44dcff): number {
  const value = product?.visual?.accent
  if (!value) return fallback
  return new THREE.Color(value).getHex()
}

function isWhite(product: Product | undefined): boolean {
  return /white|白/i.test(`${product?.attrs.color ?? ''} ${product?.visual?.tone ?? ''}`)
}

type CaseLook = {
  panel: number
  frame: number
  mesh: number
  trim: number
  front: 'glass' | 'pano' | 'mesh' | 'wood'
  label: string
}

/** 从商品名/属性里推断机箱外观：配色（黑/白/银/粉）与前面板结构（玻璃/网孔/木格栅）。 */
function caseLook(product: Product | undefined): CaseLook {
  const text = `${product?.model ?? ''} ${product?.brand ?? ''} ${product?.attrs.color ?? ''} ${product?.visual?.tone ?? ''}`.toLowerCase()
  const palette = /粉|pink/.test(text)
    ? { panel: 0xd8a8b2, frame: 0xbf8b96, mesh: 0xc9a0a8, trim: 0x8f6069, label: '粉色' }
    : /银|silver|灰|gray|grey/.test(text)
      ? { panel: 0x9ba7af, frame: 0x86929a, mesh: 0x93a0a8, trim: 0x66737b, label: '银色' }
      : /white|白/.test(text)
        ? { panel: 0xd2dade, frame: 0xb5c0c6, mesh: 0xc3cdd2, trim: 0x94a3ab, label: '白色' }
        : { panel: 0x2a343e, frame: 0x3a4652, mesh: 0x222e3b, trim: 0x1b242c, label: '黑色' }
  const front: CaseLook['front'] = caseFrontStyle(product)
  return { ...palette, front }
}

export class PCLabScene {
  private container: HTMLElement
  private callbacks: SceneCallbacks
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private composer: EffectComposer | null = null
  private bloom: UnrealBloomPass | null = null
  private raf = 0
  private clock = new THREE.Clock()
  private resizeObserver: ResizeObserver
  private partsRoot = new THREE.Group()
  private effectsRoot = new THREE.Group()
  private partObjects = new Map<Category, THREE.Object3D>()
  private explodeNodes: { object: THREE.Object3D; base: THREE.Vector3; offset: THREE.Vector3 }[] = []
  private materials!: MaterialLibrary
  private materialList: THREE.Material[] = []
  private textures: THREE.Texture[] = []
  private selectionHelper: THREE.BoxHelper | null = null
  private hoverHelper: THREE.BoxHelper | null = null
  private selectedCategory: Category | null = null
  private hoveredCategory: Category | null = null
  private hiddenIds: string[] = []
  private isolatedId: string | null = null
  private customizations: CustomizationMap = {}
  private explodeValue = 0
  private detachedIds: Category[] = []
  private tutorialVisible: string[] | null = null
  private viewMode: ViewMode = 'assembled'
  private lastXray: boolean | null = null
  private xrayState = new Map<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>()
  private autoRotate = true
  private pointerDown = { x: 0, y: 0, time: 0 }
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private lastHoverCheck = 0
  private installFx = new Map<string, { from: THREE.Vector3; start: number; duration: number }>()
  private cameraTween: {
    fromPos: THREE.Vector3
    toPos: THREE.Vector3
    fromTarget: THREE.Vector3
    toTarget: THREE.Vector3
    t: number
  } | null = null
  private frames = 0
  private fpsClock = 0
  private lastReadout = 0
  private scanner: THREE.Object3D | null = null
  private particles: THREE.Points[] = []
  private disposed = false
  private resizePending = true
  private hemiLight!: THREE.HemisphereLight
  private keyLight!: THREE.DirectionalLight
  private fillLight!: THREE.DirectionalLight
  private rearLight!: THREE.DirectionalLight
  private interiorLight!: THREE.PointLight
  private floorLight!: THREE.PointLight
  private currentCooler: Product | undefined
  private lightingPreset: 'bright' | 'studio' | 'night' = 'bright'
  private powerOn = false
  private debugMode = false
  private fanRotors: THREE.Object3D[] = []
  private rgbMaterials: THREE.MeshStandardMaterial[] = []
  private coolantTextures: THREE.Texture[] = []
  private coolantBubbles: { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; offset: number }[] = []
  private caseTintMaterials: { material: THREE.MeshStandardMaterial; base: number; metalness: number; roughness: number }[] = []
  private caseTint: string | null = null
  private caseFront: CaseFront = 'glass'
  private powerLights: THREE.PointLight[] = []

  constructor(container: HTMLElement, callbacks: SceneCallbacks = {}) {
    this.container = container
    this.callbacks = callbacks
    const width = Math.max(320, container.clientWidth || 960)
    const height = Math.max(320, container.clientHeight || 640)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.85))
    this.renderer.setSize(width, height)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.localClippingEnabled = true
    this.renderer.domElement.className = 'pc-scene-canvas'
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0d141b)
    this.scene.fog = new THREE.FogExp2(0x0d141b, 0.0024)
    this.scene.environmentIntensity = 0.65
    this.scene.add(this.partsRoot)
    this.scene.add(this.effectsRoot)

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1200)
    this.camera.position.set(70, 50, 86)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 24, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.065
    this.controls.rotateSpeed = 0.65
    this.controls.zoomSpeed = 0.8
    this.controls.panSpeed = 0.6
    this.controls.minDistance = 22
    this.controls.maxDistance = 210
    this.controls.maxPolarAngle = Math.PI * 0.495
    this.controls.autoRotate = this.autoRotate
    this.controls.autoRotateSpeed = 0.35
    this.controls.update()

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    this.buildLights()
    this.buildEnvironment()
    this.buildComposer(width, height)
    this.materials = this.createMaterials()
    this.bindEvents()
    this.resizeObserver = new ResizeObserver(() => {
      this.resizePending = true
    })
    this.resizeObserver.observe(container)
    this.animate()
    window.setTimeout(() => this.callbacks.onReady?.(), 220)
  }

  private buildLights() {
    this.hemiLight = new THREE.HemisphereLight(0xeaf2fa, 0x28323a, 1.55)
    this.scene.add(this.hemiLight)

    this.keyLight = new THREE.DirectionalLight(0xfff8ee, 2.85)
    this.keyLight.position.set(55, 85, 65)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.set(1536, 1536)
    this.keyLight.shadow.camera.left = -80
    this.keyLight.shadow.camera.right = 80
    this.keyLight.shadow.camera.top = 90
    this.keyLight.shadow.camera.bottom = -30
    this.keyLight.shadow.camera.near = 1
    this.keyLight.shadow.camera.far = 260
    this.keyLight.shadow.bias = -0.0004
    this.keyLight.target.position.set(0, 24, 0)
    this.scene.add(this.keyLight)
    this.scene.add(this.keyLight.target)

    this.fillLight = new THREE.DirectionalLight(0xc8daf0, 1.35)
    this.fillLight.position.set(-55, 48, 35)
    this.fillLight.target.position.set(0, 24, 0)
    this.scene.add(this.fillLight)
    this.scene.add(this.fillLight.target)

    this.rearLight = new THREE.DirectionalLight(0xd6e4ee, 0.95)
    this.rearLight.position.set(-15, 55, -55)
    this.rearLight.target.position.set(0, 24, 0)
    this.scene.add(this.rearLight)
    this.scene.add(this.rearLight.target)

    this.interiorLight = new THREE.PointLight(0xfff8f0, 1580, 78, 1.8)
    this.interiorLight.position.set(-1, 31, 10)
    this.scene.add(this.interiorLight)

    this.floorLight = new THREE.PointLight(0xd2e3ef, 380, 95, 2)
    this.floorLight.position.set(0, 8, 25)
    this.scene.add(this.floorLight)

    // Powered-on lighting lives inside the chassis. It is off by default and
    // only contributes when the user explicitly toggles the build on.
    const gpuGlow = new THREE.PointLight(0x6db7cc, 0, 34, 2)
    gpuGlow.position.set(-1.5, 20.5, 2.5)
    const boardGlow = new THREE.PointLight(0x8fc7df, 0, 28, 2)
    boardGlow.position.set(-1.0, 31, -1.5)
    const caseGlow = new THREE.PointLight(0x5f9fb4, 0, 32, 2)
    caseGlow.position.set(4.5, 30, 6)
    this.powerLights = [gpuGlow, boardGlow, caseGlow]
    const bases = [650, 420, 480]
    this.powerLights.forEach((light, index) => {
      light.userData.baseIntensity = bases[index] ?? 120
      light.intensity = 0
      this.scene.add(light)
    })
  }

  setPowerOn(enabled: boolean) {
    this.powerOn = enabled
    for (const light of this.powerLights) {
      const base = Number(light.userData.baseIntensity ?? 0)
      light.intensity = enabled ? base : 0
    }
    for (const material of this.rgbMaterials) {
      material.emissiveIntensity = enabled ? Number(material.userData.glow ?? 1.4) : 0.04
    }
  }

  setDebugMode(enabled: boolean) {
    this.debugMode = enabled
    if (!enabled) {
      this.removeSelectionHelper()
      this.removeHoverHelper()
    } else {
      this.selectCategory(this.selectedCategory)
    }
  }

  private powerStrip(color: number, emissiveScale = 1.6): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.04,
      metalness: 0.28,
      roughness: 0.32,
    })
    material.userData.glow = emissiveScale
    this.materialList.push(material)
    this.rgbMaterials.push(material)
    return material
  }

  setLightingPreset(preset: 'bright' | 'studio' | 'night') {
    this.lightingPreset = preset
    if (!this.keyLight) return
    if (preset === 'studio') {
      this.renderer.toneMappingExposure = 1.08
      this.hemiLight.color.setHex(0xdce8f2)
      this.hemiLight.groundColor.setHex(0x20272f)
      this.hemiLight.intensity = 1.22
      this.keyLight.color.setHex(0xfff5e8)
      this.keyLight.intensity = 2.1
      this.fillLight.color.setHex(0xb7c9d8)
      this.fillLight.intensity = 0.85
      this.rearLight.color.setHex(0xc6d7e4)
      this.rearLight.intensity = 0.55
      this.interiorLight.color.setHex(0xeef5fb)
      this.interiorLight.intensity = 920
      this.interiorLight.distance = 64
      this.floorLight.color.setHex(0xcfdae3)
      this.floorLight.intensity = 180
      this.floorLight.distance = 80
    } else if (preset === 'night') {
      this.renderer.toneMappingExposure = 1.02
      this.hemiLight.color.setHex(0x7c8fa2)
      this.hemiLight.groundColor.setHex(0x171e25)
      this.hemiLight.intensity = 0.62
      this.keyLight.color.setHex(0xffd9b5)
      this.keyLight.intensity = 1.35
      this.fillLight.color.setHex(0x8ea9c2)
      this.fillLight.intensity = 0.52
      this.rearLight.color.setHex(0xa7bccd)
      this.rearLight.intensity = 0.65
      this.interiorLight.color.setHex(0xffe0bd)
      this.interiorLight.intensity = 680
      this.interiorLight.distance = 64
      this.floorLight.color.setHex(0x7693aa)
      this.floorLight.intensity = 120
      this.floorLight.distance = 80
    } else {
      // 'bright' - 通透展厅模式，明亮清晰，高光分明，保留ACESToneMapping质感
      this.renderer.toneMappingExposure = 1.18
      this.hemiLight.color.setHex(0xeaf2fa)
      this.hemiLight.groundColor.setHex(0x28323a)
      this.hemiLight.intensity = 1.55
      this.keyLight.color.setHex(0xfff8ee)
      this.keyLight.intensity = 2.85
      this.fillLight.color.setHex(0xc8daf0)
      this.fillLight.intensity = 1.35
      this.rearLight.color.setHex(0xd6e4ee)
      this.rearLight.intensity = 0.95
      this.interiorLight.color.setHex(0xfff8f0)
      this.interiorLight.intensity = 1580
      this.interiorLight.distance = 78
      this.floorLight.color.setHex(0xd2e3ef)
      this.floorLight.intensity = 380
      this.floorLight.distance = 95
    }
  }

  private buildEnvironment() {
    this.effectsRoot.add(this.buildPlatform())
    this.effectsRoot.add(this.buildGrid())
    this.effectsRoot.add(this.buildParticles())
    this.scanner = this.buildScanner()
    this.effectsRoot.add(this.scanner)
  }

  private buildPlatform(): THREE.Group {
    const group = new THREE.Group()
    group.name = 'platform'
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(59, 60, 0.8, 96),
      new THREE.MeshStandardMaterial({ color: 0x111922, metalness: 0.12, roughness: 0.92 }),
    )
    base.position.y = -0.4
    base.receiveShadow = true
    group.add(base)

    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(57.5, 57.5, 0.08, 96),
      new THREE.MeshStandardMaterial({ color: 0x161f27, metalness: 0.1, roughness: 0.96 }),
    )
    inner.position.y = 0.02
    inner.receiveShadow = true
    group.add(inner)

    return group
  }

  private buildGrid(): THREE.Group {
    return new THREE.Group()
  }

  private buildParticles(): THREE.Group {
    return new THREE.Group()
  }

  private buildScanner(): THREE.Object3D {
    return new THREE.Group()
  }

  private buildComposer(_width: number, _height: number) {
    // Direct rendering: no bloom or post glow. Professional product views should
    // be lit by materials and lights, not by a screen-space neon pass.
    this.composer = null
    this.bloom = null
  }

  private createMaterials(): MaterialLibrary {
    const make = (material: THREE.Material): THREE.Material => {
      this.materialList.push(material)
      return material
    }
    const panel = make(
      new THREE.MeshStandardMaterial({ color: 0x2a343e, metalness: 0.58, roughness: 0.42 }),
    ) as THREE.MeshStandardMaterial
    const panelLight = make(
      new THREE.MeshStandardMaterial({ color: 0xbfc9ce, metalness: 0.62, roughness: 0.36 }),
    ) as THREE.MeshStandardMaterial
    const frame = make(
      new THREE.MeshStandardMaterial({ color: 0x3a4652, metalness: 0.82, roughness: 0.3 }),
    ) as THREE.MeshStandardMaterial
    const dark = make(
      new THREE.MeshStandardMaterial({ color: 0x222b35, metalness: 0.65, roughness: 0.38 }),
    ) as THREE.MeshStandardMaterial
    const metal = make(
      new THREE.MeshStandardMaterial({ color: 0xc2d0db, metalness: 0.96, roughness: 0.18 }),
    ) as THREE.MeshStandardMaterial
    const brushed = make(
      new THREE.MeshStandardMaterial({ color: 0x768794, metalness: 0.88, roughness: 0.28 }),
    ) as THREE.MeshStandardMaterial
    const pcb = make(
      new THREE.MeshStandardMaterial({ color: 0x16222a, metalness: 0.22, roughness: 0.65 }),
    ) as THREE.MeshStandardMaterial
    const pcbGreen = make(
      new THREE.MeshStandardMaterial({ color: 0x133826, metalness: 0.2, roughness: 0.62 }),
    ) as THREE.MeshStandardMaterial
    const copper = make(
      new THREE.MeshStandardMaterial({ color: 0xd87a42, metalness: 0.95, roughness: 0.24 }),
    ) as THREE.MeshStandardMaterial
    const gold = make(
      new THREE.MeshStandardMaterial({ color: 0xdfb75c, metalness: 0.96, roughness: 0.2 }),
    ) as THREE.MeshStandardMaterial
    const plastic = make(
      new THREE.MeshStandardMaterial({ color: 0x26303b, metalness: 0.08, roughness: 0.55 }),
    ) as THREE.MeshStandardMaterial
    const rubber = make(
      new THREE.MeshStandardMaterial({ color: 0x182026, metalness: 0.05, roughness: 0.9 }),
    ) as THREE.MeshStandardMaterial
    const glass = make(
      new THREE.MeshPhysicalMaterial({
        color: 0x8fbacb,
        metalness: 0.02,
        roughness: 0.05,
        transparent: true,
        opacity: 0.075,
        depthWrite: false,
        side: THREE.FrontSide,
        clearcoat: 0.7,
        clearcoatRoughness: 0.06,
      }),
    ) as THREE.MeshPhysicalMaterial
    glass.envMapIntensity = 0.55
    const cyan = make(
      new THREE.MeshStandardMaterial({ color: 0x7fc4d4, emissive: 0x2f7f91, emissiveIntensity: 0.75, metalness: 0.2, roughness: 0.4 }),
    ) as THREE.MeshStandardMaterial
    const orange = make(
      new THREE.MeshStandardMaterial({ color: 0xc99a63, emissive: 0x6e3f1f, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.42 }),
    ) as THREE.MeshStandardMaterial
    const white = make(
      new THREE.MeshStandardMaterial({ color: 0xd9e2e6, metalness: 0.28, roughness: 0.42 }),
    ) as THREE.MeshStandardMaterial
    const label = make(
      new THREE.MeshStandardMaterial({ color: 0x9fb8c5, metalness: 0.2, roughness: 0.6 }),
    ) as THREE.MeshStandardMaterial
    const fanBlade = make(
      new THREE.MeshStandardMaterial({ color: 0x26323d, metalness: 0.25, roughness: 0.62 }),
    ) as THREE.MeshStandardMaterial
    const fanBladeRgb = make(
      new THREE.MeshStandardMaterial({
        color: 0xecf6fa,
        metalness: 0.04,
        roughness: 0.24,
        transparent: true,
        opacity: 0.88,
      }),
    ) as THREE.MeshStandardMaterial
    const meshTexture = this.createMeshTexture()
    const meshPanel = make(
      new THREE.MeshStandardMaterial({
        color: 0x222e3b,
        metalness: 0.78,
        roughness: 0.36,
        map: meshTexture,
        bumpMap: meshTexture,
        bumpScale: 0.05,
      }),
    ) as THREE.MeshStandardMaterial
    return {
      panel, panelLight, frame, dark, metal, brushed, pcb, pcbGreen, copper, gold, plastic, rubber, glass, cyan, orange, white, label, fanBlade, fanBladeRgb, meshPanel,
    }
  }

  private createMeshTexture(): THREE.CanvasTexture {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#1e2936'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#0a1016'
    const r = 3.2
    for (let y = 8; y < size; y += 16) {
      const offsetX = (y % 32 === 8) ? 0 : 8
      for (let x = offsetX + 8; x < size; x += 16) {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(16, 16)
    this.textures.push(texture)
    return texture
  }

  private box(
    parent: THREE.Object3D,
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    radius = 0,
  ): THREE.Mesh {
    const geometry = radius > 0 ? new RoundedBoxGeometry(width, height, depth, 2, radius) : new THREE.BoxGeometry(width, height, depth)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  private cylinder(
    parent: THREE.Object3D,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    segments = 24,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  private edges(mesh: THREE.Mesh, color = 0x2d5668, opacity = 0.42) {
    const geometry = new THREE.EdgesGeometry(mesh.geometry, 24)
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity })
    this.materialList.push(material)
    const line = new THREE.LineSegments(geometry, material)
    mesh.add(line)
  }

  private textPlane(
    parent: THREE.Object3D,
    text: string,
    subtext: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    color = '#7fe4ff',
    rotateY = 0,
  ) {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 160
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 512, 160)
    ctx.fillStyle = 'rgba(4, 10, 14, 0.72)'
    ctx.fillRect(0, 0, 512, 160)
    ctx.strokeStyle = 'rgba(68, 220, 255, 0.55)'
    ctx.lineWidth = 2
    ctx.strokeRect(3, 3, 506, 154)
    ctx.fillStyle = color
    ctx.font = '700 46px Bahnschrift, Segoe UI, sans-serif'
    ctx.fillText(text, 24, 70)
    ctx.fillStyle = 'rgba(160, 196, 212, 0.9)'
    ctx.font = '500 22px Consolas, monospace'
    ctx.fillText(subtext, 24, 112)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    this.textures.push(texture)
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.92, depthWrite: false })
    this.materialList.push(material)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
    mesh.position.set(x, y, z)
    mesh.rotation.y = rotateY
    parent.add(mesh)
  }

  setConfig(products: Product[], selection: BuildSelection, quantities: Record<string, number> = {}) {
    this.clearParts()
    this.materials = this.createMaterials()
    const byCategory = new Map<Category, Product>()
    for (const product of products) byCategory.set(product.category, product)
    const byId = new Map(products.map((p) => [p.id, p]))
    const get = (category: Category): Product | undefined => {
      const id = selection[category]
      return id ? byId.get(id) : byCategory.get(category)
    }

    const chassis = get('case')
    const mb = get('motherboard')
    const gpu = get('gpu')
    const cpu = get('cpu')
    const cooler = get('cooler')
    const memory = get('memory')
    const psu = get('psu')
    const ssd = get('ssd')
    const hdd = get('hdd')
    const fans = get('fan')
    const expansion = get('expansion')

    this.currentCooler = cooler
    if (chassis) this.buildCase(chassis)
    if (this.caseTint) this.setCaseTint(this.caseTint)
    if (mb) this.buildMotherboard(mb)
    if (cpu) this.buildCpu(cpu)
    if (memory) this.buildMemory(memory)
    if (gpu) this.buildGpu(gpu)
    if (cooler) this.buildCooler(cooler, cpu)
    if (psu) this.buildPsu(psu)
    if (ssd) this.buildSsd(ssd)
    if (hdd) this.buildHdd(hdd)
    if (fans) this.buildFans(fans, quantities.fan ?? 4)
    if (expansion) this.buildExpansion(expansion)

    this.applyCustomizations()
    this.applyExplode()
    this.applyVisibility()
    this.applyViewMode()
    this.selectCategory(this.selectedCategory)
    this.setPowerOn(this.powerOn)
  }

  setCustomizations(customizations: CustomizationMap) {
    this.customizations = customizations ?? {}
    this.applyCustomizations()
  }

  public setCaseTint(tint: string | null) {
    this.caseTint = tint
    if (!tint) {
      for (const entry of this.caseTintMaterials) {
        entry.material.color.setHex(entry.base)
        entry.material.metalness = entry.metalness
        entry.material.roughness = entry.roughness
      }
      return
    }
    const color = new THREE.Color(tint).getHex()
    for (const entry of this.caseTintMaterials) {
      entry.material.color.setHex(color)
    }
  }

  private tinted(color: number, metalness: number, roughness: number): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness })
    this.materialList.push(material)
    return material
  }

  private coolantTexture(): THREE.Texture {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 32
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, 256, 0)
    gradient.addColorStop(0, '#1a5868')
    gradient.addColorStop(0.5, '#78d8ec')
    gradient.addColorStop(1, '#1a5868')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 256, 32)
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(4, 1)
    texture.colorSpace = THREE.SRGBColorSpace
    this.coolantTextures.push(texture)
    return texture
  }

  private fan(size: number, rgb: boolean, accentColor: number, bladeMaterial: THREE.Material): THREE.Group {
    const group = new THREE.Group()
    group.name = 'case-fan'
    const half = size / 2
    const frame = this.materials.dark
    this.box(group, size, 0.9, 1.2, 0, half - 0.45, 0, frame)
    this.box(group, size, 0.9, 1.2, 0, -half + 0.45, 0, frame)
    this.box(group, 0.9, size, 1.2, -half + 0.45, 0, 0, frame)
    this.box(group, 0.9, size, 1.2, half - 0.45, 0, 0, frame)
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      const spoke = this.cylinder(group, 0.1, 0.1, size * 0.86, 0, 0, 0, this.materials.brushed, 8)
      spoke.rotation.z = a - Math.PI / 2
    }
    const hub = this.cylinder(group, size * 0.19, size * 0.19, 1.8, 0, 0, 0.15, this.materials.plastic, 28)
    hub.rotation.x = Math.PI / 2
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(size * 0.43, 0.12, 8, 48),
      rgb ? new THREE.MeshBasicMaterial({ color: accentColor }) : this.materials.brushed,
    )
    if (rgb) this.materialList.push(ring.material as THREE.Material)
    ring.position.z = 0.62
    group.add(ring)

    const effectiveBladeMat = rgb ? this.materials.fanBladeRgb : bladeMaterial
    const rotor = new THREE.Group()
    for (let i = 0; i < 9; i += 1) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(size * 0.34, 0.16, 0.58), effectiveBladeMat)
      blade.position.set(size * 0.26, 0, 0.28)
      blade.rotation.y = 0.32
      const pivot = new THREE.Group()
      pivot.rotation.z = (i / 9) * Math.PI * 2
      pivot.add(blade)
      rotor.add(pivot)
    }
    rotor.userData.fanRotor = true
    group.add(rotor)
    this.fanRotors.push(rotor)

    // 中心电机轴心与金属拉丝轴心贴片
    const motorHub = this.cylinder(group, size * 0.16, size * 0.16, 1.4, 0, 0, 0.25, this.materials.dark, 32)
    motorHub.rotation.x = Math.PI / 2
    const hubBadge = this.cylinder(group, size * 0.11, size * 0.11, 0.1, 0, 0, 0.98, this.materials.brushed, 32)
    hubBadge.rotation.x = Math.PI / 2

    return group
  }

  private getCustomAnchor(category: Category): CustomAnchor | null {
    if (category === 'cooler') {
      const isAio = this.currentCooler?.attrs.coolerType === 'aio'
      if (isAio) {
        const radSize = this.currentCooler?.attrs.radiatorSize ?? 360
        const radLength = radSize >= 360 ? 40 : radSize >= 280 ? 32 : 28
        return {
          position: [-2.8, 46.55, 0],
          rotation: [-Math.PI / 2, 0, -Math.PI / 2],
          width: radLength - 0.4,
          height: 11.4,
          surface: '水冷冷排顶盖',
        }
      }
      return {
        position: [-4.2, 47.45, -4.0],
        rotation: [-Math.PI / 2, 0, 0],
        width: 14.0,
        height: 12.0,
        surface: '风冷双塔顶盖',
      }
    }
    return CUSTOM_ANCHORS[category] ?? null
  }

  private applyCustomizations() {
    for (const [category, root] of this.partObjects) {
      for (const child of [...root.children]) {
        if (!child.userData.customization) continue
        root.remove(child)
        child.traverse((object) => {
          if (object instanceof THREE.Mesh) object.geometry.dispose()
        })
        const material = (child as THREE.Mesh).material
        const materials = Array.isArray(material) ? material : material ? [material] : []
        for (const item of materials) {
          const map = item instanceof THREE.MeshBasicMaterial ? item.map : null
          if (map) {
            map.dispose()
            this.textures = this.textures.filter((texture) => texture !== map)
          }
          item.dispose()
          this.materialList = this.materialList.filter((entry) => entry !== item)
          this.xrayState.delete(item)
        }
      }
      const custom = this.customizations[category]
      const anchor = this.getCustomAnchor(category)
      if (!custom || !anchor || !custom.imageData) continue
      const texture = this.buildCustomTexture(category, custom, anchor)
      const etched = category === 'case'
      const baseOpacity = etched ? 0.92 : 0.95
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: this.viewMode === 'xray' ? 0.2 : baseOpacity,
        blending: THREE.NormalBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(anchor.width, anchor.height), material)
      mesh.position.set(...anchor.position)
      mesh.rotation.set(...anchor.rotation)
      mesh.renderOrder = 7
      mesh.userData.customization = category
      // A patterned chassis glass is still glass: let clicks reach the
      // hardware behind it instead of always selecting the chassis.
      if (category === 'case') mesh.userData.pickThrough = true
      root.add(mesh)
      this.materialList.push(material)
      this.xrayState.set(material, { opacity: baseOpacity, transparent: true, depthWrite: false })
      this.textures.push(texture)
    }
  }

  private buildCustomTexture(category: Category, custom: PartCustomization, anchor: CustomAnchor): THREE.CanvasTexture {
    const aspect = anchor.width / Math.max(0.1, anchor.height)
    let canvasWidth = 1024
    let canvasHeight = 1024
    if (aspect >= 1) {
      canvasWidth = 1024
      canvasHeight = Math.max(128, Math.round(1024 / aspect))
    } else {
      canvasHeight = 1024
      canvasWidth = Math.max(128, Math.round(1024 * aspect))
    }

    const canvas = document.createElement('canvas')
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const ctx = canvas.getContext('2d')!
    const primary = custom.primary || '#06131c'
    const accent = custom.accent || '#44dcff'
    const intensity = Math.max(0.15, Math.min(1, custom.intensity))
    const seed = parseInt((custom.signature ?? 'PF00000000').replace(/[^0-9a-f]/gi, '').slice(0, 8) || '0', 16)
    const rand = seededRandom(seed)

    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight)
    gradient.addColorStop(0, primary)
    gradient.addColorStop(1, '#02070b')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    if (custom.imageData) {
      const image = new Image()
      image.onload = () => {
        ctx.save()
        ctx.fillStyle = primary
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)
        // Full-bleed cover mode to fill entire plate without blank margin
        const scale = Math.max(canvasWidth / image.width, canvasHeight / image.height)
        const w = image.width * scale
        const h = image.height * scale
        ctx.globalAlpha = 1.0
        ctx.drawImage(image, (canvasWidth - w) / 2, (canvasHeight - h) / 2, w, h)
        ctx.restore()

        if (custom.pattern && custom.pattern !== 'none') {
          ctx.save()
          ctx.globalAlpha = 0.25 * intensity
          this.drawPattern(ctx, Math.min(canvasWidth, canvasHeight), custom, accent, rand)
          ctx.restore()
        }

        texture.needsUpdate = true
      }
      image.src = custom.imageData
    } else {
      ctx.globalAlpha = 0.5 + intensity * 0.5
      ctx.strokeStyle = accent
      ctx.fillStyle = accent
      ctx.lineWidth = 2
      this.drawPattern(ctx, Math.min(canvasWidth, canvasHeight), custom, accent, rand)
      ctx.globalAlpha = 1
      this.drawCustomOverlay(ctx, Math.min(canvasWidth, canvasHeight), category, custom, accent, intensity, rand)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  private drawPattern(
    ctx: CanvasRenderingContext2D,
    size: number,
    custom: PartCustomization,
    accent: string,
    rand: () => number,
  ) {
    ctx.save()
    if (custom.pattern === 'circuit') {
      for (let i = 0; i < 26; i += 1) {
        let x = Math.floor(rand() * 16) * 32
        let y = Math.floor(rand() * 16) * 32
        ctx.beginPath()
        ctx.moveTo(x, y)
        for (let j = 0; j < 4; j += 1) {
          if (rand() > 0.5) x += (rand() > 0.5 ? 1 : -1) * 32 * Math.ceil(rand() * 3)
          else y += (rand() > 0.5 ? 1 : -1) * 32 * Math.ceil(rand() * 3)
          ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (custom.pattern === 'hex') {
      const r = 26
      for (let row = -1; row < 12; row += 1) {
        for (let col = -1; col < 10; col += 1) {
          const x = col * r * 1.5
          const y = row * r * Math.sqrt(3) + (col % 2 ? (r * Math.sqrt(3)) / 2 : 0)
          ctx.beginPath()
          for (let k = 0; k < 6; k += 1) {
            const a = (Math.PI / 3) * k
            const px = x + Math.cos(a) * r * 0.9
            const py = y + Math.sin(a) * r * 0.9
            if (k === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.stroke()
        }
      }
    } else if (custom.pattern === 'topography') {
      for (let i = 0; i < 20; i += 1) {
        ctx.beginPath()
        for (let x = 0; x <= size; x += 8) {
          const y = 40 + i * 22 + Math.sin(x * 0.018 + i * 0.55) * 13 + Math.sin(x * 0.006 - i) * 9
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    } else if (custom.pattern === 'carbon') {
      for (let y = -32; y < size + 32; y += 16) {
        for (let x = -32; x < size + 32; x += 32) {
          const offset = (Math.floor(y / 16) % 2) * 16
          ctx.strokeRect(x + offset, y, 28, 12)
          ctx.beginPath()
          ctx.moveTo(x + offset, y + 12)
          ctx.lineTo(x + offset + 28, y + 12)
          ctx.stroke()
        }
      }
    } else if (custom.pattern === 'sakura') {
      for (let i = 0; i < 14; i += 1) {
        const x = rand() * size
        const y = rand() * size
        const s = 5 + rand() * 9
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(rand() * Math.PI * 2)
        for (let p = 0; p < 5; p += 1) {
          ctx.beginPath()
          ctx.ellipse(0, -s, s * 0.52, s, 0.4, 0, Math.PI * 2)
          ctx.stroke()
          ctx.rotate((Math.PI * 2) / 5)
        }
        ctx.restore()
      }
    } else if (custom.pattern === 'starlight') {
      const stars: [number, number][] = []
      for (let i = 0; i < 120; i += 1) {
        const x = rand() * size
        const y = rand() * size
        stars.push([x, y])
        ctx.globalAlpha = 0.3 + rand() * 0.7
        ctx.beginPath()
        ctx.arc(x, y, rand() * 2.2 + 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 0.45
      for (let i = 0; i < 12; i += 1) {
        const a = stars[Math.floor(rand() * stars.length)]
        const b = stars[Math.floor(rand() * stars.length)]
        ctx.beginPath()
        ctx.moveTo(a[0], a[1])
        ctx.lineTo(b[0], b[1])
        ctx.stroke()
      }
    } else if (custom.pattern === 'brush') {
      for (let i = 0; i < 20; i += 1) {
        ctx.save()
        ctx.globalAlpha = 0.18 + rand() * 0.35
        ctx.lineWidth = 8 + rand() * 28
        ctx.lineCap = 'round'
        const x = rand() * size
        const y = rand() * size
        ctx.beginPath()
        ctx.moveTo(x - 140, y)
        ctx.bezierCurveTo(x - 40, y - 90, x + 50, y + 90, x + 160, y - 10)
        ctx.stroke()
        ctx.restore()
      }
    }
    if (custom.finish === 'brushed') {
      ctx.globalAlpha = 0.13
      ctx.lineWidth = 1
      for (let y = 0; y < size; y += 3) {
        ctx.beginPath()
        ctx.moveTo(0, y + rand() * 2)
        ctx.lineTo(size, y + rand() * 2)
        ctx.stroke()
      }
    } else if (custom.finish === 'gloss') {
      const gloss = ctx.createLinearGradient(0, 0, size, size)
      gloss.addColorStop(0, 'rgba(255,255,255,0.22)')
      gloss.addColorStop(0.45, 'rgba(255,255,255,0)')
      gloss.addColorStop(1, 'rgba(255,255,255,0.12)')
      ctx.fillStyle = gloss
      ctx.fillRect(0, 0, size, size)
    }
    ctx.restore()
  }

  private drawCustomOverlay(
    ctx: CanvasRenderingContext2D,
    size: number,
    category: Category,
    custom: PartCustomization,
    accent: string,
    intensity: number,
    rand: () => number,
  ) {
    ctx.save()
    ctx.globalAlpha = 1
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.strokeRect(14, 14, size - 28, size - 28)
    ctx.globalAlpha = 0.5
    ctx.strokeRect(22, 22, size - 44, size - 44)
    ctx.globalAlpha = 1
    ctx.fillStyle = accent
    ctx.font = '600 15px Consolas, monospace'
    ctx.fillText(`PC FORGE / ${category.toUpperCase()} / CUSTOM`, 30, 46)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#dff7ff'
    ctx.fillText(custom.signature ?? 'PF-UNSIGNED', size - 30, 46)
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(220,245,255,0.9)'
    ctx.font = '500 17px Consolas, monospace'
    if (custom.engraving) ctx.fillText(custom.engraving.toUpperCase(), 30, size - 36)
    ctx.textAlign = 'right'
    ctx.fillStyle = accent
    ctx.font = '500 14px Consolas, monospace'
    ctx.fillText(`${custom.finish.toUpperCase()} / ${Math.round(intensity * 100)}%`, size - 30, size - 36)
    ctx.restore()
    if (!custom.imageData) {
      ctx.save()
      ctx.globalAlpha = 0.07
      for (let i = 0; i < 900; i += 1) {
        ctx.fillStyle = rand() > 0.5 ? '#ffffff' : '#000000'
        ctx.fillRect(rand() * size, rand() * size, 1.5, 1.5)
      }
      ctx.restore()
    }
  }

  private newPart(category: Category, offset: THREE.Vector3): THREE.Group {
    const root = new THREE.Group()
    root.name = category
    root.userData.partId = category
    this.partsRoot.add(root)
    this.partObjects.set(category, root)
    this.registerExplode(root, offset)
    return root
  }

  private registerExplode(object: THREE.Object3D, offset: THREE.Vector3) {
    object.userData.basePosition = object.position.clone()
    this.explodeNodes.push({ object, base: object.position.clone(), offset: offset.clone() })
  }


  private buildCase(product: Product) {
    const root = this.newPart('case', new THREE.Vector3(0, 0, 0))
    const white = isWhite(product)
    const panelMat = white ? this.materials.panelLight : this.materials.panel
    const darkMat = white ? this.materials.brushed : this.materials.frame
    const meshMat = white ? this.materials.panelLight : (this.materials.meshPanel ?? panelMat)

    // Bottom Base & Feet
    const floor = this.box(root, CASE.width, 0.9, CASE.depth, 0, CASE.floor + 0.45, 0, darkMat, 0.1)
    floor.userData.isChassisShell = true
    for (const [x, z] of [[-CASE.width / 2 + 1.8, -CASE.depth / 2 + 2.2], [CASE.width / 2 - 1.8, -CASE.depth / 2 + 2.2], [-CASE.width / 2 + 1.8, CASE.depth / 2 - 2.2], [CASE.width / 2 - 1.8, CASE.depth / 2 - 2.2]]) {
      const foot = this.cylinder(root, 1.4, 1.15, 1.6, x, CASE.floor - 0.8, z, this.materials.rubber, 18)
      foot.userData.isChassisShell = true
    }

    // Midplate / PSU Shroud Plate with air cutouts
    const midplate = this.box(root, CASE.width - 2.8, 0.7, CASE.depth - 4.4, 0.4, CASE.floor + 11.2, 0, darkMat, 0.08)
    midplate.userData.isChassisShell = true
    for (let i = 0; i < 9; i += 1) {
      const cutout = this.box(root, 0.35, 0.75, 5.2, -6.5 + i * 1.5, CASE.floor + 11.2, -1.5, this.materials.dark)
      cutout.userData.isChassisShell = true
    }

    // Motherboard Tray with cable routing grommets
    const tray = this.box(root, 0.6, CASE.height - 13.5, CASE.depth - 4.8, -CASE.width / 2 + 1.8, CASE.floor + 11.2 + (CASE.height - 13.5) / 2, 0.2, panelMat, 0.08)
    tray.userData.isChassisShell = true
    for (const y of [CASE.floor + 14.5, CASE.floor + 21, CASE.floor + 28, CASE.floor + 35]) {
      const grommet = this.box(root, 0.72, 3.8, 1.4, -CASE.width / 2 + 1.8, y, 7.8, this.materials.rubber)
      grommet.userData.isChassisShell = true
    }

    // Top Panel & Radiator Exhaust Grille
    const top = this.box(root, CASE.width, 1.1, CASE.depth, 0, CASE.floor + CASE.height - 0.55, 0, panelMat, 0.1)
    top.userData.isChassisShell = true
    const topGrille = this.box(root, 13.6, 0.4, 38, -2.8, CASE.floor + CASE.height + 0.15, 0, meshMat)
    topGrille.userData.isChassisShell = true

    // Rear Panel with Motherboard I/O & PCIe Slots (后窗面板，标准 I/O 窗与 7 槽横向 PCIe 挡板)
    const rear = this.box(root, CASE.width - 2.8, CASE.height - 2.6, 0.8, 0, CASE.floor + CASE.height / 2, -CASE.depth / 2 + 0.4, darkMat, 0.1)
    rear.userData.isChassisShell = true

    // 后置主板 I/O 接口镂空开孔窗口
    const ioCutout = this.box(root, 5.2, 15.6, 0.84, -9.2, CASE.floor + 30.5, -CASE.depth / 2 + 0.4, this.materials.dark, 0.05)
    ioCutout.userData.isChassisShell = true

    // 7 组标准 PCIe 冲压防尘挡板 (横向 X 轴跨度 10.6，厚度 0.82 与后窗面板平齐，绝不沿 Z 轴前后探出穿模)
    for (let slot = 0; slot < 7; slot += 1) {
      const slotY = CASE.floor + 14.8 + slot * 1.95
      const pcieCut = this.box(root, 10.6, 1.35, 0.82, -3.2, slotY, -CASE.depth / 2 + 0.4, this.materials.dark, 0.04)
      pcieCut.userData.isChassisShell = true
      // 镀镍装配固定螺钉 (右侧固定挡片支架)
      this.cylinder(root, 0.18, 0.18, 0.86, 2.4, slotY, -CASE.depth / 2 + 0.4, this.materials.metal, 8).rotation.x = Math.PI / 2
      // 冲压百叶窗条形散热镂空
      this.box(root, 7.8, 0.25, 0.84, -3.6, slotY, -CASE.depth / 2 + 0.4, this.materials.metal, 0.02)
    }

    // Look configuration for Front & Side
    const look = caseLook(product)
    this.caseFront = look.front

    // Front Panel / Panoramic Glass
    const frontFrame = this.box(root, CASE.width, CASE.height, 0.9, 0, CASE.floor + CASE.height / 2, CASE.depth / 2 - 0.45, look.front === 'glass' || look.front === 'pano' ? this.materials.glass : panelMat, 0.1)
    frontFrame.userData.isChassisShell = true
    this.registerExplode(frontFrame, new THREE.Vector3(0, 0, 28))
    if (look.front === 'glass' || look.front === 'pano') {
      this.textPlane(frontFrame, 'PC FORGE', 'DIGITAL TWIN ASSEMBLY LAB', 0, CASE.floor + 5.6, 0.36, 9.5, 3.0, '#9beeff')
    } else {
      this.textPlane(frontFrame, 'PC FORGE', look.label, 0, CASE.floor + 3.2, 0.52, 8.2, 2.2, '#9beeff')
    }

    // Left Side Showcase Panel (Full-View Tempered Glass)
    const glassThickness = 0.6
    const leftPanel = this.box(
      root,
      glassThickness,
      CASE.height - 2.2,
      CASE.depth - 2.2,
      CASE.width / 2 - glassThickness / 2,
      CASE.floor + CASE.height / 2,
      0,
      this.materials.glass,
      0.14
    )
    leftPanel.userData.isChassisShell = true
    this.registerExplode(leftPanel, new THREE.Vector3(26, 0, 0))

    // Right Metal Cable-Management Side Panel
    const rightPanel = this.box(
      root,
      0.65,
      CASE.height - 2.2,
      CASE.depth - 2.2,
      -CASE.width / 2 + 0.32,
      CASE.floor + CASE.height / 2,
      0,
      panelMat,
      0.1
    )
    rightPanel.userData.isChassisShell = true
    this.registerExplode(rightPanel, new THREE.Vector3(-26, 0, 0))

    // Chassis Pillar Frame (Four Corner Uprights)
    for (const [x, z] of [
      [-CASE.width / 2 + 0.6, -CASE.depth / 2 + 0.6],
      [CASE.width / 2 - 0.6, -CASE.depth / 2 + 0.6],
      [-CASE.width / 2 + 0.6, CASE.depth / 2 - 0.6],
      ...(look.front === 'pano' ? [] : [[CASE.width / 2 - 0.6, CASE.depth / 2 - 0.6]]),
    ]) {
      const pillar = this.box(root, 1.2, CASE.height - 2.0, 1.2, x, CASE.floor + CASE.height / 2, z, darkMat, 0.08)
      pillar.userData.isChassisShell = true
    }

    // HDD Drive Cage in lower compartment (位于下置电源仓前段的真实冲压金属硬盘仓)
    const cageX = 6.4
    const cageZ = 9.0
    const cageBottomY = CASE.floor + 0.1 // 3.1
    const cageHeight = 8.6
    const cageCenterY = cageBottomY + cageHeight / 2 // 7.4
    const cageL = this.box(root, 0.35, cageHeight, 14.2, cageX - 5.3, cageCenterY, cageZ, darkMat, 0.1)
    const cageR = this.box(root, 0.35, cageHeight, 14.2, cageX + 5.3, cageCenterY, cageZ, darkMat, 0.1)
    cageL.userData.isChassisShell = true
    cageR.userData.isChassisShell = true
    const cageTop = this.box(root, 10.95, 0.3, 14.2, cageX, cageBottomY + cageHeight, cageZ, darkMat, 0.1)
    cageTop.userData.isChassisShell = true
    for (const ry of [cageBottomY + 2.4, cageBottomY + 6.2]) {
      for (const sx of [-1, 1]) {
        const rail = this.box(root, 0.28, 0.22, 13.6, cageX + sx * 5.05, ry, cageZ, this.materials.metal, 0.05)
        rail.userData.isChassisShell = true
      }
    }

    // GPU Support Bracket (立于电源仓隔板上方的显卡防下垂支架，底座磁吸，托臂支撑显卡底部)
    const shroudTopY = CASE.floor + 11.2 + 0.35 // 14.55
    const standBase = this.cylinder(root, 1.25, 1.35, 0.35, 7.5, shroudTopY + 0.18, 15, this.materials.metal, 20)
    standBase.castShadow = true
    const supportPillar = this.box(root, 0.55, 7.2, 0.55, 7.5, shroudTopY + 3.95, 15, this.materials.brushed)
    supportPillar.castShadow = true
    const supportArm = this.box(root, 1.9, 0.38, 0.85, 6.6, shroudTopY + 7.1, 15, this.materials.rubber)
    supportArm.castShadow = true
  }

  private buildMotherboard(product: Product) {
    const root = this.newPart('motherboard', new THREE.Vector3(-8, 0, 0))
    const board = this.box(root, 0.4, 30.5, 24.4, -9.5, 27, -2, this.materials.pcb, 0.08)
    this.edges(board, 0x245b50, 0.28)

    const accentColor = accent(product, 0x44dcff)
    const accentMat = accentColor === 0xff8a3d ? this.materials.orange : this.materials.cyan
    this.box(root, 0.12, 0.2, 22, -9.26, 39.4, -2, accentMat)
    this.box(root, 0.12, 26, 0.2, -9.26, 27, -13.8, accentMat)

    const socket = this.box(root, 0.35, 5.6, 5.6, -9.15, 31.4, -4, this.materials.dark, 0.15)
    this.edges(socket, 0x3c6d7c, 0.32)
    this.box(root, 0.45, 4.8, 4.8, -9.05, 31.4, -4, this.materials.brushed, 0.1)

    const vrmTop = this.box(root, 1.2, 1.2, 11, -8.9, 38, -7, this.materials.brushed, 0.2)
    this.edges(vrmTop, 0x41606d, 0.3)
    for (let i = 0; i < 7; i += 1) this.box(root, 1.35, 0.14, 10.6, -8.9, 38.7, -7, this.materials.dark)

    const vrmLeft = this.box(root, 1.2, 9, 1.4, -8.9, 34, -13.2, this.materials.brushed, 0.2)
    this.edges(vrmLeft, 0x41606d, 0.3)
    for (let i = 0; i < 6; i += 1) this.box(root, 1.35, 8.6, 0.14, -8.9, 34, -13.2 + (i - 2.5) * 0.22, this.materials.dark)

    // 一体化金属 I/O 盔甲装甲与散热片（面向机箱后窗与主舱视线）
    const io = this.box(root, 0.65, 8.2, 1.8, -9.18, 33.5, -13.7, this.materials.dark, 0.12)
    this.edges(io, 0x4d6c7d, 0.3)
    this.box(root, 0.72, 8.0, 0.35, -9.15, 33.5, -13.7, this.materials.metal)
    const brandLower = product.brand.toLowerCase()
    const ioLabel = brandLower.includes('asus') ? 'ROG STRIX' : brandLower.includes('msi') ? 'MAG TOMAHAWK' : brandLower.includes('gigabyte') ? 'AORUS ELITE' : product.brand.toUpperCase()
    this.textPlane(root, ioLabel, product.model.replace(/ASUS|MSI|GIGABYTE/gi, '').trim(), -8.82, 35.2, -13.7, 5.8, 1.4, '#9fe8ff', Math.PI / 2)
    for (let i = 0; i < 5; i += 1) this.box(root, 0.8, 0.7, 0.9, -9.0, 30.6 + i * 1.2, -13.75, this.materials.brushed)

    const chipset = this.box(root, 0.7, 4.4, 4.8, -8.95, 14.2, 2.2, this.materials.brushed, 0.25)
    this.edges(chipset, 0x335c68, 0.3)
    this.textPlane(root, product.attrs.chipset ?? 'CHIPSET', 'PC FORGE · MAINBOARD', -8.55, 14.4, 2.2, 3.8, 1.3, '#8fe9ff', Math.PI / 2)

    const m2 = this.box(root, 0.65, 3.2, 9, -8.95, 18.2, 5.6, this.materials.brushed, 0.18)
    this.edges(m2, 0x385d68, 0.28)
    this.textPlane(root, 'M.2 NVMe', 'PCIe 5.0 / 4.0 THERMAL GUARD', -8.55, 18.2, 5.6, 6.4, 1.8, '#ff9e58', Math.PI / 2)

    // 音频独立隔离区（澄澈金黄色高保真音频电容阵列 + LED 隔离分割灯线）
    const audioTrace = this.box(root, 0.45, 10.5, 0.12, -9.15, 17.5, -12.5, this.materials.orange)
    audioTrace.castShadow = false
    for (let c = 0; c < 4; c += 1) {
      const cap = this.cylinder(root, 0.32, 0.32, 0.85, -9.05, 13.6 + c * 1.2, -13.2, this.materials.gold, 16)
      cap.rotation.z = Math.PI / 2
    }

    // 主 PCIe 5.0 x16 插槽金属加固装甲（SafeSlot 镀镍高亮精钢护甲）
    const pcieArmor = this.box(root, 0.48, 1.25, 12.2, -9.06, 22, 2, this.materials.metal)
    pcieArmor.castShadow = false
    this.box(root, 0.35, 1.15, 11.8, -9.02, 22, 2, this.materials.dark)
    this.box(root, 0.42, 0.25, 11.4, -8.98, 22.65, 2, this.materials.gold)
    // PCIe 卡扣与快拆释放按钮（Q-Release）
    this.box(root, 0.55, 0.65, 0.85, -8.98, 22, 8.2, this.materials.panelLight)

    // 第二条扩展 PCIe 插槽
    const slot2 = this.box(root, 0.35, 1.15, 12, -9.12, 17.6, 2, this.materials.dark)
    slot2.castShadow = false
    this.box(root, 0.42, 0.25, 11.4, -9.05, 18.25, 2, this.materials.gold)

    for (let dimm = 0; dimm < 4; dimm += 1) {
      const z = -0.6 + dimm * 1.25
      const slot = this.box(root, 0.35, 13.6, 0.48, -9.15, 33.2, z, this.materials.dark)
      slot.castShadow = false
      this.box(root, 0.45, 0.35, 1.05, -9.12, 37.4, z, this.materials.plastic)
      this.box(root, 0.45, 0.35, 1.05, -9.12, 29, z, this.materials.plastic)
    }

    this.box(root, 0.14, 2.2, 2.2, -9.25, 30.4, 8.7, this.materials.cyan)
  }

  private buildCpu(product: Product) {
    const root = this.newPart('cpu', new THREE.Vector3(12, 18, 0))
    const isAmd = /AMD|Ryzen/i.test(product.brand + ' ' + product.model)

    if (isAmd) {
      // ========= AMD AM5 处理器 (LGA1718, 八爪鱼多边形凹口导热顶盖) =========
      const sub = this.box(root, 0.25, 4.2, 4.2, -9.02, 31.4, -4, this.materials.pcbGreen, 0.08)
      this.edges(sub, 0x1d4734, 0.28)

      const ihsCenter = this.box(root, 0.55, 3.4, 3.4, -8.76, 31.4, -4, this.materials.metal, 0.15)
      this.edges(ihsCenter, 0x5a7688, 0.3)

      for (let arm = 0; arm < 4; arm += 1) {
        const angle = (arm * Math.PI) / 2
        const ax = Math.cos(angle) * 1.85
        const az = Math.sin(angle) * 1.85
        this.box(root, 0.52, 1.1, 1.1, -8.76, 31.4 + ax, -4 + az, this.materials.metal, 0.1)
      }

      const capCoords = [
        [-1.75, -1.75], [1.75, -1.75], [-1.75, 1.75], [1.75, 1.75],
        [0, -1.95], [0, 1.95], [-1.95, 0], [1.95, 0],
      ]
      for (const [dy, dz] of capCoords) {
        this.box(root, 0.38, 0.35, 0.55, -8.82, 31.4 + dy, -4 + dz, this.materials.gold, 0.04)
      }

      this.box(root, 0.35, 5.2, 0.35, -8.82, 31.4, -1.5, this.materials.metal, 0.08)
      this.cylinder(root, 0.18, 0.18, 5.8, -8.72, 31.4, -1.2, this.materials.metal, 12).rotation.x = Math.PI / 2

      this.buildCpuLaserTexture(root, product, -8.47, 31.4, -4, 3.3, 3.3, true)

    } else {
      // ========= Intel LGA1700 处理器 (长方形长宽比 37.5mm x 45mm, 两侧外突扣压耳翼) =========
      const sub = this.box(root, 0.24, 4.5, 3.75, -9.02, 31.4, -4, this.materials.pcbGreen, 0.08)
      this.edges(sub, 0x1d4734, 0.28)

      const ihs = this.box(root, 0.52, 4.1, 3.35, -8.76, 31.4, -4, this.materials.metal, 0.15)
      this.edges(ihs, 0x5a7688, 0.3)

      this.box(root, 0.42, 1.2, 0.42, -8.78, 31.4, -4 - 1.85, this.materials.metal, 0.08)
      this.box(root, 0.42, 1.2, 0.42, -8.78, 31.4, -4 + 1.85, this.materials.metal, 0.08)

      this.box(root, 0.38, 5.4, 0.4, -8.82, 31.4, -1.8, this.materials.dark, 0.08)
      this.cylinder(root, 0.16, 0.16, 6.2, -8.72, 31.4, -1.5, this.materials.metal, 12).rotation.x = Math.PI / 2

      this.buildCpuLaserTexture(root, product, -8.49, 31.4, -4, 3.2, 3.9, false)
    }
  }

  private buildCpuLaserTexture(
    parent: THREE.Object3D,
    product: Product,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    isAmd: boolean
  ) {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = '#64748b'
    ctx.fillRect(0, 0, 512, 512)

    const gradient = ctx.createLinearGradient(0, 0, 512, 512)
    gradient.addColorStop(0, 'rgba(148, 163, 184, 0.35)')
    gradient.addColorStop(0.5, 'rgba(71, 85, 105, 0.65)')
    gradient.addColorStop(1, 'rgba(30, 41, 59, 0.85)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 512, 512)

    ctx.fillStyle = '#cbd5e1'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (isAmd) {
      ctx.fillStyle = '#f97316'
      ctx.font = '900 68px "Segoe UI", sans-serif'
      ctx.fillText('RYZEN', 256, 175)

      ctx.fillStyle = '#f8fafc'
      ctx.font = '800 48px "Segoe UI", sans-serif'
      const modelClean = product.model.replace(/AMD\s*/i, '').replace(/Ryzen\s*/i, 'Ryzen ')
      ctx.fillText(modelClean, 256, 250)

      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 24px "Consolas", monospace'
      ctx.fillText('AM5 LGA1718 · DIFFUSED IN USA', 256, 315)
      ctx.fillText('MADE IN MALAYSIA · 100-000000', 256, 355)
    } else {
      ctx.fillStyle = '#38bdf8'
      ctx.font = '900 58px "Segoe UI", sans-serif'
      ctx.fillText('intel', 256, 150)

      ctx.fillStyle = '#f8fafc'
      ctx.font = '800 46px "Segoe UI", sans-serif'
      const modelClean = product.model.replace(/Intel\s*/i, '')
      ctx.fillText(modelClean, 256, 225)

      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 24px "Consolas", monospace'
      ctx.fillText('LGA1700 · INTEL CONFIDENTIAL', 256, 295)
      ctx.fillText('SRMB2 3.40GHZ · V321D495', 256, 335)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    this.textures.push(texture)
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: 0.88,
      roughness: 0.28,
    })
    this.materialList.push(material)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
    mesh.position.set(x, y, z)
    mesh.rotation.y = Math.PI / 2
    mesh.rotation.z = isAmd ? 0 : Math.PI / 2
    parent.add(mesh)
  }

  private buildMemory(product: Product) {
    const root = this.newPart('memory', new THREE.Vector3(2, 22, 6))
    const accentColor = accent(product, 0x44dcff)
    const rgbMat = accentColor === 0xff8a3d ? this.materials.orange : this.materials.cyan
    for (let i = 0; i < 2; i += 1) {
      const z = -0.6 + (i * 2 + 1) * 1.25
      const stick = this.box(root, 0.42, 3.8, 13.4, -8.95, 33.2, z, this.materials.dark, 0.12)
      this.edges(stick, 0x3d5d6c, 0.3)
      this.box(root, 0.16, 0.36, 12.8, -8.95, 35.15, z, rgbMat)
      this.box(root, 0.44, 1.2, 3.4, -8.95, 33.4, z + 2.2, this.materials.brushed, 0.1)
    }
  }

  private buildGpu(product: Product) {
    const root = this.newPart('gpu', new THREE.Vector3(26, -4, 14))
    const length = Math.max(18, Math.min(38, (product.attrs.lengthMm ?? 300) / 10))
    const thickness = Math.max(4, Math.min(7.5, (product.attrs.thicknessSlots ?? 2.5) * 1.8))
    const centerZ = 1.5
    const centerX = -2.7
    const accentColor = accent(product, 0x44dcff)
    const accentMat = accentColor === 0xff8a3d ? this.materials.orange : this.materials.cyan

    const pcb = this.box(root, 10.8, 0.35, length, centerX, 22.4, centerZ, this.materials.pcb, 0.06)
    this.edges(pcb, 0x275247, 0.28)
    const backplate = this.box(root, 10.6, 0.28, length - 0.8, centerX, 22.9, centerZ, this.materials.brushed, 0.18)
    this.edges(backplate, 0x4a606b, 0.34)
    const shroud = this.box(root, 10.9, thickness, length - 1.2, centerX, 22.2 - thickness / 2, centerZ, this.materials.plastic, 0.35)
    this.edges(shroud, 0x35434c, 0.26)

    const fanCount = length > 28 ? 3 : 2
    const fanRadius = (length * 0.72) / (fanCount * 2)
    const fanZs = fanCount === 3 ? [-length * 0.26, 0, length * 0.26] : [-length * 0.22, length * 0.22]
    for (const z of fanZs) {
      const fanGroup = this.fan(fanRadius * 2, true, accentColor, this.materials.fanBlade)
      fanGroup.position.set(centerX, 22.08 - thickness, centerZ + z)
      fanGroup.rotation.x = Math.PI / 2
      fanGroup.scale.z = 0.42
      root.add(fanGroup)
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(fanRadius * 0.92, 0.09, 8, 56),
        this.materials.brushed,
      )
      ring.rotation.x = Math.PI / 2
      ring.position.set(centerX, 21.86 - thickness, centerZ + z)
      root.add(ring)
    }

    this.textPlane(root, product.attrs.gpuChip?.replace('GeForce ', '') ?? 'GPU', `${product.attrs.vramGb ?? ''}GB · ${product.attrs.chipVendor ?? ''}`, centerX + 5.58, 22.6, centerZ + length / 2 - 4.2, 5.2, 1.6, '#ffb27a', Math.PI / 2)
    this.box(root, 0.2, 0.5, length - 5, centerX + 5.5, 22.6, centerZ, accentMat)

    // Vertical showcase mount: fans face the side glass, as in a premium vertical-GPU build
    const center = new THREE.Vector3(centerX, 22.2, centerZ)
    const mount = new THREE.Group()
    for (const child of [...root.children]) {
      root.remove(child)
      child.position.sub(center)
      mount.add(child)
    }
    mount.position.set(4.2, 25.2, 1.2)
    mount.rotation.z = Math.PI / 2
    root.add(mount)
  }

  private buildCooler(product: Product, cpu: Product | undefined) {
    const root = this.newPart('cooler', new THREE.Vector3(34, 16, -6))
    const isAio = product.attrs.coolerType === 'aio'
    const accentColor = accent(product, 0x44dcff)
    const rgbMat = accentColor === 0xff8a3d ? this.materials.orange : this.materials.cyan

    this.box(root, 4.6, 1.3, 5.4, -8.9, 32.2, -4, this.materials.metal, 0.14)
    if (isAio) {
      const pump = this.cylinder(root, 2.8, 2.8, 2.6, -8.0, 33.3, -4, this.materials.dark, 40)
      pump.rotation.z = Math.PI / 2
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.2, 8, 40), rgbMat)
      ring.rotation.y = Math.PI / 2
      ring.position.set(-6.65, 33.3, -4)
      root.add(ring)

      // 冷排规格与水室端盖几何定位
      const radSize = product.attrs.radiatorSize ?? 360
      const radLength = radSize >= 360 ? 40 : radSize >= 280 ? 32 : 28
      const fanCount = radSize >= 360 ? 3 : 2
      const frontTankZ = radLength / 2 - 1.6
      const rearTankZ = -radLength / 2 + 1.2

      // 冷排铝合金双向水道主体 (Radiator Core)
      this.box(root, 11.5, 2.8, radLength, -2.8, 45.1, 0, this.materials.brushed, 0.28)
      for (let i = 0; i < 15; i += 1) {
        this.box(root, 11.8, 0.18, 0.22, -2.8, 45.1, -radLength / 2 + 2 + i * (radLength - 4) / 14, this.materials.dark)
      }

      // ★★★ 前置与后置独立密封水室端盖 (End Tanks) ★★★
      // 前置水室：用于承接进出水管金属接头，位于风扇旋转扫掠区域前端，彻底杜绝穿模！
      this.box(root, 11.8, 2.85, 3.2, -2.8, 45.1, frontTankZ, this.materials.dark, 0.18)
      this.box(root, 11.8, 2.85, 2.4, -2.8, 45.1, rearTankZ, this.materials.dark, 0.18)

      // 冷排风扇精准分布在端盖之间，保证扇叶在任何转角均不触碰冷排接头与水管
      if (fanCount === 3) {
        const fanPositions = [-12.0, -0.5, 11.0]
        for (const fz of fanPositions) {
          const fanGroup = this.fan(11.6, false, accentColor, this.materials.fanBlade)
          fanGroup.rotation.x = Math.PI / 2
          fanGroup.scale.z = 0.65
          fanGroup.position.set(-2.8, 43.26, fz)
          root.add(fanGroup)
        }
      } else {
        const fanPositions = [-radLength / 4, radLength / 4 - 1.5]
        for (const fz of fanPositions) {
          const fanGroup = this.fan(11.6, false, accentColor, this.materials.fanBlade)
          fanGroup.rotation.x = Math.PI / 2
          fanGroup.scale.z = 0.65
          fanGroup.position.set(-2.8, 43.26, fz)
          root.add(fanGroup)
        }
      }

      // ★★★ 真机水冷水管走线 (S-Curve & Front End Tank 接驳) ★★★
      // curveA / curveB 从 CPU 冷头侧向引出，沿内存前方平缓跃升，严密避开风扇叶片空间 (y <= 40.2)，在最前端水室端盖底部垂直接入
      const curveA = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-6.8, 34.0, -3.2),
        new THREE.Vector3(-5.2, 36.2, 3.5),
        new THREE.Vector3(-4.6, 40.0, 12.0),
        new THREE.Vector3(-4.5, 43.6, frontTankZ),
      ])
      const curveB = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-6.8, 32.6, -4.8),
        new THREE.Vector3(-3.8, 35.0, 2.5),
        new THREE.Vector3(-2.8, 39.5, 11.0),
        new THREE.Vector3(-2.5, 43.6, frontTankZ),
      ])

      const coolantTex = this.coolantTexture()
      const sheathMat = new THREE.MeshStandardMaterial({
        color: 0x0b1a20,
        metalness: 0.2,
        roughness: 0.55,
        transparent: true,
        opacity: 0.42,
      })
      this.materialList.push(sheathMat)

      for (const curve of [curveA, curveB]) {
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.62, 14, false), sheathMat)
        root.add(tube)
        const coolantMat = new THREE.MeshStandardMaterial({
          color: 0x2c6d7d,
          map: coolantTex,
          emissive: 0x78d8ec,
          emissiveMap: coolantTex,
          emissiveIntensity: 0.5,
          metalness: 0.1,
          roughness: 0.32,
        })
        this.materialList.push(coolantMat)
        const coolant = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.47, 12, false), coolantMat)
        root.add(coolant)

        // 两端接头：冷头端水平出水 + 冷排端盖垂直进水 G1/4 旋转金属倒角扣具
        const start = curve.getPointAt(0)
        const end = curve.getPointAt(1)

        // 冷头端金属接头
        const pumpFitting = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.9, 16), this.materials.metal)
        pumpFitting.position.copy(start)
        pumpFitting.rotation.z = Math.PI / 2
        root.add(pumpFitting)

        // 冷排端盖金属接头
        const radFitting = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.9, 16), this.materials.metal)
        radFitting.position.copy(end)
        radFitting.rotation.x = 0
        root.add(radFitting)

        for (let b = 0; b < 3; b += 1) {
          const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.15 + (b % 2) * 0.05, 8, 6), this.materials.cyan)
          root.add(bubble)
          this.coolantBubbles.push({ mesh: bubble, curve, offset: b / 3 })
        }
      }
    } else {
      this.cylinder(root, 0.36, 0.36, 14.2, -7.2, 39.1, -6.1, this.materials.copper, 14)
      this.cylinder(root, 0.36, 0.36, 14.2, -7.2, 39.1, -1.9, this.materials.copper, 14)
      this.cylinder(root, 0.36, 0.36, 14.2, -5.9, 39.1, -6.1, this.materials.copper, 14)
      this.cylinder(root, 0.36, 0.36, 14.2, -5.9, 39.1, -1.9, this.materials.copper, 14)
      for (let tower = 0; tower < 2; tower += 1) {
        const z = -8.1 + tower * 8.2
        for (let i = 0; i < 23; i += 1) {
          this.box(root, 11, 0.18, 6.8, -4.2, 33.6 + i * 0.59, z, this.materials.brushed)
        }
        this.box(root, 11.2, 13.6, 0.4, -4.2, 40.2, z - 3.3, this.materials.frame, 0.08)
        this.box(root, 11.2, 13.6, 0.4, -4.2, 40.2, z + 3.3, this.materials.frame, 0.08)
      }
      for (const z of [-12.5, 3.9]) {
        const fanGroup = this.fan(11.6, false, accentColor, this.materials.fanBlade)
        fanGroup.position.set(-4.2, 39.6, z)
        fanGroup.rotation.y = 0
        fanGroup.scale.z = 0.42
        root.add(fanGroup)
      }
      this.box(root, 0.18, 0.5, 5.2, -4.2, 47.2, -4, rgbMat)
    }
    if (cpu?.attrs.igpu) this.box(root, 0.3, 0.3, 0.3, -8.5, 33.6, -6, this.materials.cyan)
  }

  private buildPsu(product: Product) {
    const root = this.newPart('psu', new THREE.Vector3(0, -6, -26))
    const psuX = -6.4
    const psuY = 8.2
    const psuZ = -12.0
    const wattage = product.attrs.wattage ?? 850
    const brandLower = product.brand.toLowerCase()
    const modelLower = product.model.toLowerCase()

    // 1. 电源外壳主体：深色哑光冷轧钢喷砂机身，拒绝死黑，四角高光倒角清晰
    const body = this.box(root, 16, 8.6, 16, psuX, psuY, psuZ, this.materials.dark, 0.25)
    this.edges(body, 0x4f6475, 0.35)

    // 2. 8 颗镀铬角隅六角装配紧固螺丝
    for (const dx of [-7.7, 7.7]) {
      for (const dy of [-4.0, 4.0]) {
        for (const dz of [-7.7, 7.7]) {
          this.cylinder(root, 0.16, 0.16, 0.22, psuX + dx, psuY + dy, psuZ + dz, this.materials.metal, 8)
        }
      }
    }

    // 3. 顶部封闭式冷轧钢屏蔽罩（真机标准：顶部与机箱中板完全封闭贴合，杜绝外露扇叶穿模）
    const topPlate = this.box(root, 15.6, 0.1, 15.6, psuX, psuY + 4.31, psuZ, this.materials.dark, 0.15)
    this.edges(topPlate, 0x475b6a, 0.25)
    // 顶部冲压加固沉头与压花咬合筋槽（增加真实机电工业质感）
    for (let s = -4.5; s <= 4.5; s += 2.25) {
      this.box(root, 12.0, 0.05, 0.7, psuX, psuY + 4.36, psuZ + s, this.materials.metal, 0.1)
    }

    // 4. 尾部 AC 交流市电插座 (C14)、独立物理翘板开关与蜂窝散热网 (Z = -20)
    const rearZ = psuZ - 7.95
    this.box(root, 3.2, 2.2, 0.5, psuX + 4.2, psuY, rearZ, this.materials.plastic)
    for (let p = 0; p < 3; p += 1) {
      this.box(root, 0.18, 0.45, 0.6, psuX + 3.6 + p * 0.6, psuY, rearZ, this.materials.gold)
    }
    // 红色/黑色 I/O 翘板开关
    this.box(root, 1.6, 2.2, 0.6, psuX + 1.2, psuY, rearZ, this.materials.plastic)
    this.box(root, 1.2, 1.6, 0.8, psuX + 1.2, psuY, rearZ - 0.15, this.materials.orange)

    // 5. 前端全模组接口阵列 (Z = -4.0，面对机箱内侧与背线仓)
    const modZ = psuZ + 7.95
    this.box(root, 14.8, 7.6, 0.35, psuX, psuY, modZ - 0.1, this.materials.brushed, 0.1)
    const isSuperFlower = brandLower.includes('super flower') || modelLower.includes('leadex')
    const modMat = isSuperFlower ? this.powerStrip(0x67e8f9, 0.95) : this.materials.plastic

    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const mx = psuX - 4.8 + col * 3.2
        const my = psuY + 2.4 - row * 2.2
        this.box(root, 2.4, 1.4, 0.65, mx, my, modZ + 0.15, modMat, 0.08)
        this.box(root, 1.8, 0.7, 0.3, mx, my, modZ + 0.35, this.materials.gold)
      }
    }
    // PCIe 5.0 12V-2x6 专属 16Pin 供电端子
    this.box(root, 3.2, 1.2, 0.75, psuX + 4.8, psuY - 2.2, modZ + 0.18, this.materials.dark, 0.08)
    this.box(root, 2.6, 0.5, 0.35, psuX + 4.8, psuY - 2.2, modZ + 0.4, this.materials.gold)

    // 6. ★★★ 面向侧透玻璃的关键展示面 (Hero Side Face, X = 1.62) ★★★
    // 彻底告别一团纯黑！根据电源品牌与型号生成专属高精度 OLED 屏、赛车条纹、镀金徽章与规格铭牌
    this.buildPsuSideTexture(root, product, psuX + 8.04, psuY, psuZ, 15.6, 8.2)

    // 底部 4 个橡胶减震脚垫
    for (const x of [-12.4, -0.4]) {
      for (const z of [-18.5, -5.5]) {
        this.cylinder(root, 0.45, 0.45, 0.3, x, 3.9, z, this.materials.rubber, 16).rotation.x = Math.PI / 2
      }
    }
  }

  private buildPsuSideTexture(
    parent: THREE.Object3D,
    product: Product,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
  ) {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const brand = product.brand.toLowerCase()
    const model = product.model.toLowerCase()
    const wattage = product.attrs.wattage ?? 850
    const efficiency = product.attrs.efficiency ?? '80+ Gold'

    // 电源金属侧板深冷色喷砂纹理底色
    ctx.fillStyle = '#182028'
    ctx.fillRect(0, 0, 1024, 512)
    ctx.strokeStyle = '#2d3a46'
    ctx.lineWidth = 4
    ctx.strokeRect(8, 8, 1008, 496)

    if (brand.includes('asus') || model.includes('thor') || model.includes('strix')) {
      // ========= 华硕 ROG Thor / ROG Strix 旗舰电竞电源 =========
      // 钛金拉丝斜切线条与镜面金属装甲
      ctx.fillStyle = '#26333f'
      ctx.beginPath()
      ctx.moveTo(340, 0)
      ctx.lineTo(1024, 0)
      ctx.lineTo(1024, 512)
      ctx.lineTo(620, 512)
      ctx.closePath()
      ctx.fill()

      // ROG 标志性斜切反光高光线
      ctx.strokeStyle = '#44dcff'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(340, 0)
      ctx.lineTo(620, 512)
      ctx.stroke()

      // OLED 功耗数显屏窗口（黑晶玻璃）
      ctx.fillStyle = '#060a0e'
      ctx.fillRect(40, 90, 440, 240)
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 3
      ctx.strokeRect(40, 90, 440, 240)

      // OLED 实时瓦数读数
      ctx.fillStyle = '#38bdf8'
      ctx.font = '900 68px "Consolas", monospace'
      ctx.fillText(`${wattage} W`, 75, 205)
      ctx.font = '700 20px "Segoe UI", sans-serif'
      ctx.fillStyle = '#7dd3fc'
      ctx.fillText('⚡ REAL-TIME POWER DRAW', 75, 250)

      // OLED 功耗动态柱状指示条
      for (let b = 0; b < 16; b += 1) {
        ctx.fillStyle = b < 10 ? '#38bdf8' : '#1e3a8a'
        ctx.fillRect(75 + b * 22, 280, 16, 22)
      }

      // 败家之眼 ROG Eye 标志性图腾
      ctx.fillStyle = '#f43f5e'
      ctx.font = '900 52px "Segoe UI", sans-serif'
      ctx.fillText('REPUBLIC OF GAMERS', 520, 180)
      ctx.fillStyle = '#f8fafc'
      ctx.font = '700 42px "Segoe UI", sans-serif'
      ctx.fillText(`ROG THOR ${wattage}W`, 520, 245)
      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 24px "Consolas", monospace'
      ctx.fillText(`${efficiency} · ATX 3.0 · PCIE 5.0 READY`, 520, 300)

    } else if (brand.includes('corsair') || model.includes('rm')) {
      // ========= 美商海盗船 Corsair RMx / SHIFT 系列 =========
      // 海盗船经典标志性明黄赛车侧腰线
      ctx.fillStyle = '#facc15'
      ctx.fillRect(0, 0, 32, 512)
      ctx.fillRect(48, 430, 928, 12)

      // Corsair 经典三桅帆船与大字体品牌
      ctx.fillStyle = '#f8fafc'
      ctx.font = '900 76px "Segoe UI", sans-serif'
      ctx.fillText('CORSAIR', 75, 180)

      // 明黄色型号徽章
      ctx.fillStyle = '#facc15'
      ctx.font = '900 68px "Segoe UI", sans-serif'
      ctx.fillText(`RM${wattage}x`, 75, 270)

      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 28px "Consolas", monospace'
      ctx.fillText('80 PLUS GOLD · FULLY MODULAR POWER SUPPLY', 75, 340)
      ctx.fillText('ZERO RPM FAN MODE · JAPANESE 105°C CAPACITORS', 75, 385)

    } else if (brand.includes('seasonic') || model.includes('focus') || model.includes('vertex')) {
      // ========= 海韵 Seasonic FOCUS / VERTEX 系列 =========
      ctx.fillStyle = '#1e3a5f'
      ctx.fillRect(40, 40, 944, 432)
      ctx.strokeStyle = '#eab308'
      ctx.lineWidth = 4
      ctx.strokeRect(40, 40, 944, 432)

      // Seasonic 镀金盾形 Logo
      ctx.fillStyle = '#facc15'
      ctx.font = '900 82px "Segoe UI", sans-serif'
      ctx.fillText('Seasonic', 90, 190)

      ctx.fillStyle = '#f8fafc'
      ctx.font = '800 64px "Segoe UI", sans-serif'
      ctx.fillText(`FOCUS GX-${wattage}`, 90, 280)

      ctx.fillStyle = '#cbd5e1'
      ctx.font = '600 28px "Consolas", monospace'
      ctx.fillText(`${efficiency} · HYBRID SILENT FAN CONTROL`, 90, 350)
      ctx.fillText('10 YEARS WARRANTY · FLUID DYNAMIC BEARING', 90, 395)

    } else if (brand.includes('be quiet')) {
      // ========= 德商闭嘴 be quiet! 系列 =========
      ctx.fillStyle = '#ea580c'
      ctx.fillRect(0, 20, 24, 472)

      ctx.fillStyle = '#f8fafc'
      ctx.font = '900 78px "Segoe UI", sans-serif'
      ctx.fillText('be quiet!', 75, 190)

      ctx.fillStyle = '#ea580c'
      ctx.font = '800 62px "Segoe UI", sans-serif'
      ctx.fillText(`PURE POWER 12 M`, 75, 275)

      ctx.fillStyle = '#cbd5e1'
      ctx.font = '600 32px "Consolas", monospace'
      ctx.fillText(`${wattage}W · ${efficiency} · ATX 3.0 COMPLIANT`, 75, 350)

    } else if (brand.includes('super flower') || model.includes('leadex')) {
      // ========= 振华 Super Flower LEADEX 系列 =========
      ctx.fillStyle = '#f59e0b'
      ctx.font = '900 72px "Segoe UI", sans-serif'
      ctx.fillText('SUPER FLOWER', 80, 180)

      ctx.fillStyle = '#f8fafc'
      ctx.font = '800 64px "Segoe UI", sans-serif'
      ctx.fillText(`LEADEX III GOLD ${wattage}W`, 80, 270)

      ctx.fillStyle = '#67e8f9'
      ctx.font = '600 28px "Consolas", monospace'
      ctx.fillText('CRYSTAL CUBE MODULAR · 9-PIN UNIVERSAL SOCKET', 80, 340)

    } else {
      // ========= 航嘉 / 长城 / 其他通用优质工规电源 =========
      ctx.fillStyle = '#38bdf8'
      ctx.font = '900 70px "Segoe UI", sans-serif'
      ctx.fillText(product.brand.toUpperCase(), 75, 180)

      ctx.fillStyle = '#f8fafc'
      ctx.font = '800 58px "Segoe UI", sans-serif'
      ctx.fillText(product.model, 75, 265)

      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 28px "Consolas", monospace'
      ctx.fillText(`${wattage}W · ${efficiency} · INDUSTRIAL GRADE MATRIX`, 75, 340)
      ctx.fillText('SINGLE +12V RAIL · ACTIVE PFC · FULL SAFETY PASS', 75, 385)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    this.textures.push(texture)
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: 0.55,
      roughness: 0.38,
    })
    this.materialList.push(material)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
    mesh.position.set(x, y, z)
    mesh.rotation.y = Math.PI / 2
    parent.add(mesh)
  }

  private buildSsd(product: Product) {
    const root = this.newPart('ssd', new THREE.Vector3(14, -8, 6))
    const heatsink = this.box(root, 0.8, 2.6, 9.4, -8.9, 18.2, 5.4, this.materials.brushed, 0.22)
    this.edges(heatsink, 0x48606b, 0.3)
    for (let i = 0; i < 6; i += 1) this.box(root, 0.9, 2.2, 0.14, -8.9, 18.2, 2 + i * 1.35, this.materials.dark)
    this.textPlane(root, 'M.2', `${product.attrs.capacityGb ? Math.round(product.attrs.capacityGb / 1024) : ''}TB · PCIe`, -8.42, 18.2, 5.4, 3.0, 0.85, '#93efff', Math.PI / 2)
  }

  private buildHdd(product: Product) {
    // 3.5寸机械硬盘沿右前方抽屉式滑轨滑出拆解
    const root = this.newPart('hdd', new THREE.Vector3(16, 0, 8))
    const hddX = 6.4
    const hddY = 6.8
    const hddZ = 9.0

    // 1. 免工具滑轨抽拉托架（Sled / Caddy）
    const tray = this.box(root, 10.5, 0.35, 14.6, hddX, hddY - 1.25, hddZ, this.materials.frame, 0.1)
    this.edges(tray, 0x3d5260, 0.25)
    // 前端免工具快拆提手与锁定卡扣
    this.box(root, 10.5, 2.2, 0.45, hddX, hddY, hddZ + 7.45, this.materials.frame, 0.15)

    // 2. 3.5寸工业机械硬盘铸铝防静电底壳（标准 3.5" 101.6mm x 26.1mm x 147mm 比例）
    const body = this.box(root, 10.16, 1.8, 14.4, hddX, hddY - 0.2, hddZ - 0.1, this.materials.dark, 0.18)
    this.edges(body, 0x4b5e68, 0.3)

    // 3. 冲压不锈钢金属密封顶盖（拉丝镀锌马口铁）
    const topCover = this.box(root, 9.8, 0.5, 14.0, hddX, hddY + 0.95, hddZ - 0.1, this.materials.brushed, 0.1)
    this.edges(topCover, 0x768a96, 0.35)

    // 4. 中心主轴电机保护压盘
    const spindle = this.cylinder(root, 1.35, 1.35, 0.08, hddX, hddY + 1.22, hddZ - 1.0, this.materials.metal, 24)
    spindle.castShadow = true

    // 5. 顶盖 6 枚外周沉头紧固螺栓
    for (const sx of [-4.5, 4.5]) {
      for (const sz of [-6.0, 0, 5.5]) {
        this.cylinder(root, 0.22, 0.22, 0.12, hddX + sx, hddY + 1.22, hddZ + sz, this.materials.metal, 10)
      }
    }

    // 6. 顶部正规规整规格铭牌（容量、转速、接口规范）
    const capacity = product.attrs.capacityGb ? Math.round(product.attrs.capacityGb / 1024) : 4
    const rpm = product.attrs.rpm ?? 7200
    this.textPlane(
      root,
      `${capacity}TB BARRACUDA`,
      `3.5" HDD · ${rpm} RPM · SATA 6Gb/s · 256MB`,
      hddX,
      hddY + 1.23,
      hddZ + 2.2,
      8.2,
      2.8,
      '#b8dff2',
      -Math.PI / 2,
    )

    // 7. 前面板托架编号
    this.textPlane(root, 'HDD BAY 01', `${capacity}TB · SATA`, hddX, hddY, hddZ + 7.7, 7.2, 1.3, '#7cd8eb')

    // 8. 尾部标准 SATA 7-Pin 数据接口与 15-Pin 供电金手指接口（面向机箱内侧与背线孔）
    const rearZ = hddZ - 7.3
    this.box(root, 3.2, 0.5, 0.6, hddX - 2.8, hddY - 0.4, rearZ, this.materials.plastic)
    this.box(root, 4.8, 0.5, 0.6, hddX + 1.8, hddY - 0.4, rearZ, this.materials.plastic)
    this.box(root, 2.6, 0.12, 0.15, hddX - 2.8, hddY - 0.4, rearZ - 0.28, this.materials.gold)
    this.box(root, 4.2, 0.12, 0.15, hddX + 1.8, hddY - 0.4, rearZ - 0.28, this.materials.gold)
  }

  private buildFans(product: Product, quantity: number) {
    const root = this.newPart('fan', new THREE.Vector3(0, 0, 0))
    const size = Math.max(8, Math.min(10.5, (product.attrs.fanSizeMm ?? 120) / 11.4))
    const rgb = Boolean(product.attrs.rgb)
    const accentColor = accent(product, 0x44dcff)
    const isAio = this.currentCooler?.attrs.coolerType === 'aio'
    const rearFan = { x: -3.8, y: 33.0, z: -22.1, axis: 'z' as const, offset: new THREE.Vector3(0, 0, -24) }

    const frontLow = { x: -2, y: 18.4, z: 21.6, axis: 'z' as const, offset: new THREE.Vector3(0, 0, 18) }
    const frontMid = { x: -2, y: 29.2, z: 21.6, axis: 'z' as const, offset: new THREE.Vector3(0, 0, 21) }
    const frontTop = { x: -2, y: 40.0, z: 21.6, axis: 'z' as const, offset: new THREE.Vector3(0, 0, 24) }

    // 符合真实装机构造标准：核心优先构建「1后排风 + 3前/侧垂直进风」经典正压风道
    // 彻底杜绝默认风扇平铺散落于机箱底部铁皮隔板的违背真机搭建现象
    const positions: { x: number; y: number; z: number; axis: 'z' | 'y'; offset: THREE.Vector3 }[] = [
      rearFan,
      frontLow,
      frontMid,
      frontTop,
    ]

    // 当用户配置 5 个以上风扇时，补充顶部排风或底部进风位
    if (!isAio) {
      positions.push(
        { x: -2, y: 45.4, z: -9, axis: 'y', offset: new THREE.Vector3(0, 15, 0) },
        { x: -2, y: 45.4, z: 4, axis: 'y', offset: new THREE.Vector3(0, 18, 0) },
      )
    }
    positions.push(
      { x: -2, y: 5.2, z: 8, axis: 'y', offset: new THREE.Vector3(0, -14, 0) },
      { x: -2, y: 5.2, z: -6, axis: 'y', offset: new THREE.Vector3(0, -17, 0) },
    )
    const count = Math.max(1, Math.min(positions.length, quantity || 1))
    for (let i = 0; i < count; i += 1) {
      const p = positions[i]
      // 进风口风扇后面先垫一块深色防尘网：扇叶间隙透出的机箱内亮面不会在视觉上
      // 叠成“第二个扇叶”，也就不会有穿模的错觉。
      if (p.axis === 'z' && p.z > 0) {
        const filter = this.box(
          root,
          size + 2.6,
          size + 2.6,
          0.16,
          p.x,
          p.y,
          p.z - 1.15,
          this.materials.frame,
          0.06,
        )
        filter.userData.partId = 'fan'
        this.registerExplode(filter, p.offset)
      }
      const fanGroup = this.fan(size, rgb, accentColor, this.materials.fanBlade)
      fanGroup.position.set(p.x, p.y, p.z)
      if (p.axis === 'y') fanGroup.rotation.x = Math.PI / 2
      fanGroup.userData.partId = 'fan'
      root.add(fanGroup)
      this.registerExplode(fanGroup, p.offset)
    }
  }

  private buildExpansion(product: Product) {
    const root = this.newPart('expansion', new THREE.Vector3(26, -12, 10))
    const card = this.box(root, 0.45, 8, 12, -9.0, 17.2, 6.5, this.materials.pcb, 0.06)
    this.edges(card, 0x2f594e, 0.28)
    this.box(root, 0.8, 1.2, 12.2, -8.9, 20.8, 6.5, this.materials.brushed)
    for (let i = 0; i < 4; i += 1) this.box(root, 0.6, 0.5, 1.2, -9.2, 16 + i * 1.6, 3 + i * 1.4, this.materials.dark)
    this.box(root, 0.3, 3, 7, -8.75, 15.5, 9.2, this.materials.brushed, 0.06)
    this.textPlane(root, 'EXP', product.attrs.type ?? 'EXPANSION', -8.72, 17, 6.5, 3.2, 0.9, '#ffcf9e', Math.PI / 2)
  }

  private clearParts() {
    this.partsRoot.clear()
    this.partObjects.clear()
    this.explodeNodes = []
    this.removeSelectionHelper()
    this.removeHoverHelper()
    const disposedGeometries = new Set<THREE.BufferGeometry>()
    this.partsRoot.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (!disposedGeometries.has(object.geometry)) {
          disposedGeometries.add(object.geometry)
          object.geometry.dispose()
        }
      }
    })
    for (const material of this.materialList) material.dispose()
    this.materialList = []
    this.rgbMaterials = []
    this.fanRotors = []
    this.coolantTextures = []
    this.coolantBubbles = []
    this.caseTintMaterials = []
    for (const texture of this.textures) texture.dispose()
    this.textures = []
    this.xrayState.clear()
    this.lastXray = null
  }

  private removeSelectionHelper() {
    if (this.selectionHelper) {
      this.scene.remove(this.selectionHelper)
      this.selectionHelper.geometry.dispose()
      ;(this.selectionHelper.material as THREE.Material).dispose()
      this.selectionHelper = null
    }
  }

  private removeHoverHelper() {
    if (this.hoverHelper) {
      this.scene.remove(this.hoverHelper)
      this.hoverHelper.geometry.dispose()
      ;(this.hoverHelper.material as THREE.Material).dispose()
      this.hoverHelper = null
    }
  }

  selectCategory(category: Category | null) {
    this.selectedCategory = category
    this.removeSelectionHelper()
    if (!category || !this.debugMode) return
    const object = this.partObjects.get(category)
    if (!object || !object.visible) return
    const helper = new THREE.BoxHelper(object, 0x6db7cc)
    const material = helper.material as THREE.LineBasicMaterial
    material.transparent = true
    material.opacity = 0.45
    material.depthTest = true
    helper.renderOrder = 9
    this.selectionHelper = helper
    this.scene.add(helper)
  }

  setExplode(value: number) {
    this.explodeValue = Math.max(0, Math.min(1, value))
    this.applyExplode()
  }

  setDetached(ids: Category[]) {
    this.detachedIds = [...ids]
    this.applyExplode()
  }

  private applyExplode() {
    const t = this.explodeValue
    const eased = t * t * (3 - 2 * t)
    for (const node of this.explodeNodes) {
      const category = node.object.userData.partId as Category | undefined
      const amount = category && this.detachedIds.includes(category) ? 1 : eased
      node.object.position.copy(node.base).addScaledVector(node.offset, amount)
      const fx = this.installFx.get(node.object.uuid)
      if (fx) {
        const elapsed = performance.now() - fx.start
        const raw = elapsed <= 0 ? 0 : Math.min(1, elapsed / fx.duration)
        const factor = 1 - (raw * raw * (3 - 2 * raw))
        node.object.position.addScaledVector(fx.from, factor)
        if (raw >= 1) this.installFx.delete(node.object.uuid)
      }
    }
  }

  animatePartInstall(category: Category, delay = 0) {
    const nodes = this.explodeNodes.filter((node) => node.object.userData.partId === category)
    if (!nodes.length) return
    const now = performance.now()
    for (const node of nodes) {
      const from = node.offset.lengthSq() > 0.01 ? node.offset.clone().multiplyScalar(1.25) : new THREE.Vector3(12, 10, 0)
      from.y += 5
      this.installFx.set(node.object.uuid, { from, start: now + delay, duration: 1400 })
    }
    this.applyExplode()
  }

  playAssemblySequence() {
    this.installFx.clear()
    this.explodeValue = 0
    const order: Category[] = ['motherboard', 'cpu', 'memory', 'ssd', 'cooler', 'case', 'psu', 'fan', 'gpu', 'expansion', 'hdd']
    let index = 0
    for (const category of order) {
      if (!this.partObjects.has(category)) continue
      this.animatePartInstall(category, 150 + index * 330)
      index += 1
    }
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode
    this.applyViewMode()
  }

  private applyViewMode() {
    if (!this.renderer) return
    if (this.viewMode === 'section') {
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)
      this.renderer.clippingPlanes = [plane]
    } else {
      this.renderer.clippingPlanes = []
    }
    const xray = this.viewMode === 'xray'
    if (this.lastXray === xray) return
    this.lastXray = xray
    for (const material of this.materialList) {
      if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial || material instanceof THREE.MeshBasicMaterial)) continue
      if (!this.xrayState.has(material)) {
        this.xrayState.set(material, {
          opacity: material.opacity,
          transparent: material.transparent,
          depthWrite: material.depthWrite,
        })
      }
      const base = this.xrayState.get(material)!
      if (xray) {
        material.transparent = true
        material.opacity = Math.min(base.opacity, 0.2)
        material.depthWrite = false
      } else {
        material.opacity = base.opacity
        material.transparent = base.transparent
        material.depthWrite = base.depthWrite
      }
      material.needsUpdate = true
    }
  }

  setVisibility(hidden: string[], isolated: string | null) {
    this.hiddenIds = hidden
    this.isolatedId = isolated
    this.applyVisibility()
  }

  setTutorialVisible(categories: string[] | null) {
    this.tutorialVisible = categories ? [...categories] : null
    this.applyVisibility()
  }

  private applyVisibility() {
    for (const [category, object] of this.partObjects) {
      const hidden = this.hiddenIds.includes(category)
      const isolated = Boolean(this.isolatedId) && this.isolatedId !== category
      const tutorialHidden = this.tutorialVisible !== null && !this.tutorialVisible.includes(category)
      object.visible = !hidden && !isolated && !tutorialHidden
    }
    if (this.selectionHelper && this.selectedCategory) {
      const object = this.partObjects.get(this.selectedCategory)
      this.selectionHelper.visible = Boolean(object?.visible)
    }
  }

  setAutoRotate(enabled: boolean) {
    this.autoRotate = enabled
    this.controls.autoRotate = enabled
  }

  focusPart(category: Category) {
    const object = this.partObjects.get(category)
    if (!object) return
    const box = new THREE.Box3().setFromObject(object)
    if (box.isEmpty()) return
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const direction = this.camera.position.clone().sub(this.controls.target).normalize()
    const distance = Math.max(38, Math.min(120, Math.max(size.x, size.y, size.z) * 2.15))
    const toPos = center.clone().addScaledVector(direction, distance)
    this.cameraTween = {
      fromPos: this.camera.position.clone(),
      toPos,
      fromTarget: this.controls.target.clone(),
      toTarget: center,
      t: 0,
    }
  }

  resetCamera() {
    this.cameraTween = {
      fromPos: this.camera.position.clone(),
      toPos: new THREE.Vector3(70, 50, 86),
      fromTarget: this.controls.target.clone(),
      toTarget: new THREE.Vector3(0, 24, 0),
      t: 0,
    }
  }

  private updateTween(dt: number) {
    if (!this.cameraTween) return
    const tween = this.cameraTween
    tween.t = Math.min(1, tween.t + dt * 2.4)
    const t = tween.t * tween.t * (3 - 2 * tween.t)
    this.camera.position.lerpVectors(tween.fromPos, tween.toPos, t)
    this.controls.target.lerpVectors(tween.fromTarget, tween.toTarget, t)
    if (tween.t >= 1) this.cameraTween = null
  }

  private bindEvents() {
    const canvas = this.renderer.domElement
    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('pointerup', this.handlePointerUp)
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerleave', this.handlePointerLeave)
    canvas.addEventListener('dblclick', this.handleDoubleClick)
  }

  private handlePointerDown = (event: PointerEvent) => {
    this.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() }
  }

  private handlePointerUp = (event: PointerEvent) => {
    const dx = event.clientX - this.pointerDown.x
    const dy = event.clientY - this.pointerDown.y
    const dt = performance.now() - this.pointerDown.time
    // Genuine clicks under 400ms and within 14px movement
    if (Math.hypot(dx, dy) > 14 || dt > 400) return
    const category = this.pick(event.clientX, event.clientY)
    this.selectCategory(category)
    this.callbacks.onSelect?.(category)
  }

  private handleDoubleClick = (event: MouseEvent) => {
    const category = this.pick(event.clientX, event.clientY)
    if (category) {
      this.selectCategory(category)
      this.callbacks.onSelect?.(category)
      this.focusPart(category)
    }
  }

  private handlePointerMove = (event: PointerEvent) => {
    const now = performance.now()
    if (now - this.lastHoverCheck < 45) return
    this.lastHoverCheck = now
    const category = this.pick(event.clientX, event.clientY)
    this.hoveredCategory = category
    this.renderer.domElement.style.cursor = category ? 'pointer' : 'grab'
    if (!this.debugMode || !category) {
      this.removeHoverHelper()
      return
    }
    const object = this.partObjects.get(category)
    if (!object || !object.visible) {
      this.removeHoverHelper()
      return
    }
    if (!this.hoverHelper || this.hoverHelper.userData.category !== category) {
      this.removeHoverHelper()
      const helper = new THREE.BoxHelper(object, 0x44dcff)
      const material = helper.material as THREE.LineBasicMaterial
      material.transparent = true
      material.opacity = 0.35
      material.depthTest = false
      helper.userData.category = category
      helper.renderOrder = 8
      this.hoverHelper = helper
      this.scene.add(helper)
    }
  }

  private handlePointerLeave = () => {
    this.removeHoverHelper()
    this.renderer.domElement.style.cursor = 'grab'
  }

  private pick(clientX: number, clientY: number): Category | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
    this.pointer.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const intersections = this.raycaster.intersectObjects(this.partsRoot.children, true)

    let internalCategory: Category | null = null
    let chassisCandidate: Category | null = null

    for (const hit of intersections) {
      const object = hit.object
      if (!object.visible) continue
      if (object.userData.pickThrough === true) continue

      let cursor: THREE.Object3D | null = object
      let category: Category | null = null
      while (cursor && cursor !== this.partsRoot) {
        if (cursor.userData.partId) {
          category = cursor.userData.partId as Category
          break
        }
        cursor = cursor.parent
      }

      if (!category) {
        const byName = categoryForSceneId(object.name)
        if (byName) category = byName
      }

      if (!category) continue

      if (category === 'case') {
        if (!chassisCandidate) chassisCandidate = 'case'
        // If it's a glass or shell mesh panel, allow raycast to reach inside hardware
        if (object.userData.isChassisShell || (object as THREE.Mesh).material === this.materials.glass) {
          continue
        }
      } else {
        internalCategory = category
        break
      }
    }

    if (internalCategory) return internalCategory

    // In exploded view, if ray slightly missed floating small parts, assist with tight 24px screen proximity
    if (this.explodeValue > 0.08) {
      const projected = this.nearestPartToPointer(clientX, clientY, rect)
      if (projected) return projected
    }

    return chassisCandidate
  }

  private nearestPartToPointer(clientX: number, clientY: number, rect: DOMRect): Category | null {
    let best: Category | null = null
    let bestDistance = 24
    const center = new THREE.Vector3()
    for (const [category, object] of this.partObjects) {
      if (!object.visible || category === 'case') continue
      const bounds = new THREE.Box3().setFromObject(object)
      bounds.getCenter(center)
      center.project(this.camera)
      if (center.z > 1) continue
      const x = rect.left + ((center.x + 1) / 2) * rect.width
      const y = rect.top + ((1 - center.y) / 2) * rect.height
      const distance = Math.hypot(clientX - x, clientY - y)
      if (distance < bestDistance) {
        bestDistance = distance
        best = category
      }
    }
    return best
  }

  private animate = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.animate)
    const dt = Math.min(0.05, this.clock.getDelta())
    if (this.resizePending) {
      this.resizePending = false
      this.resize()
    }
    this.controls.autoRotate = this.autoRotate
    this.controls.update()
    this.updateTween(dt)
    if (this.selectionHelper) {
      this.selectionHelper.update()
      const material = this.selectionHelper.material as THREE.LineBasicMaterial
      material.opacity = 0.62 + Math.sin(performance.now() * 0.004) * 0.26
    }
    if (this.installFx.size) this.applyExplode()
    if (this.powerOn) {
      const pulse = 0.88 + Math.sin(performance.now() * 0.0016) * 0.12
      for (const rotor of this.fanRotors) rotor.rotation.z -= dt * 5.2
      for (const material of this.rgbMaterials) {
        material.emissiveIntensity = Number(material.userData.glow ?? 1.4) * pulse
      }
      for (const texture of this.coolantTextures) texture.offset.x -= dt * 0.42
      for (const item of this.coolantBubbles) {
        item.offset = (item.offset + dt * 0.085) % 1
        item.curve.getPointAt(item.offset, item.mesh.position)
      }
    }
    if (this.hoverHelper) this.hoverHelper.update()
    if (this.scanner) this.scanner.rotation.y += dt * 0.22
    for (const points of this.particles) points.rotation.y += dt * 0.012
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)

    this.frames += 1
    this.fpsClock += dt
    if (this.fpsClock >= 0.8) {
      this.callbacks.onFps?.(Math.round(this.frames / this.fpsClock))
      this.frames = 0
      this.fpsClock = 0
    }
    const now = performance.now()
    if (now - this.lastReadout > 220) {
      this.lastReadout = now
      const offset = this.camera.position.clone().sub(this.controls.target)
      const distance = offset.length()
      this.callbacks.onCamera?.({
        azimuth: (Math.atan2(offset.x, offset.z) * 180) / Math.PI,
        elevation: (Math.asin(offset.y / Math.max(0.001, distance)) * 180) / Math.PI,
        distance,
      })
    }
  }

  private resize() {
    const width = Math.max(320, this.container.clientWidth || 960)
    const height = Math.max(320, this.container.clientHeight || 640)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.composer?.setSize(width, height)
  }

  capture(): string {
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement.toDataURL('image/png')
  }

  capturePart(category: Category, size = 560): string | null {
    const source = this.partObjects.get(category)
    if (!source) return null
    const unit = category === 'fan' ? source.children.find((child) => child.userData.partId === 'fan') ?? source : source
    const object = unit.clone(true)
    object.position.set(0, 0, 0)
    object.rotation.set(0, 0, 0)
    object.traverse((child) => {
      child.visible = !child.userData.customization
      if (!(child instanceof THREE.Mesh)) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      const cloned = materials.map((material) => {
        const next = material.clone()
        if (next instanceof THREE.MeshStandardMaterial || next instanceof THREE.MeshPhysicalMaterial) {
          next.transparent = false
          next.opacity = 1
          next.depthWrite = true
          next.envMapIntensity = Math.max(1, next.envMapIntensity)
        }
        return next
      })
      child.material = Array.isArray(child.material) ? cloned : cloned[0]
    })
    object.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(object)
    if (bounds.isEmpty()) return null
    const center = bounds.getCenter(new THREE.Vector3())
    const radius = Math.max(4, bounds.getBoundingSphere(new THREE.Sphere()).radius)
    object.position.sub(center)

    const scene = new THREE.Scene()
    scene.environment = this.scene.environment
    scene.add(object)
    scene.add(new THREE.AmbientLight(0xffffff, 1.7))
    scene.add(new THREE.HemisphereLight(0xeef5fb, 0x26323d, 2.2))
    const key = new THREE.DirectionalLight(0xfff5e8, 4.2)
    key.position.set(1.4, 2.2, 2.6)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xaed7e4, 2.2)
    rim.position.set(-2.4, 1.2, -1.8)
    scene.add(rim)

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, radius * 14)
    const distance = (radius / Math.sin((30 * Math.PI) / 360)) * 0.82
    camera.position.set(distance * 0.72, distance * 0.5, distance * 0.95)
    camera.lookAt(0, 0, 0)
    const front = new THREE.DirectionalLight(0xffffff, 3.6)
    front.position.copy(camera.position)
    scene.add(front)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setSize(size, size)
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.16
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.render(scene, camera)
    const url = renderer.domElement.toDataURL('image/png')
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of materials) material.dispose()
    })
    renderer.forceContextLoss()
    renderer.dispose()
    return url
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointerdown', this.handlePointerDown)
    canvas.removeEventListener('pointerup', this.handlePointerUp)
    canvas.removeEventListener('pointermove', this.handlePointerMove)
    canvas.removeEventListener('pointerleave', this.handlePointerLeave)
    canvas.removeEventListener('dblclick', this.handleDoubleClick)
    this.controls.dispose()
    this.clearParts()
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose())
        else object.material.dispose()
      }
      if (object instanceof THREE.Line || object instanceof THREE.LineSegments) {
        object.geometry.dispose()
        ;(object.material as THREE.Material).dispose()
      }
    })
    this.composer?.dispose()
    this.renderer.dispose()
    canvas.remove()
  }
}
