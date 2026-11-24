<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Category, Product } from '../types'

const props = withDefaults(
  defineProps<{
    product: Product
    height?: number
  }>(),
  {
    height: 220,
  }
)

const container = ref<HTMLDivElement | null>(null)
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let currentMeshGroup: THREE.Group | null = null
let animId = 0
let resizeObserver: ResizeObserver | null = null

function createMaterials() {
  return {
    pcb: new THREE.MeshStandardMaterial({ color: 0x182422, roughness: 0.65, metalness: 0.2 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xd0d8df, roughness: 0.22, metalness: 0.92 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x222a32, roughness: 0.42, metalness: 0.8 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe6b432, roughness: 0.32, metalness: 0.95 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x141a20, roughness: 0.55, metalness: 0.1 }),
    accent: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.85, emissive: 0x0ea5e9, emissiveIntensity: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xd0e8f8, transparent: true, opacity: 0.35, roughness: 0.1, transmission: 0.85, thickness: 0.6 }),
  }
}

function buildModel(product: Product): THREE.Group {
  const root = new THREE.Group()
  const mats = createMaterials()
  const cat = product.category

  if (cat === 'cpu') {
    // Substrate PCB
    const substrate = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.22, 4.4), mats.pcb)
    root.add(substrate)

    // Gold contact pads at bottom
    const pads = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.05, 4.1), mats.gold)
    pads.position.y = -0.12
    root.add(pads)

    // Nickel-plated IHS
    const ihs = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 3.6), mats.metal)
    ihs.position.y = 0.25
    root.add(ihs)

    // Center laser cap
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 2.8), mats.darkMetal)
    cap.position.y = 0.45
    root.add(cap)

    // Gold corner pin mark
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.35), mats.gold)
    mark.position.set(-1.8, 0.13, -1.8)
    root.add(mark)
  } else if (cat === 'gpu') {
    const length = 14
    const height = 6
    const width = 2.4

    // PCB
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(length, 0.25, height), mats.pcb)
    pcb.position.set(0, 0, 0)
    root.add(pcb)

    // Backplate
    const backplate = new THREE.Mesh(new THREE.BoxGeometry(length - 0.2, 0.15, height - 0.2), mats.darkMetal)
    backplate.position.set(0, 0.18, 0)
    root.add(backplate)

    // Heatsink fins block
    const fins = new THREE.Mesh(new THREE.BoxGeometry(length - 1.2, 1.2, height - 0.6), mats.metal)
    fins.position.set(0, -0.7, 0)
    root.add(fins)

    // Shroud
    const shroud = new THREE.Mesh(new THREE.BoxGeometry(length, 0.4, height), mats.plastic)
    shroud.position.set(0, -1.4, 0)
    root.add(shroud)

    // Dual/Triple Fans
    const fanCount = 3
    for (let i = 0; i < fanCount; i++) {
      const fx = -length / 2 + 2.4 + i * ((length - 4.8) / (fanCount - 1))
      const fanRim = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.25, 24), mats.darkMetal)
      fanRim.position.set(fx, -1.5, 0)
      root.add(fanRim)

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), mats.accent)
      hub.position.set(fx, -1.52, 0)
      root.add(hub)
    }

    // PCIe Gold Finger connector
    const pcie = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.45, 0.18), mats.gold)
    pcie.position.set(-1.2, 0, height / 2 + 0.22)
    root.add(pcie)

    // I/O Bracket
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, height + 0.8), mats.metal)
    bracket.position.set(-length / 2 - 0.1, -0.6, 0)
    root.add(bracket)
  } else if (cat === 'motherboard') {
    const size = 12
    // ATX Mainboard PCB
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(size, 0.25, size), mats.pcb)
    root.add(pcb)

    // CPU Socket
    const socket = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, 3.2), mats.darkMetal)
    socket.position.set(-2, 0.25, -2)
    root.add(socket)
    const socketCover = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 2.5), mats.metal)
    socketCover.position.set(-2, 0.45, -2)
    root.add(socketCover)

    // VRM Heatsinks
    const vrmTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 1.0), mats.darkMetal)
    vrmTop.position.set(-2, 0.65, -4.2)
    root.add(vrmTop)
    const vrmLeft = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 4.4), mats.darkMetal)
    vrmLeft.position.set(-4.5, 0.65, -2)
    root.add(vrmLeft)

    // RAM Slots (4 slots)
    for (let i = 0; i < 4; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 4.8), mats.plastic)
      slot.position.set(1.4 + i * 0.7, 0.3, -2)
      root.add(slot)
    }

    // PCIe Slots
    for (let i = 0; i < 2; i++) {
      const pcie = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.4, 0.45), mats.darkMetal)
      pcie.position.set(0.4, 0.3, 1.5 + i * 2.2)
      root.add(pcie)
      const armor = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.25, 0.5), mats.metal)
      armor.position.set(0.4, 0.35, 1.5 + i * 2.2)
      root.add(armor)
    }

    // Chipset Heatsink
    const chipset = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 2.6), mats.darkMetal)
    chipset.position.set(2.8, 0.5, 2.8)
    root.add(chipset)

    // M.2 Armor Plate
    const m2 = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.3, 1.2), mats.metal)
    m2.position.set(-0.5, 0.3, 0.3)
    root.add(m2)
  } else if (cat === 'memory') {
    // RAM stick
    const length = 9.5
    const height = 2.8
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(length, height, 0.12), mats.pcb)
    root.add(pcb)

    // Gold edge contacts
    const pins = new THREE.Mesh(new THREE.BoxGeometry(length - 0.6, 0.4, 0.15), mats.gold)
    pins.position.set(0, -height / 2 + 0.15, 0)
    root.add(pins)

    // Metal heatspreader
    const spreader = new THREE.Mesh(new THREE.BoxGeometry(length, height - 0.4, 0.32), mats.darkMetal)
    spreader.position.set(0, 0.2, 0)
    root.add(spreader)

    // Top RGB Diffuser
    const rgbBar = new THREE.Mesh(new THREE.BoxGeometry(length + 0.2, 0.45, 0.38), mats.accent)
    rgbBar.position.set(0, height / 2 + 0.15, 0)
    root.add(rgbBar)
  } else if (cat === 'ssd') {
    // M.2 2280
    const length = 8.0
    const width = 2.2
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(length, 0.15, width), mats.pcb)
    root.add(pcb)

    // Gold connector pins
    const pins = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, width - 0.3), mats.gold)
    pins.position.set(-length / 2 + 0.25, 0, 0)
    root.add(pins)

    // NAND Flash chips
    for (let i = 0; i < 2; i++) {
      const chip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 1.5), mats.plastic)
      chip.position.set(0.6 + i * 2.1, 0.18, 0)
      root.add(chip)
    }

    // Controller chip
    const controller = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 1.1), mats.metal)
    controller.position.set(-1.6, 0.18, 0)
    root.add(controller)

    // Metal Heatsink plate
    const heatsink = new THREE.Mesh(new THREE.BoxGeometry(length - 1.2, 0.35, width), mats.darkMetal)
    heatsink.position.set(0.6, 0.38, 0)
    root.add(heatsink)
  } else if (cat === 'cooler') {
    // Dual-Tower Air Cooler or AIO Pump
    if (product.attrs.coolerType === 'aio') {
      // Pump Block
      const pump = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 2.2, 32), mats.darkMetal)
      root.add(pump)
      const mirror = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.1, 32), mats.accent)
      mirror.position.y = 1.12
      root.add(mirror)

      // Radiator
      const rad = new THREE.Mesh(new THREE.BoxGeometry(9.0, 1.8, 4.0), mats.darkMetal)
      rad.position.set(0, 5, 0)
      root.add(rad)

      // Tubes
      const tubeA = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.25, 8, 24, Math.PI * 0.7), mats.plastic)
      tubeA.position.set(-1.2, 2.5, 0)
      tubeA.rotation.z = -Math.PI / 4
      root.add(tubeA)
    } else {
      // Twin tower heatsink
      for (const side of [-2.0, 2.0]) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(2.4, 6.0, 5.0), mats.metal)
        tower.position.set(side, 3.0, 0)
        root.add(tower)
      }
      // Central fan
      const fan = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5.2, 5.2), mats.plastic)
      fan.position.set(0, 3.0, 0)
      root.add(fan)
      // Heatpipes
      for (let i = -1.5; i <= 1.5; i += 1.0) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6.8, 12), mats.gold)
        pipe.position.set(i, 3.0, 0)
        root.add(pipe)
      }
      // Base
      const base = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.8, 4.0), mats.metal)
      base.position.set(0, 0.4, 0)
      root.add(base)
    }
  } else if (cat === 'psu') {
    // ATX Power Supply
    const body = new THREE.Mesh(new THREE.BoxGeometry(8.0, 5.0, 8.5), mats.darkMetal)
    root.add(body)

    // Intake Fan Grille
    const fanGrille = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.1, 32), mats.plastic)
    fanGrille.position.set(0, 2.55, 0)
    root.add(fanGrille)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.18, 16), mats.accent)
    hub.position.set(0, 2.58, 0)
    root.add(hub)

    // Modular Sockets Panel
    const socketPanel = new THREE.Mesh(new THREE.BoxGeometry(7.0, 4.0, 0.2), mats.plastic)
    socketPanel.position.set(0, 0, 4.3)
    root.add(socketPanel)
  } else if (cat === 'case') {
    // Chassis Frame
    const width = 8.5
    const height = 12.0
    const depth = 11.0
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mats.darkMetal)
    root.add(chassis)

    // Tempered Glass side
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.2, height - 0.6, depth - 0.6), mats.glass)
    glass.position.set(width / 2 + 0.1, 0, 0)
    root.add(glass)

    // Front Mesh Panel
    const front = new THREE.Mesh(new THREE.BoxGeometry(width - 0.4, height - 0.4, 0.25), mats.plastic)
    front.position.set(0, 0, depth / 2 + 0.1)
    root.add(front)
  } else {
    // Default fan / accessories
    const frame = new THREE.Mesh(new THREE.BoxGeometry(6.0, 6.0, 1.2), mats.plastic)
    root.add(frame)
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.6, 24), mats.accent)
    rotor.rotation.x = Math.PI / 2
    root.add(rotor)
  }

  return root
}

