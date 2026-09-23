import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, calculateStats, countCompletedVideos } from '../src/utils/roadmapEngine.ts';
import { playlist, prefs, repeat } from './helpers.ts';

const playlists = [playlist('mat', repeat(6, 60)), playlist('fiz', repeat(4, 30))];
const pref = prefs({ dailyStudyHours: 2 });
const plansFor = (map: Record<string, boolean>) => buildSchedule(playlists, pref, { completedMap: map, today: '2026-09-21' }).plans;

test('stats count only the incomplete workload', () => {
  const none = calculateStats(plansFor({}), 10, 0);
  assert.equal(none.totalMinutes, 480);
  assert.equal(none.effectiveRemainingHours, 8);
  assert.equal(none.progressPercent, 0);

  const firstDay = plansFor({})[0].items.map(i => i.videoId);
  assert.deepEqual(firstDay, ['mat-1', 'fiz-1', 'fiz-2']);
  const map = Object.fromEntries(firstDay.map(id => [id, true]));
  const plans = plansFor(map);
  const some = calculateStats(plans, 10, countCompletedVideos(playlists, map));
  assert.equal(some.totalMinutes, 360);
  assert.equal(some.completedVideos, 3);
  assert.equal(some.progressPercent, 30);
  assert.equal(some.estimatedFinishDate, none.estimatedFinishDate, 'finish date is the last day with work left');
  assert.equal(some.daysRemaining, none.daysRemaining - 1, 'a fully ticked day no longer counts');
});

test('the finish date moves up when the last day is done', () => {
  const plans = plansFor({});
  const last = plans.at(-1)!;
  const map = Object.fromEntries(last.items.map(i => [i.videoId, true]));
  const stats = calculateStats(plansFor(map), 10, countCompletedVideos(playlists, map));
  assert.ok(stats.estimatedFinishDate < last.date);
});

test('completed ids from removed playlists are not counted', () => {
  const map = { 'mat-1': true, 'removed-1': true, 'removed-2': true, 'fiz-9': true, 'fiz-2': false };
  assert.equal(countCompletedVideos(playlists, map), 1);
  const stats = calculateStats(plansFor(map), 10, Object.keys(map).length);
  assert.equal(stats.completedVideos, 5, 'raw counts are only clamped');
  assert.equal(calculateStats([], 3, 99).progressPercent, 100);
  assert.equal(calculateStats([], 0, 4).progressPercent, 0);
  assert.equal(calculateStats([], Number.NaN, -1).completedVideos, 0);
});

test('when everything is done nothing remains', () => {
  const map = Object.fromEntries(playlists.flatMap(p => p.videos.map(v => [v.id, true])));
  const stats = calculateStats(plansFor(map), 10, countCompletedVideos(playlists, map));
  assert.equal(stats.totalMinutes, 0);
  assert.equal(stats.daysRemaining, 0);
  assert.equal(stats.progressPercent, 100);
});
