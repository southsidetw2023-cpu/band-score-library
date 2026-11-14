import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const baseUrl = process.env.APP_URL || 'http://127.0.0.1:4175/'
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const themes = [
  { id: 'slate-blue', label: 'A-cool-slate-blue' },
  { id: 'forest-green', label: 'B-deep-forest-green' },
  { id: 'mono-blue', label: 'C-monochrome-blue-accent' },
]

await mkdir('artifacts/color-previews', { recursive: true })
const browser = await chromium.launch({ executablePath, headless: true })

try {
  for (const theme of themes) {
    for (const target of [
      { name: 'desktop', viewport: { width: 1440, height: 1100 }, isMobile: false },
      { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true },
    ]) {
      const page = await browser.newPage({ viewport: target.viewport, isMobile: target.isMobile })
      const url = new URL(baseUrl)
      url.searchParams.set('theme', theme.id)
      await page.goto(url.toString(), { waitUntil: 'networkidle' })
      await page.getByRole('heading', { name: '全部樂譜' }).waitFor()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      if (overflow) throw new Error(`${theme.id} ${target.name} 出現水平捲動`)
      await page.screenshot({
        path: `artifacts/color-previews/${theme.label}-${target.name}.png`,
        fullPage: false,
      })
      await page.close()
    }
  }
  console.log('完成三套配色的桌機與手機預覽。')
} finally {
  await browser.close()
}