function updateSceneModel(product: Product) {
  if (!scene || !camera || !controls) return

  if (currentMeshGroup) {
    scene.remove(currentMeshGroup)
    currentMeshGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
        else child.material.dispose()
      }
    })
    currentMeshGroup = null
  }

  const group = buildModel(product)
  scene.add(group)
  currentMeshGroup = group

  // Auto-center and fit camera to bounding sphere
  const box = new THREE.Box3().setFromObject(group)
  const center = new THREE.Vector3()
  const sphere = new THREE.Sphere()
  box.getCenter(center)
  box.getBoundingSphere(sphere)

  group.position.sub(center)

  const radius = Math.max(3.5, sphere.radius)
  const fov = camera.fov * (Math.PI / 180)
  const dist = (radius / Math.sin(fov / 2)) * 1.25

  camera.position.set(dist * 0.85, dist * 0.55, dist * 1.1)
  camera.near = 0.1
  camera.far = dist * 8
  camera.updateProjectionMatrix()

  controls.target.set(0, 0, 0)
  controls.minDistance = radius * 0.8
  controls.maxDistance = dist * 2.5
  controls.update()
}

function animate() {
  animId = requestAnimationFrame(animate)
  if (controls) controls.update()
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

onMounted(() => {
  if (!container.value) return
  const el = container.value
  const width = el.clientWidth || 320
  const height = el.clientHeight || 210

  scene = new THREE.Scene()
  scene.background = null

  camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000)
  camera.position.set(12, 8, 14)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
  renderer.setSize(width, height)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.autoRotate = true
  controls.autoRotateSpeed = 1.3
  controls.enableZoom = true
  controls.enablePan = false
  controls.maxPolarAngle = Math.PI * 0.85
  controls.minPolarAngle = Math.PI * 0.15

  // Studio 3-point lighting
  const ambient = new THREE.AmbientLight(0xffffff, 1.2)
  scene.add(ambient)

  const keyLight = new THREE.DirectionalLight(0xfff8ed, 3.2)
  keyLight.position.set(8, 12, 10)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0x38bdf8, 2.0)
  fillLight.position.set(-8, 6, -6)
  scene.add(fillLight)

  const rimLight = new THREE.DirectionalLight(0xe0f2fe, 1.8)
  rimLight.position.set(0, -6, -8)
  scene.add(rimLight)

  updateSceneModel(props.product)
  animate()

  resizeObserver = new ResizeObserver(() => {
    if (!el || !renderer || !camera) return
    const w = el.clientWidth
    const h = el.clientHeight
    if (w > 0 && h > 0) {
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
  })
  resizeObserver.observe(el)
})

