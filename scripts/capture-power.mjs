import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await page.goto('http://127.0.0.1:5178/?v=power', { waitUntil: 'networkidle' })
await page.waitForTimeout(3500)
const power = page.locator('button', { hasText: '通电' }).first()
if (await power.count()) await power.click()
await page.waitForTimeout(1600)
await page.screenshot({ path: 'docs/assembly-lab-power.png' })
await browser.close()
console.log('captured power')
