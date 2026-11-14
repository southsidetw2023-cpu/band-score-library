import { AuthError, authenticateUploadAccess, authErrorResponse, json, type Env } from '../_shared/auth'

interface Context {
  request: Request
  env: Env
}

interface StoredSetlist {
  ids: string[]
  revision: number
  updatedAt: string
  updatedBy: string
}

const setlistKey = 'state/team-setlist.json'

function requireBucket(env: Env) {
  if (!env.SCORE_UPLOADS) throw new AuthError('共用歌單儲存區尚未完成環境設定。', 503)
  return env.SCORE_UPLOADS
}

async function readSetlist(env: Env): Promise<StoredSetlist | null> {
  const object = await requireBucket(env).get(setlistKey)
  if (!object?.body) return null

  try {
    const value = await new Response(object.body).json() as Partial<StoredSetlist>
    if (!Array.isArray(value.ids)) return null
    return {
      ids: value.ids.filter((id): id is string => typeof id === 'string'),
      revision: Number.isSafeInteger(value.revision) ? Number(value.revision) : 0,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
      updatedBy: typeof value.updatedBy === 'string' ? value.updatedBy : '',
    }
  } catch {
    return null
  }
}

export async function onRequestGet({ env }: Context) {
  try {
    const stored = await readSetlist(env)
    return json({ setlist: stored ?? { ids: [], revision: 0, updatedAt: '', updatedBy: '' } })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function onRequestPut({ request, env }: Context) {
  try {
    const access = await authenticateUploadAccess(request, env)
    const payload = await request.json() as { ids?: unknown }
    if (!Array.isArray(payload.ids)) return json({ error: '歌單格式無效。' }, 400)

    const ids = payload.ids
    if (ids.length > 500 || ids.some((id) => typeof id !== 'string' || id.length < 1 || id.length > 200)) {
      return json({ error: '歌單內容無效。' }, 400)
    }
    if (new Set(ids).size !== ids.length) return json({ error: '歌單不可包含重複歌曲。' }, 400)

    const current = await readSetlist(env)
    const setlist: StoredSetlist = {
      ids,
      revision: (current?.revision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: access.uploadedBy,
    }
    await requireBucket(env).put(setlistKey, JSON.stringify(setlist), {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
    })
    return json({ setlist })
  } catch (error) {
    return authErrorResponse(error)
  }
}
