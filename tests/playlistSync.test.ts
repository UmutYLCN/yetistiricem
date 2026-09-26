import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StudyCamp, SubjectPlaylist } from '../src/types/index.ts';
import type { PlannerData } from '../src/lib/persistence.ts';
import { createBackup, emptyData, parseBackup } from '../src/lib/persistence.ts';
import * as ops from '../src/lib/plannerOps.ts';
import {
  diffPlaylist, emptyPlaylistSync, isCheckDue, normalizePlaylistSync, syncNotifications, syncTargets,
} from '../src/lib/playlistSync.ts';
import type { PlaylistEntry } from '../src/utils/youtubePlaylist.ts';
import { buildCampSchedule } from '../src/utils/roadmapEngine.ts';
import { prefs } from './helpers.ts';

const LIST = 'PLabcdefghij1234';
const yt = (n: number) => `video${String(n).padStart(6, '0')}`; // 11 characters
const entry = (n: number, overrides: Partial<PlaylistEntry> = {}): PlaylistEntry =>
  ({
    kind: 'video',
    videoId: yt(n),
    title: `Ders ${n}`,
    channelTitle: 'Kanal',
    url: `https://www.youtube.com/watch?v=${yt(n)}`,
    thumbnailUrl: '',
    durationSeconds: 1800,
    blockedInTurkey: false,
    ...overrides,
  }) as PlaylistEntry;

function branch(videoNumbers: number[], overrides: Partial<SubjectPlaylist> = {}): SubjectPlaylist {
  return {
    id: 'mat',
    title: 'TYT Matematik',
    subject: 'Matematik',
    channelName: 'Kanal',
    playlistUrl: `https://www.youtube.com/playlist?list=${LIST}`,
    colorTag: 'ink',
    source: 'manual',
    totalDurationMinutes: videoNumbers.length * 60,
    videos: videoNumbers.map(n => ({
      id: `mat-${n}`,
      title: `Ders ${n}`,
      durationMinutes: 60,
      videoUrl: `https://www.youtube.com/watch?v=${yt(n)}`,
      thumbnailUrl: '',
      completed: false,
    })),
    ...overrides,
  };
}

function camp(b: SubjectPlaylist, overrides: Partial<StudyCamp> = {}): StudyCamp {
  return {
    id: 'tyt',
    name: 'TYT 2027',
    createdAt: '2026-09-21',
    branches: [b],
    schedule: { ...prefs({ dailyStudyHours: 2, startDate: '2026-09-21' }), mode: 'auto', targetEndDate: null, weekPlan: [[], [], [], [], [], [], []] },
    shiftEvents: [],
    ...overrides,
  };
}

const withCamp = (c: StudyCamp, completedMap: Record<string, boolean> = {}): PlannerData => ({
  ...emptyData(),
  camps: [c],
  activeCampId: c.id,
  completedMap,
});

test('only the student’s own branches with a readable playlist link are checked, once a day', () => {
  const own = branch([1]);
  const typed = branch([2], { id: 'typed', playlistUrl: '' });
  const demo = branch([3], { id: 'demo', source: 'demo-template' });
  const targets = syncTargets([camp(own, { branches: [own, typed, demo] })]);
  assert.deepEqual(targets.map(t => [t.branch.id, t.playlistId]), [['mat', LIST]]);
  assert.ok(isCheckDue(emptyPlaylistSync(), '2026-09-26'));
  assert.ok(!isCheckDue({ ...emptyPlaylistSync(), lastAttempt: '2026-09-26' }, '2026-09-26'));
});

test('the first check offers only videos after the branch’s last one; later checks offer what was not seen', () => {
  // Imported 1, 3 and 4; 2 was left out on import.
  const b = branch([1, 3, 4]);
  const first = diffPlaylist(b, [entry(1), entry(2), entry(3), entry(4), entry(5), entry(6)], undefined, '2026-09-25');
  assert.deepEqual(first.pending.map(v => v.youtubeId), [yt(5), yt(6)], 'the skipped 2 is not offered');
  assert.deepEqual(new Set(first.seen), new Set([1, 2, 3, 4, 5, 6].map(yt)));

  const later = diffPlaylist(
    b,
    [
      entry(1), entry(2), entry(3), entry(4), entry(5), entry(6), entry(7),
      entry(8, { blockedInTurkey: true }),
      { kind: 'unavailable', videoId: yt(9), reason: 'private' },
      entry(10, { durationSeconds: 601 * 60 }),
    ],
    first,
    '2026-09-26'
  );
  assert.deepEqual(later.pending.map(v => v.youtubeId), [yt(5), yt(6), yt(7)], 'still waiting plus the new 7; blocked, private and too long are not offered');
  assert.equal(later.checkedOn, '2026-09-26');

  const unrelated = diffPlaylist(branch([90, 91]), [entry(1), entry(2)], undefined, '2026-09-25');
  assert.deepEqual(unrelated.pending, [], 'a branch that shares no video with the list only starts the record');
});

