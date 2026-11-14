import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const SHEET_ID = '1zTrXWdCbsrGtPR7z8C1GFX2bcKQ4juJ-C0TQnWViDww'
const tabs = ['讚美', '敬拜']

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell.length || row.length) {
    row.push(cell)
    if (row.some((value) => value.trim())) rows.push(row)
  }

  return rows
}

function makeId(category, index, title) {
  const slug = title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 44)
  return `${category}-${String(index).padStart(3, '0')}-${slug || 'song'}`
}

function normalizeTab(category, csv) {
  const [headerRow, ...rows] = parseCsv(csv)
  const headers = headerRow.map((header, index) => header.trim() || (index === 0 ? '編號' : `欄位${index + 1}`))

  return rows.map((row, rowIndex) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? '']))
    const index = Number.parseInt(record['編號'], 10) || rowIndex + 1
    const title = record['歌名'] || record['歌曲'] || `未命名歌曲 ${index}`

    return {
      id: makeId(category, index, title),
      index,
      title,
      category,
      year: record['年份'] || '',
      source: record['出處'] || '',
      language: record['原文語言'] || '',
      songUrl: record['歌曲連結'] || '',
      lyricsUrl: record['中文歌詞連結'] || '',
      scoreUrl: record['歌譜連結'] || '',
      harmonyUrl: record['和聲/合音連結'] || '',
      tempo: record['歌曲速度'] || '',
      key: '',
      tags: [category, record['原文語言']].filter(Boolean),
    }
  })
}

const songs = []
for (const tab of tabs) {
  const endpoint = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
  const response = await fetch(endpoint)
  if (!response.ok) throw new Error(`讀取 ${tab} 失敗：HTTP ${response.status}`)
  songs.push(...normalizeTab(tab, await response.text()))
}

const output = resolve('src/data/songs.generated.json')
await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(songs, null, 2)}\n`, 'utf8')
console.log(`已匯入 ${songs.length} 首歌曲至 ${output}`)
