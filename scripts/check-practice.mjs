import { chromium } from 'playwright-core'

const baseUrl = process.env.APP_URL || 'http://127.0.0.1:4175/'
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({ serviceWorkers: 'block' })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  const loggedOut = await context.newPage()
  await loggedOut.setViewportSize({ width: 375, height: 812 })
  await loggedOut.goto(baseUrl, { waitUntil: 'load' })
  assert(await loggedOut.getByRole('heading', { name: 'PPC 敬拜團歌單' }).isVisible(), '未登入時沒有顯示登入閘門')
  assert(!(await loggedOut.getByRole('heading', { name: '全部樂譜' }).isVisible()), '未登入仍可進入樂譜庫')
  await loggedOut.close()

  let entries = []
  let revision = 0
  const page = await context.newPage()
  await page.setViewportSize({ width: 375, height: 812 })
  await page.addInitScript(() => window.sessionStorage.setItem('ensemble-google-credential', 'test-credential'))
  await page.route('**/api/session', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ user: { id: 'test-user', email: 'member@example.com', name: '測試團員', picture: '', canUpload: true, isAdmin: false } }),
  }))
  await page.route('**/api/practice*', async (route) => {
    const method = route.request().method()
    if (method === 'PUT') {
      const { entry } = route.request().postDataJSON()
      entries = [{ ...entry, updatedAt: new Date().toISOString() }, ...entries.filter((item) => item.songId !== entry.songId)]
      revision += 1
    } else if (method === 'DELETE') {
      const { songId } = route.request().postDataJSON()
      entries = entries.filter((entry) => entry.songId !== songId)
      revision += 1
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ practice: { entries, revision, updatedAt: new Date().toISOString() } }) })
  })
  await page.goto(baseUrl, { waitUntil: 'load' })
  await page.getByRole('heading', { name: '全部樂譜' }).waitFor()
  assert((await page.locator('.mobile-nav button').count()) === 4, '手機底部導覽不是四個分頁')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  assert(!overflow, '375px 手機版出現水平溢位')
  await page.getByRole('button', { name: /管理中心/ }).first().click()
  assert(await page.getByText('Google 帳號已驗證，可直接上傳，不需要分享網址。').isVisible(), '一般 Google 帳號沒有顯示直接上傳權限')
  assert(await page.getByText('選擇檔案，或拖曳到這裡').isVisible(), '一般 Google 帳號沒有顯示檔案上傳表單')
  await page.locator('.mobile-nav').getByRole('button', { name: '樂譜庫', exact: true }).click()

  const search = page.getByPlaceholder('搜尋歌名、出處、語言或年份')
  await search.fill('Jesus Christ alone')
  await page.waitForFunction(() => document.querySelectorAll('.song-card').length === 1)
  await page.getByRole('button', { name: '將 Jesus Christ alone 加入歌單' }).click()
  await page.locator('.mobile-nav').getByRole('button', { name: /本週歌單/ }).click()
  assert(await page.getByText('Jesus Christ alone', { exact: true }).isVisible(), '一般登入帳號無法加入本週歌單')
  await page.getByRole('button', { name: '從歌單移除 Jesus Christ alone' }).click()
  assert(!(await page.getByText('Jesus Christ alone', { exact: true }).isVisible()), '一般登入帳號無法移除本週歌單歌曲')
  await page.locator('.mobile-nav').getByRole('button', { name: '樂譜庫', exact: true }).click()
  await page.getByRole('button', { name: /將 Jesus Christ alone 加入個人練習/ }).click()
  await page.getByRole('heading', { name: '個人練習' }).waitFor()
  assert(await page.getByText('Jesus Christ alone', { exact: true }).isVisible(), '加入後個人練習沒有顯示歌曲')

  await page.locator('.practice-fields select').nth(0).selectOption('practicing')
  await page.locator('.practice-fields select').nth(1).selectOption('G')
  await page.locator('.practice-fields textarea').fill('副歌需要再加強')
  await page.getByRole('button', { name: '儲存備註' }).click()
  await page.getByText('已同步至你的 Google 帳號').waitFor()
  assert(entries[0]?.status === 'practicing' && entries[0]?.practiceKey === 'G' && entries[0]?.notes === '副歌需要再加強', '練習進度、Key 或備註未同步')

  await page.reload({ waitUntil: 'load' })
  await page.getByRole('button', { name: /個人練習/ }).first().click()
  assert(await page.locator('.practice-fields textarea').inputValue() === '副歌需要再加強', '重新載入後個人練習備註未保留')
  console.log('帳號功能驗證完成：登入閘門、一般帳號直接上傳與編輯本週歌單、四分頁、375px 手機版、個人練習同步皆通過。')
} finally {
  await browser.close()
}
