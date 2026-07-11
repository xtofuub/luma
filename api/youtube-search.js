const MAX_RESULTS = 8;

function decodeEntities(value = '') {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const query = String(request.query?.q || '').trim();
  if (query.length < 2 || query.length > 120) {
    return response.status(400).json({ error: 'Enter a search between 2 and 120 characters.' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return response.status(503).json({
      error: 'YouTube search is not configured yet. Add YOUTUBE_API_KEY in Vercel, or paste a YouTube link below.',
      code: 'YOUTUBE_SEARCH_UNCONFIGURED',
    });
  }

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    safeSearch: 'moderate',
    maxResults: String(MAX_RESULTS),
    q: query,
    key: apiKey,
  });

  try {
    const youtubeResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
      headers: { Accept: 'application/json' },
    });
    const payload = await youtubeResponse.json();

    if (!youtubeResponse.ok) {
      const message = payload?.error?.message || 'YouTube search failed.';
      return response.status(youtubeResponse.status).json({ error: message });
    }

    const items = (payload.items || [])
      .filter((item) => item?.id?.videoId && item?.snippet?.title)
      .map((item) => ({
        videoId: item.id.videoId,
        title: decodeEntities(item.snippet.title),
        channel: decodeEntities(item.snippet.channelTitle || 'YouTube'),
      }));

    response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    return response.status(200).json({ items });
  } catch {
    return response.status(502).json({ error: 'Could not reach YouTube. Try again in a moment.' });
  }
}