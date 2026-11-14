export interface ChordSheetData {
  songId: string
  originalKey: string
  sourceLabel: string
  chordPro: string
}

const howMuchDoILoveYou = String.raw`{key: D}

{comment: Intro}
[Gmaj7] / / / | [A/G] / / / | [F#m7] / / / | [Bm7] / / /
[Em7] / / / | [A] / / / | [D] / / /

{comment: Inter}
[D] / [G/D] / | [D] / [G/D] /
[D] / [G/D] / | [D] / / /

{start_of_verse: Verse}
[Gmaj7]我問這一生　[D/F#]愛祢有多深
I've ever wondered how much I love You
[Em7]獻上我所有　[A]在祢同在
Every day I stand in Your presence
[D]我滿心感恩　[D/F#]
Giving all to You

[Gmaj7]我只想永遠　[D/F#]坐在祢的腳前
I never want to be far away from You
[Em7]即使我軟弱
When I go astray
[A]祢的愛
I find Your love
[D]從不曾走遠　[C/D]
Reaching out to me
{end_of_verse}

{start_of_chorus: Chorus}
[Gmaj7]我深深愛祢[A/G]耶穌
Jesus I'm in love with You
[F#m7]更深愛慕祢[Bm7]耶穌
Jesus I'm in love with You
[Em7]帶我進入　[A]祢更深愛[D]裡 [Em7] [D/F#]
Take me deeper, deeper in love with You

[Gmaj7]我渴慕著祢[A/G]耶穌
Jesus I want more of You
[F#m7]更深渴慕祢[Bm7]耶穌
Jesus I want more of You
[Em7]讓我親近　[A]更貼近祢[D]心 [G/D] [D]
Draw me closer, closer to Your heart
{end_of_chorus}

{start_of_bridge: Bridge}
[Em7]愛祢就像[D]呼吸 [A/C#]
How much do I love You
[F#m7]沒有祢我[F#/A#]心無法[Bm7]言喻
So much that my heart can't live without
[Em7]我要更多有祢 [A]
How much do I want You
[Dsus4]將生命全然[D7]獻上給祢
So much that I'll give my life for You
{end_of_bridge}`

export const chordSheets: Record<string, ChordSheetData> = {
  '敬拜-088-how-much-do-i-love-you': {
    songId: '敬拜-088-how-much-do-i-love-you',
    originalKey: 'D',
    sourceLabel: '依現有 PDF 歌譜整理',
    chordPro: howMuchDoILoveYou,
  },
}

export function getChordSheet(songId: string) {
  return chordSheets[songId] ?? null
}
