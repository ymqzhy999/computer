const fs = require('fs')
const path = require('path')
const root = path.join(process.cwd(), 'src')
const hexMap = {
  '#44dcff': '#7fa8bd', '#38bdf8': '#8fb6c9', '#ff8a3d': '#c99a63', '#ff6b57': '#d4776b',
  '#ffb547': '#d2a45f', '#f97316': '#c99a63', '#fb923c': '#c99a63', '#10b981': '#86b295',
  '#34d399': '#86b295', '#ef4444': '#cf8378', '#f87171': '#cf8378', '#f59e0b': '#d2a45f',
  '#facc15': '#d2a45f',
}
const rgbMap = [
  [[68, 220, 255], [127, 168, 189]],
  [[56, 189, 248], [143, 182, 201]],
  [[255, 138, 61], [201, 154, 99]],
  [[255, 107, 87], [212, 119, 107]],
  [[255, 181, 71], [210, 164, 95]],
  [[16, 185, 129], [134, 178, 149]],
  [[52, 211, 153], [134, 178, 149]],
  [[239, 68, 68], [207, 131, 120]],
  [[248, 113, 113], [207, 131, 120]],
  [[245, 158, 11], [210, 164, 95]],
  [[250, 204, 21], [210, 164, 95]],
]
const files = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) { if (entry.name !== 'three') walk(full); continue }
    if (!/\.(vue|ts|css)$/.test(entry.name)) continue
    if (entry.name === 'customization.ts') continue
    files.push(full)
  }
}
walk(root)
let total = 0
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8')
  let next = before
  for (const [from, to] of Object.entries(hexMap)) {
    next = next.replace(new RegExp(from, 'gi'), to)
  }
  for (const [[r, g, b], [nr, ng, nb]] of rgbMap) {
    const re = new RegExp(`rgba\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}`, 'gi')
    next = next.replace(re, `rgba(${nr}, ${ng}, ${nb}`)
  }
  if (next !== before) {
    const hits = before.split('\n').filter((line, i) => line !== next.split('\n')[i]).length
    total += hits
    fs.writeFileSync(file, next)
    console.log(path.relative(root, file), hits)
  }
}
console.log('changed lines:', total)
