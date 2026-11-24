import fs from 'node:fs'
import path from 'node:path'
const files = []
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    const s = fs.statSync(p)
    if (s.isDirectory()) walk(p)
    else if (p.endsWith('.vue')) files.push(p)
  }
}
walk('src')
const set = new Set()
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8')
  for (const m of t.matchAll(/class="([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) {
      if (c && !c.includes('{') && !c.includes('}')) set.add(c)
    }
  }
}
console.log([...set].sort().join('\n'))
console.error('TOTAL', set.size)
