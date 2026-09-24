import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YouTubeApiError, classifyGoogleError, fetchPlaylist } from '../server/youtubeApi.ts';
import type { PlaylistVideoEntry } from '../src/utils/youtubePlaylist.ts';
import type { FakeItem } from './youtubeFake.ts';
import { PLAYLIST_ID, TEST_KEY, fakeVideo, fakeYouTube, googleError, jsonResponse, vid } from './youtubeFake.ts';

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

function playlistOf(items: FakeItem[]) {
  return { id: PLAYLIST_ID, title: 'TYT Matematik Kampı', channelTitle: 'Liste Sahibi', items };
}

async function rejection(promise: Promise<unknown>): Promise<YouTubeApiError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof YouTubeApiError, `expected YouTubeApiError, got ${String(error)}`);
    return error;
  }
  assert.fail('expected the request to fail');
}

test('a multi-page playlist is read to the end, in playlist order', async () => {
  const ids = range(123);
  const yt = fakeYouTube({ playlists: [playlistOf(ids.map(n => ({ videoId: vid(n) })))], videos: ids.map(n => fakeVideo(n)) });

  const result = await fetchPlaylist(PLAYLIST_ID, { apiKey: TEST_KEY, fetch: yt.fetch });

  assert.equal(result.entries.length, 123);
  assert.equal(result.truncated, false);
  assert.deepEqual(
    result.entries.map(e => e.videoId),
    ids.map(vid)
  );
  assert.deepEqual(result.playlist, {
    id: PLAYLIST_ID,
    title: 'TYT Matematik Kampı',
    channelTitle: 'Liste Sahibi',
    url: `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`,
  });

  const itemCalls = yt.calls.filter(c => c.url.pathname.endsWith('/playlistItems'));
  assert.deepEqual(
    itemCalls.map(c => c.url.searchParams.get('pageToken')),
    [null, 'page-50', 'page-100']
  );
  assert.ok(itemCalls.every(c => c.url.searchParams.get('maxResults') === '50' && c.url.searchParams.get('playlistId') === PLAYLIST_ID));
  const videoCalls = yt.calls.filter(c => c.url.pathname.endsWith('/videos'));
  assert.deepEqual(
    videoCalls.map(c => c.url.searchParams.get('id')!.split(',').length).sort((a, b) => b - a),
    [50, 50, 23]
  );
});

test('only fixed YouTube endpoints are called, with the key in a header and never in a URL', async () => {
  const yt = fakeYouTube({ playlists: [playlistOf([{ videoId: vid(1) }])], videos: [fakeVideo(1)] });
  await fetchPlaylist(PLAYLIST_ID, { apiKey: TEST_KEY, fetch: yt.fetch });

  assert.deepEqual(
    yt.calls.map(c => `${c.url.origin}${c.url.pathname}`),
    [
      'https://www.googleapis.com/youtube/v3/playlists',
      'https://www.googleapis.com/youtube/v3/playlistItems',
      'https://www.googleapis.com/youtube/v3/videos',
    ]
  );
  for (const call of yt.calls) {
    assert.equal(call.headers.get('x-goog-api-key'), TEST_KEY);
    assert.ok(!call.url.href.includes(TEST_KEY));
    assert.equal(call.url.searchParams.has('key'), false);
  }
});

