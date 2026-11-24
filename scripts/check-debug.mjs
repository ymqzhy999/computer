import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.goto('http://127.0.0.1:5178/?v=debug', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
const buttons = await page.locator('.viewport-tools .tool-btn').evaluateAll((items) =>
  items.map((item) => ({ title: item.getAttribute('title'), text: item.textContent?.trim() })),
)
console.log(JSON.stringify({ buttons, errors }))
await browser.close()
