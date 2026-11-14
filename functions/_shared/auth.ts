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
  put(key: string, value: ArrayBuffer | ReadableStream, options?: {
    httpMetadata?: { contentType?: string }
    customMetadata?: Record<string, string>
  }): Promise<R2ObjectLike>
}

export interface GoogleUser {
  email: string
  name: string
  picture: string
  canUpload: boolean
}

interface GoogleTokenInfo {
  aud?: string
  email?: string
  email_verified?: boolean
  exp?: number
  iss?: string
  name?: string
  picture?: string
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
  if (!validIssuer || token.aud !== env.GOOGLE_CLIENT_ID || token.email_verified !== true || expiry * 1000 <= Date.now() || !token.email) {
    throw new AuthError('Google 帳號驗證失敗，請重新登入。')
  }

  const email = token.email.toLocaleLowerCase()
  return {
    email,
    name: token.name?.trim() || email,
    picture: token.picture ?? '',
    canUpload: allowedEmails(env).has(email),
  }
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
