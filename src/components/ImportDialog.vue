<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Plus,
  Upload,
  X,
} from 'lucide-vue-next'
import { useBuildStore } from '../stores/build'
import { useToastStore } from '../stores/toast'
import { normalizeProduct, parseCsvProducts, parseJsonProducts } from '../services/productImport'
import { CATEGORY_META } from '../data/meta'
import type { Category, Product } from '../types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const store = useBuildStore()
const toast = useToastStore()

const mode = ref<'file' | 'manual'>('file')
const fileName = ref('')
const rawText = ref('')
const preview = ref<Product[]>([])
const errors = ref<string[]>([])
const dragging = ref(false)

const manual = reactive({
  category: 'gpu' as Category,
  brand: '',
  model: '',
  sku: '',
  price: '',
  tagline: '',
  socket: '',
  formFactor: '',
  power: '',
})

const canImport = computed(() => preview.value.length > 0)
const manualValid = computed(() => manual.brand.trim() && manual.model.trim() && Number(manual.price) > 0)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    mode.value = 'file'
    fileName.value = ''
    rawText.value = ''
    preview.value = []
    errors.value = []
  },
)

function parseText(text: string, name: string) {
  rawText.value = text
  fileName.value = name
  const isJson = name.toLowerCase().endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[')
  const result = isJson ? parseJsonProducts(text) : parseCsvProducts(text)
  preview.value = result.products
  errors.value = result.errors
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  parseText(await file.text(), file.name)
  input.value = ''
}

async function onDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  parseText(await file.text(), file.name)
}

function commitImport() {
  if (!preview.value.length) return
  const result = store.importProducts(preview.value)
  toast.success('产品数据已导入', `新增 ${result.added} 条 · 更新 ${result.updated} 条；价格标记为用户导入样本`)
  emit('close')
}

function addManual() {
  if (!manualValid.value) return
  const raw: Record<string, unknown> = {
    category: manual.category,
    brand: manual.brand.trim(),
    model: manual.model.trim(),
    sku: manual.sku.trim() || undefined,
    price: Number(manual.price),
    tagline: manual.tagline.trim() || '用户手动添加配件',
    source: '用户手动录入',
    specs: {
      录入方式: '手动添加',
      插槽: manual.socket || '未填写',
      板型: manual.formFactor || '未填写',
      功耗: manual.power ? `${manual.power} W` : '未填写',
    },
    attrs: {
      socket: manual.socket || undefined,
      formFactor: manual.formFactor || undefined,
      tdp: manual.power ? Number(manual.power) : undefined,
    },
  }
  const product = normalizeProduct(raw, store.customProducts.length)
  if (!product) {
    toast.error('无法添加配件', '请检查类别、品牌与型号')
    return
  }
  if (store.addCustomProduct(product)) {
    store.inspectProduct(product.id)
    emit('close')
  }
}

