import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.goto('http://127.0.0.1:5178/?v=tutorial2', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await page.getByRole('button', { name: '真实装机教程', exact: true }).click()
await page.waitForTimeout(700)
const visible1 = await page.locator('.diy-console').isVisible()
const title1 = await page.locator('.hud-top-left h1').innerText()
await page.getByRole('button', { name: /下一步/ }).first().click()
await page.waitForTimeout(700)
const title2 = await page.locator('.hud-top-left h1').innerText()
console.log(JSON.stringify({ visible1, title1, title2, errors }))
await browser.close()
