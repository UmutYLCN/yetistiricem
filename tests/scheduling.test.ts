import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, generateRoadmap, getEffectiveMinutes, isOversizedItem } from '../src/utils/roadmapEngine.ts';
import { dayOfWeek } from '../src/utils/date.ts';
import { allIds, playlist, prefs, repeat } from './helpers.ts';

const EPS = 1e-9;

test('every video is scheduled exactly once, in playlist order', () => {
  const pls = [playlist('mat', repeat(15, 40)), playlist('fiz', repeat(9, 55)), playlist('bio', repeat(4, 25))];
  const plans = generateRoadmap(pls, prefs());
  const ids = allIds(plans);
  assert.equal(ids.length, 28);
  assert.equal(new Set(ids).size, 28);
  for (const pl of pls) {
    assert.deepEqual(ids.filter(id => id.startsWith(`${pl.id}-`)), pl.videos.map(v => v.id));
  }
});

test('days never exceed capacity and scale with speed and practice time', () => {
  const pls = [playlist('mat', repeat(30, 37)), playlist('fiz', repeat(20, 52))];
  const days = (overrides: Parameters<typeof prefs>[0]) => {
    const pref = prefs(overrides);
    const plans = generateRoadmap(pls, pref);
    for (const plan of plans) {
      assert.ok(plan.totalMinutes <= pref.dailyStudyHours * 60 + EPS, `${plan.date} ${plan.totalMinutes}`);
      for (const item of plan.items) assert.equal(item.effectiveMinutes, getEffectiveMinutes(item.durationMinutes, pref));
    }
    return plans.filter(p => p.items.length > 0).length;
  };
  const normal = days({});
  const faster = days({ playbackSpeed: 2 });
  const withPractice = days({ practiceMultiplier: 0.5 });
  assert.ok(faster < normal, `2x speed ${faster} < ${normal}`);
  assert.ok(withPractice > normal, `practice ${withPractice} > ${normal}`);
  assert.equal(getEffectiveMinutes(60, prefs({ playbackSpeed: 1.5, practiceMultiplier: 0.2 })), 48);
});

test('an oversized video gets a day of its own, is reported, and does not stall the plan', () => {
  const pls = [playlist('mat', [30, 300, 30, 30]), playlist('fiz', repeat(5, 30))];
  const pref = prefs({ dailyStudyHours: 2 });
  const result = buildSchedule(pls, pref, { today: '2026-09-21' });
  const day = result.plans.find(p => p.items.some(i => i.id === 'mat-2'))!;
  assert.deepEqual(day.items.map(i => i.id), ['mat-2']);
  assert.ok(isOversizedItem(day.items[0], pref));
  assert.deepEqual(result.issues, [
    { kind: 'oversized-item', itemId: 'mat-2', date: day.date, effectiveMinutes: 300, capacityMinutes: 120 },
  ]);
  assert.equal(allIds(result.plans).length, 9);
  for (const plan of result.plans) {
    if (plan !== day) assert.ok(plan.totalMinutes <= 120 + EPS);
  }
  // Placed on the first day it reaches the front of its playlist.
  assert.equal(day.date, '2026-09-22');
});

test('zero, negative and non-numeric settings fall back to defaults and are reported', () => {
  const pls = [playlist('mat', repeat(10, 40))];
  for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = buildSchedule(pls, prefs({ dailyStudyHours: bad, playbackSpeed: bad, maxSubjectsPerDay: bad }));
    assert.equal(allIds(result.plans).length, 10);
    assert.equal(result.capacityMinutes, 240);
    assert.equal(result.preferences.playbackSpeed, 1);
    assert.equal(result.preferences.maxSubjectsPerDay, 3);
    assert.deepEqual(
      result.issues.map(i => (i.kind === 'invalid-preference' ? i.field : i.kind)),
      ['dailyStudyHours', 'playbackSpeed', 'maxSubjectsPerDay']
    );
  }
  const garbage = buildSchedule(pls, { startDate: 'yarın' } as never, { today: '2026-09-24' });
  assert.equal(allIds(garbage.plans).length, 10);
  assert.ok(garbage.issues.some(i => i.kind === 'invalid-preference' && i.field === 'startDate'));
  // A zero-length video is just free, not a loop.
  assert.equal(allIds(generateRoadmap([playlist('x', [0, 0, 0, -5])], prefs())).length, 4);
});

