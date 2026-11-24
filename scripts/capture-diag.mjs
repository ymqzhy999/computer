import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.goto('http://127.0.0.1:5178/?v=diag2', { waitUntil: 'networkidle' })
await page.waitForTimeout(2200)
await page.locator('.tree-group').first().locator('.option-row').filter({ hasText: 'Intel Core Ultra 9 285K' }).locator('.mini-add').click()
await page.waitForTimeout(600)
await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '配置方案' }).click()
await page.waitForTimeout(800)
const before = await page.locator('.diag-item').count()
await page.locator('.diag-link').first().click()
await page.waitForTimeout(400)
await page.locator('.compat-diagnosis').scrollIntoViewIfNeeded()
await page.waitForTimeout(400)
await page.screenshot({ path: 'docs/builds-diagnosis.png' })
console.log(JSON.stringify({ before, options: await page.locator('.diag-option').count(), errors }))
await browser.close()
