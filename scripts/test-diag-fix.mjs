import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.goto('http://127.0.0.1:5178/?v=diagfix', { waitUntil: 'networkidle' })
await page.waitForTimeout(2200)
await page.locator('.tree-group').first().locator('.option-row').filter({ hasText: 'Intel Core Ultra 9 285K' }).locator('.mini-add').click()
await page.waitForTimeout(600)
await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '配置方案' }).click()
await page.waitForTimeout(800)
const before = await page.locator('.diag-item').count()
await page.locator('.diag-link').first().click()
await page.waitForTimeout(400)
const optionText = await page.locator('.diag-option').first().innerText()
await page.locator('.diag-option').first().click()
await page.waitForTimeout(900)
const after = await page.locator('.diag-item').count()
const clear = await page.locator('.diag-clear').count()
const status = await page.locator('.compat-pill').innerText()
console.log(JSON.stringify({ before, optionText, after, clear, status, errors }))
await page.screenshot({ path: 'docs/builds-diagnosis-fixed.png' })
await browser.close()
