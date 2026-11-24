import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5178/?v=workload', { waitUntil: 'networkidle' })
await page.waitForTimeout(2200)
await page.locator('.tree-group[data-cat="cooler"] .tree-row').click()
await page.waitForTimeout(400)
const cooler = page.locator('.tree-group[data-cat="cooler"] .option-row').filter({ hasText: 'Arctic Liquid Freezer III 360' }).first()
await cooler.locator('.mini-add').click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: '兼容性' }).click()
await page.waitForTimeout(400)
await page.locator('.workload-section').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: 'docs/workload-section.png' })
console.log(JSON.stringify({ text: await page.locator('.workload-section').innerText() }))
await browser.close()
