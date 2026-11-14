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

const structuredIds = new Set(progress.songs.filter((song) => ['structured_draft', 'structured_verified'].includes(song.status)).map((song) => song.songId))
const verifiedIds = new Set(progress.songs.filter((song) => song.status === 'structured_verified').map((song) => song.songId))
assert(structuredIds.size === 174, `進度清單應有 174 首結構化歌譜，實際為 ${structuredIds.size}`)
assert(verifiedIds.size === 2, `第一批應有 2 首 structured_verified，實際為 ${verifiedIds.size}`)
for (const songId of Object.keys(sheets)) assert(structuredIds.has(songId), `${songId} 未寫入進度清單`)
for (const songId of verifiedIds) assert(sheets[songId]?.reviewStatus === 'verified', `${songId} 未標示 verified`)

console.log('結構化和弦譜驗證完成：174 首均具備原調、段落、歌詞與可辨識和弦行；其中 2 首已完成來源對照校對。')