test('when no weekday can be studied, nothing loops and every video is reported unscheduled', () => {
  const pls = [playlist('mat', repeat(5, 40))];
  for (const blocked of [
    { activeDays: [] },
    { restDays: [0, 1, 2, 3, 4, 5, 6] },
    { mockExamDays: [0, 1, 2, 3, 4, 5, 6] },
    { activeDays: [1, 2], restDays: [1], mockExamDays: [2] },
  ]) {
    const result = buildSchedule(pls, prefs(blocked));
    assert.deepEqual(result.plans, []);
    assert.equal(result.unscheduledItems.length, 5);
    assert.deepEqual(result.issues, [{ kind: 'no-study-days', unscheduledCount: 5 }]);
  }
});

test('rest, mock exam and inactive days get no videos and are labelled', () => {
  const pls = [playlist('mat', repeat(40, 45)), playlist('fiz', repeat(20, 45))];
  // Start on a Sunday rest day; Wednesday is simply not active; Saturday is a mock exam.
  const pref = prefs({ startDate: '2026-09-20', activeDays: [0, 1, 2, 4, 5, 6], restDays: [0], mockExamDays: [6] });
  const plans = generateRoadmap(pls, pref);
  assert.equal(plans[0].date, '2026-09-20');
  assert.equal(plans[0].isRestDay, true);
  for (const plan of plans) {
    const dow = dayOfWeek(plan.date);
    if (dow === 0 || dow === 3) assert.ok(plan.isRestDay && !plan.isMockExamDay && plan.items.length === 0, plan.date);
    else if (dow === 6) assert.ok(plan.isMockExamDay && !plan.isRestDay && plan.items.length === 0, plan.date);
    else assert.ok(!plan.isRestDay && !plan.isMockExamDay && plan.items.length > 0, plan.date);
  }
  assert.ok(plans.at(-1)!.items.length > 0, 'no trailing empty days');
});

test('maxSubjectsPerDay caps distinct subjects and every subject keeps progressing', () => {
  const pls = ['mat', 'fiz', 'kim', 'bio', 'tar'].map(s => playlist(s, repeat(12, 20)));
  const plans = generateRoadmap(pls, prefs({ maxSubjectsPerDay: 2, dailyStudyHours: 3 }));
  for (const plan of plans) assert.ok(new Set(plan.items.map(i => i.subject)).size <= 2, plan.date);
  const firstSeen = new Map<string, number>();
  plans.forEach((plan, day) => plan.items.forEach(i => firstSeen.has(i.subject) || firstSeen.set(i.subject, day)));
  assert.equal(firstSeen.size, 5);
  assert.ok(Math.max(...firstSeen.values()) <= 3, `all subjects start within 4 days: ${[...firstSeen]}`);
  assert.equal(allIds(plans).length, 60);
});

test('the subject cap counts subjects, not playlists', () => {
  const pls = [playlist('mat-a', repeat(6, 20), 'Matematik'), playlist('mat-b', repeat(6, 20), 'Matematik'), playlist('fiz', repeat(6, 20), 'Fizik')];
  const plans = generateRoadmap(pls, prefs({ maxSubjectsPerDay: 1 }));
  for (const plan of plans) assert.ok(new Set(plan.items.map(i => i.subject)).size <= 1, plan.date);
  assert.equal(allIds(plans).length, 18);
});

test('legacy ISO start dates are read as the local calendar day', () => {
  const pls = [playlist('mat', repeat(3, 40))];
  const local = new Date(2026, 8, 21, 0, 15); // just after local midnight
  assert.equal(generateRoadmap(pls, prefs({ startDate: local.toISOString() }))[0].date, '2026-09-21');
  assert.equal(generateRoadmap(pls, prefs({ startDate: '2026-09-21' }))[0].date, '2026-09-21');
});

test('a video listed twice still gets unique item ids and shared completion', () => {
  const a = playlist('a', [30, 30]);
  const b = { ...playlist('b', [30]), videos: [{ ...a.videos[0] }] };
  const plans = generateRoadmap([a, b], prefs(), { 'a-1': true });
  const items = plans.flatMap(p => p.items);
  assert.deepEqual(items.map(i => i.id).sort(), ['a-1', 'a-2', 'b:a-1']);
  assert.ok(items.filter(i => i.videoId === 'a-1').every(i => i.completed));
});

test('large plans finish quickly', () => {
  const pls = Array.from({ length: 8 }, (_, i) => playlist(`p${i}`, repeat(250, 30 + i * 7)));
  const started = performance.now();
  const plans = generateRoadmap(pls, prefs({ maxSubjectsPerDay: 3, restDays: [0] , activeDays: [1, 2, 3, 4, 5, 6] }));
  assert.equal(allIds(plans).length, 2000);
  assert.ok(performance.now() - started < 2000);
});
