import { chromium } from 'playwright-core'

const baseUrl = process.env.APP_URL || 'http://127.0.0.1:4175/'
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ executablePath, headless: true })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, serviceWorkers: 'block' })
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  await page.route('**/api/session', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ user: { id: 'test-user', email: 'member@example.com', name: '測試團員', picture: '', canUpload: true, isAdmin: false } }),
  }))
  await page.addInitScript(() => {
    window.sessionStorage.setItem('ensemble-google-credential', 'test-credential')
    window.localStorage.removeItem('ensemble-live-original-scale')
    window.localStorage.setItem('ensemble-live-score-view', 'live')
  })
  await page.goto(baseUrl, { waitUntil: 'load' })
  console.log('1/4 正式站已載入')
  await page.getByPlaceholder('搜尋歌名、出處、語言或年份').fill('How Much Do I Love You')
  await page.waitForFunction(() => document.querySelectorAll('.song-card').length === 1)
  console.log('1c/4 已找到測試歌曲')
  await page.locator('.song-card-main').click()
  await page.getByRole('button', { name: /現場模式/ }).click()
  console.log('1d/4 已進入現場模式')
  await page.getByRole('button', { name: '原始譜' }).click()
  await page.locator('.performance-pdf-page canvas').first().waitFor()
  console.log('2/4 原始 PDF 已載入')

  const scoreWrap = page.locator('.performance-sheet-wrap')
  const scorePage = page.locator('.performance-pdf-page').first()
  const canvas = page.locator('.performance-pdf-page canvas').first()
  const pageBox = await scorePage.boundingBox()
  assert(pageBox, '找不到手機原始譜頁面')

  await page.getByRole('button', { name: '放大原始歌譜' }).click()
  await page.waitForFunction(() => document.querySelector('.font-stepper span')?.textContent === '110%')
  await page.waitForTimeout(1_500)
  const stablePageBox = await scorePage.boundingBox()
  const enlargedCanvasBox = await canvas.boundingBox()
  assert(stablePageBox && Math.abs(stablePageBox.width - pageBox.width) < 1, '放大後 PDF 量測外框被畫布反向撐大')
  assert(enlargedCanvasBox && enlargedCanvasBox.x >= pageBox.x - 1, '放大後原始譜左側跑出可捲動範圍')
  assert(enlargedCanvasBox && enlargedCanvasBox.width > pageBox.width * 1.08 && enlargedCanvasBox.width < pageBox.width * 1.12, '110% 放大比例持續失控倍增')

  const metrics = await scoreWrap.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  assert(metrics.scrollWidth > metrics.clientWidth, '放大後原始譜無法橫向捲動')
  console.log('3/4 按鈕放大與橫向捲動通過')

  for (let index = 0; index < 9; index += 1) await page.getByRole('button', { name: '放大原始歌譜' }).click()
  await page.waitForFunction(() => document.querySelector('.font-stepper span')?.textContent === '200%')
  await page.waitForTimeout(1_500)
  const doubledPageBox = await scorePage.boundingBox()
  const doubledCanvasBox = await canvas.boundingBox()
  assert(doubledPageBox && Math.abs(doubledPageBox.width - pageBox.width) < 1, '連續放大後 PDF 量測外框被畫布反向撐大')
  assert(doubledCanvasBox && doubledCanvasBox.width > pageBox.width * 1.98 && doubledCanvasBox.width < pageBox.width * 2.02, '200% 放大比例持續失控倍增')

  await scoreWrap.evaluate((target) => {
    const makeTouch = (identifier, clientX) => new Touch({ identifier, target, clientX, clientY: 520 })
    const startTouches = [makeTouch(1, 130), makeTouch(2, 245)]
    const movedTouches = [makeTouch(1, 85), makeTouch(2, 290)]
    target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: startTouches, changedTouches: startTouches }))
    target.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: movedTouches, changedTouches: movedTouches }))
    target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: movedTouches }))
  })
  await page.waitForFunction(() => Number.parseInt(document.querySelector('.font-stepper span')?.textContent || '0', 10) > 110)
  assert(await page.getByText('PDF 依原檔顯示，可雙指縮放').isVisible(), '原始譜未提示雙指縮放')
  assert(Number(await page.evaluate(() => window.localStorage.getItem('ensemble-live-original-scale'))) > 1.1, '雙指縮放比例沒有儲存')
  console.log('4/4 雙指縮放與比例記憶通過')

  await page.screenshot({ path: 'artifacts/live-original-mobile-zoom-verified.png', fullPage: false })
  await page.setViewportSize({ width: 844, height: 390 })
  const landscapePageBox = await scorePage.boundingBox()
  const landscapeCanvasBox = await canvas.boundingBox()
  assert(landscapePageBox && landscapeCanvasBox && landscapeCanvasBox.x >= landscapePageBox.x - 1, '手機橫向時原始譜左側跑出可捲動範圍')
  console.log('手機原始譜驗證完成：按鈕放大不跑版、可橫向捲動、雙指縮放、比例記憶與橫向畫面皆通過。')
} finally {
  await browser.close()
}