test('video metadata and exact durations come from videos.list', async () => {
  const yt = fakeYouTube({
    playlists: [playlistOf([{ videoId: vid(1) }, { videoId: vid(2) }, { videoId: vid(3) }, { videoId: vid(4) }])],
    videos: [
      fakeVideo(1, { title: 'Temel Kavramlar', channelTitle: 'Başka Kanal', duration: 'PT38M23S' }),
      fakeVideo(2, { duration: 'PT1H2M3S', regionRestriction: { blocked: ['DE', 'TR'] } }),
      fakeVideo(3, { duration: 'PT45S', regionRestriction: { allowed: ['US'] }, thumbnails: { default: { url: 'https://i.ytimg.com/vi/x/default.jpg' } } }),
      fakeVideo(4, { duration: 'P1DT1H', regionRestriction: { allowed: ['TR'] }, thumbnails: {} }),
    ],
  });

  const { entries } = await fetchPlaylist(PLAYLIST_ID, { apiKey: TEST_KEY, fetch: yt.fetch });
  const videos = entries.filter((e): e is PlaylistVideoEntry => e.kind === 'video');
  assert.equal(videos.length, 4);

  assert.deepEqual(videos[0], {
    kind: 'video',
    videoId: vid(1),
    title: 'Temel Kavramlar',
    channelTitle: 'Başka Kanal',
    url: `https://www.youtube.com/watch?v=${vid(1)}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${vid(1)}/mqdefault.jpg`,
    durationSeconds: 38 * 60 + 23,
    blockedInTurkey: false,
  });
  assert.equal(videos[1].durationSeconds, 3723);
  assert.equal(videos[1].blockedInTurkey, true);
  assert.equal(videos[2].durationSeconds, 45);
  assert.equal(videos[2].blockedInTurkey, true, 'an allow-list without TR blocks Turkey');
  assert.equal(videos[2].thumbnailUrl, 'https://i.ytimg.com/vi/x/default.jpg');
  assert.equal(videos[3].durationSeconds, 25 * 3600);
  assert.equal(videos[3].blockedInTurkey, false);
  assert.equal(videos[3].thumbnailUrl, `https://i.ytimg.com/vi/${vid(4)}/mqdefault.jpg`, 'falls back to the standard thumbnail');
});

test('unavailable entries keep their slot and say why; repeats stay in place', async () => {
  const yt = fakeYouTube({
    playlists: [
      playlistOf([
        { videoId: vid(1) },
        { videoId: vid(2), privacy: 'private' },
        { videoId: vid(3), privacy: 'privacyStatusUnspecified' }, // deleted: videos.list does not return it
        { videoId: vid(4) },
        { videoId: vid(5) },
        { videoId: vid(6) },
        { videoId: vid(1) },
        { videoId: vid(7) },
      ]),
    ],
    videos: [
      fakeVideo(1),
      fakeVideo(2, { privacyStatus: 'private' }),
      fakeVideo(4, { liveBroadcastContent: 'live', duration: 'P0D' }),
      fakeVideo(5, { liveBroadcastContent: 'upcoming', duration: 'P0D' }),
      fakeVideo(6, { duration: 'PT0S' }),
      fakeVideo(7, { uploadStatus: 'rejected' }),
    ],
  });

  const { entries } = await fetchPlaylist(PLAYLIST_ID, { apiKey: TEST_KEY, fetch: yt.fetch });
  assert.deepEqual(
    entries.map(e => (e.kind === 'video' ? `video:${e.videoId}` : `${e.reason}:${e.videoId}`)),
    [
      `video:${vid(1)}`,
      `private:${vid(2)}`,
      `deleted:${vid(3)}`,
      `live:${vid(4)}`,
      `upcoming:${vid(5)}`,
      `no-duration:${vid(6)}`,
      `video:${vid(1)}`,
      `deleted:${vid(7)}`,
    ]
  );
  const videoCalls = yt.calls.filter(c => c.url.pathname.endsWith('/videos'));
  assert.equal(videoCalls.length, 1);
  assert.equal(videoCalls[0].url.searchParams.get('id')!.split(',').length, 7, 'each id is looked up once');
});

test('an empty playlist is a valid, empty answer', async () => {
  const yt = fakeYouTube({ playlists: [playlistOf([])], videos: [] });
  const result = await fetchPlaylist(PLAYLIST_ID, { apiKey: TEST_KEY, fetch: yt.fetch });
  assert.deepEqual(result.entries, []);
  assert.equal(result.truncated, false);
  assert.equal(yt.calls.filter(c => c.url.pathname.endsWith('/videos')).length, 0);
});

