import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const extractionRoot = path.join(root, 'work/chord-sheet-batch/extracted')
const ocrRoot = path.join(root, 'work/chord-sheet-review/ocr')
const outputPath = path.join(root, 'src/data/structured-sheets.generated.json')
const progressPath = path.join(root, 'docs/chord-sheet-progress.json')
const chordSheetsSource = await readFile(path.join(root, 'src/data/chord-sheets.ts'), 'utf8')
const verifiedIds = new Set([...chordSheetsSource.matchAll(/songId:\s*'([^']+)'/g)].map((match) => match[1]))
const files = (await readdir(extractionRoot)).filter((file) => file.endsWith('.json')).sort()
let englishWords = new Set()
try {
  englishWords = new Set((await readFile('/usr/share/dict/words', 'utf8')).split(/\r?\n/).map((word) => word.toLowerCase()).filter(Boolean))
} catch {
  // The committed generated output does not require the local dictionary at runtime.
}

const sectionPattern = /\b(intro|verse(?:\s*\d+)?|pre[\s-]*chorus|chorus(?:\s*\d+)?|bridge(?:\s*\d+)?|interlude|inter|outro|ending|end|last|free\s*worship|spirit\s*chord|tag|instrumental)\b/i
const chordPattern = /^[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add|m|M|°)?\d*(?:[#b]\d+)?)?(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?$/
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
  '敬拜-076-主祢本為大': [
    { type: 'section', text: 'Intro' },
    { type: 'chords', text: 'A | D/A' },
    { type: 'section', text: 'Verse' },
    { type: 'chords', text: 'A D/A Amaj7 D/A' },
    { type: 'lyrics', text: '主祢本為大，當受極大讚美，在我們神至聖城中，願全地都喜樂' },
    { type: 'chords', text: 'F#m7 A/E Bm7 Esus4 E' },
    { type: 'chords', text: 'A D/A Amaj7 D/A' },
    { type: 'lyrics', text: '主在祢裡面我們已有權柄，能戰勝黑暗眾仇敵，今向祢來敬拜' },
    { type: 'chords', text: 'F#m7 A/E Bm7 Esus4 E' },
    { type: 'section', text: 'Chorus' },
    { type: 'chords', text: 'A C#m7 D A/C#' },
    { type: 'lyrics', text: '主我們高舉祢至聖尊名，主我們何等感謝，因祢為我成就大事' },
    { type: 'chords', text: 'Bm7 D/E A C#m7' },
    { type: 'lyrics', text: '主我們信靠祢無比大愛，主惟有祢是永遠上帝' },
    { type: 'chords', text: 'D A/C# Bm7 D/E E A' },
    { type: 'lyrics', text: '祢聖名在天地之上' },
    { type: 'section', text: 'Free Worship' },
    { type: 'chords', text: 'A | A/C# | D | E' },
  ],
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
  let cleaned = text
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/\|/g, ' | ')
    .replace(/\bI\s+ntro\b/gi, 'Intro')
    .replace(/\bB\s+ridge\b/gi, 'Bridge')
    .replace(/\bY\s+our\b/g, 'Your')
    .replace(/\bC\s+horus\b/gi, 'Chorus')
    .replace(/\bInter\s+lude\b/gi, 'Interlude')
    .replace(/\b([A-G](?:#|b)?)\s+(ma\s*j|di\s*m|su\s*s)\s*(\d*)/g, (_, root, suffix, number) => `${root}${suffix.replace(/\s/g, '')}${number}`)
    .replace(/\b([A-G](?:#|b)?)\s+(s\s*us|m\s*aj|m\s*in)\s*(\d*)/g, (_, root, suffix, number) => `${root}${suffix.replace(/\s/g, '')}${number}`)
    .replace(/([A-G])\s+([#b])/g, '$1$2')
    .replace(/([A-G](?:#|b)?)\s+(maj|min|dim|aug|sus|add|m|M)\s*(\d*)/g, '$1$2$3')
    .replace(/([A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M))\s+(\d+)/g, '$1$2')
    .replace(/\b([A-G](?:#|b)?)\s+(\d+(?:[#b]\d+)?)\b/g, '$1$2')
    .replace(/\b([A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M|°)?\d*)((?:\/{2,4}))(?=\s|\||$)/g, (_, chord, slashes) => `${chord} ${slashes.split('').join(' ')}`)
    .replace(/([A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M)?\d*)\s*\/\s*([A-G])([#b]?)/g, '$1/$2$3')
    .replace(/([A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M)\d*)(?=[A-G])/g, '$1 ')
    .replace(/\s+([,.:;!?])/g, '$1')
    .trim()
  return cleaned
}

function repairEnglishSpacing(text) {
  const repairCjk = (value) => value
    .replace(/袮/g, '祢')
    .replace(/稣/g, '穌')
    .replace(/来/g, '來')
    .replace(/满/g, '滿')
    .replace(/(?<=\p{Script=Han})[:：](?=\p{Script=Han})/gu, '')
    .replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, '')
    .replace(/(?<=\p{Script=Han})[ー-](?=\p{Script=Han})/gu, '')
    .replace(/[ー-]+$/g, '')
    .replace(/心心/g, '心')
    .replace(/身身/g, '身')
    .replace(/十十/g, '十')
    .replace(/生命命/g, '生命')
    .replace(/止止/g, '止')
    .replace(/唯一一/g, '唯一')
    .replace(/手手/g, '手')
    .replace(/風風/g, '風')
    .replace(/門門/g, '門')
    .replace(/見見/g, '見')
    .replace(/山山/g, '山')
    .replace(/血血/g, '血')
    .replace(/無人人/g, '無人')
    .replace(/高高舉/g, '高舉')
    .replace(/天高高比/g, '天高比')
    .replace(/多深深廣/g, '多深廣')
    .replace(/捨生生命/g, '捨生命')
    .replace(/能行行/g, '能行')
    .replace(/改變系生命/g, '改變我生命')
    .replace(/([\p{Script=Han}])\1/gu, (pair, character) => new Set(['單', '看', '深', '緊', '種', '高', '千', '萬', '隆', '重', '齊', '永', '遠', '常', '天']).has(character) ? pair : character)
    .trim()
  if (!/[A-Za-z]/.test(text) || englishWords.size === 0) return repairCjk(text)
  let repaired = text
    .replace(/\bI\s+[’']\s*(m|ll|ve|d)\b/gi, (_, suffix) => `I'${suffix.toLowerCase()}`)
    .replace(/\b(you|we|they|he|she|it|that|there)\s+[’']\s*(re|ll|ve|d|s)\b/gi, (_, word, suffix) => `${word}'${suffix}`)
    .replace(/\b(do|does|did|is|are|was|were|have|has|had|would|should|could|wo|ca)\s*n\s*[’']?\s*t\b/gi, (_, word) => `${word}n't`)
    .replace(/\bYoure\b/g, "You're")
    .replace(/\bw\s+anna\b/gi, 'wanna')
    .replace(/\bB\s+erhadapan\b/g, 'Berhadapan')
    .replace(/\bMenolonghidupku\b/gi, 'Menolong hidupku')
    .replace(/\bAndI\b/g, 'And I')
    .replace(/\bmade away\b/gi, 'made a way')
    .replace(/\bWHATA\b/g, 'WHAT A')
    .replace(/\bHEALEDMY\b/g, 'HEALED MY')
    .replace(/\bHOLDMY\b/g, 'HOLD MY')
    .replace(/\bAMIRACLE\b/g, 'A MIRACLE')
    .replace(/\bOFMY\b/g, 'OF MY')
    .replace(/\bGIVEMY\b/g, 'GIVE MY')
    .replace(/\bISURRENDER\b/g, 'I SURRENDER')
    .replace(/\bV\s+ISIONS\b/g, 'VISIONS')
  const joinFragments = (left, right) => {
    const joined = `${left}${right}`
    return englishWords.has(joined.toLowerCase()) ? joined : null
  }
  for (let pass = 0; pass < 3; pass += 1) {
    repaired = repaired
      .replace(/\b([A-Za-z]{3,})([A-Za-z])\s+([A-Za-z])\b/g, (match, stem, left, right) => {
        const tail = `${left}${right}`
        return englishWords.has(stem.toLowerCase()) && englishWords.has(tail.toLowerCase()) ? `${stem} ${tail}` : match
      })
      .replace(/(?<!['’])\b([A-Za-z])\s+([A-Za-z]{2,})\b/g, (match, left, right) => joinFragments(left, right) ?? match)
      .replace(/\b([A-Za-z]{2,})\s+([A-Za-z])\b/g, (match, left, right) => joinFragments(left, right) ?? match)
      .replace(/\b([A-Za-z]{2,})\s+([A-Za-z]{2,})\b/g, (match, left, right) => {
        const joined = joinFragments(left, right)
        return joined && (!englishWords.has(left.toLowerCase()) || !englishWords.has(right.toLowerCase())) ? joined : match
      })
  }
  repaired = repaired.replace(/\b[A-Za-z]{6,}\b/g, (word) => {
    if (englishWords.has(word.toLowerCase())) return word
    if (word !== word.toUpperCase() && !/[a-z][A-Z]/.test(word)) return word
    for (let index = 1; index < word.length - 1; index += 1) {
      const left = word.slice(0, index)
      const right = word.slice(index)
      if ((left.length === 1 || englishWords.has(left.toLowerCase())) && englishWords.has(right.toLowerCase())) return `${left} ${right}`
    }
    return word
  })
  if (/[A-Za-z]{3}/.test(repaired)) repaired = repaired.replace(/\b[l1]\b/g, 'I')
  repaired = repaired
    .replace(/\bCALLEDM\s+E\b/g, 'CALLED ME')
    .replace(/\bHEAL\s+ED\b/g, 'HEALED')
    .replace(/\bAREn't\b/g, "AREN'T")
  return repairCjk(repaired)
}

function lyricQuality(text) {
  const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []
  if (words.length === 0 || englishWords.size === 0) return text.replace(/\s/g, '').length
  const recognized = words.filter((word) => englishWords.has(word.replace(/'/g, '').toLowerCase()) || word.length <= 2).length
  const suspiciousJoins = words.filter((word) => word.length >= 7 && !englishWords.has(word.toLowerCase())).length
  return text.replace(/\s/g, '').length + recognized * 5 - suspiciousJoins * 8
}

function isChordToken(token) {
  return chordPattern.test(token.replace(/[()[\],]/g, ''))
}

function normalizeChordLine(text) {
  const withoutDirections = text
    .replace(/\([^)]*(?:key|repeat|chorus|verse|last|end|升)[^)]*\)/gi, ' ')
    .replace(/(?:→|—>|->|à).*$/i, ' ')
    .replace(/\b(?:spirit|original|chc|華文堂|末句|原版|版|升到)\b\s*:?/gi, ' ')
    .replace(/\|/g, ' | ')
    .replace(/\(\s*x\s*(\d+)\s*\)/gi, ' x$1 ')
    .replace(/\b([A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M)?)(?:\?|!)\b/g, (_, chord) => `${chord}7`)
    .replace(/\bGsust\b/g, 'Gsus4')
    .replace(/\s+/g, ' ')
    .trim()

  const expanded = []
  for (const originalToken of withoutDirections.split(/\s+/)) {
    const wrappers = originalToken.match(/^([(|:]*)((?:.*?))([),;:]*)$/)
    const prefix = wrappers?.[1] ?? ''
    const suffix = wrappers?.[3] ?? ''
    let bare = wrappers?.[2] ?? originalToken
    if (!bare) continue
    if (/^[A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M|°)?\d*(?:[#b]\d+)?\/$/.test(bare)) {
      expanded.push(`${prefix}${bare.slice(0, -1)}${suffix}`, '/')
      continue
    }
    const slashParts = bare.split('/')
    if (slashParts.length >= 3 && slashParts.every((part) => !part || /^[A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M|°)?\d*(?:[#b]\d+)?$/.test(part))) {
      const first = slashParts.shift()
      const bass = slashParts.pop()
      const middle = slashParts.join('/')
      expanded.push(`${prefix}${first}${suffix}`)
      if (middle && bass) expanded.push(`${middle}/${bass}`)
      continue
    }
    if (slashParts.length === 2 && /^(?:[A-G](?:#|b)?)(?:maj|min|dim|aug|sus|add|m|M|°)\d*/.test(slashParts[1])) {
      expanded.push(`${prefix}${slashParts[0]}${suffix}`, slashParts[1])
      continue
    }
    expanded.push(originalToken)
  }

  let previousRoot = ''
  return expanded.map((token) => {
    const bare = token.replace(/^[|:(]+|[|,;:)]*$/g, '')
    const chord = chordPattern.test(bare) ? bare.match(/^([A-G](?:#|b)?)/) : null
    if (chord) {
      previousRoot = chord[1]
      return token
    }
    const slash = bare.match(/^\/([A-G](?:#|b)?)$/)
    if (!slash || !previousRoot) return token
    return token.replace(bare, `${previousRoot}/${slash[1]}`)
  }).filter((token) => {
    const bare = token.replace(/^[|:(]+|[|,;:)]*$/g, '')
    return !bare || chordPattern.test(bare) || rhythmPattern.test(bare)
  }).join(' ').replace(/\s+/g, ' ').trim()
}

function classify(text) {
  const normalized = cleanText(text)
  if (!normalized) return null
  if (/^(?:[qj]\s*=|\d+\s+[A-G](?:#|b)?\b)/i.test(normalized)) return null
  const section = normalized.match(sectionPattern)
  const tokens = normalized.split(/\s+/).filter(Boolean)
  const chordTokens = tokens.filter((token) => isChordToken(token)).length
  const rhythmTokens = tokens.filter((token) => rhythmPattern.test(token)).length
  const musicalRatio = (chordTokens + rhythmTokens) / Math.max(1, tokens.length)
  if (section && tokens.length <= 5) return { type: 'section', text: section[0].replace(/\s+/g, ' ') }
  if (chordTokens > 0 && musicalRatio >= 0.5) {
    const chords = normalizeChordLine(normalized)
    if (chords && chords.split(/\s+/).some((token) => isChordToken(token))) return { type: 'chords', text: chords }
  }
  if (/^(?:key\s*[:：]|https?:\/\/|\d{4}[/-]\d|\d{4}\/)/i.test(normalized)) return null
  if (/copyright|all rights reserved|版權所有/i.test(normalized)) return null
  if (!/\p{Script=Han}/u.test(normalized) && /^[A-G][A-Za-z0-9|xX()一二\-–—\s]+$/.test(normalized) && (normalized.match(/[0-9|\-–—]/g) ?? []).length >= 3) return null
  if (/^[A-Z]{1,2}$/.test(normalized)) return null
  if (/^[#b0-9\s|/().,:'"+_-]+$/i.test(normalized)) return null
  const lyrics = repairEnglishSpacing(normalized)
  if (/^[A-Z]{1,2}$/.test(lyrics)) return null
  if ((lyrics.match(/[0-9|\-–—]/g) ?? []).length >= 5 && (lyrics.match(/[A-Za-z]{3,}|[\p{Script=Han}]{2,}/gu) ?? []).length <= 1) return null
  return { type: 'lyrics', text: lyrics }
}

function splitSectionLine(text) {
  const match = text.match(/^\(?\s*(?:(?:original|原|chc(?:\s+華文堂)?)\s+)?(intro|verse(?:\s*\d+)?|pre[\s-]*chorus|chorus(?:\s*\d+)?|bridge(?:\s*\d+)?|interlude|inter|outro|ending|end|last|free\s*worship|spirit\s*chord|tag|instrumental)\s*[:：-]?\s*(.*)$/i)
  if (!match) return null
  return { section: cleanText(match[1]), remainder: cleanText(match[2]).replace(/\)$/, '').trim() }
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
    const prefix = splitSectionLine(row.text)
    if (prefix?.remainder) {
      rows.push({ type: 'section', text: prefix.section })
      const remainder = classify(prefix.remainder)
      if (remainder) rows.push(remainder)
      continue
    }
    const classified = classify(row.text)
    if (classified) rows.push(classified)
  }
  return rows.filter((row, index) => index === 0 || row.type !== rows[index - 1].type || row.text !== rows[index - 1].text)
}

function groupOcrLines(lines) {
  const groups = []
  for (const line of [...lines].sort((left, right) => right.y - left.y || left.x - right.x)) {
    let group = groups.find((candidate) => Math.abs(candidate.y - line.y) <= 0.008)
    if (!group) {
      group = { y: line.y, items: [] }
      groups.push(group)
    }
    group.items.push(line)
  }
  return groups
    .sort((left, right) => right.y - left.y)
    .map((group) => ({ ...group, items: group.items.sort((left, right) => left.x - right.x) }))
}

function ocrSegments(page) {
  const groups = groupOcrLines(page.lines)
  const firstSectionY = groups.find((group) => sectionPattern.test(group.items.map((item) => item.text).join(' ')))?.y ?? 0.78
  const columns = { left: [], right: [], full: [] }

  for (const group of groups) {
    if (group.y > firstSectionY + 0.012) continue
    const left = group.items.filter((item) => item.x + item.width / 2 < 0.5)
    const right = group.items.filter((item) => item.x + item.width / 2 >= 0.5)
    const leftEdge = left.length ? Math.max(...left.map((item) => item.x + item.width)) : 0
    const rightEdge = right.length ? Math.min(...right.map((item) => item.x)) : 1
    const separated = left.length > 0 && right.length > 0 && rightEdge - leftEdge >= 0.035
    const add = (column, items) => {
      const text = cleanText(items.map((item) => item.text).join(' '))
      if (text) columns[column].push({ column, y: group.y, text })
    }
    if (separated) {
      add('left', left)
      add('right', right)
    } else {
      add(left.length ? 'left' : right.length ? 'right' : 'full', group.items)
    }
  }

  return [...columns.left, ...columns.full, ...columns.right]
}

function extractedSegments(page) {
  return mergeSuperscripts(page.lines).flatMap((line) => segmentLine(line, page.width, true).map((segment) => ({
    ...segment,
    y: line.y / page.height,
  })))
}

function ocrPageToRows(ocrPage, extractedPage) {
  const rawSegments = extractedSegments(extractedPage)
  const rows = []
  for (const segment of ocrSegments(ocrPage)) {
    const nearest = rawSegments
      .filter((candidate) => candidate.column === segment.column || candidate.column === 'full' || segment.column === 'full')
      .map((candidate) => ({ candidate, distance: Math.abs(candidate.y - segment.y) }))
      .filter(({ distance }) => distance <= 0.012)
      .sort((left, right) => left.distance - right.distance)[0]?.candidate
    const sourcePrefix = splitSectionLine(nearest?.text ?? '') ?? splitSectionLine(segment.text)
    if (sourcePrefix?.remainder) {
      rows.push({ type: 'section', text: sourcePrefix.section })
      const remainder = classify(sourcePrefix.remainder)
      if (remainder) rows.push(remainder)
      continue
    }
    const ocrClass = classify(segment.text)
    const rawClass = nearest ? classify(nearest.text) : null
    const selected = rawClass?.type === 'chords' || rawClass?.type === 'section'
      ? rawClass
      : rawClass?.type === 'lyrics' && ocrClass?.type === 'lyrics' && lyricQuality(rawClass.text) > lyricQuality(ocrClass.text)
        ? rawClass
        : ocrClass
    if (!selected) continue
    const prefix = splitSectionLine(selected.text)
    if (prefix?.remainder) {
      rows.push({ type: 'section', text: prefix.section })
      const remainder = classify(prefix.remainder)
      if (remainder) rows.push(remainder)
    } else {
      rows.push(selected)
    }
  }
  const deduplicated = rows.filter((row, index) => index === 0 || row.type !== rows[index - 1].type || row.text !== rows[index - 1].text)
  if (!deduplicated.some((row) => row.type === 'section')) deduplicated.unshift({ type: 'section', text: 'Verse' })
  return deduplicated
}

const sheets = {}
for (const file of files) {
  const extraction = JSON.parse(await readFile(path.join(extractionRoot, file), 'utf8'))
  if (verifiedIds.has(extraction.songId)) continue
  const extractedRows = extraction.pages.flatMap((page, index) => [
    ...(index > 0 ? [{ type: 'section', text: `Page ${index + 1}` }] : []),
    ...pageToRows(page),
  ])
  let ocrRows = null
  try {
    const ocrPages = JSON.parse(await readFile(path.join(ocrRoot, file), 'utf8'))
    ocrRows = ocrPages.flatMap((page, index) => [
      ...(index > 0 ? [{ type: 'section', text: `Page ${index + 1}` }] : []),
      ...ocrPageToRows(page, extraction.pages[index]),
    ])
  } catch {
    // OCR is a review enhancement; extraction remains the fallback.
  }
  const rows = rowOverrides[extraction.songId] || ocrRows || extractedRows
  if (rows.length === 0) continue
  const isReviewed = Boolean(rowOverrides[extraction.songId] || ocrRows)
  sheets[extraction.songId] = {
    songId: extraction.songId,
    originalKey: keyOverrides[extraction.songId] || extraction.detectedKey || '',
    sourceLabel: rowOverrides[extraction.songId]
      ? '已對照原始歌譜與歌詞完成校對'
      : isReviewed
        ? '已對照原始 PDF 文字層與頁面 OCR 完成校對'
        : '由現有歌譜擷取，待逐首校對',
    reviewStatus: isReviewed
      ? 'verified'
      : (keyOverrides[extraction.songId] || extraction.detectedKey ? 'draft' : 'needs_key_review'),
    rows,
  }
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(sheets, null, 2)}\n`)
const progress = JSON.parse(await readFile(progressPath, 'utf8'))
for (const song of progress.songs) {
  if (sheets[song.songId]) song.status = sheets[song.songId].reviewStatus === 'verified' ? 'structured_verified' : 'structured_draft'
}
progress.generatedAt = new Date().toISOString()
progress.counts = progress.songs.reduce((counts, song) => {
  counts[song.status] = (counts[song.status] ?? 0) + 1
  return counts
}, {})
await writeFile(progressPath, `${JSON.stringify(progress, null, 2)}\n`)
console.log(`generated ${Object.keys(sheets).length} structured sheet drafts -> ${path.relative(root, outputPath)}`)
