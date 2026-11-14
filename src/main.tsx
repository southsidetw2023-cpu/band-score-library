import { StrictMode, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CirclePlay,
  CircleUserRound,
  CloudUpload,
  ExternalLink,
  FileMusic,
  FileText,
  GripVertical,
  HardDrive,
  Languages,
  LibraryBig,
  ListFilter,
  ListMusic,
  LoaderCircle,
  LockKeyhole,
  Minus,
  Music2,
  Plus,
  Presentation,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react'
import { getChordSheet, type ChordSheetData } from './data/chord-sheets'
import songsData from './data/songs.generated.json'
import type { Song, ViewName } from './types'
import './styles.css'

const previewThemes = new Set(['slate-blue', 'forest-green', 'mono-blue'])
const previewTheme = new URLSearchParams(window.location.search).get('theme')
if (previewTheme && previewThemes.has(previewTheme)) {
  document.documentElement.dataset.theme = previewTheme
}

const songs = (songsData as Song[]).sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'))
const chromaticKeys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const
const pdfWorkerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

interface PerformanceSession {
  songs: Song[]
  initialSongId: string
}

function getDriveFileId(url: string) {
  return url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i)?.[1] ?? ''
}

function getInlineScoreUrl(url: string) {
  const fileId = getDriveFileId(url)
  return fileId
    ? `${import.meta.env.BASE_URL}api/score?file=${encodeURIComponent(fileId)}`
    : ''
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  })
}

const navItems: Array<{ id: ViewName; label: string; helper: string; icon: LucideIcon }> = [
  { id: 'library', label: '樂譜庫', helper: '搜尋與瀏覽', icon: LibraryBig },
  { id: 'setlist', label: '本週歌單', helper: '排練與演出', icon: ListMusic },
  { id: 'admin', label: '管理中心', helper: '成員與匯入', icon: ShieldCheck },
]

function getInitialSetlist() {
  const stored = window.localStorage.getItem('ensemble-setlist')
  if (stored) {
    try {
      const ids = JSON.parse(stored) as string[]
      return ids.filter((id) => songs.some((song) => song.id === id))
    } catch {
      // Continue with the curated local demo set.
    }
  }
  return songs.slice(0, 4).map((song) => song.id)
}

function App() {
  const [view, setView] = useState<ViewName>('library')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [category, setCategory] = useState<'全部' | Song['category']>('全部')
  const [availability, setAvailability] = useState<'全部' | '已有歌譜' | '待補歌譜'>('全部')
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [performanceSession, setPerformanceSession] = useState<PerformanceSession | null>(null)
  const [setlistIds, setSetlistIds] = useState<string[]>(getInitialSetlist)

  useEffect(() => {
    window.localStorage.setItem('ensemble-setlist', JSON.stringify(setlistIds))
  }, [setlistIds])

  const filteredSongs = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase('zh-Hant')
    return songs.filter((song) => {
      const matchesQuery = !normalizedQuery || [song.title, song.source, song.language, song.year]
        .join(' ')
        .toLocaleLowerCase('zh-Hant')
        .includes(normalizedQuery)
      const matchesCategory = category === '全部' || song.category === category
      const matchesAvailability = availability === '全部'
        || (availability === '已有歌譜' ? Boolean(song.scoreUrl) : !song.scoreUrl)
      return matchesQuery && matchesCategory && matchesAvailability
    })
  }, [availability, category, deferredQuery])

  const setlist = setlistIds
    .map((id) => songs.find((song) => song.id === id))
    .filter((song): song is Song => Boolean(song))

  function addToSetlist(song: Song) {
    setSetlistIds((current) => current.includes(song.id) ? current : [...current, song.id])
  }

  function removeFromSetlist(songId: string) {
    setSetlistIds((current) => current.filter((id) => id !== songId))
  }

  function moveSetlistSong(songId: string, toIndex: number) {
    setSetlistIds((current) => {
      const fromIndex = current.indexOf(songId)
      const boundedIndex = Math.max(0, Math.min(toIndex, current.length - 1))
      if (fromIndex < 0 || fromIndex === boundedIndex) return current

      const next = [...current]
      next.splice(fromIndex, 1)
      next.splice(boundedIndex, 0, songId)
      return next
    })
  }

  function openLiveSheet(song: Song) {
    setSelectedSong(null)
    setPerformanceSession({ songs: [song], initialSongId: song.id })
  }

  function openPerformanceSet() {
    if (setlist.length === 0) return
    setPerformanceSession({ songs: setlist, initialSongId: setlist[0].id })
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要內容</a>
      <Sidebar view={view} setView={setView} setlistCount={setlistIds.length} />

      <main className="main-content" id="main-content">
        <Topbar setView={setView} />

        {view === 'library' && (
          <LibraryView
            query={query}
            setQuery={setQuery}
            category={category}
            setCategory={setCategory}
            availability={availability}
            setAvailability={setAvailability}
            filteredSongs={filteredSongs}
            setlistIds={setlistIds}
            onOpen={setSelectedSong}
            onAdd={addToSetlist}
          />
        )}

        {view === 'setlist' && (
          <SetlistView
            songs={setlist}
            onOpen={setSelectedSong}
            onRemove={removeFromSetlist}
            onMove={moveSetlistSong}
            onClear={() => setSetlistIds([])}
            onBrowse={() => setView('library')}
            onStartPerformance={openPerformanceSet}
          />
        )}

        {view === 'admin' && <AdminView />}
      </main>

      <MobileNav view={view} setView={setView} setlistCount={setlistIds.length} />
      <SongDialog song={selectedSong} onClose={() => setSelectedSong(null)} onAdd={addToSetlist} onOpenLive={openLiveSheet} inSetlist={selectedSong ? setlistIds.includes(selectedSong.id) : false} />
      <PerformanceDialog session={performanceSession} onClose={() => setPerformanceSession(null)} />
    </div>
  )
}