watch(() => props.product, (newProd) => {
  if (newProd) updateSceneModel(newProd)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animId)
  resizeObserver?.disconnect()
  if (renderer && container.value) {
    renderer.domElement.remove()
    renderer.dispose()
  }
  if (currentMeshGroup) {
    currentMeshGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
        else child.material.dispose()
      }
    })
  }
})
</script>

<template>
  <div class="part-3d-box" :style="{ height: `${height}px` }">
    <!-- Concentric radar HUD background circles -->
    <div class="part-3d-hud" aria-hidden="true">
      <div class="hud-circle hud-circle--outer"></div>
      <div class="hud-circle hud-circle--middle"></div>
      <div class="hud-circle hud-circle--inner"></div>
      <div class="hud-axis-x"></div>
      <div class="hud-axis-y"></div>
    </div>
    <!-- Interactive WebGL 3D Canvas -->
    <div ref="container" class="part-3d-canvas"></div>
    <div class="part-3d-badge">
      <span>3D 数字孪生 · 可鼠标拖拽旋转</span>
    </div>
  </div>
</template>

<style scoped>
.part-3d-box {
  position: relative;
  width: 100%;
  height: 210px;
  border-radius: 8px;
  background: radial-gradient(circle at center, rgba(14, 34, 53, 0.7) 0%, rgba(5, 13, 20, 0.95) 75%);
  border: 1px solid rgba(143, 182, 201, 0.25);
  overflow: hidden;
  box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.7);
}

