import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, generateRoadmap } from '../src/utils/roadmapEngine.ts';
import { dateById, layout, playlist, prefs, repeat } from './helpers.ts';

const playlists = [playlist('mat', repeat(8, 40)), playlist('fiz', repeat(6, 35)), playlist('kim', [20, 90, 30, 45])];
const pref = prefs({ restDays: [0], mockExamDays: [6], activeDays: [1, 2, 3, 4, 5, 6] });

test('reported bug: ticking the first task keeps it and every other task on its date', () => {
  const before = generateRoadmap(playlists, pref, {});
  const after = generateRoadmap(playlists, pref, { 'mat-1': true });
  assert.deepEqual(layout(after), layout(before));
  const day = after.find(p => p.items.some(i => i.id === 'mat-1'));
  assert.equal(day?.date, '2026-09-21');
  assert.equal(day?.items.find(i => i.id === 'mat-1')?.completed, true);
});

test('toggling any single task, or many, never changes the layout', () => {
  const base = layout(generateRoadmap(playlists, pref));
  const ids = base.flatMap(d => d.items);
  for (const id of ids) {
    assert.deepEqual(layout(generateRoadmap(playlists, pref, { [id]: true })), base, `toggling ${id}`);
  }
  // Deterministic pseudo-random subsets.
  let seed = 7;
  for (let round = 0; round < 25; round++) {
    const map: Record<string, boolean> = {};
    for (const id of ids) {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      if (seed % 3 === 0) map[id] = true;
    }
    assert.deepEqual(layout(generateRoadmap(playlists, pref, map)), base);
  }
  const everything = Object.fromEntries(ids.map(id => [id, true]));
  assert.deepEqual(layout(generateRoadmap(playlists, pref, everything)), base);
});

test('completion is decorated per item and per day', () => {
  const dates = dateById(generateRoadmap(playlists, pref));
  const firstDay = dates.get('mat-1')!;
  const firstDayIds = [...dates].filter(([, d]) => d === firstDay).map(([id]) => id);
  const map = Object.fromEntries(firstDayIds.map(id => [id, true]));
  const plans = generateRoadmap(playlists, pref, map);
  const day = plans.find(p => p.date === firstDay)!;
  assert.equal(day.isAllCompleted, true);
  assert.ok(day.items.every(i => i.completed));
  assert.ok(plans.filter(p => p.date !== firstDay).every(p => !p.isAllCompleted));
});

test('completion map entries that are false or unknown change nothing', () => {
  const base = generateRoadmap(playlists, pref);
  const plans = generateRoadmap(playlists, pref, { 'mat-1': false, 'removed-playlist-3': true });
  assert.deepEqual(layout(plans), layout(base));
  assert.ok(plans.every(p => p.items.every(i => !i.completed)));
});

test('the layout does not depend on the current day', () => {
  const a = buildSchedule(playlists, pref, { today: '2026-01-01' }).plans;
  const b = buildSchedule(playlists, pref, { today: '2026-10-10' }).plans;
  assert.deepEqual(layout(a), layout(b));
  assert.ok(a.every(p => !p.isPast && !p.isToday));
  assert.ok(b.filter(p => p.date < '2026-10-10').every(p => p.isPast));
});
