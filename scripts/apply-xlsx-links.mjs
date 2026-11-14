import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const xlsxPath = process.argv[2]
if (!xlsxPath) {
  throw new Error('請提供 Google Sheet 匯出的 XLSX 路徑。')
}

const tabs = ['讚美', '敬拜']
const fieldsByColumn = {
  F: 'songUrl',
  G: 'lyricsUrl',
  H: 'scoreUrl',
  I: 'harmonyUrl',
}
const output = resolve('src/data/songs.generated.json')

function readZipEntry(entry) {
  return execFileSync('unzip', ['-p', resolve(xlsxPath), entry], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
}

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function getAttribute(attributes, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return attributes.match(new RegExp(`(?:^|\\s)${escaped}="([^"]*)"`))?.[1] ?? ''
}

function parseRelationships(xml) {
  const relationships = new Map()
  for (const match of xml.matchAll(/<Relationship\b([^>]+?)(?:\/>|>)/g)) {
    const id = getAttribute(match[1], 'Id')
    const target = getAttribute(match[1], 'Target')
    if (id && target) relationships.set(id, decodeXml(target))
  }
  return relationships
}

function parseSharedStrings(xml) {
  const strings = []
  for (const match of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const value = [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((text) => decodeXml(text[1]))
      .join('')
    strings.push(value)
  }
  return strings
}

function parseRowIndexes(xml, sharedStrings) {
  const indexes = new Map()
  for (const match of xml.matchAll(/<c\b([^>]*\br="A(\d+)"[^>]*)>([\s\S]*?)<\/c>/g)) {
    const attributes = match[1]
    const row = Number(match[2])
    const rawValue = match[3].match(/<v>([^<]+)<\/v>/)?.[1]
    if (rawValue === undefined) continue

    const resolvedValue = getAttribute(attributes, 't') === 's'
      ? sharedStrings[Number(rawValue)]
      : rawValue
    const value = Number(resolvedValue)
    if (Number.isFinite(value)) indexes.set(row, value)
  }
  return indexes
}

function parseHyperlinks(xml, relationships) {
  const links = new Map()
  for (const match of xml.matchAll(/<hyperlink\b([^>]+?)(?:\/>|>)/g)) {
    const ref = getAttribute(match[1], 'ref')
    const relationshipId = getAttribute(match[1], 'r:id')
    const target = relationships.get(relationshipId)
    if (ref && target) links.set(ref, target)
  }
  return links
}

const songs = JSON.parse(await readFile(output, 'utf8'))
const songByKey = new Map(songs.map((song) => [`${song.category}:${song.index}`, song]))
const sharedStrings = parseSharedStrings(readZipEntry('xl/sharedStrings.xml'))
let applied = 0

for (const [sheetOffset, tab] of tabs.entries()) {
  const sheetNumber = sheetOffset + 1
  const worksheet = readZipEntry(`xl/worksheets/sheet${sheetNumber}.xml`)
  const relationships = parseRelationships(readZipEntry(`xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`))
  const rowIndexes = parseRowIndexes(worksheet, sharedStrings)
  const hyperlinks = parseHyperlinks(worksheet, relationships)

  for (const [row, index] of rowIndexes) {
    const song = songByKey.get(`${tab}:${index}`)
    if (!song) continue

    for (const [column, field] of Object.entries(fieldsByColumn)) {
      const link = hyperlinks.get(`${column}${row}`)
      if (link) {
        song[field] = link
        applied += 1
      } else if (!/^https?:\/\//i.test(song[field])) {
        song[field] = ''
      }
    }
  }
}

await writeFile(output, `${JSON.stringify(songs, null, 2)}\n`, 'utf8')

const counts = Object.fromEntries(Object.values(fieldsByColumn).map((field) => [field, songs.filter((song) => song[field]).length]))
console.log(JSON.stringify({ songs: songs.length, applied, counts }))
