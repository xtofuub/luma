const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const MAX_RESULTS = 50;
const DEFAULT_RESULTS = 30;
const MAX_SEARCH_POOL = 50;

function decodeEntities(value = '') {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function parseDuration(value = '') {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value);
  if (!match) return 0;
  return (Number(match[1]) || 0) * 3600 + (Number(match[2]) || 0) * 60 + (Number(match[3]) || 0);
}

function normalizeVideo(item) {
  const videoId = item.id?.videoId || item.id;
  if (!videoId || !item.snippet) return null;
  const thumbnails = item.snippet.thumbnails || {};
  return {
    videoId,
    title: decodeEntities(item.snippet.title),
    channel: decodeEntities(item.snippet.channelTitle || 'YouTube'),
    thumbnail: thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: parseDuration(item.contentDetails?.duration),
    publishedAt: item.snippet.publishedAt || '',
  };
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveRegion(request) {
  const geoCountry = String(firstHeader(request.headers['x-vercel-ip-country']) || '').toUpperCase();
  if (/^[A-Z]{2}$/.test(geoCountry)) return geoCountry;

  const requested = String(firstValue(request.query?.region) || '').toUpperCase();
  if (/^[A-Z]{2}$/.test(requested)) return requested;
  return 'US';
}

function resolveLanguage(request) {
  const requested = String(firstValue(request.query?.language) || '').trim();
  if (/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(requested)) return requested;

  const acceptLanguage = String(firstHeader(request.headers['accept-language']) || '');
  const browserLanguage = acceptLanguage.split(',')[0]?.trim();
  return /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(browserLanguage || '') ? browserLanguage : 'en';
}

async function youtube(path, params, key) {
  const query = new URLSearchParams({ ...params, key });
  const upstream = await fetch(`${YOUTUBE_API}/${path}?${query}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const message = payload?.error?.message || 'YouTube API request failed.';
    const error = new Error(message);
    error.status = upstream.status;
    throw error;
  }
  return payload;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const serverKey = process.env.YOUTUBE_API_KEY || '';
  if (String(request.query?.status || '') === '1') {
    return response.status(200).json({ serverConfigured: Boolean(serverKey), browserKeySupported: true });
  }

  const browserKeyHeader = request.headers['x-youtube-api-key'];
  const browserKey = Array.isArray(browserKeyHeader) ? browserKeyHeader[0] : browserKeyHeader;
  const key = serverKey || String(browserKey || '').trim();
  if (!key) {
    return response.status(428).json({
      error: 'Add your YouTube Data API v3 key in Music settings, or configure YOUTUBE_API_KEY in Vercel.',
      code: 'YOUTUBE_KEY_REQUIRED',
    });
  }

  const query = String(firstValue(request.query?.q) || '').trim().slice(0, 120);
  const requestedLimit = Number(firstValue(request.query?.limit));
  const maxResults = Math.min(MAX_RESULTS, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : DEFAULT_RESULTS));
  const regionCode = resolveRegion(request);
  const relevanceLanguage = resolveLanguage(request);

  try {
    let items = [];
    if (query) {
      // Keep YouTube's relevance order and ask for the largest allowed page.
      // Filtering happens only after details are fetched, so playable results retain
      // their original relative position instead of being re-ranked by Luma.
      const searchPayload = await youtube('search', {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: String(MAX_SEARCH_POOL),
        order: 'relevance',
        safeSearch: 'none',
        regionCode,
        relevanceLanguage,
      }, key);

      items = Array.isArray(searchPayload.items) ? searchPayload.items : [];
      const ids = items.map((item) => item.id?.videoId).filter(Boolean);
      if (ids.length) {
        const detailsPayload = await youtube('videos', {
          part: 'contentDetails,status',
          id: ids.join(','),
          maxResults: String(ids.length),
        }, key);
        const details = new Map((detailsPayload.items || []).map((item) => [item.id, item]));
        items = items.map((item) => ({ ...item, ...details.get(item.id?.videoId) }));
      }
    } else {
      const trendingPayload = await youtube('videos', {
        part: 'snippet,contentDetails,status',
        chart: 'mostPopular',
        videoCategoryId: '10',
        regionCode,
        maxResults: String(maxResults),
      }, key);
      items = Array.isArray(trendingPayload.items) ? trendingPayload.items : [];
    }

    const videos = items
      .filter((item) => item.status?.privacyStatus !== 'private' && item.status?.embeddable !== false)
      .map(normalizeVideo)
      .filter(Boolean)
      .slice(0, maxResults);

    response.setHeader('Vary', 'Accept-Language, X-Vercel-IP-Country');
    response.setHeader('Cache-Control', serverKey
      ? (query ? 'public, max-age=20, s-maxage=90, stale-while-revalidate=180' : 'public, max-age=60, s-maxage=600, stale-while-revalidate=1800')
      : 'private, no-store');
    return response.status(200).json({
      videos,
      query,
      regionCode,
      relevanceLanguage,
      requested: maxResults,
      searched: query ? MAX_SEARCH_POOL : maxResults,
      serverConfigured: Boolean(serverKey),
    });
  } catch (error) {
    const status = Number(error?.status) || 502;
    return response.status(status).json({ error: error instanceof Error ? error.message : 'Could not reach YouTube.' });
  }
}
