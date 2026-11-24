import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5178/?v=collapse', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.locator('.panel-edge--left').click()
await page.locator('.panel-edge--right').click()
await page.waitForTimeout(1000)
await page.screenshot({ path: 'docs/assembly-lab-collapsed.png' })
const state = await page.evaluate(() => ({
  doc: document.documentElement.scrollWidth,
  win: window.innerWidth,
  left: document.querySelector('.lab-layout')?.className,
  canvas: document.querySelector('.workbench')?.getBoundingClientRect().toJSON(),
}))
console.log(JSON.stringify(state))
await browser.close()