function Sidebar({ view, setView, setlistCount }: { view: ViewName; setView: (view: ViewName) => void; setlistCount: number }) {
  return (
    <aside className="sidebar" aria-label="主要導覽">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"><Music2 size={22} strokeWidth={2.4} /></span>
        <span>
          <strong>合奏庫</strong>
          <small>ENSEMBLE</small>
        </span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ id, label, helper, icon: Icon }) => (
          <button key={id} type="button" className={view === id ? 'nav-item is-active' : 'nav-item'} onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined}>
            <Icon size={20} aria-hidden="true" />
            <span><strong>{label}{id === 'setlist' && setlistCount > 0 && <b className="nav-count">{setlistCount}</b>}</strong><small>{helper}</small></span>
            <ChevronRight size={16} className="nav-chevron" aria-hidden="true" />
          </button>
        ))}
      </nav>

      <div className="sidebar-security">
        <LockKeyhole size={18} aria-hidden="true" />
        <span><strong>私人樂譜庫</strong><small>僅限已核准團員</small></span>
      </div>
    </aside>
  )
}

function Topbar({ setView }: { setView: (view: ViewName) => void }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">PPC 敬拜團</p>
        <h1>團隊樂譜工作台</h1>
      </div>
      <div className="topbar-actions">
        <button type="button" className="button button-primary" onClick={() => setView('admin')}>
          <Plus size={18} aria-hidden="true" />新增樂譜
        </button>
        <button type="button" className="profile-button" aria-label="開啟帳號選單">
          <span className="profile-icon"><CircleUserRound size={21} aria-hidden="true" /></span>
          <span><strong>管理者</strong><small>本機原型</small></span>
        </button>
      </div>
    </header>
  )
}

interface LibraryViewProps {
  query: string
  setQuery: (value: string) => void
  category: '全部' | Song['category']
  setCategory: (value: '全部' | Song['category']) => void
  availability: '全部' | '已有歌譜' | '待補歌譜'
  setAvailability: (value: '全部' | '已有歌譜' | '待補歌譜') => void
  filteredSongs: Song[]
  setlistIds: string[]
  onOpen: (song: Song) => void
  onAdd: (song: Song) => void
}

