import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const sheets = JSON.parse(await readFile(path.join(root, 'src/data/structured-sheets.generated.json'), 'utf8'))
const progress = JSON.parse(await readFile(path.join(root, 'docs/chord-sheet-progress.json'), 'utf8'))
const validKeys = new Set(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'])
const chordPattern = /^[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add|m|M|°)?\d*(?:[#b]\d+)?)?(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?$/
const rhythmPattern = /^(?:\|{1,2}|\/{1,4}|:|x\d+|\(x\d+\)|-|–|—)$/i
const transposableChordPattern = /^([|:(]*)([A-G])([#b]?)([^/\s|,;:]*)(?:\/([A-G])([#b]?))?([|,;:)]*)$/

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const entries = Object.values(sheets)
assert(entries.length === 174, `應有 174 首結構化草稿，實際為 ${entries.length}`)
let alignedLyricChordRows = 0
let sourceAlignedRows = 0
let estimatedAlignedRows = 0

for (const sheet of entries) {
  assert(validKeys.has(sheet.originalKey), `${sheet.songId} 缺少有效原調：${sheet.originalKey}`)
  assert(sheet.rows.some((row) => row.type === 'section'), `${sheet.songId} 缺少段落標記`)
  assert(sheet.rows.some((row) => row.type === 'lyrics'), `${sheet.songId} 缺少歌詞`)
  const chordRows = sheet.rows.filter((row) => row.type === 'chords')
  assert(chordRows.length > 0, `${sheet.songId} 缺少和弦行`)
  for (const [rowIndex, row] of sheet.rows.entries()) {
    if (row.type !== 'chords') continue
    const tokens = row.text.split(/\s+/).map((token) => token.replace(/^[|:(]+|[|,;:)]*$/g, '')).filter(Boolean)
    const hasChord = tokens.some((token) => chordPattern.test(token))
    assert(hasChord, `${sheet.songId} 存在無法辨識和弦的和弦行：${row.text}`)
    assert(tokens.every((token) => chordPattern.test(token) || rhythmPattern.test(token)), `${sheet.songId} 和弦行含有非和弦內容：${row.text}`)
    assert(tokens.filter((token) => chordPattern.test(token)).every((token) => transposableChordPattern.test(token)), `${sheet.songId} 存在轉調引擎無法處理的和弦：${row.text}`)
    if (row.positions) {
      assert(row.positions.map((position) => position.text).join(' ') === row.text, `${sheet.songId} 和弦定位內容與原列不一致：${row.text}`)
      assert(row.positions.every((position, index) => index === 0 || position.offsetEm > row.positions[index - 1].offsetEm), `${sheet.songId} 和弦定位沒有由左到右遞增：${row.text}`)
    }
    if (tokens.length > 1 && tokens.every((token) => chordPattern.test(token)) && sheet.rows[rowIndex + 1]?.type === 'lyrics') {
      alignedLyricChordRows += 1
      assert(row.positions?.length === tokens.length, `${sheet.songId} 歌詞上方的多和弦列缺少完整定位：${row.text}`)
      if (row.alignment === 'source') sourceAlignedRows += 1
      else if (row.alignment === 'estimated') estimatedAlignedRows += 1
      else assert(false, `${sheet.songId} 和弦定位缺少來源標記：${row.text}`)
    }
  }
  for (const row of sheet.rows.filter((candidate) => candidate.type === 'lyrics')) {
    assert(!/copyright|all rights reserved|https?:|spirit chord|\bkey\s*[:：]/i.test(row.text), `${sheet.songId} 歌詞含有來源註記：${row.text}`)
    assert(!/[œ™&]|[\u0300-\u036f]/u.test(row.text), `${sheet.songId} 歌詞含有樂譜符號或 OCR 雜字：${row.text}`)
    assert(row.text.replace(/\s/g, '').length > 2 || /^(?:耶穌|耶稣)$/.test(row.text), `${sheet.songId} 歌詞過短，疑似 OCR 雜字：${row.text}`)
  }
}

const allThingsNewOpening = sheets['讚美-046-all-things-new'].rows.find((row) => row.type === 'chords' && row.text === 'A E/A')
assert(allThingsNewOpening?.alignment === 'source', 'All Things New 的 A E/A 沒有使用原稿座標')
assert(allThingsNewOpening.positions[1].offsetEm - allThingsNewOpening.positions[0].offsetEm > 5, 'All Things New 的 A 與 E/A 仍然過度靠近')
assert(alignedLyricChordRows === sourceAlignedRows + estimatedAlignedRows, '歌詞和弦定位統計不一致')
assert(sourceAlignedRows >= 2300, `原稿座標覆蓋不足：${sourceAlignedRows}/${alignedLyricChordRows}`)

const structuredIds = new Set(progress.songs.filter((song) => ['structured_draft', 'structured_verified'].includes(song.status)).map((song) => song.songId))
const verifiedIds = new Set(progress.songs.filter((song) => song.status === 'structured_verified').map((song) => song.songId))
assert(structuredIds.size === 174, `進度清單應有 174 首結構化歌譜，實際為 ${structuredIds.size}`)
assert(verifiedIds.size === 174, `應有 174 首 structured_verified，實際為 ${verifiedIds.size}`)
for (const songId of Object.keys(sheets)) assert(structuredIds.has(songId), `${songId} 未寫入進度清單`)
for (const songId of verifiedIds) assert(sheets[songId]?.reviewStatus === 'verified', `${songId} 未標示 verified`)

console.log(`結構化和弦譜驗證完成：174 首、${alignedLyricChordRows} 列歌詞上方多和弦均已定位（原稿座標 ${sourceAlignedRows} 列、保守估算 ${estimatedAlignedRows} 列），且所有和弦列可完整解析。`)