.part-3d-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: grab;
  z-index: 2;
}

.part-3d-canvas:active {
  cursor: grabbing;
}

.part-3d-hud {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0.35;
  z-index: 1;
}

.hud-circle {
  position: absolute;
  border-radius: 50%;
  border: 1px dashed rgba(143, 182, 201, 0.4);
}

.hud-circle--outer {
  width: 190px;
  height: 190px;
}

.hud-circle--middle {
  width: 130px;
  height: 130px;
  border-style: solid;
  border-color: rgba(143, 182, 201, 0.25);
}

.hud-circle--inner {
  width: 70px;
  height: 70px;
}

.hud-axis-x {
  position: absolute;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(143, 182, 201, 0.3) 20%, rgba(143, 182, 201, 0.3) 80%, transparent);
}

.hud-axis-y {
  position: absolute;
  height: 100%;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(143, 182, 201, 0.3) 20%, rgba(143, 182, 201, 0.3) 80%, transparent);
}

.part-3d-badge {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 3;
}

.part-3d-badge span {
  font-family: var(--cn);
  font-size: 10.5px;
  color: #7dd3fc;
  background: rgba(8, 22, 34, 0.85);
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid rgba(143, 182, 201, 0.35);
  letter-spacing: 0.04em;
  white-space: nowrap;
  backdrop-filter: blur(4px);
}
</style>
