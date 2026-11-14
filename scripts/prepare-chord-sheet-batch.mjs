import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const root = path.resolve(import.meta.dirname, '..')
const songsPath = path.join(root, 'src/data/songs.generated.json')
const chordSheetsPath = path.join(root, 'src/data/chord-sheets.ts')
const workRoot = path.join(root, 'work/chord-sheet-batch')
const extractionRoot = path.join(workRoot, 'extracted')
const progressPath = path.join(root, 'docs/chord-sheet-progress.json')
const requestedLimit = Number(process.argv.find((argument) => argument.startsWith('--limit='))?.split('=')[1] ?? 0)
const concurrency = Math.max(1, Number(process.argv.find((argument) => argument.startsWith('--concurrency='))?.split('=')[1] ?? 5))

const songs = JSON.parse(await readFile(songsPath, 'utf8'))
const chordSheetSource = await readFile(chordSheetsPath, 'utf8')
const publishedIds = new Set([...chordSheetSource.matchAll(/songId:\s*'([^']+)'/g)].map((match) => match[1]))
let previousById = new Map()
try {
  const previous = JSON.parse(await readFile(progressPath, 'utf8'))
  previousById = new Map(previous.songs.map((song) => [song.songId, song]))
} catch {
  // First run: no durable progress file yet.
}

await mkdir(extractionRoot, { recursive: true })
await mkdir(path.dirname(progressPath), { recursive: true })

function driveFileId(url) {
  return url.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1] ?? ''
}

function sourceType(url) {
  if (!url) return 'missing'
  if (driveFileId(url)) return 'drive_pdf'
  if (/pse\.is|reurl\.cc|bit\.ly|tinyurl/i.test(url)) return 'short_url'
  if (/drive\.google\.com\/drive\/(?:u\/\d\/)?folders\//.test(url)) return 'drive_folder'
  return 'other_url'
}

function safeFilename(id) {
  return id.replaceAll('/', '-').replaceAll('\\', '-').replace(/[^\p{L}\p{N}_.-]+/gu, '-')
}

function compactText(items) {
  return items.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim()
}

function groupLines(items) {
  const sorted = [...items].sort((left, right) => right.y - left.y || left.x - right.x)
  const lines = []
  for (const item of sorted) {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2.5)
    if (!line) {
      line = { y: item.y, items: [] }
      lines.push(line)
    }
    line.items.push(item)
  }
  return lines
    .sort((left, right) => right.y - left.y)
    .map((line) => ({ ...line, items: line.items.sort((left, right) => left.x - right.x), text: compactText(line.items) }))
}

async function fetchPdf(url, attempts = 3) {
  const fileId = driveFileId(url)
  if (!fileId) throw new Error('不是可直接下載的 Google Drive PDF')
  const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`
  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(downloadUrl, { signal: AbortSignal.timeout(30_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('下載內容不是 PDF')
      return bytes
    } catch (error) {
      lastError = error
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 750))
    }
  }
  throw lastError
}

async function extractSong(song) {
  const bytes = await fetchPdf(song.scoreUrl)
  const document = await getDocument({ data: bytes }).promise
  const pages = []
  let allText = ''
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const items = content.items
      .filter((item) => 'str' in item && item.str.trim())
      .map((item) => ({
        text: item.str,
        x: Math.round(item.transform[4] * 100) / 100,
        y: Math.round(item.transform[5] * 100) / 100,
        width: Math.round(item.width * 100) / 100,
        height: Math.round(item.height * 100) / 100,
      }))
    const lines = groupLines(items)
    allText += `${lines.map((line) => line.text).join('\n')}\n`
    pages.push({ pageNumber, width: viewport.width, height: viewport.height, lines })
  }
  const detectedKey = allText.match(/\bKey\s*[:：]?\s*([A-G](?:#|b)?)/i)?.[1] ?? ''
  const extraction = {
    schemaVersion: 1,
    songId: song.id,
    title: song.title,
    sourceUrl: song.scoreUrl,
    extractedAt: new Date().toISOString(),
    detectedKey,
    pages,
  }
  const filename = `${safeFilename(song.id)}.json`
  await writeFile(path.join(extractionRoot, filename), `${JSON.stringify(extraction, null, 2)}\n`)
  return {
    status: allText.replace(/\s/g, '').length >= 80 ? 'extracted_needs_conversion' : 'needs_ocr',
    pageCount: document.numPages,
    characterCount: allText.replace(/\s/g, '').length,
    detectedKey,
    extractionFile: `work/chord-sheet-batch/extracted/${filename}`,
    error: '',
  }
}

const progress = songs.map((song) => {
  const type = sourceType(song.scoreUrl)
  const previous = previousById.get(song.id)
  const base = {
    songId: song.id,
    title: song.title,
    category: song.category,
    sourceType: type,
    sourceUrl: song.scoreUrl,
    status: type === 'missing' ? 'blocked_missing_source' : type === 'drive_pdf' ? 'queued' : 'blocked_source_needs_resolution',
    pageCount: 0,
    characterCount: 0,
    detectedKey: '',
    extractionFile: '',
    error: '',
  }
  if (previous && previous.sourceUrl === song.scoreUrl) Object.assign(base, previous)
  if (publishedIds.has(song.id)) base.status = 'published'
  return base
})

const queue = progress.filter((item) => item.status === 'queued').slice(0, requestedLimit > 0 ? requestedLimit : undefined)
let cursor = 0

async function worker() {
  while (cursor < queue.length) {
    const item = queue[cursor]
    cursor += 1
    const song = songs.find((candidate) => candidate.id === item.songId)
    try {
      Object.assign(item, await extractSong(song))
      console.log(`OK\t${item.title}\t${item.detectedKey || '-'}\t${item.characterCount}`)
    } catch (error) {
      item.status = 'extract_failed'
      item.error = String(error instanceof Error ? error.message : error)
      console.error(`FAIL\t${item.title}\t${item.error}`)
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()))

const counts = progress.reduce((summary, item) => {
  summary[item.status] = (summary[item.status] ?? 0) + 1
  return summary
}, {})

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  totalSongs: progress.length,
  counts,
  songs: progress,
}

await writeFile(progressPath, `${JSON.stringify(output, null, 2)}\n`)
console.log(`SUMMARY\t${JSON.stringify(counts)}`)
