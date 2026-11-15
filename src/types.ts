export type Category = '讚美' | '敬拜'

export interface Song {
  id: string
  index: number
  title: string
  category: Category
  year: string
  source: string
  language: string
  songUrl: string
  lyricsUrl: string
  scoreUrl: string
  harmonyUrl: string
  tempo: string
  key: string
  tags: string[]
}

export type ViewName = 'library' | 'setlist' | 'practice' | 'admin'
