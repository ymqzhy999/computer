import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5178/?v=tutorialshot', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await page.getByRole('button', { name: '真实装机教程', exact: true }).click()
await page.waitForTimeout(900)
await page.getByRole('button', { name: /下一步/ }).first().click()
await page.waitForTimeout(900)
await page.screenshot({ path: 'docs/assembly-lab-tutorial.png' })
await browser.close()
