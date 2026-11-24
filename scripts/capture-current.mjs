import { chromium } from 'playwright-core'

const executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
await page.goto('http://127.0.0.1:5178/?v=current', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.screenshot({ path: 'docs/current-lab.png' })
await page.getByRole('button', { name: '配置方案' }).click()
await page.waitForTimeout(1500)
await page.screenshot({ path: 'docs/current-builds.png', fullPage: true })
await browser.close()
console.log('captured')
