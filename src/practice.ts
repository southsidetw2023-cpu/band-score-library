import { useCallback, useEffect, useRef, useState } from 'react'

export type PracticeStatus = 'not_started' | 'practicing' | 'familiar'

export interface PracticeEntry {
  songId: string
  status: PracticeStatus
  practiceKey: string
  notes: string
  updatedAt: string
}

interface RemotePractice {
  entries: PracticeEntry[]
  revision: number
  updatedAt: string
}

export interface PracticeState {
  entries: PracticeEntry[]
  loading: boolean
  savingSongId: string
  message: string
  upsert: (entry: Omit<PracticeEntry, 'updatedAt'>) => Promise<boolean>
  remove: (songId: string) => Promise<boolean>
  refresh: () => Promise<void>
}

function headers(credential: string) {
  return { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' }
}

export function usePractice(credential: string): PracticeState {
  const [entries, setEntries] = useState<PracticeEntry[]>([])
  const [loading, setLoading] = useState(Boolean(credential))
  const [savingSongId, setSavingSongId] = useState('')
  const [message, setMessage] = useState('正在同步個人練習…')
  const revisionRef = useRef(-1)

  const apply = useCallback((practice: RemotePractice) => {
    if (!Number.isSafeInteger(practice.revision) || practice.revision < revisionRef.current) return
    revisionRef.current = practice.revision
    setEntries(Array.isArray(practice.entries) ? practice.entries : [])
    setMessage('已同步至你的 Google 帳號')
  }, [])

  const refresh = useCallback(async () => {
    if (!credential || savingSongId) return
    try {
      const url = new URL(`${import.meta.env.BASE_URL}api/practice`, window.location.href)
      url.searchParams.set('_sync', String(Date.now()))
      const response = await fetch(url, { headers: headers(credential), cache: 'no-store' })
      const payload = await response.json() as { practice?: RemotePractice; error?: string }
      if (!response.ok || !payload.practice) throw new Error(payload.error || '無法同步個人練習。')
      apply(payload.practice)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '目前無法同步個人練習。')
    } finally {
      setLoading(false)
    }
  }, [apply, credential, savingSongId])

  useEffect(() => {
    if (!credential) {
      setEntries([])
      setLoading(false)
      revisionRef.current = -1
      return
    }
    setLoading(true)
    void refresh()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 5_000)
    const resume = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [credential, refresh])

  const mutate = useCallback(async (method: 'PUT' | 'DELETE', songId: string, body: object) => {
    if (!credential) return false
    setSavingSongId(songId)
    setMessage('正在儲存…')
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/practice`, {
        method,
        headers: headers(credential),
        body: JSON.stringify(body),
      })
      const payload = await response.json() as { practice?: RemotePractice; error?: string }
      if (!response.ok || !payload.practice) throw new Error(payload.error || '無法儲存個人練習。')
      apply(payload.practice)
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '無法儲存個人練習。')
      return false
    } finally {
      setSavingSongId('')
    }
  }, [apply, credential])

  const upsert = useCallback((entry: Omit<PracticeEntry, 'updatedAt'>) => mutate('PUT', entry.songId, { entry }), [mutate])
  const remove = useCallback((songId: string) => mutate('DELETE', songId, { songId }), [mutate])

  return { entries, loading, savingSongId, message, upsert, remove, refresh }
}
