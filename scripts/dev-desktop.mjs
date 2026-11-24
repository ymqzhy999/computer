import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import http from 'node:http'

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

// 1. Build electron scripts
const buildProc = spawn('node', ['scripts/build-electron.mjs'], { stdio: 'inherit', shell: true })
await new Promise((resolve, reject) => {
  buildProc.on('close', (code) => (code === 0 ? resolve() : reject(new Error('Build electron failed'))))
})

// 2. Ensure Vite server is active
const isViteUp = await checkPort(5173)
let viteProcess = null

if (!isViteUp) {
  console.log('Starting Vite server for desktop dev...')
  viteProcess = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '5173'], {
    stdio: 'pipe',
    shell: true,
  })
  // Wait until server is listening
  let ready = false
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 600))
    if (await checkPort(5173)) {
      ready = true
      break
    }
  }
  if (!ready) {
    console.error('Timed out waiting for Vite server.')
    process.exit(1)
  }
}

console.log('✓ Vite server ready. Launching Electron...')

// 3. Launch Electron
const electronProc = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173/',
    NODE_ENV: 'development',
  },
})

electronProc.on('close', () => {
  if (viteProcess) {
    viteProcess.kill()
  }
  process.exit(0)
})
