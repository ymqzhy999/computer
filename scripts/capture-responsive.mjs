import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto('http://127.0.0.1:5178/?v=responsive', { waitUntil: 'networkidle' })
await page.waitForTimeout(3500)
await page.screenshot({ path: 'docs/assembly-lab-1280.png' })
const overflow = await page.evaluate(() => ({
  doc: document.documentElement.scrollWidth,
  win: window.innerWidth,
  timeline: document.querySelector('.timeline')?.getBoundingClientRect().toJSON(),
}))
console.log(JSON.stringify(overflow))
await browser.close()
