import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVideosHandler } from '../server/videosEndpoint.ts';
import { VIDEO_FAILURE_TEXT, requestVideos } from '../src/lib/playlistImport.ts';
import { parseVideoLinks } from '../src/utils/youtubeParser.ts';
import { MAX_VIDEOS_PER_REQUEST, parseVideosResponse } from '../src/utils/youtubePlaylist.ts';
import { PLAYLIST_ID, TEST_KEY, fakeVideo, fakeYouTube, jsonResponse, vid } from './youtubeFake.ts';

test('pasted text yields each video once, in order, whatever surrounds the links', () => {
  const text = [
    `https://www.youtube.com/watch?v=${vid(1)}`,
    '',
    `2. ders: https://youtu.be/${vid(2)}?si=abc (izle)`,
    `https://youtu.be/${vid(3)} https://www.youtube.com/shorts/${vid(4)}`,
    `https://www.youtube.com/watch?v=${vid(1)}&t=30`,
    `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`,
    'Temel Kavramlar 40 dk',
    'https://www.youtube.com/@kanal',
  ].join('\n');
  assert.deepEqual(parseVideoLinks(text), {
    ids: [vid(1), vid(2), vid(3), vid(4)],
    playlists: [`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`],
    unreadable: ['Temel Kavramlar 40 dk', 'https://www.youtube.com/@kanal'],
  });
  assert.deepEqual(parseVideoLinks('  \n '), { ids: [], playlists: [], unreadable: [] });
});

test('long lists are read in requests of 50 and come back in paste order', async () => {
  const count = MAX_VIDEOS_PER_REQUEST * 2 + 3;
  const ids = Array.from({ length: count }, (_, i) => vid(i + 1)).reverse();
  const yt = fakeYouTube({ playlists: [], videos: ids.map((_, i) => fakeVideo(i + 1)) });
  const handler = createVideosHandler({ apiKey: TEST_KEY, fetch: yt.fetch });
  const asked: string[] = [];
  const result = await requestVideos(ids, {
    fetch: (input, init) => {
      asked.push(input);
      return handler(new Request(`http://localhost${input}`, init));
    },
  });
  assert.ok(result.ok);
  assert.deepEqual(result.entries.map(e => e.videoId), ids);
  assert.equal(asked.length, 3);
  assert.ok(asked.every(url => url.startsWith('/api/youtube/videos?ids=')));
});

test('a failed batch fails the whole read, and malformed answers are refused', async () => {
  const ids = Array.from({ length: MAX_VIDEOS_PER_REQUEST + 1 }, (_, i) => vid(i + 1));
  let calls = 0;
  const failing = await requestVideos(ids, {
    fetch: async () => (++calls === 1 ? jsonResponse(200, { entries: [] }) : jsonResponse(429, { error: { code: 'quota' } })),
  });
  assert.deepEqual(failing, { ok: false, failure: 'quota' });

  assert.equal(parseVideosResponse({ entries: 'nope' }), null);
  assert.equal(parseVideosResponse({ entries: [{ kind: 'video', videoId: vid(1) }] }), null, 'a malformed entry rejects the whole answer');
  assert.deepEqual(parseVideosResponse({ entries: [{ kind: 'unavailable', videoId: vid(1), reason: 'deleted' }] }), {
    entries: [{ kind: 'unavailable', videoId: vid(1), reason: 'deleted' }],
  });
  assert.match(VIDEO_FAILURE_TEXT['invalid-id'].title, /video/);
});
