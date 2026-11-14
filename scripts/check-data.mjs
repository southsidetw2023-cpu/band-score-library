import { readFile } from 'node:fs/promises'

const songs = JSON.parse(await readFile('src/data/songs.generated.json', 'utf8'))
const resourceFields = ['songUrl', 'lyricsUrl', 'scoreUrl', 'harmonyUrl']
const invalid = []

for (const song of songs) {
  for (const field of resourceFields) {
    const value = song[field]
    if (value && !/^https?:\/\//i.test(value)) {
      invalid.push(`${song.category} #${song.index} ${field}: ${value}`)
    }
  }
}

if (songs.length !== 207) {
  throw new Error(`歌曲筆數錯誤：預期 207，實際 ${songs.length}`)
}

if (invalid.length) {
  throw new Error(`發現 ${invalid.length} 筆無效資源連結：\n${invalid.slice(0, 10).join('\n')}`)
}

const scoreCount = songs.filter((song) => song.scoreUrl).length
if (!scoreCount) throw new Error('資料中沒有任何歌譜連結。')

console.log(`資料驗證完成：207 首歌曲、${scoreCount} 筆歌譜連結，所有資源欄位均為有效網址。`)
