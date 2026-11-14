import { useCallback, useEffect, useRef, useState } from 'react'

export interface AuthUser {
  email: string
  name: string
  picture: string
  canUpload: boolean
}

export interface AuthState {
  user: AuthUser | null
  credential: string
  loading: boolean
  error: string
  configured: boolean
  signOut: () => void
  refresh: (credential: string) => Promise<void>
}

interface GoogleCredentialResponse {
  credential: string
}

interface GoogleAccountsApi {
  id: {
    initialize(options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void
    renderButton(element: HTMLElement, options: Record<string, string | number>): void
    disableAutoSelect(): void
  }
}

declare global {
  interface Window {
    google?: { accounts: GoogleAccountsApi }
  }
}

const storageKey = 'ensemble-google-credential'
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''

async function getSession(credential: string) {
  const response = await fetch(`${import.meta.env.BASE_URL}api/session`, {
    headers: { Authorization: `Bearer ${credential}` },
  })
  const payload = await response.json() as { user?: AuthUser; error?: string }
  if (!response.ok || !payload.user) throw new Error(payload.error || '無法完成 Google 登入。')
  return payload.user
}

export function useGoogleAuth(): AuthState {
  const [credential, setCredential] = useState(() => window.sessionStorage.getItem(storageKey) ?? '')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(Boolean(credential))
  const [error, setError] = useState('')

  const refresh = useCallback(async (nextCredential: string) => {
    setLoading(true)
    setError('')
    try {
      const nextUser = await getSession(nextCredential)
      window.sessionStorage.setItem(storageKey, nextCredential)
      setCredential(nextCredential)
      setUser(nextUser)
    } catch (reason) {
      window.sessionStorage.removeItem(storageKey)
      setCredential('')
      setUser(null)
      setError(reason instanceof Error ? reason.message : '無法完成 Google 登入。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (credential) void refresh(credential)
  }, []) // Only restore the saved credential on first mount.

  const signOut = useCallback(() => {
    window.google?.accounts.id.disableAutoSelect()
    window.sessionStorage.removeItem(storageKey)
    setCredential('')
    setUser(null)
    setError('')
  }, [])

  return { user, credential, loading, error, configured: Boolean(clientId), signOut, refresh }
}

export function GoogleSignInButton({ onCredential, disabled = false }: { onCredential: (credential: string) => void; disabled?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!clientId || disabled) return
    let cancelled = false

    const render = () => {
      if (cancelled || !containerRef.current || !window.google) return
      containerRef.current.replaceChildren()
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => onCredential(response.credential),
      })
      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'signin_with',
        locale: 'zh_TW',
        width: Math.min(320, containerRef.current.clientWidth || 280),
      })
    }

    if (window.google) {
      render()
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]')
      const script = existing ?? document.createElement('script')
      if (!existing) {
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        script.dataset.googleIdentity = 'true'
        document.head.append(script)
      }
      script.addEventListener('load', render, { once: true })
      script.addEventListener('error', () => setError('Google 登入元件載入失敗，請稍後重試。'), { once: true })
    }

    return () => { cancelled = true }
  }, [disabled, onCredential])

  if (!clientId) return <p className="auth-message is-warning">Google 登入尚未完成正式環境設定。</p>
  return <div><div ref={containerRef} className="google-sign-in" aria-label="使用 Google 登入" />{error && <p className="auth-message is-error" role="alert">{error}</p>}</div>
}
