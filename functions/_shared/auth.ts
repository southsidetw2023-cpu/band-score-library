export interface Env {
  GOOGLE_CLIENT_ID?: string
  ALLOWED_UPLOAD_EMAILS?: string
  SCORE_UPLOADS?: R2BucketLike
}

export interface R2ObjectLike {
  key: string
  size: number
  uploaded: Date
  customMetadata?: Record<string, string>
  body?: ReadableStream
  httpMetadata?: { contentType?: string }
  writeHttpMetadata?: (headers: Headers) => void
}

export interface R2BucketLike {
  get(key: string): Promise<R2ObjectLike | null>
  head(key: string): Promise<R2ObjectLike | null>
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    objects: R2ObjectLike[]
    truncated: boolean
    cursor?: string
  }>
  put(key: string, value: ArrayBuffer | ReadableStream | string, options?: {
    httpMetadata?: { contentType?: string }
    customMetadata?: Record<string, string>
  }): Promise<R2ObjectLike>
}

export interface GoogleUser {
  id: string
  email: string
  name: string
  picture: string
  canUpload: boolean
}

export interface UploadAccess {
  kind: 'admin' | 'share'
  user: GoogleUser | null
  uploadedBy: string
}

interface GoogleTokenInfo {
  aud?: string
  email?: string
  email_verified?: boolean
  exp?: number
  iss?: string
  name?: string
  picture?: string
  sub?: string
}

interface GoogleJwtHeader {
  alg?: string
  kid?: string
}

export class AuthError extends Error {
  status: number

  constructor(message: string, status = 401) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

function allowedEmails(env: Env) {
  return new Set((env.ALLOWED_UPLOAD_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLocaleLowerCase())
    .filter(Boolean))
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function decodeJsonPart<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T
}

async function verifyGoogleToken(credential: string) {
  const parts = credential.split('.')
  if (parts.length !== 3) throw new AuthError('Google 登入憑證格式無效。')
  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = decodeJsonPart<GoogleJwtHeader>(encodedHeader)
  const payload = decodeJsonPart<GoogleTokenInfo>(encodedPayload)
  if (header.alg !== 'RS256' || !header.kid) throw new AuthError('Google 登入憑證簽章無效。')

  const certResponse = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
    headers: { Accept: 'application/json' },
    cf: { cacheEverything: true, cacheTtl: 3600 },
  } as RequestInit)
  if (!certResponse.ok) throw new AuthError('Google 驗證服務暫時無法使用。', 502)
  const certs = await certResponse.json() as { keys?: JsonWebKey[] }
  const jwk = certs.keys?.find((key) => key.kid === header.kid)
  if (!jwk) throw new AuthError('Google 登入憑證已過期，請重新登入。')

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  )
  if (!valid) throw new AuthError('Google 登入憑證簽章驗證失敗。')
  return payload
}

export async function authenticate(request: Request, env: Env): Promise<GoogleUser> {
  if (!env.GOOGLE_CLIENT_ID) throw new AuthError('Google 登入尚未完成環境設定。', 503)

  const authorization = request.headers.get('Authorization') ?? ''
  const credential = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!credential) throw new AuthError('請先使用 Google 登入。')

  const token = await verifyGoogleToken(credential)
  const validIssuer = token.iss === 'accounts.google.com' || token.iss === 'https://accounts.google.com'
  const expiry = Number(token.exp ?? 0)
  if (!validIssuer || token.aud !== env.GOOGLE_CLIENT_ID || token.email_verified !== true || expiry * 1000 <= Date.now() || !token.email || !token.sub) {
    throw new AuthError('Google 帳號驗證失敗，請重新登入。')
  }

  const email = token.email.toLocaleLowerCase()
  return {
    id: await sha256(`google:${token.sub}`),
    email,
    name: token.name?.trim() || email,
    picture: token.picture ?? '',
    canUpload: allowedEmails(env).has(email),
  }
}

const shareConfigKey = 'config/upload-share.json'

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

async function authenticateShare(request: Request, env: Env): Promise<UploadAccess> {
  if (!env.SCORE_UPLOADS) throw new AuthError('檔案儲存區尚未完成環境設定。', 503)
  const token = request.headers.get('X-Upload-Key')?.trim() ?? ''
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) throw new AuthError('這個上傳網址無效或已失效。')
  const config = await env.SCORE_UPLOADS.get(shareConfigKey)
  if (!config?.body) throw new AuthError('分享上傳尚未啟用。', 403)
  const stored = await new Response(config.body).json() as { tokenHash?: string }
  const tokenHash = await sha256(token)
  if (!stored.tokenHash || !constantTimeEqual(tokenHash, stored.tokenHash)) throw new AuthError('這個上傳網址無效或已失效。')
  return { kind: 'share', user: null, uploadedBy: 'share-link' }
}

export async function authenticateUploadAccess(request: Request, env: Env): Promise<UploadAccess> {
  if (request.headers.get('Authorization')) {
    const user = await authenticate(request, env)
    if (!user.canUpload) throw new AuthError('這個帳號尚未取得管理者權限。', 403)
    return { kind: 'admin', user, uploadedBy: user.email }
  }
  return authenticateShare(request, env)
}

export async function createUploadShare(env: Env) {
  if (!env.SCORE_UPLOADS) throw new AuthError('檔案儲存區尚未完成環境設定。', 503)
  const random = crypto.getRandomValues(new Uint8Array(32))
  const token = btoa(String.fromCharCode(...random)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  await env.SCORE_UPLOADS.put(shareConfigKey, JSON.stringify({
    tokenHash: await sha256(token),
    updatedAt: new Date().toISOString(),
  }), { httpMetadata: { contentType: 'application/json' } })
  return token
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) return json({ error: error.message }, error.status)
  console.error(error)
  return json({ error: '系統暫時無法完成帳號驗證。' }, 500)
}
