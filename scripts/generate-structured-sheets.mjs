import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const extractionRoot = path.join(root, 'work/chord-sheet-batch/extracted')
const outputPath = path.join(root, 'src/data/structured-sheets.generated.json')
const progressPath = path.join(root, 'docs/chord-sheet-progress.json')
const chordSheetsSource = await readFile(path.join(root, 'src/data/chord-sheets.ts'), 'utf8')
const verifiedIds = new Set([...chordSheetsSource.matchAll(/songId:\s*'([^']+)'/g)].map((match) => match[1]))
const files = (await readdir(extractionRoot)).filter((file) => file.endsWith('.json')).sort()

const sectionPattern = /\b(intro|verse(?:\s*\d+)?|pre[\s-]*chorus|chorus(?:\s*\d+)?|bridge(?:\s*\d+)?|interlude|inter|outro|ending|free\s*worship|tag|instrumental)\b/i
const chordPattern = /^[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add|m|M)\d*)?(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?$/
const rhythmPattern = /^(?:\|{1,2}|\/{1,4}|:|x\d+|\(x\d+\)|-|–|—)$/i
const keyOverrides = {
  '敬拜-003-fall': 'F',
  '敬拜-004-heart-of-a-servant-僕人的心': 'F',
  '敬拜-006-改變世界': 'G',
  '敬拜-056-yesus-yang-kuandalkan-耶穌是我指望': 'G',
  '敬拜-058-oleh-kuasa-darahmu-因祢大能寶血': 'G',
  '敬拜-132-i-can-t-live-without-you': 'F',
  '讚美-024-lebih-dari-pemenang-勝過這世界': 'A',
  '讚美-033-god-is-here-神同在': 'D',
  '讚美-040-you-have-overcome-祢勝過世界': 'E',
  '讚美-042-yesus-tuhan-allah-yang-perkasa-耶穌全能偉大真神': 'C',
}
const rowOverrides = {
  '敬拜-044-在呼召我之處': [
    { type: 'section', text: 'Verse' },
    { type: 'chords', text: 'E A/E E D/E E' },
    { type: 'lyrics', text: '主溫柔的聖靈　讓我全心感受' },
    { type: 'chords', text: 'Amaj9 G#m7 C#m7' },
    { type: 'lyrics', text: '滲透我的生命　賜下平靜和安息' },
    { type: 'chords', text: 'F#m7 A/B E A/E' },
    { type: 'lyrics', text: '祢使我心得滿足' },
    { type: 'chords', text: 'E A/E E D/E E' },
    { type: 'lyrics', text: '主慈愛的真理　祢榮光照向我' },
    { type: 'chords', text: 'Amaj9 G#m7 C#m7' },
    { type: 'lyrics', text: '包圍我的身體　賜下平靜和安息' },
    { type: 'chords', text: 'F#m7 A/B E' },
    { type: 'lyrics', text: '讓我感受祢的愛' },
    { type: 'section', text: 'Chorus' },
    { type: 'chords', text: 'E7 Amaj9 G#m7' },
    { type: 'lyrics', text: '在呼召我之處　我要獻上敬拜' },
    { type: 'chords', text: 'C#m7 F#m7 A/B Emaj7' },
    { type: 'lyrics', text: '無論遭遇何事　依然揚聲歌唱' },
    { type: 'chords', text: 'E7 Amaj9 G#m7' },
    { type: 'lyrics', text: '在呼召我之處　我要獻上敬拜' },
    { type: 'chords', text: 'C#m7 F#m7 A/B E' },
    { type: 'lyrics', text: '無論遭遇何事　依然揚聲歌唱' },
    { type: 'section', text: 'Bridge' },
    { type: 'chords', text: 'D/E E7 Amaj7 B/A' },
    { type: 'lyrics', text: '在我行走時成為我道路' },
    { type: 'chords', text: 'G#m7 C#m7' },
    { type: 'lyrics', text: '活著時成為我生命' },
    { type: 'chords', text: 'F#m7 A/B Emaj7' },
    { type: 'lyrics', text: '就在這地　獻上敬拜' },
  ],
  '讚美-041-祢是全能神': [
    { type: 'section', text: 'Verse' },
    { type: 'chords', text: 'E B A' },
    { type: 'lyrics', text: '無人能形容　祢所賜奇妙大愛' },
    { type: 'chords', text: 'C#m B F#m' },
    { type: 'lyrics', text: '祢偉大作為　世上無人能相比' },
    { type: 'chords', text: 'E B/E A' },
    { type: 'lyrics', text: '祢信實的愛　眷顧我一切所需' },
    { type: 'chords', text: 'C#m B E/G# A' },
    { type: 'lyrics', text: '我高聲宣揚　唯有耶穌是救主' },
    { type: 'section', text: 'Chorus' },
    { type: 'chords', text: 'E B/E' },
    { type: 'lyrics', text: '祢是全能神　榮耀的救主' },
    { type: 'chords', text: 'C#m A' },
    { type: 'lyrics', text: '在寶座上祢統管萬有' },
    { type: 'chords', text: 'E B/E' },
    { type: 'lyrics', text: '祢是全能神　榮耀的君王' },
    { type: 'chords', text: 'C#m F# A B A' },
    { type: 'lyrics', text: '昨日今日一直到永遠' },
    { type: 'section', text: 'Interlude' },
    { type: 'chords', text: 'A | F#m | C#m | E' },
    { type: 'chords', text: 'A | F#m | C#m | B' },
  ],
}

function cleanText(text) {
  return text
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/\bY\s+our\b/g, 'Your')
    .replace(/\bC\s+horus\b/gi, 'Chorus')
    .replace(/\b([A-G](?:#|b)?)\s+(s\s*us|m\s*aj|m\s*in)\s*(\d*)/g, (_, root, suffix, number) => `${root}${suffix.replace(/\s/g, '')}${number}`)
    .replace(/([A-G])\s+([#b])/g, '$1$2')
    .replace(/([A-G](?:#|b)?)\s+(maj|min|dim|aug|sus|add|m|M)\s*(\d*)/g, '$1$2$3')
    .replace(/([A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M))\s+(\d+)/g, '$1$2')
    .replace(/([A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M)?\d*)\s*\/\s*([A-G])([#b]?)/g, '$1/$2$3')
    .replace(/([A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M)\d*)(?=[A-G])/g, '$1 ')
    .replace(/\s+([,.:;!?])/g, '$1')
    .trim()
}

function isChordToken(token) {
  return chordPattern.test(token.replace(/[()[\],]/g, ''))
}

function classify(text) {
  const normalized = cleanText(text)
  if (!normalized) return null
  const section = normalized.match(sectionPattern)
  const tokens = normalized.split(/\s+/).filter(Boolean)
  const chordTokens = tokens.filter((token) => isChordToken(token)).length
  const rhythmTokens = tokens.filter((token) => rhythmPattern.test(token)).length
  const musicalRatio = (chordTokens + rhythmTokens) / Math.max(1, tokens.length)
  if (section && tokens.length <= 5) return { type: 'section', text: section[0].replace(/\s+/g, ' ') }
  if (chordTokens > 0 && musicalRatio >= 0.5) return { type: 'chords', text: normalized }
  if (/^(?:key\s*[:：]|https?:\/\/|\d{4}[/-]\d|\d{4}\/)/i.test(normalized)) return null
  if (/copyright|all rights reserved|版權所有/i.test(normalized)) return null
  if (/^[#b0-9\s|/().,:'"+_-]+$/i.test(normalized)) return null
  return { type: 'lyrics', text: normalized }
}

function mergeSuperscripts(lines) {
  const result = lines.map((line) => ({ ...line, items: line.items.map((item) => ({ ...item })) }))
  for (let index = 0; index < result.length - 1; index += 1) {
    const upper = result[index]
    const lower = result[index + 1]
    if (upper.y - lower.y > 10 || upper.items.length === 0) continue
    if (!upper.items.every((item) => /^[#b0-9]+$/.test(item.text.trim()))) continue
    for (const suffix of upper.items) {
      let nearest = null
      let distance = Number.POSITIVE_INFINITY
      for (const base of lower.items) {
        const nextDistance = Math.abs(base.x + base.width - suffix.x)
        if (nextDistance < distance && nextDistance < 22) {
          nearest = base
          distance = nextDistance
        }
      }
      if (nearest) nearest.text += suffix.text.trim()
    }
    upper.consumed = true
  }
  return result.filter((line) => !line.consumed)
}

function segmentLine(line, pageWidth, splitBody) {
  if (!splitBody) return [{ column: 'full', y: line.y, text: cleanText(line.items.map((item) => item.text).join(' ')) }]
  const midpoint = pageWidth / 2
  const left = line.items.filter((item) => item.x < midpoint)
  const right = line.items.filter((item) => item.x >= midpoint)
  if (left.length === 0 || right.length === 0) {
    return [{ column: left.length ? 'left' : 'right', y: line.y, text: cleanText(line.items.map((item) => item.text).join(' ')) }]
  }
  const leftEdge = Math.max(...left.map((item) => item.x + item.width))
  const rightEdge = Math.min(...right.map((item) => item.x))
  if (rightEdge - leftEdge < 18) {
    return [{ column: 'full', y: line.y, text: cleanText(line.items.map((item) => item.text).join(' ')) }]
  }
  return [
    { column: 'left', y: line.y, text: cleanText(left.map((item) => item.text).join(' ')) },
    { column: 'right', y: line.y, text: cleanText(right.map((item) => item.text).join(' ')) },
  ]
}

function pageToRows(page) {
  const lines = mergeSuperscripts(page.lines)
  const firstSectionY = lines.find((line) => sectionPattern.test(line.text))?.y ?? page.height * 0.72
  const header = []
  const columns = { left: [], right: [], full: [] }
  for (const line of lines) {
    const inBody = line.y <= firstSectionY + 2
    for (const segment of segmentLine(line, page.width, inBody)) {
      if (!segment.text) continue
      if (!inBody || segment.column === 'full') header.push(segment)
      else columns[segment.column].push(segment)
    }
  }

  const ordered = [
    ...header.sort((a, b) => b.y - a.y),
    ...columns.left.sort((a, b) => b.y - a.y),
    ...columns.right.sort((a, b) => b.y - a.y),
  ]
  const titleIndex = ordered.findIndex((row) => sectionPattern.test(row.text))
  const body = titleIndex >= 0 ? ordered.slice(titleIndex) : ordered.slice(Math.min(4, ordered.length))
  const rows = []
  for (const row of body) {
    const prefix = row.text.match(new RegExp(`^(${sectionPattern.source})\\s*[:：-]?\\s*(.*)$`, 'i'))
    if (prefix && prefix[2]) {
      rows.push({ type: 'section', text: cleanText(prefix[1]) })
      const remainder = classify(prefix[2])
      if (remainder) rows.push(remainder)
      continue
    }
    const classified = classify(row.text)
    if (classified) rows.push(classified)
  }
  return rows.filter((row, index) => index === 0 || row.type !== rows[index - 1].type || row.text !== rows[index - 1].text)
}

const sheets = {}
for (const file of files) {
  const extraction = JSON.parse(await readFile(path.join(extractionRoot, file), 'utf8'))
  if (verifiedIds.has(extraction.songId)) continue
  const extractedRows = extraction.pages.flatMap((page, index) => [
    ...(index > 0 ? [{ type: 'section', text: `Page ${index + 1}` }] : []),
    ...pageToRows(page),
  ])
  const rows = rowOverrides[extraction.songId] || extractedRows
  if (rows.length === 0) continue
  sheets[extraction.songId] = {
    songId: extraction.songId,
    originalKey: extraction.detectedKey || keyOverrides[extraction.songId] || '',
    sourceLabel: '由現有歌譜擷取，待逐首校對',
    reviewStatus: extraction.detectedKey || keyOverrides[extraction.songId] ? 'draft' : 'needs_key_review',
    rows,
  }
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(sheets, null, 2)}\n`)
const progress = JSON.parse(await readFile(progressPath, 'utf8'))
for (const song of progress.songs) {
  if (sheets[song.songId]) song.status = 'structured_draft'
}
progress.generatedAt = new Date().toISOString()
progress.counts = progress.songs.reduce((counts, song) => {
  counts[song.status] = (counts[song.status] ?? 0) + 1
  return counts
}, {})
await writeFile(progressPath, `${JSON.stringify(progress, null, 2)}\n`)
console.log(`generated ${Object.keys(sheets).length} structured sheet drafts -> ${path.relative(root, outputPath)}`)
