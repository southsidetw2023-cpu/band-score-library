import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const baseUrl = process.env.APP_URL || 'http://127.0.0.1:4175/'
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ executablePath, headless: true })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function assertRhythmRowsInline(page, label) {
  const rows = page.locator('.performance-sheet .rhythm-row')
  assert((await rows.count()) === 4, `${label}應有 4 列單行節奏和弦`)
  const isInline = await rows.first().evaluate((row) => {
    const visibleItems = Array.from(row.querySelectorAll('.chord, .lyrics'))
      .filter((element) => element.textContent?.trim())
      .map((element) => element.getBoundingClientRect().top)
    return Math.max(...visibleItems) - Math.min(...visibleItems) < 3
  })
  assert(isInline, `${label}和弦與拍點仍被拆成上下兩層`)
}

await mkdir('artifacts', { recursive: true })

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  await desktop.goto(baseUrl, { waitUntil: 'load' })
  assert(await desktop.getByRole('heading', { name: '全部樂譜' }).isVisible(), '桌面版未顯示樂譜庫標題')
  assert((await desktop.locator('.song-card').count()) === 30, '桌面版應先顯示 30 首，避免一次渲染 207 張卡片')
  assert((await desktop.locator('.song-card h3').first().textContent()) === 'Jesus Christ alone', '樂譜庫未依年份與新增順序由新到舊排列')
  assert(await desktop.getByText('依年份新到舊排列 · 點選歌曲查看完整資料').isVisible(), '樂譜庫未顯示目前排序規則')

  const search = desktop.getByPlaceholder('搜尋歌名、出處、語言或年份')
  await search.fill('Follow')
  await desktop.waitForFunction(() => document.querySelectorAll('.song-card').length === 2)
  assert((await desktop.locator('.song-card').count()) === 2, '搜尋 Follow 應顯示兩個跨分類結果')
  await desktop.locator('.song-card-main').first().click()
  assert(await desktop.getByRole('dialog').isVisible(), '歌曲詳細資料視窗未開啟')
  const resourceLinks = desktop.getByRole('dialog').locator('.resource-link[href]')
  assert((await resourceLinks.count()) > 0, '歌曲詳細資料中沒有可開啟的資源連結')
  for (let index = 0; index < await resourceLinks.count(); index += 1) {
    const href = await resourceLinks.nth(index).getAttribute('href')
    assert(/^https?:\/\//i.test(href ?? ''), `歌曲資源連結不是有效網址：${href}`)
  }
  await desktop.getByRole('button', { name: '關閉歌曲資料' }).click()
  await search.fill('')

  await search.fill('All Things New')
  await desktop.waitForFunction(() => document.querySelectorAll('.song-card').length === 1)
  await desktop.locator('.song-card-main').click()
  await desktop.getByRole('button', { name: /現場模式/ }).click()
  const alignedOpening = desktop.locator('.structured-chords-positioned[aria-label="A E/A"]').first()
  await alignedOpening.waitFor()
  const alignedOpeningTokens = alignedOpening.locator(':scope > span')
  assert((await alignedOpeningTokens.count()) === 2, 'All Things New 的 A E/A 沒有拆成兩個定位和弦')
  const openingA = await alignedOpeningTokens.nth(0).boundingBox()
  const openingEA = await alignedOpeningTokens.nth(1).boundingBox()
  assert(openingA && openingEA && openingEA.x - openingA.x > 75, 'All Things New 的 A 與 E/A 仍未依原稿拉開距離')
  assert((await alignedOpening.locator('xpath=following-sibling::*[1]').textContent()) === '喔主你賜我新生命', 'All Things New 的定位和弦沒有對應正確歌詞')
  await desktop.screenshot({ path: 'artifacts/all-things-new-alignment-verified.png', fullPage: false })
  await desktop.getByRole('button', { name: '關閉現場和弦譜' }).click()
  await search.fill('')

  await search.fill('How Much Do I Love You')
  await desktop.waitForFunction(() => document.querySelectorAll('.song-card').length === 1)
  await desktop.locator('.song-card-main').click()
  assert(await desktop.getByText('D', { exact: true }).isVisible(), '測試歌曲未顯示原調 D')
  await desktop.getByRole('button', { name: /現場模式/ }).click()
  assert(await desktop.getByRole('heading', { level: 2, name: 'How Much Do I Love You' }).isVisible(), '現場和弦譜未開啟')
  assert((await desktop.locator('.key-stepper strong').textContent()) === 'D', '現場和弦譜初始 Key 應為 D')
  await desktop.locator('.performance-sheet .chord', { hasText: 'Gmaj7' }).first().waitFor()
  assert(await desktop.locator('.performance-sheet .chord', { hasText: 'Gmaj7' }).first().isVisible(), '原調和弦內容未渲染')
  await assertRhythmRowsInline(desktop, '桌面版')
  assert(await desktop.getByRole('button', { name: '現場譜' }).getAttribute('aria-pressed') === 'true', '現場模式沒有預設顯示現場譜')
  await desktop.getByRole('button', { name: '原始譜' }).click()
  assert(await desktop.getByRole('button', { name: '原始譜' }).getAttribute('aria-pressed') === 'true', '無法切換到原始譜')
  assert(await desktop.getByText('PDF 依原檔顯示，可雙指縮放').isVisible(), '原始譜模式沒有說明可雙指縮放')
  assert(await desktop.locator('.performance-pdf-shell').isVisible(), '原始譜沒有在現場模式內顯示')
  assert(!(await desktop.getByRole('button', { name: '升高一個半音' }).isVisible()), '原始譜模式仍顯示移調控制')
  await desktop.getByRole('button', { name: '現場譜' }).click()
  await desktop.locator('.performance-sheet .chord', { hasText: 'Gmaj7' }).first().waitFor()
  await desktop.getByRole('button', { name: '升高一個半音' }).click()
  await desktop.waitForFunction(() => document.querySelector('.key-stepper strong')?.textContent === 'Eb')
  await desktop.locator('.performance-sheet .chord', { hasText: 'Abmaj7' }).first().waitFor()
  assert(await desktop.locator('.performance-sheet .chord', { hasText: 'Abmaj7' }).first().isVisible(), '升 Key 後和弦未同步轉調')
  await desktop.getByRole('button', { name: '關閉現場和弦譜' }).click()

  await desktop.locator('.song-card-main').click()
  await desktop.getByRole('button', { name: /現場模式/ }).click()
  assert((await desktop.locator('.key-stepper strong').textContent()) === 'Eb', '現場模式未記住最後選擇的 Key')
  await desktop.getByRole('button', { name: '恢復原調' }).click()
  await desktop.waitForFunction(() => document.querySelector('.key-stepper strong')?.textContent === 'D')
  await desktop.locator('.performance-sheet .chord', { hasText: 'Gmaj7' }).first().waitFor()
  await desktop.screenshot({ path: 'artifacts/live-chords-desktop-verified.png', fullPage: false })
  await desktop.getByRole('button', { name: '關閉現場和弦譜' }).click()
  await search.fill('')
  await desktop.screenshot({ path: 'artifacts/library-desktop-verified.png', fullPage: false })

  await desktop.evaluate(() => {
    window.localStorage.setItem('ensemble-setlist', JSON.stringify([
      '敬拜-088-how-much-do-i-love-you',
      '讚美-073-天上的門打開',
    ]))
  })
  await desktop.reload({ waitUntil: 'load' })
  await desktop.getByRole('button', { name: /本週歌單/ }).first().click()
  assert(await desktop.getByRole('heading', { name: '本週排練歌單' }).isVisible(), '歌單頁未開啟')
  await desktop.getByRole('button', { name: '將 天上的門打開 往上移' }).click()
  assert((await desktop.locator('.setlist-card li').first().locator('.setlist-song strong').textContent()) === '天上的門打開', '往上按鈕沒有更新歌單順序')
  await desktop.reload({ waitUntil: 'load' })
  await desktop.getByRole('button', { name: /本週歌單/ }).first().click()
  assert((await desktop.locator('.setlist-card li').first().locator('.setlist-song strong').textContent()) === '天上的門打開', '調整後的歌單順序沒有儲存')
  await desktop.getByRole('button', { name: '將 天上的門打開 往下移' }).click()
  const firstDragHandle = desktop.getByRole('button', { name: '拖曳調整 How Much Do I Love You 的順序' })
  const firstHandleBox = await firstDragHandle.boundingBox()
  const secondRowBox = await desktop.locator('.setlist-card li').nth(1).boundingBox()
  assert(firstHandleBox && secondRowBox, '找不到歌單拖曳位置')
  await desktop.mouse.move(firstHandleBox.x + firstHandleBox.width / 2, firstHandleBox.y + firstHandleBox.height / 2)
  await desktop.mouse.down()
  await desktop.mouse.move(secondRowBox.x + secondRowBox.width / 2, secondRowBox.y + secondRowBox.height / 2, { steps: 5 })
  await desktop.mouse.up()
  assert((await desktop.locator('.setlist-card li').first().locator('.setlist-song strong').textContent()) === '天上的門打開', '拖曳把手沒有更新歌單順序')
  await desktop.getByRole('button', { name: '將 天上的門打開 往下移' }).click()
  await desktop.getByRole('button', { name: '進入現場模式' }).click()
  assert(await desktop.getByRole('heading', { level: 2, name: 'How Much Do I Love You' }).isVisible(), '演出歌單沒有從第一首開始')
  await desktop.screenshot({ path: 'artifacts/live-set-desktop-verified.png', fullPage: false })
  await desktop.getByRole('button', { name: '下一首歌' }).click()
  assert(await desktop.getByRole('heading', { level: 2, name: '天上的門打開' }).isVisible(), '下一首按鈕沒有切換演出歌曲')
  await desktop.locator('.performance-sheet .chord', { hasText: 'F#m7' }).first().waitFor()
  await desktop.getByRole('button', { name: '升高一個半音' }).click()
  await desktop.locator('.performance-sheet .chord', { hasText: 'Gm7' }).first().waitFor()
  assert((await desktop.locator('.key-stepper strong').textContent()) === 'Bb', '天上的門打開升 Key 後沒有更新目前 Key')
  await desktop.getByRole('button', { name: '上一首歌' }).click()
  for (let index = 0; index < 5; index += 1) await desktop.getByRole('button', { name: '縮小字體' }).click()
  assert((await desktop.locator('.font-stepper span').textContent()) === '50%', '字體縮放下限應為 50%')
  await desktop.getByRole('button', { name: '關閉現場和弦譜' }).click()
  await desktop.getByRole('button', { name: /樂譜庫/ }).first().click()
  await search.fill('一直到永遠')
  await desktop.waitForFunction(() => document.querySelectorAll('.song-card').length === 1)
  await desktop.locator('.song-card-main').click()
  await desktop.getByRole('button', { name: /現場模式/ }).click()
  assert(await desktop.getByRole('heading', { level: 2, name: '一直到永遠' }).isVisible(), '沒有歌譜的歌曲無法進入現場模式')
  assert(await desktop.getByText('這首歌尚未提供歌譜').isVisible(), '完全缺少歌譜時沒有清楚提示')
  await desktop.getByRole('combobox', { name: '設定 一直到永遠 的演出 Key' }).selectOption('A')
  await desktop.getByRole('button', { name: '關閉現場和弦譜' }).click()
  await search.fill('')
  await desktop.getByRole('button', { name: /管理中心/ }).first().click()
  assert(await desktop.getByRole('heading', { name: '管理中心' }).isVisible(), '管理中心未開啟')
  assert(await desktop.getByText('目前沒有上傳權限').isVisible(), '未登入且沒有分享網址時沒有鎖定檔案上傳')
  assert(await desktop.getByText('Google 登入尚未完成正式環境設定。').first().isVisible(), '未設定 Google Client ID 時沒有清楚提示')
  assert(await desktop.getByText('取得上傳權限後顯示紀錄。').isVisible(), '未授權時沒有隱藏上傳紀錄')

  const shared = await browser.newPage({ viewport: { width: 1100, height: 900 } })
  await shared.goto(`${baseUrl}#upload=${'a'.repeat(43)}`, { waitUntil: 'load' })
  assert(await shared.getByText('你正透過分享網址上傳，不需要登入。').isVisible(), '分享網址沒有直接開啟免登入上傳模式')
  assert(await shared.getByText('選擇檔案，或拖曳到這裡').isVisible(), '分享網址持有者沒有顯示上傳表單')
  assert(!shared.url().includes('#upload='), '分享憑證沒有從網址列移除')
  await shared.close()

  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, reducedMotion: 'reduce' })
  await mobile.goto(baseUrl, { waitUntil: 'load' })
  assert(await mobile.getByRole('heading', { name: '全部樂譜' }).isVisible(), '手機版未顯示樂譜庫標題')
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  assert(!overflow, '手機版出現水平捲動')
  await mobile.getByPlaceholder('搜尋歌名、出處、語言或年份').fill('How Much Do I Love You')
  await mobile.waitForFunction(() => document.querySelectorAll('.song-card').length === 1)
  await mobile.locator('.song-card-main').click()
  await mobile.getByRole('button', { name: /現場模式/ }).click()
  await mobile.locator('.performance-sheet .chord', { hasText: 'Gmaj7' }).first().waitFor()
  await assertRhythmRowsInline(mobile, '手機版')
  await mobile.getByRole('button', { name: '原始譜' }).click()
  assert(await mobile.locator('.performance-pdf-shell').isVisible(), '手機版無法切換到原始譜')
  await mobile.locator('.performance-pdf-page canvas').first().waitFor()
  const originalPage = mobile.locator('.performance-pdf-page').first()
  const originalCanvas = mobile.locator('.performance-pdf-page canvas').first()
  const originalPageBox = await originalPage.boundingBox()
  const originalCanvasBox = await originalCanvas.boundingBox()
  assert(originalPageBox && originalCanvasBox, '手機原始譜沒有可量測的頁面')
  await mobile.getByRole('button', { name: '放大原始歌譜' }).click()
  await mobile.waitForFunction(() => document.querySelector('.font-stepper span')?.textContent === '110%')
  const enlargedCanvasBox = await originalCanvas.boundingBox()
  assert(enlargedCanvasBox && enlargedCanvasBox.x >= originalPageBox.x - 1, '手機原始譜放大後左側跑出可捲動範圍')
  const originalScrollMetrics = await mobile.locator('.performance-sheet-wrap').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  assert(originalScrollMetrics.scrollWidth > originalScrollMetrics.clientWidth, '手機原始譜放大後沒有可橫向捲動')
  await mobile.locator('.performance-sheet-wrap').evaluate((target) => {
    const makeTouch = (identifier, clientX, clientY) => new Touch({ identifier, target, clientX, clientY })
    const startTouches = [makeTouch(1, 130, 520), makeTouch(2, 245, 520)]
    const movedTouches = [makeTouch(1, 85, 520), makeTouch(2, 290, 520)]
    target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: startTouches, changedTouches: startTouches }))
    target.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: movedTouches, changedTouches: movedTouches }))
    target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: movedTouches }))
  })
  await mobile.waitForFunction(() => Number.parseInt(document.querySelector('.font-stepper span')?.textContent || '0', 10) > 110)
  assert(await mobile.getByText('PDF 依原檔顯示，可雙指縮放').isVisible(), '手機原始譜沒有提示雙指縮放')
  await mobile.screenshot({ path: 'artifacts/live-original-mobile-verified.png', fullPage: false })
  await mobile.getByRole('button', { name: '現場譜' }).click()
  await mobile.locator('.performance-sheet .chord', { hasText: 'Gmaj7' }).first().waitFor()
  const mobileLiveOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  assert(!mobileLiveOverflow, '手機現場模式出現水平捲動')
  for (const accessibleName of ['現場譜', '原始譜', '降低一個半音', '升高一個半音', '關閉現場和弦譜']) {
    const box = await mobile.getByRole('button', { name: accessibleName }).boundingBox()
    assert(box && box.width >= 44 && box.height >= 44, `${accessibleName} 的觸控範圍小於 44px`)
  }
  await mobile.locator('.performance-sheet-wrap').evaluate((element) => { element.scrollTop = 600 })
  await mobile.waitForFunction(() => document.querySelector('.performance-header')?.classList.contains('is-collapsed'))
  assert(await mobile.getByRole('button', { name: '展開現場模式控制列' }).isVisible(), '往下滑動後沒有顯示精簡控制列')
  assert((await mobile.locator('.performance-compact-header strong').textContent()) === 'How Much Do I Love You', '精簡控制列沒有顯示歌曲名稱')
  assert((await mobile.locator('.performance-compact-header span').textContent())?.includes('D'), '精簡控制列沒有顯示目前 Key')
  assert(!(await mobile.getByRole('button', { name: '降低一個半音' }).isVisible()), '收合後仍顯示完整 Key 控制器')
  await mobile.waitForTimeout(250)
  await mobile.screenshot({ path: 'artifacts/live-chords-mobile-collapsed-verified.png', fullPage: false })
  await mobile.getByRole('button', { name: '展開現場模式控制列' }).click()
  await mobile.waitForFunction(() => !document.querySelector('.performance-header')?.classList.contains('is-collapsed'))
  assert(await mobile.getByRole('button', { name: '降低一個半音' }).isVisible(), '點擊精簡列後沒有展開完整控制區')
  await mobile.screenshot({ path: 'artifacts/live-chords-mobile-verified.png', fullPage: false })
  await mobile.getByRole('button', { name: '關閉現場和弦譜' }).click()
  await mobile.screenshot({ path: 'artifacts/library-mobile-verified.png', fullPage: false })

  await mobile.getByPlaceholder('搜尋歌名、出處、語言或年份').fill('Praise')
  const praiseCard = mobile.locator('.song-card').filter({ has: mobile.getByRole('heading', { name: 'Praise', exact: true }) })
  await praiseCard.locator('.song-card-main').click()
  await mobile.getByRole('button', { name: /現場模式/ }).click()
  await mobile.locator('.performance-sheet .chord', { hasText: 'Am7' }).first().waitFor()
  assert(await mobile.locator('.performance-sheet .lyrics', { hasText: 'Praise ' }).first().isVisible(), 'Praise 結構化歌詞沒有顯示')
  await mobile.getByRole('button', { name: '升高一個半音' }).click()
  await mobile.locator('.performance-sheet .chord', { hasText: 'Bbm7' }).first().waitFor()
  assert(await mobile.locator('.performance-sheet .chord', { hasText: 'Bbm7' }).first().isVisible(), 'Praise 升 Key 後和弦未同步轉調')
  await mobile.getByRole('button', { name: '關閉現場和弦譜' }).click()

  for (const example of [
    { title: 'The Joy', originalKey: 'F', targetKey: 'F#', chord: 'F# B/F# F#' },
    { title: '在呼召我之處', originalKey: 'E', targetKey: 'F', chord: 'F Bb/F F Eb/F F', verified: true },
    { title: 'God is Here 神同在', originalKey: 'D', targetKey: 'Eb', chord: 'Eb' },
  ]) {
    await mobile.getByPlaceholder('搜尋歌名、出處、語言或年份').fill(example.title)
    const card = mobile.locator('.song-card').filter({ has: mobile.getByRole('heading', { name: example.title, exact: true }) })
    await card.locator('.song-card-main').click()
    await mobile.getByRole('button', { name: /現場模式/ }).click()
    await mobile.getByRole('heading', { level: 2, name: example.title, exact: true }).waitFor()
    await mobile.locator('.structured-performance-sheet').waitFor()
    await mobile.waitForFunction((key) => document.querySelector('.key-stepper strong')?.textContent === key, example.originalKey)
    assert((await mobile.locator('.key-stepper strong').textContent()) === example.originalKey, `${example.title} 沒有顯示原調`)
    if (example.verified) assert((await mobile.locator('.performance-title-row p').textContent())?.includes('已對照原始歌譜與歌詞完成校對'), `${example.title} 沒有顯示已校對狀態`)
    assert((await mobile.locator('.performance-pdf-page canvas').count()) === 0, `${example.title} 仍在載入 PDF`)
    await mobile.getByRole('button', { name: '升高一個半音' }).click()
    assert((await mobile.locator('.key-stepper strong').textContent()) === example.targetKey, `${example.title} 沒有更新目前 Key`)
    await mobile.locator('.structured-chords', { hasText: example.chord }).first().waitFor()
    assert(await mobile.locator('.structured-chords', { hasText: example.chord }).first().isVisible(), `${example.title} 和弦沒有同步轉調`)
    await mobile.getByRole('button', { name: '關閉現場和弦譜' }).click()
  }

  await mobile.evaluate(() => {
    window.localStorage.setItem('ensemble-setlist', JSON.stringify([
      '敬拜-088-how-much-do-i-love-you',
      '讚美-073-天上的門打開',
    ]))
  })
  await mobile.reload({ waitUntil: 'load' })
  await mobile.getByRole('button', { name: /本週歌單/ }).click()
  for (const accessibleName of ['拖曳調整 How Much Do I Love You 的順序', '將 天上的門打開 往上移', '從歌單移除 How Much Do I Love You']) {
    const box = await mobile.getByRole('button', { name: accessibleName }).boundingBox()
    assert(box && box.width >= 44 && box.height >= 44, `${accessibleName} 的觸控範圍小於 44px`)
  }
  await mobile.getByRole('button', { name: '將 天上的門打開 往上移' }).click()
  assert((await mobile.locator('.setlist-card li').first().locator('.setlist-song strong').textContent()) === '天上的門打開', '手機版無法調整歌單順序')
  await mobile.getByRole('button', { name: '將 天上的門打開 往下移' }).click()
  await mobile.getByRole('button', { name: '進入現場模式' }).click()
  await mobile.getByRole('button', { name: '下一首歌' }).click()
  await mobile.getByRole('button', { name: '上一首歌' }).click()
  await mobile.screenshot({ path: 'artifacts/live-set-mobile-verified.png', fullPage: false })
  await mobile.evaluate(() => {
    const target = document.querySelector('.performance-sheet-wrap')
    if (!target) throw new Error('找不到現場歌譜滑動區')
    const start = new Touch({ identifier: 1, target, clientX: 320, clientY: 420 })
    const end = new Touch({ identifier: 1, target, clientX: 80, clientY: 426 })
    target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, changedTouches: [start] }))
    target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [end] }))
  })
  assert(await mobile.getByRole('heading', { level: 2, name: '天上的門打開' }).isVisible(), '手機左滑沒有切換到下一首歌')
  await mobile.getByRole('button', { name: '關閉現場和弦譜' }).click()

  await mobile.evaluate(() => navigator.serviceWorker.ready)
  await mobile.reload({ waitUntil: 'load' })
  await mobile.context().setOffline(true)
  await mobile.reload({ waitUntil: 'domcontentloaded' })
  assert(await mobile.getByRole('heading', { name: '全部樂譜' }).isVisible(), '離線時無法開啟已快取的合奏庫')
  await mobile.context().setOffline(false)

  for (const viewport of [{ width: 375, height: 812 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    const page = await browser.newPage({ viewport, isMobile: viewport.width < 900 })
    await page.goto(baseUrl, { waitUntil: 'load' })
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    assert(!hasOverflow, `${viewport.width}×${viewport.height} 出現水平捲動`)
    await page.close()
  }

  console.log('瀏覽器驗證完成：207 首資料、歌單排序與儲存、演出歌單滑動切歌、即時轉調、原始譜放大／橫移／雙指縮放、50% 字體縮放、Key 記憶、離線快取、歌曲詳情、Google 登入／上傳鎖定狀態、管理中心，以及手機／平板直橫向皆通過。')
} finally {
  await browser.close()
}
