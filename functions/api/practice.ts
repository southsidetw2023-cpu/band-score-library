import { AuthError, authenticate, authErrorResponse, json, type Env } from '../_shared/auth'

interface Context {
  request: Request
  env: Env
}

type PracticeStatus = 'not_started' | 'practicing' | 'familiar'

interface PracticeEntry {
  songId: string
  status: PracticeStatus
  practiceKey: string
  notes: string
  updatedAt: string
}

interface StoredPractice {
  entries: PracticeEntry[]
  revision: number
  updatedAt: string
}

const statuses = new Set<PracticeStatus>(['not_started', 'practicing', 'familiar'])
const keys = new Set(['', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'])

function requireBucket(env: Env) {
  if (!env.SCORE_UPLOADS) throw new AuthError('個人練習儲存區尚未完成環境設定。', 503)
  return env.SCORE_UPLOADS
}

function storageKey(userId: string) {
  return `state/practice/${userId}.json`
}

async function readPractice(env: Env, userId: string): Promise<StoredPractice> {
  const object = await requireBucket(env).get(storageKey(userId))
  if (!object?.body) return { entries: [], revision: 0, updatedAt: '' }
  try {
    const value = await new Response(object.body).json() as Partial<StoredPractice>
    const entries = Array.isArray(value.entries) ? value.entries.filter(isStoredEntry) : []
    return {
      entries,
      revision: Number.isSafeInteger(value.revision) ? Number(value.revision) : 0,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    }
  } catch {
    return { entries: [], revision: 0, updatedAt: '' }
  }
}

function isStoredEntry(value: unknown): value is PracticeEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<PracticeEntry>
  return typeof entry.songId === 'string'
    && statuses.has(entry.status as PracticeStatus)
    && typeof entry.practiceKey === 'string'
    && typeof entry.notes === 'string'
    && typeof entry.updatedAt === 'string'
}

function parseEntry(value: unknown): Omit<PracticeEntry, 'updatedAt'> | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Partial<PracticeEntry>
  if (typeof entry.songId !== 'string' || entry.songId.length < 1 || entry.songId.length > 200) return null
  if (!statuses.has(entry.status as PracticeStatus) || !keys.has(entry.practiceKey ?? '')) return null
  if (typeof entry.notes !== 'string' || entry.notes.length > 2_000) return null
  return { songId: entry.songId, status: entry.status as PracticeStatus, practiceKey: entry.practiceKey ?? '', notes: entry.notes }
}

async function writePractice(env: Env, userId: string, practice: StoredPractice) {
  await requireBucket(env).put(storageKey(userId), JSON.stringify(practice), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  })
}

export async function onRequestGet({ request, env }: Context) {
  try {
    const user = await authenticate(request, env)
    return json({ practice: await readPractice(env, user.id) })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function onRequestPut({ request, env }: Context) {
  try {
    const user = await authenticate(request, env)
    const payload = await request.json() as { entry?: unknown }
    const incoming = parseEntry(payload.entry)
    if (!incoming) return json({ error: '個人練習資料格式無效。' }, 400)

    const current = await readPractice(env, user.id)
    if (!current.entries.some((entry) => entry.songId === incoming.songId) && current.entries.length >= 500) {
      return json({ error: '個人練習曲目已達上限。' }, 400)
    }
    const now = new Date().toISOString()
    const entry: PracticeEntry = { ...incoming, updatedAt: now }
    const entries = current.entries.filter((item) => item.songId !== entry.songId)
    entries.unshift(entry)
    const practice = { entries, revision: current.revision + 1, updatedAt: now }
    await writePractice(env, user.id, practice)
    return json({ practice })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function onRequestDelete({ request, env }: Context) {
  try {
    const user = await authenticate(request, env)
    const payload = await request.json() as { songId?: unknown }
    if (typeof payload.songId !== 'string' || payload.songId.length < 1 || payload.songId.length > 200) {
      return json({ error: '歌曲資料格式無效。' }, 400)
    }
    const current = await readPractice(env, user.id)
    const now = new Date().toISOString()
    const practice = {
      entries: current.entries.filter((entry) => entry.songId !== payload.songId),
      revision: current.revision + 1,
      updatedAt: now,
    }
    await writePractice(env, user.id, practice)
    return json({ practice })
  } catch (error) {
    return authErrorResponse(error)
  }
}
