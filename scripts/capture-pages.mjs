import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 })
await page.goto('http://127.0.0.1:5178', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const nav = page.getByRole('navigation', { name: '主导航' })
for (const [label, file] of [['市场价格', 'docs/market-check.png'], ['智能配机', 'docs/smart-check.png'], ['配置方案', 'docs/builds-check.png']]) {
  await nav.getByRole('button', { name: label }).click()
  await page.waitForTimeout(1600)
  await page.screenshot({ path: file })
}
await browser.close()
console.log('captured')
