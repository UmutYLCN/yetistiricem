import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlaylistHandler } from '../server/playlistEndpoint.ts';
import type { FetchLike } from '../server/youtubeApi.ts';
import { parsePlaylistResponse } from '../src/utils/youtubePlaylist.ts';
import { PLAYLIST_ID, TEST_KEY, fakeVideo, fakeYouTube, googleError, vid } from './youtubeFake.ts';

const endpoint = (query: string) => `http://localhost/api/youtube/playlist${query}`;
const get = (query: string) => new Request(endpoint(query));

function sampleYouTube(intercept?: Parameters<typeof fakeYouTube>[0]['intercept']) {
  return fakeYouTube({
    playlists: [{ id: PLAYLIST_ID, title: 'Kamp', channelTitle: 'Kanal', items: [{ videoId: vid(1) }, { videoId: vid(2) }] }],
    videos: [fakeVideo(1), fakeVideo(2)],
    intercept,
  });
}

async function responseText(response: Response): Promise<string> {
  const headers = [...response.headers].map(([k, v]) => `${k}: ${v}`).join('\n');
  return `${response.status}\n${headers}\n\n${await response.text()}`;
}

test('a valid id returns the playlist in the shared contract', async () => {
  const yt = sampleYouTube();
  const handler = createPlaylistHandler({ apiKey: TEST_KEY, fetch: yt.fetch });
  const response = await handler(get(`?id=${PLAYLIST_ID}`));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const parsed = parsePlaylistResponse(await response.json());
  assert.ok(parsed);
  assert.deepEqual(
    parsed.entries.map(e => e.videoId),
    [vid(1), vid(2)]
  );
});

test('only a validated playlist id is accepted, so the endpoint is not a proxy', async () => {
  const yt = sampleYouTube();
  const handler = createPlaylistHandler({ apiKey: TEST_KEY, fetch: yt.fetch });
  const rejected = [
    '',
    '?id=',
    `?list=${PLAYLIST_ID}`,
    `?id=${encodeURIComponent(`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`)}`,
    `?id=${encodeURIComponent('https://evil.test/steal')}`,
    `?id=${encodeURIComponent(`${PLAYLIST_ID}&key=x`)}`,
    `?id=${encodeURIComponent('../../v3/search')}`,
    '?id=WL',
    '?id=RDdQw4w9WgXcQ',
    `?id=${PLAYLIST_ID}&id=${PLAYLIST_ID}`,
  ];
  for (const query of rejected) {
    const response = await handler(get(query));
    assert.equal(response.status, 400, query);
    assert.deepEqual(await response.json(), { error: { code: 'invalid-id' } }, query);
  }
  assert.equal(yt.calls.length, 0, 'nothing reached YouTube');

  for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) {
    const response = await handler(new Request(endpoint(`?id=${PLAYLIST_ID}`), { method }));
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get('allow'), 'GET');
  }
  assert.equal(yt.calls.length, 0);
});

test('without a key the endpoint says it is not configured and calls nothing', async () => {
  for (const apiKey of [undefined, '', '   ']) {
    const yt = sampleYouTube();
    const handler = createPlaylistHandler({ apiKey, fetch: yt.fetch });
    const response = await handler(get(`?id=${PLAYLIST_ID}`));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: { code: 'not-configured' } });
    assert.equal(yt.calls.length, 0);
  }
});

test('upstream failures become error codes with matching HTTP statuses', async () => {
  const cases: [Response, number, string][] = [
    [googleError(403, 'quotaExceeded'), 429, 'quota'],
    [googleError(404, 'playlistNotFound'), 404, 'not-found'],
    [googleError(403, 'playlistItemsNotAccessible'), 403, 'private'],
    [googleError(400, 'badRequest', 'API_KEY_INVALID'), 502, 'bad-key'],
    [googleError(503, 'backendError'), 502, 'upstream'],
  ];
  for (const [answer, status, code] of cases) {
    const handler = createPlaylistHandler({
      apiKey: TEST_KEY,
      fetch: sampleYouTube(() => answer.clone()).fetch,
      log: () => {},
    });
    const response = await handler(get(`?id=${PLAYLIST_ID}`));
    assert.equal(response.status, status, code);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: { code } });
  }
});

test('the API key never appears in a response or a log line', async () => {
  const echoing: FetchLike[] = [
    // Upstream error bodies that quote the key back.
    async () => googleError(400, 'keyInvalid', 'API_KEY_INVALID', `API key not valid: ${TEST_KEY}`),
    async () => googleError(403, 'quotaExceeded', undefined, `quota for ${TEST_KEY}`),
    async () => googleError(500, 'backendError', undefined, `backend failed (${TEST_KEY})`),
    async () => new Response(`<html>${TEST_KEY}</html>`, { status: 502 }),
    // A network failure whose error text quotes the request.
    async input => {
      throw new TypeError(`fetch failed: ${input.href} x-goog-api-key=${TEST_KEY}`);
    },
    // A bug inside the fetch layer that leaks the key into an arbitrary error.
    async () => {
      throw new Error(`unexpected ${TEST_KEY}`);
    },
  ];
  const lines: string[] = [];
  for (const fetch of echoing) {
    const handler = createPlaylistHandler({ apiKey: TEST_KEY, fetch, log: line => lines.push(line) });
    const text = await responseText(await handler(get(`?id=${PLAYLIST_ID}`)));
    assert.ok(!text.includes(TEST_KEY), text);
    assert.ok(!text.includes('AIza'), text);
  }
  assert.equal(lines.length, echoing.length);
  for (const line of lines) assert.ok(!line.includes(TEST_KEY), line);

  const ok = createPlaylistHandler({ apiKey: TEST_KEY, fetch: sampleYouTube().fetch });
  assert.ok(!(await responseText(await ok(get(`?id=${PLAYLIST_ID}`)))).includes(TEST_KEY));
  const unknown = await responseText(await ok(get(`?id=${TEST_KEY}`)));
  assert.ok(!unknown.includes(TEST_KEY), 'the requested id is not echoed either');
});

test('results are cached for a while and concurrent requests share one read', async () => {
  let clock = 0;
  const yt = sampleYouTube();
  const handler = createPlaylistHandler({ apiKey: TEST_KEY, fetch: yt.fetch, cacheTtlMs: 1000, now: () => clock });
  const readsPerFetch = 3; // playlists + playlistItems + videos

  const [a, b] = await Promise.all([handler(get(`?id=${PLAYLIST_ID}`)), handler(get(`?id=${PLAYLIST_ID}`))]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(yt.calls.length, readsPerFetch);

  clock = 999;
  await handler(get(`?id=${PLAYLIST_ID}`));
  assert.equal(yt.calls.length, readsPerFetch);

  clock = 1000;
  await handler(get(`?id=${PLAYLIST_ID}`));
  assert.equal(yt.calls.length, readsPerFetch * 2);
});

test('failures are not cached', async () => {
  let fail = true;
  const yt = sampleYouTube(() => (fail ? googleError(503, 'backendError') : undefined));
  const handler = createPlaylistHandler({ apiKey: TEST_KEY, fetch: yt.fetch, log: () => {} });
  assert.equal((await handler(get(`?id=${PLAYLIST_ID}`))).status, 502);
  fail = false;
  assert.equal((await handler(get(`?id=${PLAYLIST_ID}`))).status, 200);
});
