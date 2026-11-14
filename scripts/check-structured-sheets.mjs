import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const sheets = JSON.parse(await readFile(path.join(root, 'src/data/structured-sheets.generated.json'), 'utf8'))
const progress = JSON.parse(await readFile(path.join(root, 'docs/chord-sheet-progress.json'), 'utf8'))
const validKeys = new Set(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'])
const chordPattern = /^[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add|m|M)\d*)?(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?$/

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const entries = Object.values(sheets)
assert(entries.length === 174, `應有 174 首結構化草稿，實際為 ${entries.length}`)

for (const sheet of entries) {
  assert(validKeys.has(sheet.originalKey), `${sheet.songId} 缺少有效原調：${sheet.originalKey}`)
  assert(sheet.rows.some((row) => row.type === 'section'), `${sheet.songId} 缺少段落標記`)
  assert(sheet.rows.some((row) => row.type === 'lyrics'), `${sheet.songId} 缺少歌詞`)
  const chordRows = sheet.rows.filter((row) => row.type === 'chords')
  assert(chordRows.length > 0, `${sheet.songId} 缺少和弦行`)
  for (const row of chordRows) {
    const hasChord = row.text.split(/\s+/).some((token) => chordPattern.test(token.replace(/^[|:(]+|[|,;:)]*$/g, '')))
    assert(hasChord, `${sheet.songId} 存在無法辨識和弦的和弦行：${row.text}`)
  }
}

const draftIds = new Set(progress.songs.filter((song) => song.status === 'structured_draft').map((song) => song.songId))
assert(draftIds.size === 174, `進度清單應有 174 首 structured_draft，實際為 ${draftIds.size}`)
for (const songId of Object.keys(sheets)) assert(draftIds.has(songId), `${songId} 未寫入進度清單`)

console.log('結構化和弦譜驗證完成：174 首均具備原調、段落、歌詞與可辨識和弦行。')