function downloadTemplate() {
  const csv = [
    'category,brand,model,sku,price,source,sourceUrl',
    'gpu,NVIDIA,GeForce RTX 5080 Founders Edition,RTX5080-FE,8299,品牌官网,https://www.nvidia.cn/',
    'cpu,AMD,Ryzen 7 9800X3D,100-100001084WOF,3799,京东自营,https://www.jd.com/',
    'memory,Kingston,FURY Beast DDR5 32GB,KF560C36BBEK2-32,699,天猫官方旗舰店,https://www.tmall.com/',
  ].join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'pc-forge-product-import-template.csv'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
        <div class="modal-card import-modal" role="dialog" aria-modal="true" aria-label="导入或添加配件">
          <div class="modal-head">
            <div>
              <span class="panel-kicker"><Database :size="11" /> DATA INGEST</span>
              <h2>导入 / 添加配件</h2>
            </div>
            <button type="button" class="modal-close" @click="emit('close')"><X :size="16" /></button>
          </div>

          <div class="import-tabs">
            <button type="button" :class="{ active: mode === 'file' }" @click="mode = 'file'"><Upload :size="13" /> 文件导入</button>
            <button type="button" :class="{ active: mode === 'manual' }" @click="mode = 'manual'"><Plus :size="13" /> 手动添加</button>
          </div>

          <template v-if="mode === 'file'">
            <div
              class="drop-zone"
              :class="{ 'drop-zone--active': dragging }"
              @dragover.prevent="dragging = true"
              @dragleave.prevent="dragging = false"
              @drop.prevent="onDrop"
            >
              <div class="drop-icons"><FileJson :size="22" /><FileSpreadsheet :size="22" /></div>
              <strong>拖入 JSON / CSV 文件</strong>
              <p>支持顶层产品数组或 <code>{ "products": [] }</code>；CSV 必须包含 category、brand、model 列。</p>
              <label class="forge-btn forge-btn--primary">
                <Upload :size="13" /> 选择文件
                <input type="file" accept=".json,.csv,text/csv,application/json" hidden @change="onFile" />
              </label>
              <button type="button" class="link-btn" @click="downloadTemplate"><Download :size="12" /> 下载 CSV 模板</button>
            </div>

            <div class="import-sample">
              <span>或粘贴 JSON / CSV 数据</span>
              <textarea
                :value="rawText"
                rows="4"
                spellcheck="false"
                placeholder='[{"category":"gpu","brand":"NVIDIA","model":"GeForce RTX 5080","sku":"RTX5080","price":8299}]'
                @input="parseText(($event.target as HTMLTextAreaElement).value, 'pasted.json')"
              ></textarea>
            </div>

            <div v-if="fileName" class="import-preview">
              <div class="preview-head">
                <span><FileJson :size="12" /> {{ fileName }}</span>
                <strong>{{ preview.length }} 条有效 · {{ errors.length }} 条错误</strong>
              </div>
              <div v-if="preview.length" class="preview-list">
                <div v-for="item in preview.slice(0, 6)" :key="item.id" class="preview-row">
                  <span>{{ CATEGORY_META.find((c) => c.id === item.category)?.short }}</span>
                  <strong>{{ item.brand }} {{ item.model }}</strong>
                  <em>{{ item.price?.reference != null ? `¥${item.price.reference.toLocaleString('zh-CN')}` : '暂无报价' }}</em>
                </div>
                <div v-if="preview.length > 6" class="preview-more">+ 还有 {{ preview.length - 6 }} 条</div>
              </div>
              <div v-if="errors.length" class="preview-errors">
                <div v-for="error in errors.slice(0, 4)" :key="error"><AlertTriangle :size="11" /> {{ error }}</div>
              </div>
              <p class="import-legal">导入价格将标记为「用户导入样本」，不会伪装成实时渠道报价。</p>
            </div>

            <div class="modal-actions">
              <button type="button" class="forge-btn" @click="emit('close')">取消</button>
              <button type="button" class="forge-btn forge-btn--primary" :disabled="!canImport" @click="commitImport">
                <CheckCircle2 :size="13" /> 导入 {{ preview.length }} 条产品
              </button>
            </div>
          </template>

          <template v-else>
            <div class="manual-grid">
              <label>
                <span>类别 / CATEGORY</span>
                <select v-model="manual.category">
                  <option v-for="meta in CATEGORY_META" :key="meta.id" :value="meta.id">{{ meta.index }} {{ meta.label }}</option>
                </select>
              </label>
              <label>
                <span>品牌 / BRAND *</span>
                <input v-model="manual.brand" type="text" placeholder="例如 ASUS" />
              </label>
              <label class="manual-wide">
                <span>完整型号 / MODEL *</span>
                <input v-model="manual.model" type="text" placeholder="例如 TUF Gaming GeForce RTX 5080 OC" />
              </label>
              <label>
                <span>SKU</span>
                <input v-model="manual.sku" type="text" placeholder="厂商 SKU" />
              </label>
              <label>
                <span>参考价 / CNY *</span>
                <input v-model="manual.price" type="number" min="0" placeholder="0" />
              </label>
              <label>
                <span>插槽 / SOCKET</span>
                <input v-model="manual.socket" type="text" placeholder="AM5 / LGA1851" />
              </label>
              <label>
                <span>板型 / FORM FACTOR</span>
                <input v-model="manual.formFactor" type="text" placeholder="ATX / M-ATX / ITX" />
              </label>
              <label>
                <span>功耗 / TDP (W)</span>
                <input v-model="manual.power" type="number" min="0" placeholder="0" />
              </label>
              <label class="manual-wide">
                <span>一句话描述</span>
                <input v-model="manual.tagline" type="text" placeholder="例如 16GB GDDR7 三风扇显卡" />
              </label>
            </div>
            <p class="import-legal">手动录入的规格有限，兼容引擎只使用已填写的字段；价格会标记为用户提供，不冒充渠道报价。</p>
            <div class="modal-actions">
              <button type="button" class="forge-btn" @click="emit('close')">取消</button>
              <button type="button" class="forge-btn forge-btn--primary" :disabled="!manualValid" @click="addManual">
                <Plus :size="13" /> 添加到产品库
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
