import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlaylistHandler } from '../server/playlistEndpoint.ts';
import { createManualCamp } from '../src/lib/camps.ts';
import { normalizePlaylists } from '../src/lib/persistence.ts';
import type { PlaylistFailure } from '../src/lib/playlistImport.ts';
import {
  FAILURE_TEXT,
  LINK_PROBLEM_TEXT,
  initialSelection,
  isSelectable,
  requestPlaylist,
  reviewPlaylist,
  rowLabel,
  selectedDrafts,
  skippedSummary,
} from '../src/lib/playlistImport.ts';
import { buildSchedule } from '../src/utils/roadmapEngine.ts';
import type { PlaylistEntry, PlaylistVideoEntry } from '../src/utils/youtubePlaylist.ts';
import { PLAYLIST_ERROR_CODES } from '../src/utils/youtubePlaylist.ts';
import { prefs } from './helpers.ts';
import { PLAYLIST_ID, TEST_KEY, fakeVideo, fakeYouTube, jsonResponse, vid } from './youtubeFake.ts';

function video(n: number, seconds: number, extra: Partial<PlaylistVideoEntry> = {}): PlaylistVideoEntry {
  return {
    kind: 'video',
    videoId: vid(n),
    title: `Ders ${n}`,
    channelTitle: 'Kanal',
    url: `https://www.youtube.com/watch?v=${vid(n)}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${vid(n)}/mqdefault.jpg`,
    durationSeconds: seconds,
    blockedInTurkey: false,
    ...extra,
  };
}

/** The browser's fetch, wired straight to the real endpoint handler. */
function wiredTo(handler: (request: Request) => Promise<Response>) {
  return (input: string, init: RequestInit) => handler(new Request(`http://localhost${input}`, init));
}

test('the browser reads what the endpoint serves, in playlist order', async () => {
  const yt = fakeYouTube({
    playlists: [{ id: PLAYLIST_ID, title: 'Kamp', channelTitle: 'Kanal', items: [3, 1, 2].map(n => ({ videoId: vid(n) })) }],
    videos: [1, 2, 3].map(n => fakeVideo(n)),
  });
  const handler = createPlaylistHandler({ apiKey: TEST_KEY, fetch: yt.fetch });
  const result = await requestPlaylist(PLAYLIST_ID, { fetch: wiredTo(handler) });
  assert.ok(result.ok);
  assert.deepEqual(
    result.data.entries.map(e => e.videoId),
    [vid(3), vid(1), vid(2)]
  );
  assert.equal(result.data.playlist.url, `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`);

  const missing = await requestPlaylist(`PL${'x'.repeat(32)}`, { fetch: wiredTo(handler) });
  assert.deepEqual(missing, { ok: false, failure: 'not-found' });
  const unconfigured = await requestPlaylist(PLAYLIST_ID, { fetch: wiredTo(createPlaylistHandler({ apiKey: undefined })) });
  assert.deepEqual(unconfigured, { ok: false, failure: 'not-configured' });
});

test('answers that are not from the playlist service are recognised', async () => {
  const answer = (response: Response) => requestPlaylist(PLAYLIST_ID, { fetch: async () => response });
  const html = { 'Content-Type': 'text/html' };
  assert.deepEqual(await answer(new Response('<!doctype html>', { status: 200, headers: html })), { ok: false, failure: 'no-service' });
  assert.deepEqual(await answer(new Response('Not found', { status: 404 })), { ok: false, failure: 'no-service' });
  assert.deepEqual(await answer(new Response('Bad gateway', { status: 502, headers: html })), { ok: false, failure: 'no-service' });
  assert.deepEqual(await answer(jsonResponse(400, { error: { code: 'something-else' } })), { ok: false, failure: 'unexpected' });
  assert.deepEqual(await answer(jsonResponse(200, { playlist: {}, entries: 'nope', truncated: false })), { ok: false, failure: 'unexpected' });
  assert.deepEqual(
    await answer(
      jsonResponse(200, {
        playlist: { id: PLAYLIST_ID, title: 't', channelTitle: 'c' },
        entries: [{ ...video(1, 60), durationSeconds: -5 }],
        truncated: false,
      })
    ),
    { ok: false, failure: 'unexpected' },
    'a malformed entry rejects the whole answer'
  );
});

test('the browser rebuilds links and refuses foreign thumbnail hosts', async () => {
  const body = {
    playlist: { id: PLAYLIST_ID, title: 't', channelTitle: 'c', url: 'https://evil.test/' },
    entries: [{ ...video(1, 60), url: 'https://evil.test/watch', thumbnailUrl: 'https://evil.test/x.png' }],
    truncated: false,
  };
  const result = await requestPlaylist(PLAYLIST_ID, { fetch: async () => jsonResponse(200, body) });
  assert.ok(result.ok);
  const entry = result.data.entries[0] as PlaylistVideoEntry;
  assert.equal(entry.url, `https://www.youtube.com/watch?v=${vid(1)}`);
  assert.equal(entry.thumbnailUrl, `https://i.ytimg.com/vi/${vid(1)}/mqdefault.jpg`);
  assert.equal(result.data.playlist.url, `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`);
});

