import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5178/?v=boardfix', { waitUntil: 'networkidle' })
await page.waitForTimeout(2200)
await page.locator('.tree-group').nth(1).locator('.installed-card').click()
await page.waitForTimeout(900)
await page.screenshot({ path: 'docs/motherboard-no-streaks.png' })
console.log(JSON.stringify({ title: await page.locator('.inspector-title').innerText() }))
await browser.close()
