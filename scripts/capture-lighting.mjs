import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5178/?v=lighting', { waitUntil: 'networkidle' })
await page.waitForTimeout(2400)

for (const name of ['bright', 'studio', 'night']) {
  if (name !== 'bright') {
    await page.locator('.tool-btn--lighting').click()
    await page.waitForTimeout(900)
  }
  await page.screenshot({ path: `docs/lighting-${name}.png` })
  console.log(name, await page.locator('.tool-btn--lighting .tool-btn__badge').innerText())
}

await browser.close()
