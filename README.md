# 合奏庫｜樂團樂譜管理原型

本機可操作的第一版原型，使用 PPC 敬拜團 Google 試算表的 207 筆資料建立樂譜庫介面。

正式網站：<https://band-score-library.pages.dev/>

GitHub Pages 備用網址：<https://southsidetw2023-cpu.github.io/band-score-library/>

> 目前是公開介面原型，尚未啟用 Google 登入、成員核准與私有檔案權限。

## 已完成

- 依歌名、出處、語言、年份搜尋
- 讚美／敬拜分類與歌譜狀態篩選
- 歌曲詳細資料與原始資源連結
- 全部歌曲皆可進入現場模式、設定各自演出 Key，並依歌單切換
- 177 份 Google Drive PDF 保留作原始資料來源
- 〈How Much Do I Love You〉與〈Praise〉具備結構化現場和弦譜、即時轉調與 Key 記憶
- 本週排練歌單（保存在瀏覽器本機）
- 管理者匯入、權限與批次上傳流程預覽
- 手機、平板與桌面響應式介面
- 網站介面與現場和弦譜離線快取

## 尚未啟用

- Google 登入與管理者核准
- 私有檔案儲存與 Google Drive 搬移
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
