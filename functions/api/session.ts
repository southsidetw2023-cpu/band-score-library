import { authenticate, authErrorResponse, json, type Env } from '../_shared/auth'

interface Context {
  request: Request
  env: Env
}

export async function onRequestGet({ request, env }: Context) {
  try {
    const user = await authenticate(request, env)
    return json({ user })
  } catch (error) {
    return authErrorResponse(error)
  }
}
