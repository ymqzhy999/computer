import { chromium } from 'playwright-core'

const executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await page.goto('http://127.0.0.1:5178/?v=redesign', { waitUntil: 'networkidle' })
await page.waitForTimeout(4500)
await page.screenshot({ path: 'docs/assembly-lab-final.png' })
await browser.close()
console.log('captured')
