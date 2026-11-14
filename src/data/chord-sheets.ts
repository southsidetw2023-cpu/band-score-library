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

const praise = String.raw`{key: C}

{comment: Intro}
[Am7] / / / | [F] / / / | [C] / / / | [G] / / /

{start_of_verse: Verse 1}
[C]我在低谷讚美　[F]在高山讚美　[C]
I'll praise in the valley, praise on the mountain
[G]在確信讚美　[F]不確定也讚美　[C]
I'll praise when I'm sure, praise when I'm doubting

[C]就算孤身奮戰　[F]我仍高聲讚美　[C]
I'll praise when outnumbered, praise when surrounded
[G]只要仍然呼吸　[F]我就要高聲唱　[C]
As long as I'm breathing, I've got a reason to
{end_of_verse}

{start_of_chorus: Chorus 1}
[Am7]Praise the Lord, [F]Oh my soul
[C]Praise the Lord, [G]Oh my soul
[Am7]Praise the Lord, [F]Oh my soul
[C]Praise the Lord, [G]Oh my soul
{end_of_chorus}

{start_of_verse: Verse 2}
[C]在突破時讚美　[F]失敗仍讚美　[C]
I'll praise when I feel it, I'll praise when I don't
[G]因為我知道祢　[F]做王掌權　[C]
I'll praise cause I know, You're still in control

[C]讚美是我武器　[F]不只是聲音　[C]
My praise is a weapon, it's more than a sound
[G]讚美大聲呼喊　[F]耶利哥都倒塌　[C]
My praise is the shout that brings Jericho down
[G]只要仍然呼吸　[F]我就要高聲唱　[C]
As long as I'm breathing, I've got a reason to
{end_of_verse}

{start_of_chorus: Chorus 2}
[Am7]Praise the Lord, [F]Oh my soul
[C]Praise the Lord, [G]Oh my soul
[Am7]Praise the Lord, [F]Oh my soul
[C]Praise the Lord, [G]Oh my soul

[Am7]我無法沉默　[F]因主祢活著
I won't be quiet, my God is alive
[C]怎能隱藏在心中　[G]讚美如同大水淹沒一切仇敵
How could I keep it inside? Cause praise is the water my enemies drown in
[G]只要仍然呼吸　[F]我就要高聲唱
As long as I'm breathing, I've got a reason to
{end_of_chorus}

{comment: Interlude}
[C] / / / | [C] / / / | [C] / / / | [C] / / /

{start_of_bridge: Bridge}
[C]讚美祢掌權　[Dm]統管萬有
I'll praise cause You're sovereign, praise cause You reign
[Am7]讚美祢復活　[F]已勝過死亡
Praise cause You rose and defeated the grave
[C]我讚美祢信實　[Dm]何等真實
I'll praise cause You're faithful, praise cause You're true
[Am7]讚美祢超越這世上所有　[F]
Praise cause there's nobody greater than You
{end_of_bridge}

{comment: Ending}
[Am7] / / / | [F] / / / | [C] / / / | [G] / / /`

const heavenOpened = String.raw`{key: A}

{comment: Intro}
[A] / / / | [A] / / / | [D] / / / | [D] / / /
[A] / / / | [A] / / / | [D] / / / | [D] / / /

{start_of_verse: Verse 1}
[A]天上的門打開　[D]有聲音發出來
[F#m7]祢是我心所愛　[E]天父如此告白　[D]
[A]主祢就是真光　[D]祢向我們照亮
[F#m7]我們已經看見　[E]以色列的榮光　[D]
{end_of_verse}

{start_of_chorus: Pre-Chorus}
[D]將一切榮耀　[E]歸於神
[F#m7]在至高處讚美　[E/G#] [A]
[Bm7]在地上有平安　[A/C#]到永遠　[D]
{end_of_chorus}

{start_of_verse: Verse 2}
[A]天上的門打開　[D]有聲音發出來
[F#m7]祢是我心所愛　[E]天父如此告白　[D]
[A]得勝的主耶穌　[D]戰勝死亡的主
[F#m7]所有黑暗權勢　[E]耶穌已經破除　[D]
{end_of_verse}

{start_of_chorus: Chorus}
[A]耶穌我們高舉祢名　[D]祢是成就應許的主
[F#m7]主我們讚美祢作為　[E]祢是萬國唯一盼望　[D]
[A]耶穌我們高舉祢名　[D]祢作王掌權到永遠
[F#m7]受造物都來高舉祢　[E]天上地下都敬拜祢　[D]
{end_of_chorus}

{comment: Outro}
[A]Oh oh oh oh oh　[D]Oh oh oh oh oh
[F#m7]Oh oh oh oh oh　[E/G#] [A]
[Bm7]Oh oh oh oh oh　[A/C#] [D]
{comment: End on D}`

export const chordSheets: Record<string, ChordSheetData> = {
  '讚美-073-天上的門打開': {
    songId: '讚美-073-天上的門打開',
    originalKey: 'A',
    sourceLabel: '依現有 PDF 歌譜整理',
    chordPro: heavenOpened,
  },
  '讚美-064-praise': {
    songId: '讚美-064-praise',
    originalKey: 'C',
    sourceLabel: '依現有 PDF 歌譜整理',
    chordPro: praise,
  },
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
