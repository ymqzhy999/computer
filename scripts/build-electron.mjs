import esbuild from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('dist-electron', { recursive: true })

await esbuild.build({
  entryPoints: ['electron/main.ts'],
  outfile: 'dist-electron/main.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['electron'],
  sourcemap: false,
})

await esbuild.build({
  entryPoints: ['electron/preload.ts'],
  outfile: 'dist-electron/preload.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  sourcemap: false,
})

console.log('✓ Electron main and preload scripts successfully built.')
