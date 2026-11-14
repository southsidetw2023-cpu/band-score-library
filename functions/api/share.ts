import { AuthError, authenticate, authErrorResponse, createUploadShare, json, type Env } from '../_shared/auth'

interface Context {
  request: Request
  env: Env
}

export async function onRequestPost({ request, env }: Context) {
  try {
    const user = await authenticate(request, env)
    if (!user.canUpload) throw new AuthError('只有管理者可以建立分享上傳網址。', 403)
    const token = await createUploadShare(env)
    const url = new URL(request.url)
    return json({ shareUrl: `${url.origin}/#upload=${token}` }, 201)
  } catch (error) {
    return authErrorResponse(error)
  }
}
