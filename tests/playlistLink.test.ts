import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectPlaylistLink, isFetchablePlaylistId, validateVideoUrl } from '../src/utils/youtubeParser.ts';
import { parseIsoDuration } from '../src/utils/youtubePlaylist.ts';
import { PLAYLIST_ID } from './youtubeFake.ts';

const canonical = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`;

test('playlist links in every common shape resolve to the canonical playlist', () => {
  const accepted = [
    canonical,
    `  ${canonical}  `,
    `youtube.com/playlist?list=${PLAYLIST_ID}`,
    `http://www.youtube.com/playlist?list=${PLAYLIST_ID}&si=abc123`,
    `https://m.youtube.com/playlist?list=${PLAYLIST_ID}`,
    `https://music.youtube.com/playlist?list=${PLAYLIST_ID}`,
    `https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${PLAYLIST_ID}&index=3`,
    `https://youtu.be/dQw4w9WgXcQ?list=${PLAYLIST_ID}`,
    PLAYLIST_ID,
  ];
  for (const input of accepted) {
    assert.deepEqual(inspectPlaylistLink(input), { ok: true, id: PLAYLIST_ID, url: canonical }, input);
  }
  const uploads = 'UUxxxxxxxxxxxxxxxxxxxxxx';
  assert.deepEqual(inspectPlaylistLink(uploads), { ok: true, id: uploads, url: `https://www.youtube.com/playlist?list=${uploads}` });
});

test('links that are not readable playlists say why', () => {
  const cases: [string, string][] = [
    ['', 'empty'],
    ['   ', 'empty'],
    [`https://example.com/playlist?list=${PLAYLIST_ID}`, 'not-youtube'],
    [`https://www.youtube.com.evil.test/playlist?list=${PLAYLIST_ID}`, 'not-youtube'],
    [`javascript:alert(1)//youtube.com/playlist?list=${PLAYLIST_ID}`, 'not-youtube'],
    ['ftp://www.youtube.com/playlist?list=PLabcdefghijk', 'not-youtube'],
    ['bir liste', 'not-youtube'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'video-only'],
    ['https://youtu.be/dQw4w9WgXcQ', 'video-only'],
    ['https://www.youtube.com/playlist?list=WL', 'personal'],
    ['https://www.youtube.com/playlist?list=LL', 'personal'],
    ['WL', 'personal'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1', 'mix'],
    ['https://www.youtube.com/playlist?list=PL<script>alert(1)</script>', 'invalid'],
    [`https://www.youtube.com/playlist?list=PL${'a'.repeat(70)}`, 'invalid'],
    ['https://www.youtube.com/playlist?list=PLshort', 'invalid'],
    ['https://www.youtube.com/@kanal/playlists', 'invalid'],
  ];
  for (const [input, problem] of cases) {
    assert.deepEqual(inspectPlaylistLink(input), { ok: false, problem }, input);
  }
});

test('the server only fetches plain playlist ids', () => {
  assert.equal(isFetchablePlaylistId(PLAYLIST_ID), true);
  assert.equal(isFetchablePlaylistId('UUxxxxxxxxxxxxxxxxxxxxxx'), true);
  assert.equal(isFetchablePlaylistId('OLAK5uy_kxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'), true);
  for (const id of ['', 'WL', 'LL', 'RDdQw4w9WgXcQ', canonical, `${PLAYLIST_ID}/../x`, `${PLAYLIST_ID}?x=1`, 'PL abcdefghijk', `PL${'a'.repeat(63)}`]) {
    assert.equal(isFetchablePlaylistId(id), false, id);
  }
});

test('a playlist link in the single-video field points to the playlist import', () => {
  const result = validateVideoUrl(canonical);
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.error, /Oynatma listesi/);
});

test('ISO 8601 durations map to exact seconds', () => {
  assert.equal(parseIsoDuration('PT15M33S'), 933);
  assert.equal(parseIsoDuration('PT1H2M3S'), 3723);
  assert.equal(parseIsoDuration('PT2H'), 7200);
  assert.equal(parseIsoDuration('PT45S'), 45);
  assert.equal(parseIsoDuration('PT10M'), 600);
  assert.equal(parseIsoDuration('P1DT2H3M4S'), 93784);
  assert.equal(parseIsoDuration('P1W'), 604800);
  assert.equal(parseIsoDuration('PT0S'), 0);
  assert.equal(parseIsoDuration('P0D'), 0);
  for (const bad of ['', 'P', 'PT', 'P1DT', 'P1M', 'P1Y', '15:33', 'PT-5S', 'pt5m', null, undefined, 42]) {
    assert.equal(parseIsoDuration(bad), null, String(bad));
  }
});
