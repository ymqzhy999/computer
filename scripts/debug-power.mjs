import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (msg) => console.log('console:', msg.type(), msg.text()))
page.on('pageerror', (err) => console.log('pageerror:', err.message))
await page.goto('http://127.0.0.1:5178/?v=debugpower', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
console.log('before', page.url(), await page.locator('.app-shell').count(), await page.locator('.tool-btn').count())
const power = page.locator('button', { hasText: '通电' }).first()
console.log('power count', await power.count())
await power.click()
await page.waitForTimeout(1500)
console.log('after', page.url(), await page.locator('.app-shell').count(), await page.locator('.tool-btn').count())
await page.screenshot({ path: 'docs/debug-power.png' })
await browser.close()
