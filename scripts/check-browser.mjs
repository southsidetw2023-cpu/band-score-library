import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const baseUrl = process.env.APP_URL || 'http://127.0.0.1:4175/'
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ executablePath, headless: true })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

await mkdir('artifacts', { recursive: true })

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  await desktop.goto(baseUrl, { waitUntil: 'networkidle' })
  assert(await desktop.getByRole('heading', { name: '全部樂譜' }).isVisible(), '桌面版未顯示樂譜庫標題')
  assert((await desktop.locator('.song-card').count()) === 30, '桌面版應先顯示 30 首，避免一次渲染 207 張卡片')

  const search = desktop.getByPlaceholder('搜尋歌名、出處、語言或年份')
  await search.fill('Follow')
  await desktop.waitForFunction(() => document.querySelectorAll('.song-card').length === 2)
  assert((await desktop.locator('.song-card').count()) === 2, '搜尋 Follow 應顯示兩個跨分類結果')
  await desktop.locator('.song-card-main').first().click()
  assert(await desktop.getByRole('dialog').isVisible(), '歌曲詳細資料視窗未開啟')
  await desktop.getByRole('button', { name: '關閉歌曲資料' }).click()
  await search.fill('')
  await desktop.screenshot({ path: 'artifacts/library-desktop-verified.png', fullPage: false })

  await desktop.getByRole('button', { name: /本週歌單/ }).first().click()
  assert(await desktop.getByRole('heading', { name: '本週排練歌單' }).isVisible(), '歌單頁未開啟')
  await desktop.getByRole('button', { name: /管理中心/ }).first().click()
  assert(await desktop.getByRole('heading', { name: '管理中心' }).isVisible(), '管理中心未開啟')

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' })
  assert(await mobile.getByRole('heading', { name: '全部樂譜' }).isVisible(), '手機版未顯示樂譜庫標題')
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  assert(!overflow, '手機版出現水平捲動')
  await mobile.screenshot({ path: 'artifacts/library-mobile-verified.png', fullPage: false })

  for (const viewport of [{ width: 375, height: 812 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    const page = await browser.newPage({ viewport, isMobile: viewport.width < 900 })
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    assert(!hasOverflow, `${viewport.width}×${viewport.height} 出現水平捲動`)
    await page.close()
  }

  console.log('瀏覽器驗證完成：207 首資料、分批載入、搜尋、歌曲詳情、歌單、管理中心，以及手機／平板直橫向皆通過。')
} finally {
  await browser.close()
}
