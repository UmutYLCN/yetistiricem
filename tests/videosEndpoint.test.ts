import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FetchLike } from '../server/youtubeApi.ts';
import { createVideosHandler } from '../server/videosEndpoint.ts';
import type { PlaylistVideoEntry } from '../src/utils/youtubePlaylist.ts';
import { MAX_VIDEOS_PER_REQUEST, parseVideosResponse } from '../src/utils/youtubePlaylist.ts';
import { TEST_KEY, fakeVideo, fakeYouTube, googleError, vid } from './youtubeFake.ts';

const get = (query: string) => new Request(`http://localhost/api/youtube/videos${query}`);

function sampleYouTube(intercept?: Parameters<typeof fakeYouTube>[0]['intercept']) {
  return fakeYouTube({
    playlists: [],
    videos: [
      fakeVideo(1),
      fakeVideo(2, { duration: 'PT1H2M3S' }),
      fakeVideo(3, { liveBroadcastContent: 'live' }),
      fakeVideo(4, { duration: 'P0D' }),
      fakeVideo(5, { privacyStatus: 'private' }),
    ],
    intercept,
  });
}

test('videos come back in the order asked, in the shared contract', async () => {
  const yt = sampleYouTube();
  const handler = createVideosHandler({ apiKey: TEST_KEY, fetch: yt.fetch });
  const response = await handler(get(`?ids=${[vid(2), vid(1), vid(9), vid(3), vid(4), vid(5)].join(',')}`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const parsed = parseVideosResponse(await response.json());
  assert.ok(parsed);
  assert.deepEqual(
    parsed.entries.map(e => (e.kind === 'video' ? e.videoId : `${e.videoId}:${e.reason}`)),
    [vid(2), vid(1), `${vid(9)}:deleted`, `${vid(3)}:live`, `${vid(4)}:no-duration`, `${vid(5)}:deleted`]
  );
  const first = parsed.entries[0] as PlaylistVideoEntry;
  assert.equal(first.durationSeconds, 3723);
  assert.equal(first.url, `https://www.youtube.com/watch?v=${vid(2)}`);
  assert.equal(yt.calls.length, 1, 'one videos.list call');
  assert.equal(yt.calls[0].url.pathname, '/youtube/v3/videos');
});

test('only validated video ids are accepted, so the endpoint is not a proxy', async () => {
  const yt = sampleYouTube();
  const handler = createVideosHandler({ apiKey: TEST_KEY, fetch: yt.fetch });
  const tooMany = Array.from({ length: MAX_VIDEOS_PER_REQUEST + 1 }, (_, i) => vid(i + 1)).join(',');
  const rejected = [
    '',
    '?ids=',
    `?id=${vid(1)}`,
    `?ids=${vid(1)}&ids=${vid(2)}`,
    `?ids=${vid(1)},,${vid(2)}`,
    `?ids=${encodeURIComponent(`https://www.youtube.com/watch?v=${vid(1)}`)}`,
    `?ids=${encodeURIComponent('https://evil.test/steal')}`,
    `?ids=${encodeURIComponent(`${vid(1)}&key=x`)}`,
    `?ids=${encodeURIComponent('../../v3/search')}`,
    `?ids=${tooMany}`,
  ];
  for (const query of rejected) {
    const response = await handler(get(query));
    assert.equal(response.status, 400, query);
    assert.deepEqual(await response.json(), { error: { code: 'invalid-id' } }, query);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) {
    const response = await handler(new Request(`http://localhost/api/youtube/videos?ids=${vid(1)}`, { method }));
    assert.equal(response.status, 405, method);
  }
  assert.equal(yt.calls.length, 0, 'nothing reached YouTube');

  const repeated = await handler(get(`?ids=${vid(1)},${vid(1)}`));
  assert.deepEqual(parseVideosResponse(await repeated.json())?.entries.map(e => e.videoId), [vid(1)], 'repeats are read once');
});

test('without a key the endpoint says it is not configured and calls nothing', async () => {
  const yt = sampleYouTube();
  const handler = createVideosHandler({ apiKey: '  ', fetch: yt.fetch });
  const response = await handler(get(`?ids=${vid(1)}`));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: { code: 'not-configured' } });
  assert.equal(yt.calls.length, 0);
});

test('upstream failures become error codes and never carry the key', async () => {
  const lines: string[] = [];
  const cases: [FetchLike, number, string][] = [
    [async () => googleError(403, 'quotaExceeded', undefined, `quota for ${TEST_KEY}`), 429, 'quota'],
    [async () => googleError(400, 'keyInvalid', 'API_KEY_INVALID', `API key not valid: ${TEST_KEY}`), 502, 'bad-key'],
    [async () => googleError(503, 'backendError', undefined, `backend failed (${TEST_KEY})`), 502, 'upstream'],
    [
      async input => {
        throw new TypeError(`fetch failed: ${input.href} x-goog-api-key=${TEST_KEY}`);
      },
      502,
      'upstream',
    ],
  ];
  for (const [fetch, status, code] of cases) {
    const handler = createVideosHandler({ apiKey: TEST_KEY, fetch, log: line => lines.push(line) });
    const response = await handler(get(`?ids=${vid(1)}`));
    const text = await response.text();
    assert.equal(response.status, status, code);
    assert.deepEqual(JSON.parse(text), { error: { code } });
    assert.ok(!text.includes(TEST_KEY) && !text.includes('AIza'), text);
  }
  assert.ok(lines.every(line => !line.includes(TEST_KEY) && /\[youtube-videos\] request failed/.test(line)), lines.join('\n'));
});

test('results are cached for a while and concurrent requests share one read', async () => {
  let clock = 0;
  const yt = sampleYouTube();
  const handler = createVideosHandler({ apiKey: TEST_KEY, fetch: yt.fetch, cacheTtlMs: 1000, now: () => clock });
  const query = `?ids=${vid(1)},${vid(2)}`;
  await Promise.all([handler(get(query)), handler(get(query))]);
  assert.equal(yt.calls.length, 1);
  clock = 999;
  await handler(get(query));
  assert.equal(yt.calls.length, 1);
  clock = 1000;
  await handler(get(query));
  assert.equal(yt.calls.length, 2);
});
