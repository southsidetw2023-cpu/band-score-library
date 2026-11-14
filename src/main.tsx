import { StrictMode, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
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
  Music2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import songsData from './data/songs.generated.json'
import type { Song, ViewName } from './types'
import './styles.css'

const previewThemes = new Set(['slate-blue', 'forest-green', 'mono-blue'])
const previewTheme = new URLSearchParams(window.location.search).get('theme')
if (previewTheme && previewThemes.has(previewTheme)) {
  document.documentElement.dataset.theme = previewTheme
}

const songs = (songsData as Song[]).sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'))

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
            onClear={() => setSetlistIds([])}
            onBrowse={() => setView('library')}
          />
        )}

        {view === 'admin' && <AdminView />}
      </main>

      <MobileNav view={view} setView={setView} setlistCount={setlistIds.length} />
      <SongDialog song={selectedSong} onClose={() => setSelectedSong(null)} onAdd={addToSetlist} inSetlist={selectedSong ? setlistIds.includes(selectedSong.id) : false} />
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

function SetlistView({ songs: setlistSongs, onOpen, onRemove, onClear, onBrowse }: { songs: Song[]; onOpen: (song: Song) => void; onRemove: (id: string) => void; onClear: () => void; onBrowse: () => void }) {
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
          <ol className="setlist-card">
            {setlistSongs.map((song, index) => (
              <li key={song.id}>
                <GripVertical size={18} className="drag-handle" aria-hidden="true" />
                <span className="setlist-number">{String(index + 1).padStart(2, '0')}</span>
                <button type="button" className="setlist-song" onClick={() => onOpen(song)}>
                  <strong>{song.title}</strong>
                  <small>{song.source || song.category} · {song.language || '語言未填'}</small>
                </button>
                <span className="setlist-category">{song.category}</span>
                <button type="button" className="icon-action" onClick={() => onRemove(song.id)} aria-label={`從歌單移除 ${song.title}`}><X size={18} /></button>
              </li>
            ))}
          </ol>

          <aside className="rehearsal-note">
            <BookOpen size={24} aria-hidden="true" />
            <p className="eyebrow">REHEARSAL NOTE</p>
            <h3>排練提醒</h3>
            <p>正式版可在這裡加入全團共用筆記、調性與段落安排。</p>
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

function SongDialog({ song, onClose, onAdd, inSetlist }: { song: Song | null; onClose: () => void; onAdd: (song: Song) => void; inSetlist: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

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
            <span><Music2 size={17} aria-hidden="true" /><small>調性</small><strong>{song.key || '待補'}</strong></span>
          </div>

          <section className="resource-section">
            <h3>歌曲資源</h3>
            <div className="resource-list">
              <ResourceLink href={song.scoreUrl} icon={FileMusic} title="歌譜" helper={song.scoreUrl ? '開啟原始連結' : '尚未提供'} />
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

function ResourceLink({ href, icon: Icon, title, helper }: { href: string; icon: LucideIcon; title: string; helper: string }) {
  if (!href) return <span className="resource-link is-disabled"><Icon size={19} aria-hidden="true" /><span><strong>{title}</strong><small>{helper}</small></span></span>
  return <a className="resource-link" href={href} target="_blank" rel="noreferrer"><Icon size={19} aria-hidden="true" /><span><strong>{title}</strong><small>{helper}</small></span><ExternalLink size={16} aria-hidden="true" /></a>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
