import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5178/?v=check', { waitUntil: 'networkidle' })
await page.waitForTimeout(3500)
console.log('styles', await page.evaluate(() => {
  const s = getComputedStyle(document.querySelector('.app-shell'))
  return { display: s.display, height: s.height, bg: s.backgroundColor, sheets: document.styleSheets.length, top: document.querySelector('.topbar')?.getBoundingClientRect().top }
}))
await page.screenshot({ path: 'docs/check.png' })
await browser.close()
