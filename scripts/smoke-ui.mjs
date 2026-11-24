import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.goto('http://127.0.0.1:5178/?v=smoke2', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

const search = page.locator('.global-search input')
await search.fill('RTX 5090')
await page.waitForTimeout(500)
const hits = await page.locator('.global-results button').count()
if (hits > 0) await page.locator('.global-results button').first().click()
await page.waitForTimeout(600)

await page.getByRole('tablist', { name: '组件信息分类' }).getByRole('button', { name: '技术参数' }).click()
await page.waitForTimeout(200)
const specsVisible = await page.locator('.spec-table').first().isVisible()
await page.getByRole('tablist', { name: '组件信息分类' }).getByRole('button', { name: '市场价格' }).click()
await page.waitForTimeout(200)
const priceVisible = await page.locator('.price-main').first().isVisible()

await page.locator('.viewport-tools .tool-btn').nth(1).click()
await page.waitForTimeout(300)
const debugTitle = await page.locator('.viewport-tools .tool-btn').nth(1).getAttribute('title')

console.log(JSON.stringify({ hits, specsVisible, priceVisible, debugTitle, errors }))
await browser.close()