function LibraryView(props: LibraryViewProps) {
  const scoreCount = songs.filter((song) => song.scoreUrl).length
  const lyricsCount = songs.filter((song) => song.lyricsUrl).length
  const [visibleCount, setVisibleCount] = useState(30)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  useEffect(() => {
    setVisibleCount(30)
  }, [props.availability, props.category, props.query])

  const visibleSongs = props.filteredSongs.slice(0, visibleCount)

  return (
    <section className="page page-library" aria-labelledby="library-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">LIBRARY</p>
          <h2 id="library-title">全部樂譜</h2>
          <p>從歌名、出處或語言快速找到排練需要的資料。</p>
        </div>
        <div className="summary-row" aria-label="樂譜庫摘要">
          <SummaryMetric value={songs.length} label="歌曲" />
          <SummaryMetric value={scoreCount} label="有歌譜" />
          <SummaryMetric value={lyricsCount} label="有歌詞" />
        </div>
      </div>

      <div className="filter-panel">
        <label className="search-field">
          <span className="sr-only">搜尋樂譜</span>
          <Search size={20} aria-hidden="true" />
          <input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="搜尋歌名、出處、語言或年份" />
          {props.query && <button type="button" className="clear-search" onClick={() => props.setQuery('')} aria-label="清除搜尋"><X size={18} /></button>}
        </label>

        <div className="filter-group" aria-label="分類篩選">
          {(['全部', '讚美', '敬拜'] as const).map((item) => (
            <button key={item} type="button" className={props.category === item ? 'chip is-active' : 'chip'} onClick={() => props.setCategory(item)} aria-pressed={props.category === item}>{item}</button>
          ))}
        </div>

        <button type="button" className="mobile-filter-trigger" onClick={() => setShowMobileFilters((isOpen) => !isOpen)} aria-expanded={showMobileFilters}>
          <ListFilter size={18} aria-hidden="true" />篩選{props.availability !== '全部' ? '（1）' : ''}
        </button>

        <label className={showMobileFilters ? 'select-field is-open' : 'select-field'}>
          <ListFilter size={18} aria-hidden="true" />
          <span className="sr-only">依歌譜狀態篩選</span>
          <select value={props.availability} onChange={(event) => props.setAvailability(event.target.value as LibraryViewProps['availability'])}>
            <option>全部</option>
            <option>已有歌譜</option>
            <option>待補歌譜</option>
          </select>
        </label>
      </div>

      <div className="results-bar" aria-live="polite">
        <span>找到 <strong>{props.filteredSongs.length}</strong> 首</span>
        <span className="results-helper">點選歌曲查看完整資料</span>
      </div>

      {props.filteredSongs.length > 0 ? (
        <div className="song-grid">
          {visibleSongs.map((song) => (
            <SongCard key={song.id} song={song} inSetlist={props.setlistIds.includes(song.id)} onOpen={props.onOpen} onAdd={props.onAdd} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Search size={30} aria-hidden="true" />
          <h3>沒有符合條件的歌曲</h3>
          <p>請調整關鍵字或篩選條件。</p>
        </div>
      )}
      {visibleCount < props.filteredSongs.length && (
        <div className="load-more">
          <button type="button" className="button button-secondary" onClick={() => setVisibleCount((count) => count + 30)}>
            顯示更多（尚有 {props.filteredSongs.length - visibleCount} 首）
          </button>
        </div>
      )}
    </section>
  )
}

function SummaryMetric({ value, label }: { value: number; label: string }) {
  return <span className="summary-metric"><strong>{value}</strong><small>{label}</small></span>
}

function SongCard({ song, inSetlist, onOpen, onAdd }: { song: Song; inSetlist: boolean; onOpen: (song: Song) => void; onAdd: (song: Song) => void }) {
  const resourceCount = [song.songUrl, song.lyricsUrl, song.scoreUrl, song.harmonyUrl].filter(Boolean).length
  return (
    <article className="song-card">
      <button type="button" className="song-card-main" onClick={() => onOpen(song)} aria-label={`查看 ${song.title}`}>
        <div className="song-cover" aria-hidden="true">
          <FileMusic size={20} />
        </div>
        <div className="song-card-copy">
          <div className="song-card-title-row">
            <h3>{song.title}</h3>
            <ChevronRight size={18} aria-hidden="true" />
          </div>
          <p>{song.source || '尚未填寫出處'}</p>
          <div className="song-meta">
            {song.year && <span><CalendarDays size={14} aria-hidden="true" />{song.year}</span>}
            {song.language && <span><Languages size={14} aria-hidden="true" />{song.language}</span>}
            <span><FileText size={14} aria-hidden="true" />{resourceCount} 項資料</span>
          </div>
        </div>
      </button>
      <div className="song-card-footer">
        <span className={song.scoreUrl ? 'status-pill is-complete' : 'status-pill is-missing'}>
          {song.scoreUrl ? <CheckCircle2 size={14} aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />}
          {song.scoreUrl ? '已有歌譜' : '待補歌譜'}
        </span>
        <button type="button" className={inSetlist ? 'setlist-action is-added' : 'setlist-action'} onClick={() => onAdd(song)} disabled={inSetlist} aria-label={inSetlist ? `${song.title} 已在歌單` : `將 ${song.title} 加入歌單`}>
          {inSetlist ? <Check size={16} /> : <Plus size={16} />}
          <span>{inSetlist ? '已加入' : '加入歌單'}</span>
        </button>
      </div>
    </article>
  )
}

function SetlistView({ songs: setlistSongs, onOpen, onRemove, onMove, onClear, onBrowse, onStartPerformance }: { songs: Song[]; onOpen: (song: Song) => void; onRemove: (id: string) => void; onMove: (id: string, toIndex: number) => void; onClear: () => void; onBrowse: () => void; onStartPerformance: () => void }) {
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null)
  const [orderAnnouncement, setOrderAnnouncement] = useState('')
  const draggedSongIdRef = useRef<string | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const pointerStartRef = useRef({ x: 0, y: 0 })
  const pointerMovedRef = useRef(false)

  function announceMove(song: Song, toIndex: number) {
    setOrderAnnouncement(`${song.title} 已移至第 ${toIndex + 1} 首`)
  }

  function moveSong(song: Song, toIndex: number) {
    if (toIndex < 0 || toIndex >= setlistSongs.length) return
    onMove(song.id, toIndex)
    announceMove(song, toIndex)
  }

  function startDrag(event: React.PointerEvent<HTMLButtonElement>, song: Song) {
    if (!event.isPrimary || event.button !== 0) return
    event.preventDefault()
    draggedSongIdRef.current = song.id
    pointerIdRef.current = event.pointerId
    pointerStartRef.current = { x: event.clientX, y: event.clientY }
    pointerMovedRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraggedSongId(song.id)
  }

  function dragSong(event: React.PointerEvent<HTMLButtonElement>) {
    const songId = draggedSongIdRef.current
    if (!songId || pointerIdRef.current !== event.pointerId) return
    event.preventDefault()
    if (Math.hypot(event.clientX - pointerStartRef.current.x, event.clientY - pointerStartRef.current.y) > 5) {
      pointerMovedRef.current = true
    }
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-setlist-index]')
    const toIndex = Number(row?.dataset.setlistIndex)
    if (!Number.isInteger(toIndex)) return
    onMove(songId, toIndex)
  }

  function finishDrag(event: React.PointerEvent<HTMLButtonElement>, song: Song) {
    if (pointerIdRef.current !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const finalIndex = setlistSongs.findIndex((item) => item.id === song.id)
    if (pointerMovedRef.current && finalIndex >= 0) announceMove(song, finalIndex)
    draggedSongIdRef.current = null
    pointerIdRef.current = null
    setDraggedSongId(null)
  }

  return (
    <section className="page" aria-labelledby="setlist-title">
      <div className="page-heading setlist-heading">
        <div>
          <p className="eyebrow">SETLIST</p>
          <h2 id="setlist-title">本週排練歌單</h2>
          <p>準備順序會儲存在這台裝置，正式版再同步給全團。</p>
        </div>
        {setlistSongs.length > 0 && <button type="button" className="button button-ghost button-danger" onClick={onClear}><Trash2 size={17} aria-hidden="true" />清空歌單</button>}
      </div>

      {setlistSongs.length > 0 ? (
        <div className="setlist-layout">
          <div>
            <p className="setlist-order-help">拖曳左側把手調整順序，或使用上下按鈕移動歌曲。</p>
            <ol className="setlist-card">
            {setlistSongs.map((song, index) => (
              <li key={song.id} data-setlist-index={index} className={draggedSongId === song.id ? 'is-dragging' : undefined}>
                <button
                  type="button"
                  className="drag-handle"
                  aria-label={`拖曳調整 ${song.title} 的順序`}
                  onPointerDown={(event) => startDrag(event, song)}
                  onPointerMove={dragSong}
                  onPointerUp={(event) => finishDrag(event, song)}
                  onPointerCancel={(event) => finishDrag(event, song)}
                >
                  <GripVertical size={20} aria-hidden="true" />
                </button>
                <span className="setlist-number">{String(index + 1).padStart(2, '0')}</span>
                <button type="button" className="setlist-song" onClick={() => onOpen(song)}>
                  <strong>{song.title}</strong>
                  <small>{song.source || song.category} · {song.language || '語言未填'}</small>
                </button>
                <span className="setlist-category">{song.category}</span>
                <span className="setlist-move-actions" aria-label={`${song.title} 排序控制`}>
                  <button type="button" onClick={() => moveSong(song, index - 1)} disabled={index === 0} aria-label={`將 ${song.title} 往上移`}><ChevronUp size={18} aria-hidden="true" /></button>
                  <button type="button" onClick={() => moveSong(song, index + 1)} disabled={index === setlistSongs.length - 1} aria-label={`將 ${song.title} 往下移`}><ChevronDown size={18} aria-hidden="true" /></button>
                </span>
                <button type="button" className="icon-action" onClick={() => onRemove(song.id)} aria-label={`從歌單移除 ${song.title}`}><X size={18} /></button>
              </li>
            ))}
            </ol>
            <p className="sr-only" aria-live="polite">{orderAnnouncement}</p>
          </div>

          <aside className="rehearsal-note">
            <Presentation size={24} aria-hidden="true" />
            <p className="eyebrow">LIVE SET</p>
            <h3>開始現場演出</h3>
            <p>依歌單順序左右切換歌曲；有現場和弦譜的歌曲可直接升降 Key。</p>
            <button type="button" className="button button-primary" onClick={onStartPerformance}><CirclePlay size={18} aria-hidden="true" />進入現場模式</button>
            <button type="button" className="button button-secondary" onClick={onBrowse}>繼續加入歌曲</button>
          </aside>
        </div>
      ) : (
        <div className="empty-state empty-large">
          <ListMusic size={38} aria-hidden="true" />
          <h3>歌單目前是空的</h3>
          <p>回到樂譜庫，從歌曲卡片右下角加入。</p>
          <button type="button" className="button button-primary" onClick={onBrowse}>瀏覽樂譜庫</button>
        </div>
      )}
    </section>
  )
}

function AdminView() {
  const [importState, setImportState] = useState<'idle' | 'running' | 'done'>('idle')
  const [uploadNotice, setUploadNotice] = useState(false)

  function simulateImport() {
    setImportState('running')
    window.setTimeout(() => setImportState('done'), 900)
  }

  return (
    <section className="page" aria-labelledby="admin-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h2 id="admin-title">管理中心</h2>
          <p>管理團員、批次匯入與私有儲存。此頁目前為本機操作示範。</p>
        </div>
        <span className="admin-badge"><ShieldCheck size={18} aria-hidden="true" />管理者專用</span>
      </div>

      <div className="admin-stats">
        <AdminMetric icon={Users} value="1" label="管理者" helper="Google 登入待串接" />
        <AdminMetric icon={UserCheck} value="0" label="待核准帳號" helper="核准後才能查看" />
        <AdminMetric icon={HardDrive} value="0 MB" label="私有儲存" helper="尚未啟用外部服務" />
      </div>

      <div className="admin-grid">
        <section className="admin-card import-card">
          <div className="card-heading">
            <span className="card-icon"><CloudUpload size={21} aria-hidden="true" /></span>
            <div><h3>首批資料匯入</h3><p>Google 試算表已完成欄位分析</p></div>
          </div>
          <div className="import-source">
            <span className="source-mark"><FileText size={20} aria-hidden="true" /></span>
            <span><strong>PPC敬拜團－歌單總表</strong><small>讚美 73 首 · 敬拜 134 首</small></span>
            <span className="status-pill is-complete"><CheckCircle2 size={14} aria-hidden="true" />可匯入</span>
          </div>
          <ul className="check-list">
            <li><Check size={16} aria-hidden="true" />207 筆歌曲資料</li>
            <li><Check size={16} aria-hidden="true" />321 個外部資源連結</li>
            <li><Check size={16} aria-hidden="true" />1 組跨分類同名歌曲</li>
          </ul>
          <button type="button" className="button button-primary button-full" onClick={simulateImport} disabled={importState !== 'idle'}>
            {importState === 'running' && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
            {importState === 'done' && <Check size={18} aria-hidden="true" />}
            {importState === 'idle' ? '預覽匯入流程' : importState === 'running' ? '正在建立預覽' : '預覽已完成'}
          </button>
          {importState === 'done' && <p className="inline-feedback" role="status">這只是本機模擬，沒有修改試算表或複製檔案。</p>}
        </section>

        <section className="admin-card">
          <div className="card-heading">
            <span className="card-icon"><Users size={21} aria-hidden="true" /></span>
            <div><h3>團員存取權</h3><p>首次登入需由管理者核准</p></div>
          </div>
          <div className="permission-flow">
            <FlowStep number="1" title="Google 登入" helper="確認帳號身分" />
            <FlowStep number="2" title="等待核准" helper="暫時無法瀏覽樂譜" />
            <FlowStep number="3" title="開通存取" helper="管理者可隨時停用" />
          </div>
          <button type="button" className="button button-secondary button-full" disabled>尚無待核准帳號</button>
        </section>

        <section className="admin-card upload-card">
          <div className="card-heading">
            <span className="card-icon"><FileMusic size={21} aria-hidden="true" /></span>
            <div><h3>新增檔案</h3><p>支援 PDF、JPG、PNG 與文字和弦譜</p></div>
          </div>
          <button type="button" className="drop-zone" onClick={() => setUploadNotice(true)}>
            <CloudUpload size={30} aria-hidden="true" />
            <strong>選擇檔案或整個資料夾</strong>
            <span>正式版會檢查重複檔案與上傳失敗項目</span>
          </button>
          {uploadNotice && <p className="inline-feedback" role="status">本機原型已確認操作；正式版才會開啟檔案選擇器。</p>}
        </section>
      </div>
    </section>
  )
}

function AdminMetric({ icon: Icon, value, label, helper }: { icon: LucideIcon; value: string; label: string; helper: string }) {
  return <div className="admin-metric"><span><Icon size={20} aria-hidden="true" /></span><div><strong>{value}</strong><p>{label}</p><small>{helper}</small></div></div>
}

function FlowStep({ number, title, helper }: { number: string; title: string; helper: string }) {
  return <div className="flow-step"><span>{number}</span><div><strong>{title}</strong><small>{helper}</small></div></div>
}

function MobileNav({ view, setView, setlistCount }: { view: ViewName; setView: (view: ViewName) => void; setlistCount: number }) {
  return (
    <nav className="mobile-nav" aria-label="行動版導覽">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" className={view === id ? 'is-active' : ''} onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined}><span className="mobile-nav-icon"><Icon size={20} aria-hidden="true" />{id === 'setlist' && setlistCount > 0 && <b>{setlistCount}</b>}</span><span>{label}</span></button>
      ))}
    </nav>
  )
}