test('pagination stops at the page cap and on a repeated token, and says so', async () => {
  const ids = range(120);
  const yt = fakeYouTube({ playlists: [playlistOf(ids.map(n => ({ videoId: vid(n) })))], videos: ids.map(n => fakeVideo(n)) });
  const capped = await fetchPlaylist(PLAYLIST_ID, { apiKey: TEST_KEY, fetch: yt.fetch, maxPages: 2 });
  assert.equal(capped.entries.length, 100);
  assert.equal(capped.truncated, true);

  let pages = 0;
  const looping = fakeYouTube({
    playlists: [playlistOf([{ videoId: vid(1) }])],
    videos: [fakeVideo(1)],
    intercept: url => {
      if (!url.pathname.endsWith('/playlistItems')) return undefined;
      pages++;
      return jsonResponse(200, {
        nextPageToken: 'same-token',
        items: [{ snippet: { resourceId: { videoId: vid(1) } }, contentDetails: { videoId: vid(1) }, status: { privacyStatus: 'public' } }],
      });
    },
  });
  const result = await fetchPlaylist(PLAYLIST_ID, { apiKey: TEST_KEY, fetch: looping.fetch });
  assert.equal(pages, 2);
  assert.equal(result.truncated, true);
});

test('YouTube errors map to endpoint error codes', async () => {
  const cases: [string, (url: URL) => Response | undefined, string][] = [
    ['missing playlist (empty playlists.list)', () => undefined, 'not-found'],
    ['playlistNotFound', url => (url.pathname.endsWith('/playlists') ? googleError(404, 'playlistNotFound') : undefined), 'not-found'],
    [
      'playlistItemsNotAccessible',
      url => (url.pathname.endsWith('/playlistItems') ? googleError(403, 'playlistItemsNotAccessible') : undefined),
      'private',
    ],
    ['quotaExceeded', () => googleError(403, 'quotaExceeded'), 'quota'],
    ['rateLimitExceeded', () => googleError(403, 'rateLimitExceeded'), 'quota'],
    ['HTTP 429', () => jsonResponse(429, {}), 'quota'],
    ['invalid key', () => googleError(400, 'badRequest', 'API_KEY_INVALID', 'API key not valid. Please pass a valid API key.'), 'bad-key'],
    ['API not enabled', () => googleError(403, 'accessNotConfigured', 'SERVICE_DISABLED'), 'bad-key'],
    ['referrer-restricted key', () => googleError(403, 'forbidden', 'API_KEY_HTTP_REFERRER_BLOCKED'), 'bad-key'],
    ['backend error', () => googleError(500, 'backendError'), 'upstream'],
    ['HTML error page', () => new Response('<html>502</html>', { status: 502 }), 'upstream'],
    ['200 with a broken body', () => new Response('not json', { status: 200 }), 'upstream'],
  ];
  for (const [name, intercept, code] of cases) {
    const yt = fakeYouTube({ playlists: name.startsWith('missing') ? [] : [playlistOf([{ videoId: vid(1) }])], videos: [fakeVideo(1)], intercept });
    const error = await rejection(fetchPlaylist(PLAYLIST_ID, { apiKey: TEST_KEY, fetch: yt.fetch }));
    assert.equal(error.code, code, name);
  }

  const offline = await rejection(
    fetchPlaylist(PLAYLIST_ID, {
      apiKey: TEST_KEY,
      fetch: async input => {
        throw new TypeError(`fetch failed for ${input.href} with ${TEST_KEY}`);
      },
    })
  );
  assert.equal(offline.code, 'upstream');
  assert.equal(offline.reason, 'network');
  assert.ok(!offline.message.includes(TEST_KEY), 'the network error text is not kept');
});

test('error classification never keeps upstream message text', () => {
  const error = classifyGoogleError(400, {
    error: { code: 400, message: `bad key ${TEST_KEY}`, errors: [{ reason: 'keyInvalid', message: TEST_KEY }] },
  });
  assert.equal(error.code, 'bad-key');
  assert.equal(error.reason, 'keyInvalid');
  assert.ok(!error.message.includes(TEST_KEY));
  assert.equal(classifyGoogleError(503, null).code, 'upstream');
  assert.equal(classifyGoogleError(401, {}).code, 'bad-key');
});
