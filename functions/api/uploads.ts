import { AuthError, authenticateUploadAccess, authErrorResponse, json, type Env, type R2ObjectLike } from '../_shared/auth'

interface Context {
  request: Request
  env: Env
}

const acceptedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const maxFileSize = 20 * 1024 * 1024

function requireBucket(env: Env) {
  if (!env.SCORE_UPLOADS) throw new AuthError('檔案儲存區尚未完成環境設定。', 503)
  return env.SCORE_UPLOADS
}

function safeFileName(name: string) {
  const normalized = name.normalize('NFKC').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '')
  return (normalized || 'score').slice(-120)
}

function safeMetadata(value: FormDataEntryValue | null, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function serializeObject(object: R2ObjectLike) {
  const metadata = object.customMetadata ?? {}
  return {
    id: object.key,
    title: metadata.title || metadata.originalName || '未命名檔案',
    category: metadata.category || '敬拜',
    key: metadata.key || '',
    originalName: metadata.originalName || object.key.split('/').at(-1) || object.key,
    contentType: metadata.contentType || object.httpMetadata?.contentType || 'application/octet-stream',
    size: object.size,
    uploadedAt: metadata.uploadedAt || object.uploaded.toISOString(),
  }
}

export async function onRequestGet({ request, env }: Context) {
  try {
    const access = await authenticateUploadAccess(request, env)
    const bucket = requireBucket(env)
    const key = new URL(request.url).searchParams.get('key')

    if (key) {
      if (!key.startsWith('scores/')) return json({ error: '檔案路徑無效。' }, 400)
      const object = await bucket.get(key)
      if (!object?.body) return json({ error: '找不到檔案。' }, 404)
      const headers = new Headers({
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(object.customMetadata?.originalName || 'score')}`,
        'Content-Type': object.customMetadata?.contentType || object.httpMetadata?.contentType || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      })
      object.writeHttpMetadata?.(headers)
      return new Response(object.body, { headers })
    }

    const objects: R2ObjectLike[] = []
    let cursor: string | undefined
    do {
      const page = await bucket.list({ prefix: 'scores/', limit: 1000, cursor })
      objects.push(...page.objects)
      cursor = page.truncated ? page.cursor : undefined
    } while (cursor)

    const uploads = await Promise.all(objects.map(async (object) => {
      const head = await bucket.head(object.key)
      return serializeObject(head ?? object)
    }))
    uploads.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    return json({ access: { kind: access.kind, user: access.user }, uploads })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function onRequestPost({ request, env }: Context) {
  try {
    const access = await authenticateUploadAccess(request, env)
    const bucket = requireBucket(env)
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return json({ error: '請選擇要上傳的檔案。' }, 400)
    if (!acceptedTypes.has(file.type)) return json({ error: '僅支援 PDF、JPG 與 PNG。' }, 400)
    if (file.size <= 0 || file.size > maxFileSize) return json({ error: '單一檔案需小於 20 MB。' }, 400)

    const title = safeMetadata(form.get('title'), 120) || file.name.replace(/\.[^.]+$/, '')
    const category = safeMetadata(form.get('category'), 10)
    const musicalKey = safeMetadata(form.get('key'), 8)
    if (!['讚美', '敬拜'].includes(category)) return json({ error: '歌曲分類無效。' }, 400)

    const uploadedAt = new Date().toISOString()
    const objectKey = `scores/${uploadedAt.slice(0, 10)}/${crypto.randomUUID()}-${safeFileName(file.name)}`
    const object = await bucket.put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        title,
        category,
        key: musicalKey,
        originalName: file.name.slice(0, 180),
        contentType: file.type,
        uploadedAt,
        uploadedBy: access.uploadedBy,
      },
    })

    return json({ upload: serializeObject({ ...object, customMetadata: {
      title,
      category,
      key: musicalKey,
      originalName: file.name.slice(0, 180),
      contentType: file.type,
      uploadedAt,
      uploadedBy: access.uploadedBy,
    } }) }, 201)
  } catch (error) {
    return authErrorResponse(error)
  }
}