function SongDialog({ song, onClose, onAdd, onOpenLive, inSetlist }: { song: Song | null; onClose: () => void; onAdd: (song: Song) => void; onOpenLive: (song: Song) => void; inSetlist: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const chordSheet = song ? getChordSheet(song.id) : null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (song && !dialog.open) dialog.showModal()
    if (!song && dialog.open) dialog.close()
  }, [song])

  return (
    <dialog ref={dialogRef} className="song-dialog" onClose={onClose} onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close() }} aria-labelledby="song-dialog-title">
      {song && (
        <div className="dialog-content">
          <div className="dialog-header">
            <span className="dialog-cover"><FileMusic size={28} aria-hidden="true" /></span>
            <div><span className="category-label">{song.category}</span><h2 id="song-dialog-title">{song.title}</h2><p>{song.source || '尚未填寫出處'}</p></div>
            <button type="button" className="dialog-close" onClick={() => dialogRef.current?.close()} aria-label="關閉歌曲資料"><X size={21} /></button>
          </div>

          <div className="detail-facts">
            <span><CalendarDays size={17} aria-hidden="true" /><small>年份</small><strong>{song.year || '未填'}</strong></span>
            <span><Languages size={17} aria-hidden="true" /><small>語言</small><strong>{song.language || '未填'}</strong></span>
            <span><Music2 size={17} aria-hidden="true" /><small>調性</small><strong>{chordSheet?.originalKey || song.key || '待補'}</strong></span>
          </div>

          <section className="resource-section">
            <h3>歌曲資源</h3>
            <div className="resource-list">
              <button type="button" className="resource-link live-resource" onClick={() => onOpenLive(song)}>
                <Presentation size={19} aria-hidden="true" />
                <span>
                  <strong>現場模式</strong>
                  <small>{chordSheet ? '和弦譜可即時轉調' : '設定演出 Key 與開啟歌譜'}</small>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
              <ResourceLink href={song.scoreUrl} icon={FileMusic} title="歌譜" helper={song.scoreUrl ? '在新分頁開啟' : '尚未提供'} />
              <ResourceLink href={song.lyricsUrl} icon={FileText} title="中文歌詞" helper={song.lyricsUrl ? '開啟原始連結' : '尚未提供'} />
              <ResourceLink href={song.songUrl} icon={CirclePlay} title="歌曲參考" helper={song.songUrl ? 'YouTube 或音訊' : '尚未提供'} />
              <ResourceLink href={song.harmonyUrl} icon={Music2} title="和聲／合音" helper={song.harmonyUrl ? '開啟練習資源' : '尚未提供'} />
            </div>
          </section>

          <section className="note-placeholder">
            <BookOpen size={20} aria-hidden="true" />
            <div><h3>排練筆記</h3><p>正式版可加入全團共用筆記與個人提示。</p></div>
          </section>

          <button type="button" className="button button-primary button-full" onClick={() => onAdd(song)} disabled={inSetlist}>{inSetlist ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}{inSetlist ? '已加入本週歌單' : '加入本週歌單'}</button>
        </div>
      )}
    </dialog>
  )
}

