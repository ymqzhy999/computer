<script setup lang="ts">
import { computed } from 'vue'
import type { Category, Product } from '../types'

const props = defineProps<{
  category: Category
  product?: Product | null
}>()

const accent = computed(() => props.product?.visual?.accent ?? '#7fa8bd')
const code = computed(() => {
  const map: Record<Category, string> = {
    cpu: 'CPU',
    motherboard: 'MB',
    gpu: 'GPU',
    memory: 'RAM',
    ssd: 'SSD',
    hdd: 'HDD',
    psu: 'PSU',
    cooler: 'CLR',
    case: 'CHS',
    fan: 'FAN',
    expansion: 'EXP',
  }
  return map[props.category]
})
</script>

<template>
  <div class="part-glyph" :style="{ '--glyph-accent': accent }">
    <div class="glyph-ticks" aria-hidden="true"></div>
    <div class="glyph-ring glyph-ring--outer" aria-hidden="true"></div>
    <div class="glyph-ring glyph-ring--inner" aria-hidden="true"></div>
    <svg class="glyph-svg" viewBox="0 0 200 200" role="img" :aria-label="product?.model ?? category">
      <g fill="none" stroke="currentColor" stroke-width="1.4">
        <template v-if="category === 'cpu'">
          <rect x="58" y="58" width="84" height="84" rx="6" />
          <rect x="70" y="70" width="60" height="60" rx="3" opacity=".55" />
          <path d="M70 48v10M86 48v10M102 48v10M118 48v10M134 48v10M70 142v10M86 142v10M102 142v10M118 142v10M134 142v10" />
          <path d="M48 70h10M48 86h10M48 102h10M48 118h10M48 134h10M142 70h10M142 86h10M142 102h10M142 118h10M142 134h10" />
          <path d="M88 88h24v24H88z" opacity=".4" />
        </template>
        <template v-else-if="category === 'gpu'">
          <rect x="30" y="72" width="140" height="56" rx="5" />
          <circle cx="66" cy="100" r="18" />
          <circle cx="100" cy="100" r="18" />
          <circle cx="134" cy="100" r="18" />
          <path d="M48 100h36M82 100h36M116 100h36" opacity=".35" />
          <path d="M30 132v10h118v-10M148 132v10" />
          <path d="M154 82h12v36h-12" opacity=".5" />
        </template>
        <template v-else-if="category === 'motherboard'">
          <rect x="46" y="38" width="108" height="124" rx="3" />
          <rect x="76" y="54" width="34" height="34" rx="2" />
          <rect x="58" y="96" width="18" height="50" rx="2" />
          <rect x="86" y="100" width="54" height="10" rx="2" />
          <rect x="86" y="118" width="54" height="10" rx="2" />
          <rect x="118" y="54" width="22" height="6" rx="1" opacity=".55" />
          <rect x="118" y="64" width="22" height="6" rx="1" opacity=".55" />
          <circle cx="64" cy="54" r="4" opacity=".6" />
          <path d="M46 150h20M130 150h24" opacity=".5" />
        </template>
        <template v-else-if="category === 'memory'">
          <rect x="46" y="64" width="108" height="32" rx="3" />
          <rect x="46" y="104" width="108" height="32" rx="3" />
          <path d="M56 64v32M72 64v32M88 64v32M104 64v32M120 64v32M136 64v32M56 104v32M72 104v32M88 104v32M104 104v32M120 104v32M136 104v32" opacity=".35" />
          <path d="M56 96v8M72 96v8M88 96v8M104 96v8M120 96v8M136 96v8" />
        </template>
        <template v-else-if="category === 'ssd'">
          <rect x="36" y="84" width="128" height="32" rx="3" />
          <rect x="52" y="92" width="24" height="16" rx="2" opacity=".6" />
          <path d="M84 92h64M84 100h48M84 108h56" opacity=".45" />
          <path d="M156 94h8v12h-8" />
        </template>
        <template v-else-if="category === 'hdd'">
          <rect x="46" y="58" width="108" height="84" rx="4" />
          <circle cx="100" cy="100" r="28" />
          <circle cx="100" cy="100" r="10" />
          <path d="M100 72v-6M100 128v6M72 100h-6M128 100h6" opacity=".5" />
        </template>
        <template v-else-if="category === 'psu'">
          <rect x="42" y="64" width="116" height="72" rx="4" />
          <circle cx="100" cy="100" r="26" />
          <path d="M100 74v10M100 116v10M74 100h10M116 100h10M82 82l7 7M118 118l-7-7M118 82l-7 7M82 118l7-7" />
          <path d="M158 106h8v16h-8" opacity=".5" />
        </template>
        <template v-else-if="category === 'cooler'">
          <rect x="66" y="46" width="68" height="88" rx="4" />
          <circle cx="100" cy="90" r="28" />
          <path d="M100 62v56M72 90h56M80 70l40 40M120 70l-40 40" opacity=".4" />
          <path d="M66 140h68" />
        </template>
        <template v-else-if="category === 'case'">
          <rect x="54" y="34" width="92" height="132" rx="4" />
          <path d="M54 52h92M146 70v80M54 150h92" opacity=".45" />
          <circle cx="72" cy="44" r="3" />
          <circle cx="128" cy="44" r="3" />
          <rect x="68" y="66" width="64" height="70" rx="2" opacity=".25" />
        </template>
        <template v-else-if="category === 'fan'">
          <rect x="50" y="50" width="100" height="100" rx="8" />
          <circle cx="100" cy="100" r="38" />
          <circle cx="100" cy="100" r="10" />
          <path d="M100 62c16 8 22 22 14 34M138 100c-8 16-22 22-34 14M100 138c-16-8-22-22-14-34M62 100c8-16 22-22 34-14" />
        </template>
        <template v-else>
          <rect x="48" y="76" width="104" height="48" rx="3" />
          <rect x="60" y="86" width="28" height="28" rx="2" opacity=".55" />
          <path d="M98 88h42M98 98h32M98 108h38" opacity=".45" />
          <path d="M152 92h10v16h-10" opacity=".5" />
        </template>
      </g>
    </svg>
    <div class="glyph-meta">
      <span>{{ code }}</span>
      <span>{{ product?.sku ?? '—' }}</span>
    </div>
  </div>
</template>
