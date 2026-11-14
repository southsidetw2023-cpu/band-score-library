import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const progress = JSON.parse(await readFile(path.join(root, 'docs/chord-sheet-progress.json'), 'utf8'))
const outputRoot = path.join(root, 'work/chord-sheet-review/pdfs')
const concurrency = Math.max(1, Number(process.argv.find((value) => value.startsWith('--concurrency='))?.split('=')[1] ?? 6))
const statuses = new Set(['structured_draft'])
const queue = progress.songs.filter((song) => statuses.has(song.status) && song.sourceType === 'drive_pdf')
let cursor = 0

await mkdir(outputRoot, { recursive: true })

function fileId(url) {
  return url.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1] ?? ''
}

function safeFilename(id) {
  return id.replaceAll('/', '-').replaceAll('\\', '-').replace(/[^\p{L}\p{N}_.-]+/gu, '-')
}

async function exists(filename) {
  try {
    await access(filename)
    return true
  } catch {
    return false
  }
}

async function worker() {
  while (cursor < queue.length) {
    const song = queue[cursor]
    cursor += 1
    const output = path.join(outputRoot, `${safeFilename(song.songId)}.pdf`)
    if (await exists(output)) {
      console.log(`SKIP\t${song.songId}`)
      continue
    }
    const id = fileId(song.sourceUrl)
    if (!id) throw new Error(`${song.songId} 沒有 Drive file id`)
    const response = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, { signal: AbortSignal.timeout(45_000) })
    if (!response.ok) throw new Error(`${song.songId} HTTP ${response.status}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error(`${song.songId} 下載內容不是 PDF`)
    await writeFile(output, bytes)
    console.log(`OK\t${song.songId}\t${bytes.length}`)
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()))
console.log(`下載完成：${queue.length} 首`)