test('stored sync records keep valid parts; a newer version is not read', () => {
  const sync = normalizePlaylistSync({
    version: 1,
    lastAttempt: '2026-09-26',
    lastFailure: 'quota',
    branches: {
      mat: { checkedOn: '2026-09-26', seen: [yt(1), 'bad'], pending: [{ youtubeId: yt(2), title: 'Ders 2', durationSeconds: 90.4 }, { youtubeId: 'x' }] },
      broken: { checkedOn: 'dün', seen: [], pending: [] },
    },
  });
  assert.deepEqual(sync, {
    lastAttempt: '2026-09-26',
    lastFailure: 'quota',
    branches: {
      mat: {
        checkedOn: '2026-09-26',
        seen: [yt(1)],
        pending: [{ youtubeId: yt(2), title: 'Ders 2', durationSeconds: 90, thumbnailUrl: `https://i.ytimg.com/vi/${yt(2)}/mqdefault.jpg` }],
      },
    },
  });
  assert.equal(normalizePlaylistSync({ version: 2, branches: {} }), null);
  assert.equal(normalizePlaylistSync({ version: 1, lastFailure: 'whatever', branches: {} })?.lastFailure, null);
});

test('accepting appends the videos in order, carries the ones that would start overdue, and never counts as postponing', () => {
  const b = branch([1, 2]);
  const today = '2026-09-24';
  let data = withCamp(camp(b), { 'mat-1': true, 'mat-2': true });
  data = ops.recordPlaylistCheck(data, 'tyt', 'mat', [entry(1), entry(2), entry(3), entry(4)], today);
  data = ops.finishPlaylistCheck(data, today, null);
  const [notice] = syncNotifications(data.camps, data.playlistSync);
  assert.equal(notice.videos.length, 2);
  assert.equal(notice.minutes, 60);

  const accepted = ops.acceptPlaylistVideos(data, 'tyt', 'mat', today);
  const after = accepted.camps[0];
  assert.deepEqual(after.branches[0].videos.map(v => v.videoUrl.slice(-11)), [1, 2, 3, 4].map(yt));
  assert.equal(after.branches[0].totalDurationMinutes, 180);
  assert.deepEqual(syncNotifications(accepted.camps, accepted.playlistSync), []);
  assert.equal(after.shiftEvents.length, 1);
  assert.equal(after.shiftEvents[0].origin, 'videos-added');
  const { plans } = buildCampSchedule(after, { completedMap: accepted.completedMap, today });
  const added = plans.flatMap(p => p.items.map(i => ({ ...i, date: p.date }))).filter(i => i.videoUrl.endsWith(yt(3)) || i.videoUrl.endsWith(yt(4)));
  assert.ok(added.every(i => i.date > today), 'nothing new starts overdue');
  assert.ok(added.every(i => !i.postponeCount), 'an app-made event is not a postponement');

  // Accepting again with nothing waiting changes nothing.
  assert.equal(ops.acceptPlaylistVideos(accepted, 'tyt', 'mat', today).camps[0], after);
});

test('ignored videos are not offered again, and edits or removal start the record over', () => {
  const b = branch([1]);
  let data = withCamp(camp(b));
  data = ops.recordPlaylistCheck(data, 'tyt', 'mat', [entry(1), entry(2)], '2026-09-25');
  data = ops.dismissPlaylistVideos(data, 'mat');
  assert.deepEqual(syncNotifications(data.camps, data.playlistSync), []);
  data = ops.recordPlaylistCheck(data, 'tyt', 'mat', [entry(1), entry(2), entry(3)], '2026-09-26');
  assert.deepEqual(syncNotifications(data.camps, data.playlistSync)[0].videos.map(v => v.youtubeId), [yt(3)]);

  const relinked = ops.updateBranch(data, 'tyt', { ...data.camps[0].branches[0], playlistUrl: 'https://www.youtube.com/playlist?list=PLzzzzzzzzzzzz' });
  assert.equal(relinked.playlistSync.branches.mat, undefined);
  const renamed = ops.updateBranch(data, 'tyt', { ...data.camps[0].branches[0], subject: 'Mat' });
  assert.ok(renamed.playlistSync.branches.mat, 'other edits keep the record');
  assert.equal(ops.removeBranch(data, 'tyt', 'mat').playlistSync.branches.mat, undefined);
  assert.equal(ops.removeCamp(data, 'tyt').playlistSync.branches.mat, undefined);

  const restored = parseBackup(JSON.stringify(createBackup(data, '2026-09-26')), '2026-09-27');
  assert.ok(restored.ok);
  if (restored.ok) assert.deepEqual(restored.data.playlistSync, data.playlistSync);
});