test('network failure, timeout and cancel are told apart', async () => {
  const offline = await requestPlaylist(PLAYLIST_ID, {
    fetch: async () => {
      throw new TypeError('Failed to fetch');
    },
  });
  assert.deepEqual(offline, { ok: false, failure: 'network' });

  const hang = (_: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  assert.deepEqual(await requestPlaylist(PLAYLIST_ID, { fetch: hang, timeoutMs: 10 }), { ok: false, failure: 'timeout' });

  const controller = new AbortController();
  const pending = requestPlaylist(PLAYLIST_ID, { fetch: hang, signal: controller.signal });
  controller.abort();
  assert.deepEqual(await pending, { ok: false, failure: 'aborted' });
});

test('every failure and link problem has Turkish text', () => {
  const failures: Exclude<PlaylistFailure, 'aborted'>[] = [...PLAYLIST_ERROR_CODES, 'network', 'timeout', 'no-service', 'unexpected'];
  for (const failure of failures) {
    assert.ok(FAILURE_TEXT[failure].title.length > 0, failure);
    assert.ok(FAILURE_TEXT[failure].body.length > 0, failure);
  }
  assert.match(FAILURE_TEXT['not-found'].body, /Gizli listeler/);
  assert.match(FAILURE_TEXT['not-configured'].body, /YOUTUBE_API_KEY/);
  for (const problem of ['empty', 'not-youtube', 'video-only', 'personal', 'mix', 'invalid'] as const) {
    assert.ok(LINK_PROBLEM_TEXT[problem].length > 0, problem);
  }
});

test('review rows: duplicates, unavailable and overlong videos are skipped predictably', () => {
  const entries: PlaylistEntry[] = [
    video(1, 600),
    video(2, 900),
    { kind: 'unavailable', videoId: vid(3), reason: 'private' },
    video(1, 600),
    video(4, 601 * 60),
    video(5, 300, { blockedInTurkey: true }),
    { kind: 'unavailable', videoId: null, reason: 'deleted' },
    video(6, 420),
  ];
  const rows = reviewPlaylist(entries, [vid(2)]);
  assert.deepEqual(
    rows.map(r => r.status),
    ['ready', 'in-list', 'unavailable', 'repeat', 'too-long', 'region', 'unavailable', 'ready']
  );
  assert.equal(rows[3].firstIndex, 0);
  assert.equal(rowLabel(rows[3]), 'Listede tekrar (1. sırada da var)');
  assert.equal(rowLabel(rows[2]), 'Gizli video');
  assert.equal(rowLabel(rows[0]), null);
  assert.deepEqual(
    rows.filter(isSelectable).map(r => r.index),
    [0, 5, 7]
  );
  assert.deepEqual([...initialSelection(rows)], [0, 7], 'region-blocked videos start unselected');
  assert.equal(skippedSummary(rows), '5 video eklenemez: 1 zaten listede, 1 listede tekrar, 1 gizli, 1 silinmiş, 1 çok uzun (10 saatten fazla).');
  assert.equal(skippedSummary(reviewPlaylist([video(1, 60)], [])), null);
});

test('selected videos become drafts in playlist order with exact durations', () => {
  const entries: PlaylistEntry[] = [
    video(1, 2303, { title: '  Temel Kavramlar  ', channelTitle: 'Başka Kanal' }),
    video(2, 90, { title: 'x'.repeat(250) }),
    { kind: 'unavailable', videoId: vid(3), reason: 'deleted' },
    video(4, 3723, { channelTitle: '' }),
    video(1, 2303),
  ];
  const rows = reviewPlaylist(entries, []);
  // Selection order and non-selectable indexes do not matter.
  const drafts = selectedDrafts(rows, new Set([3, 2, 4, 0, 1]));
  assert.deepEqual(
    drafts.map(d => d.youtubeId),
    [vid(1), vid(2), vid(4)]
  );
  assert.deepEqual(drafts[0], {
    youtubeId: vid(1),
    url: `https://www.youtube.com/watch?v=${vid(1)}`,
    title: 'Temel Kavramlar',
    durationMinutes: 2303 / 60,
    channelName: 'Başka Kanal',
    thumbnailUrl: `https://i.ytimg.com/vi/${vid(1)}/mqdefault.jpg`,
  });
  assert.equal(Math.round(drafts[0].durationMinutes * 60), 2303, 'seconds survive the minute conversion');
  assert.equal(drafts[1].title.length, 200);
  assert.equal('channelName' in drafts[2], false);
  assert.deepEqual(selectedDrafts(rows, new Set()), []);
});

test('an imported camp keeps order and metadata through storage and schedules like any camp', () => {
  const entries: PlaylistEntry[] = [video(1, 50 * 60), video(2, 70 * 60, { channelTitle: 'Konuk' }), video(3, 30 * 60)];
  const drafts = selectedDrafts(reviewPlaylist(entries, []), new Set([0, 1, 2]));
  const camp = createManualCamp({
    title: 'Kamp',
    subject: 'Matematik',
    channelName: 'Kanal',
    playlistUrl: `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`,
    videos: drafts,
  });
  assert.equal(camp.source, 'manual');
  assert.equal(camp.totalDurationMinutes, 150);

  const stored = normalizePlaylists(JSON.parse(JSON.stringify([camp])));
  assert.equal(stored.droppedVideos, 0);
  const [reloaded] = stored.playlists;
  assert.deepEqual(
    reloaded.videos.map(v => [v.title, v.durationMinutes, v.videoUrl, v.channelName]),
    [
      ['Ders 1', 50, `https://www.youtube.com/watch?v=${vid(1)}`, 'Kanal'],
      ['Ders 2', 70, `https://www.youtube.com/watch?v=${vid(2)}`, 'Konuk'],
      ['Ders 3', 30, `https://www.youtube.com/watch?v=${vid(3)}`, 'Kanal'],
    ]
  );

  // Two hours a day: 50 + 70 fit on day one, the 30-minute video moves to day two.
  const { plans } = buildSchedule([reloaded], prefs(), { completedMap: {}, shiftEvents: [], today: '2026-09-21' });
  assert.deepEqual(
    plans.map(p => [p.date, p.items.map(i => i.title)]),
    [
      ['2026-09-21', ['Ders 1', 'Ders 2']],
      ['2026-09-22', ['Ders 3']],
    ]
  );
});
