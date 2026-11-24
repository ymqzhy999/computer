import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5178/?v=probe', { waitUntil: 'networkidle' })
await page.waitForTimeout(2200)
const groups = await page.locator('.tree-group').evaluateAll((items) =>
  items.slice(0, 3).map((g) => ({
    cls: g.className,
    text: g.textContent?.replace(/\s+/g, ' ').trim().slice(0, 240),
    buttons: [...g.querySelectorAll('button')].slice(0, 8).map((b) => ({
      cls: b.className,
      title: b.getAttribute('title'),
      text: b.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80),
    })),
  })),
)
console.log(JSON.stringify(groups, null, 2))
await browser.close()