function normalizeTransposeOffset(offset: number) {
  if (offset > 6) return -5
  if (offset < -5) return 6
  return offset
}

function currentKey(originalKey: string, offset: number) {
  const aliases: Record<string, number> = { 'C#': 1, 'D#': 3, Gb: 6, 'G#': 8, 'A#': 10 }
  const originalIndex = aliases[originalKey] ?? chromaticKeys.indexOf(originalKey as typeof chromaticKeys[number])
  return chromaticKeys[(originalIndex + offset + 120) % 12]
}

function transposeLabel(offset: number) {
  if (offset === 0) return '原調'
  return `${offset > 0 ? '+' : ''}${offset} 半音`
}

function markRhythmRows(html: string) {
  const container = document.createElement('div')
  container.innerHTML = html

  container.querySelectorAll<HTMLElement>('.row').forEach((row) => {
    const lyrics = Array.from(row.querySelectorAll<HTMLElement>('.lyrics'))
      .map((element) => element.textContent ?? '')
      .join('')
      .trim()
    const hasChord = Array.from(row.querySelectorAll<HTMLElement>('.chord'))
      .some((element) => Boolean(element.textContent?.trim()))

    if (hasChord && lyrics.length > 0 && /^[\/|\s]+$/.test(lyrics)) {
      row.classList.add('rhythm-row')
    }
  })

  return container.innerHTML
}

