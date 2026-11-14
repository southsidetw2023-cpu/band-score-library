interface ScoreRequestContext {
  request: Request
}

export async function onRequestGet({ request }: ScoreRequestContext) {
  const fileId = new URL(request.url).searchParams.get('file') ?? ''
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(fileId)) {
    return new Response('Invalid score file.', { status: 400 })
  }

  const upstreamUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`
  const upstream = await fetch(upstreamUrl, {
    headers: { Accept: 'application/pdf,application/octet-stream;q=0.9' },
    cf: { cacheEverything: true, cacheTtl: 86_400 },
  } as RequestInit)

  if (!upstream.ok || !upstream.body) {
    return new Response('Score file unavailable.', { status: upstream.status || 502 })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'Content-Disposition': 'inline',
      'Content-Type': 'application/pdf',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
