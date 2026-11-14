# 合奏庫｜樂團樂譜管理原型

本機可操作的第一版原型，使用 PPC 敬拜團 Google 試算表的 207 筆資料建立樂譜庫介面。

正式網站：<https://band-score-library.pages.dev/>

GitHub Pages 備用網址：<https://southsidetw2023-cpu.github.io/band-score-library/>

> 正式站以 Google 帳號辨識使用者；只有環境中核准的管理者帳號可新增私有檔案。

## 已完成

- 依歌名、出處、語言、年份搜尋
- 讚美／敬拜分類與歌譜狀態篩選
- 歌曲詳細資料與原始資源連結
- 全部歌曲皆可進入現場模式、設定各自演出 Key，並依歌單切換
- 177 份 Google Drive PDF 保留作原始資料來源
- 〈How Much Do I Love You〉、〈Praise〉與〈天上的門打開〉具備已校對的結構化現場和弦譜、即時轉調與 Key 記憶
- 另有 174 首以原始 PDF 文字層與頁面 OCR 交叉核對，完成可即時轉調的結構化和弦譜
- 本週排練歌單（保存在瀏覽器本機）
- Google 帳號登入與管理者上傳權限
- PDF、JPG、PNG 私有檔案上傳（單檔上限 20 MB）
- 上傳檔案的類型、大小與伺服器端身分驗證
- 手機、平板與桌面響應式介面
- 網站介面與現場和弦譜離線快取

## 待後續功能

- 已上傳 PDF／圖片轉為可即時移調的結構化和弦譜
- Google Drive 舊檔案搬移至私有儲存
- 團隊即時同步、共用／個人筆記
- 外部歌譜 PDF 的完整離線快取

## 本機執行

```bash
npm install
npm run import:data
npm run dev
```

Google Sheet 的 CSV 匯出不包含儲存格超連結。更新資料後，需將試算表匯出為 XLSX，再執行：

```bash
npm run import:links -- /path/to/song-list.xlsx
```

正式串接外部服務前，先確認資料授權、檔案分享範圍與備份策略。

## 正式環境設定

Cloudflare Pages 需設定：

- 建置變數 `VITE_GOOGLE_CLIENT_ID`：Google Identity Services 的 Web Client ID
- 執行環境變數 `GOOGLE_CLIENT_ID`：與前端相同的 Client ID
- 執行環境變數 `ALLOWED_UPLOAD_EMAILS`：可上傳帳號，以逗號分隔
- R2 binding `SCORE_UPLOADS`：團隊私有樂譜 bucket

Google OAuth Web Client 的 JavaScript 來源需包含正式站與 Cloudflare 預覽網域。OAuth Client ID 不是密鑰；Client Secret 不應放入此專案或前端環境。