function PdfPage({ page, zoom, pageNumber }: { page: PDFPageProxy; zoom: number; pageNumber: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const [availableWidth, setAvailableWidth] = useState(0)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateWidth = () => setAvailableWidth(container.clientWidth)
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || availableWidth <= 0) return

    renderTaskRef.current?.cancel()
    const unscaledViewport = page.getViewport({ scale: 1 })
    const cssScale = (availableWidth / unscaledViewport.width) * zoom
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const renderViewport = page.getViewport({ scale: cssScale * pixelRatio })
    const cssWidth = unscaledViewport.width * cssScale
    const cssHeight = unscaledViewport.height * cssScale

    canvas.width = Math.ceil(renderViewport.width)
    canvas.height = Math.ceil(renderViewport.height)
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return

    const task = page.render({ canvas, canvasContext: context, viewport: renderViewport })
    renderTaskRef.current = task
    void task.promise.catch((error: unknown) => {
      if (!(error instanceof Error) || error.name !== 'RenderingCancelledException') console.error(error)
    })

    return () => {
      task.cancel()
      if (renderTaskRef.current === task) renderTaskRef.current = null
    }
  }, [availableWidth, page, zoom])

  return (
    <div ref={containerRef} className="performance-pdf-page">
      <canvas ref={canvasRef} aria-label={`歌譜第 ${pageNumber} 頁`} />
    </div>
  )
}

function PdfScoreViewer({ url, title, zoom }: { url: string; title: string; zoom: number }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [pages, setPages] = useState<PDFPageProxy[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let loadedDocument: PDFDocumentProxy | null = null

    setDocument(null)
    setPages([])
    setError('')

    void import('pdfjs-dist').then(async (pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      const loadingTask = pdfjs.getDocument({ url })
      loadedDocument = await loadingTask.promise
      const nextPages = await Promise.all(
        Array.from({ length: loadedDocument.numPages }, (_, index) => loadedDocument!.getPage(index + 1)),
      )
      if (!cancelled) {
        setDocument(loadedDocument)
        setPages(nextPages)
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '歌譜載入失敗')
    })

    return () => {
      cancelled = true
      if (loadedDocument) void loadedDocument.destroy()
    }
  }, [url])

  if (error) {
    return (
      <div className="performance-pdf-error" role="alert">
        <FileMusic size={36} aria-hidden="true" />
        <strong>無法在現場模式載入歌譜</strong>
        <span>請改用下方的原始連結開啟。</span>
      </div>
    )
  }

  if (!document || pages.length === 0) {
    return <div className="performance-loading" role="status"><LoaderCircle size={24} className="spin" aria-hidden="true" />正在載入〈{title}〉歌譜</div>
  }

  return (
    <section className="performance-pdf-document" aria-label={`${title} 原始歌譜，共 ${pages.length} 頁`}>
      {pages.map((page, index) => <PdfPage key={page.pageNumber} page={page} zoom={zoom} pageNumber={index + 1} />)}
    </section>
  )
}

