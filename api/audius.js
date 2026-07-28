const AUDIUS_API = 'https://api.audius.co/v1';
const MAX_RESULTS = 20;

function pickArtwork(artwork) {
  if (!artwork || typeof artwork !== 'object') return '';
  return artwork['480x480'] || artwork['1000x1000'] || artwork['150x150'] || '';
}

function normalizeTrack(track) {
  if (!track || typeof track.id !== 'string' || typeof track.title !== 'string') return null;
  const artist = track.user?.name || track.user?.handle || 'Audius artist';
  return {
    id: track.id,
    title: track.title,
    artist,
    artistHandle: track.user?.handle || '',
    duration: Number(track.duration) || 0,
    artwork: pickArtwork(track.artwork),
    genre: track.genre || '',
    mood: track.mood || '',
    permalink: track.permalink || '',
    streamUrl: `${AUDIUS_API}/tracks/${encodeURIComponent(track.id)}/stream?app_name=Luma`,
  };
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const rawQuery = Array.isArray(request.query?.q) ? request.query.q[0] : request.query?.q;
  const query = String(rawQuery || '').trim().slice(0, 120);
  const limit = Math.min(MAX_RESULTS, Math.max(1, Number(request.query?.limit) || 12));
  const endpoint = query ? '/tracks/search' : '/tracks/trending';
  const params = new URLSearchParams({ limit: String(limit), app_name: 'Luma' });
  if (query) params.set('query', query);
  else params.set('time', 'week');

  const headers = { Accept: 'application/json' };
  if (process.env.AUDIUS_API_KEY) {
    headers.Authorization = `Bearer ${process.env.AUDIUS_API_KEY}`;
  }

  try {
    const upstream = await fetch(`${AUDIUS_API}${endpoint}?${params}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const message = payload?.message || payload?.error || 'Audius request failed.';
      return response.status(upstream.status).json({ error: message });
    }

    const tracks = (Array.isArray(payload?.data) ? payload.data : [])
      .filter((track) => track?.is_available !== false && !track?.is_stream_gated)
      .map(normalizeTrack)
      .filter(Boolean);

    response.setHeader('Cache-Control', query
      ? 'public, max-age=30, s-maxage=120, stale-while-revalidate=300'
      : 'public, max-age=60, s-maxage=600, stale-while-revalidate=1800');
    return response.status(200).json({ tracks, source: 'Audius', query });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach Audius.';
    return response.status(502).json({ error: message });
  }
}