function PerformanceDialog({ session, onClose }: { session: PerformanceSession | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const sheetWrapRef = useRef<HTMLElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const scrollFrameRef = useRef<number | null>(null)
  const pendingScrollTopRef = useRef(0)
  const headerCollapsedRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const songs = session?.songs ?? []
  const song = songs[activeIndex] ?? null
  const chordSheet = song ? getChordSheet(song.id) : null
  const inlineScoreUrl = song ? getInlineScoreUrl(song.scoreUrl) : ''
  const [offset, setOffset] = useState(0)
  const [performanceKey, setPerformanceKey] = useState('')
  const [fontScale, setFontScale] = useState(() => Number(window.localStorage.getItem('ensemble-live-font-scale')) || 1)
  const [renderedSheet, setRenderedSheet] = useState({ songId: '', offset: 0, html: '' })
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (session && songs.length > 0 && !dialog.open) dialog.showModal()
    if ((!session || songs.length === 0) && dialog.open) dialog.close()
  }, [session, songs.length])

  useEffect(() => {
    if (!session) return
    const nextIndex = session.songs.findIndex((candidate) => candidate.id === session.initialSongId)
    setActiveIndex(nextIndex >= 0 ? nextIndex : 0)
  }, [session])

  useEffect(() => {
    sheetWrapRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    shellRef.current?.style.setProperty('--performance-header-offset', '0px')
    shellRef.current?.style.setProperty('--performance-collapse-progress', '0')
    shellRef.current?.style.setProperty('--performance-compact-opacity', '0')
    headerCollapsedRef.current = false
    setIsHeaderCollapsed(false)
  }, [activeIndex])

  useLayoutEffect(() => {
    const shell = shellRef.current
    const header = headerRef.current
    if (!shell || !header) return

    const updateHeaderMetrics = () => {
      shell.style.setProperty('--performance-header-height', `${header.offsetHeight}px`)
    }

    updateHeaderMetrics()
    const observer = new ResizeObserver(updateHeaderMetrics)
    observer.observe(header)
    return () => observer.disconnect()
  }, [song, songs.length])

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current)
  }, [])

  useEffect(() => {
    if (!song) return
    const stored = Number(window.localStorage.getItem(`ensemble-live-transpose:${song.id}`))
    setOffset(Number.isFinite(stored) ? normalizeTransposeOffset(stored) : 0)
    setPerformanceKey(window.localStorage.getItem(`ensemble-live-key:${song.id}`) || song.key || '')
  }, [song])

  function updateOffset(nextOffset: number) {
    if (!song) return
    const normalized = normalizeTransposeOffset(nextOffset)
    setOffset(normalized)
    window.localStorage.setItem(`ensemble-live-transpose:${song.id}`, String(normalized))
  }

  function updateFontScale(nextScale: number) {
    const normalized = Math.min(1.4, Math.max(0.5, Math.round(nextScale * 10) / 10))
    setFontScale(normalized)
    window.localStorage.setItem('ensemble-live-font-scale', String(normalized))
  }

  function updatePerformanceKey(nextKey: string) {
    if (!song || !chromaticKeys.includes(nextKey as typeof chromaticKeys[number])) return
    setPerformanceKey(nextKey)
    window.localStorage.setItem(`ensemble-live-key:${song.id}`, nextKey)
  }

  useEffect(() => {
    if (!song) return
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.key === '+' || event.key === '=') && chordSheet) updateOffset(offset + 1)
      if (event.key === '-' && chordSheet) updateOffset(offset - 1)
      if (event.key === '0' && chordSheet) updateOffset(0)
      if (event.key === 'ArrowLeft' && activeIndex > 0) setActiveIndex((current) => current - 1)
      if (event.key === 'ArrowRight' && activeIndex < songs.length - 1) setActiveIndex((current) => current + 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, chordSheet, offset, song, songs.length])

  useEffect(() => {
    if (!chordSheet) {
      setRenderedSheet({ songId: '', offset: 0, html: '' })
      return
    }

    let cancelled = false
    void import('chordsheetjs').then(({ ChordProParser, HtmlDivFormatter }) => {
      const targetKey = currentKey(chordSheet.originalKey, offset)
      const accidental = targetKey.includes('b') ? 'b' : '#'
      const parsed = new ChordProParser().parse(chordSheet.chordPro)
      const transposed = offset === 0 ? parsed : parsed.transpose(offset, { accidental, normalizeChordSuffix: false })
      const html = markRhythmRows(new HtmlDivFormatter({ normalizeChordSuffix: false }).format(transposed))
      if (!cancelled) setRenderedSheet({ songId: chordSheet.songId, offset, html })
    })

    return () => { cancelled = true }
  }, [chordSheet, offset])

  const targetKey = chordSheet ? currentKey(chordSheet.originalKey, offset) : performanceKey
  const visibleSheet = song && renderedSheet.songId === song.id && renderedSheet.offset === offset ? renderedSheet.html : ''

  function goToSong(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= songs.length) return
    setActiveIndex(nextIndex)
  }

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLElement>) {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 64 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return
    goToSong(deltaX < 0 ? activeIndex + 1 : activeIndex - 1)
  }

  function handleSheetScroll(event: React.UIEvent<HTMLElement>) {
    pendingScrollTopRef.current = event.currentTarget.scrollTop
    if (scrollFrameRef.current !== null) return

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null
      const shell = shellRef.current
      const header = headerRef.current
      if (!shell || !header) return

      const compactHeight = Number.parseFloat(getComputedStyle(shell).getPropertyValue('--performance-compact-height')) || 48
      const maxOffset = Math.max(1, header.offsetHeight - compactHeight)
      const offset = Math.min(pendingScrollTopRef.current, maxOffset)
      const progress = offset / maxOffset
      const compactOpacity = Math.max(0, Math.min(1, (progress - 0.72) / 0.28))
      const nextCollapsed = progress >= 0.995

      shell.style.setProperty('--performance-header-offset', `${offset}px`)
      shell.style.setProperty('--performance-collapse-progress', progress.toFixed(3))
      shell.style.setProperty('--performance-compact-opacity', compactOpacity.toFixed(3))

      if (nextCollapsed !== headerCollapsedRef.current) {
        headerCollapsedRef.current = nextCollapsed
        setIsHeaderCollapsed(nextCollapsed)
      }
    })
  }

  function expandPerformanceHeader() {
    sheetWrapRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <dialog ref={dialogRef} className="performance-dialog" onClose={onClose} aria-labelledby="performance-title">
      {song && (
        <div ref={shellRef} className="performance-shell">
          <header ref={headerRef} className={`performance-header${isHeaderCollapsed ? ' is-collapsed' : ''}`}>
            <button type="button" className="performance-compact-header" onClick={expandPerformanceHeader} aria-label="展開現場模式控制列" aria-hidden={!isHeaderCollapsed} tabIndex={isHeaderCollapsed ? 0 : -1}>
              <strong>{song.title}</strong>
              <span><small>Key</small>{targetKey || '—'}</span>
            </button>

            <div className="performance-header-main" aria-hidden={isHeaderCollapsed}>
              <div className="performance-title-row">
                <div>
                  <span className="performance-kicker">現場模式</span>
                  <h2 id="performance-title">{song.title}</h2>
                  <p>{chordSheet ? `原調 ${chordSheet.originalKey} · ${chordSheet.sourceLabel}` : '原始歌譜模式 · 可記錄演出 Key'}</p>
                </div>
                <button type="button" className="performance-close" onClick={() => dialogRef.current?.close()} aria-label="關閉現場和弦譜"><X size={23} /></button>
              </div>

              {songs.length > 1 && (
                <nav className="performance-set-nav" aria-label="演出歌單切換">
                  <button type="button" onClick={() => goToSong(activeIndex - 1)} disabled={activeIndex === 0} aria-label="上一首歌"><ChevronLeft size={22} aria-hidden="true" /></button>
                  <div aria-live="polite"><strong>{activeIndex + 1} / {songs.length}</strong><span>左右滑動切換歌曲</span></div>
                  <button type="button" onClick={() => goToSong(activeIndex + 1)} disabled={activeIndex === songs.length - 1} aria-label="下一首歌"><ChevronRight size={22} aria-hidden="true" /></button>
                </nav>
              )}

              <div className="performance-toolbar">
                {chordSheet ? (
                  <div className="key-stepper" aria-label="調整歌曲 Key">
                    <button type="button" onClick={() => updateOffset(offset - 1)} aria-label="降低一個半音"><Minus size={24} /></button>
                    <div aria-live="polite"><small>目前 Key</small><strong>{targetKey}</strong><span>{transposeLabel(offset)}</span></div>
                    <button type="button" onClick={() => updateOffset(offset + 1)} aria-label="升高一個半音"><Plus size={24} /></button>
                  </div>
                ) : (
                  <label className="performance-key-picker">
                    <span><small>演出 Key</small><strong>{targetKey || '未設定'}</strong></span>
                    <select value={performanceKey} onChange={(event) => updatePerformanceKey(event.target.value)} aria-label={`設定 ${song.title} 的演出 Key`}>
                      <option value="" disabled>選擇 Key</option>
                      {chromaticKeys.map((key) => <option key={key} value={key}>{key}</option>)}
                    </select>
                  </label>
                )}
                <button type="button" className="performance-tool" onClick={() => updateOffset(0)} disabled={!chordSheet || offset === 0}><RotateCcw size={18} aria-hidden="true" /><span>恢復原調</span></button>
                <div className="font-stepper" aria-label={chordSheet ? '調整和弦譜字體大小' : '調整歌譜大小'}>
                  <button type="button" onClick={() => updateFontScale(fontScale - 0.1)} disabled={fontScale <= 0.5} aria-label={chordSheet ? '縮小字體' : '縮小歌譜'}><ZoomOut size={19} /></button>
                  <span>{Math.round(fontScale * 100)}%</span>
                  <button type="button" onClick={() => updateFontScale(fontScale + 0.1)} disabled={fontScale >= 1.4} aria-label={chordSheet ? '放大字體' : '放大歌譜'}><ZoomIn size={19} /></button>
                </div>
              </div>
            </div>
          </header>

          <main ref={sheetWrapRef} className="performance-sheet-wrap" style={{ '--sheet-scale': fontScale } as React.CSSProperties} aria-busy={Boolean(chordSheet && !visibleSheet)} onScroll={handleSheetScroll} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {chordSheet
              ? visibleSheet
                ? <div className="performance-sheet" dangerouslySetInnerHTML={{ __html: visibleSheet }} />
                : <div className="performance-loading"><LoaderCircle size={24} className="spin" aria-hidden="true" />正在準備和弦譜</div>
              : inlineScoreUrl
                ? <div className="performance-pdf-shell">
                    <a className="performance-original-link" href={song.scoreUrl} target="_blank" rel="noreferrer">另開原始歌譜<ExternalLink size={16} aria-hidden="true" /></a>
                    <PdfScoreViewer key={song.id} url={inlineScoreUrl} title={song.title} zoom={fontScale} />
                  </div>
              : <section className="performance-missing">
                  <FileMusic size={38} aria-hidden="true" />
                  <h3>{song.scoreUrl ? '這份歌譜無法直接顯示' : '這首歌尚未提供歌譜'}</h3>
                  <p>{song.scoreUrl ? '目前連結不是可直接讀取的 PDF，請用原始連結開啟。' : '資料庫內沒有歌譜檔案，仍可設定並記住演出 Key。'}</p>
                  <div className="performance-resource-actions">
                    {song.scoreUrl && <a className="button button-primary" href={song.scoreUrl} target="_blank" rel="noreferrer">開啟原始歌譜<ExternalLink size={17} aria-hidden="true" /></a>}
                    {song.lyricsUrl && <a className="button button-secondary" href={song.lyricsUrl} target="_blank" rel="noreferrer">開啟歌詞<ExternalLink size={17} aria-hidden="true" /></a>}
                  </div>
                </section>}
          </main>
        </div>
      )}
    </dialog>
  )
}

function ResourceLink({ href, icon: Icon, title, helper }: { href: string; icon: LucideIcon; title: string; helper: string }) {
  if (!href) return <span className="resource-link is-disabled"><Icon size={19} aria-hidden="true" /><span><strong>{title}</strong><small>{helper}</small></span></span>
  return <a className="resource-link" href={href} target="_blank" rel="noreferrer"><Icon size={19} aria-hidden="true" /><span><strong>{title}</strong><small>{helper}</small></span><ExternalLink size={16} aria-hidden="true" /></a>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
