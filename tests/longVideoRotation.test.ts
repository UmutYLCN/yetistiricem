import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StudyCamp } from '../src/types/index.ts';
import { buildCampSchedule, buildSchedule } from '../src/utils/roadmapEngine.ts';
import { allIds, layout, playlist, prefs, repeat } from './helpers.ts';

// 2026-09-21 is a Monday.
const ids = (plans: ReturnType<typeof buildSchedule>['plans']) => plans.filter(p => p.items.length > 0).map(p => p.items.map(i => i.id));

test('B-4: long math days alternate with Fizik/Kimya days instead of starving them', () => {
  const branches = [playlist('mat', repeat(5, 150), 'Matematik'), playlist('fiz', repeat(5, 30), 'Fizik'), playlist('kim', repeat(5, 30), 'Kimya')];
  const { plans } = buildSchedule(branches, prefs(), { today: '2026-09-21' });
  const days = ids(plans);
  assert.deepEqual(days.slice(0, 6), [['mat-1'], ['fiz-1', 'kim-1', 'fiz-2', 'kim-2'], ['mat-2'], ['fiz-3', 'kim-3', 'fiz-4', 'kim-4'], ['mat-3'], ['fiz-5', 'kim-5']]);
  assert.equal(allIds(plans).length, 15);
  assert.deepEqual(allIds(plans).filter(i => i.startsWith('mat-')), ['mat-1', 'mat-2', 'mat-3', 'mat-4', 'mat-5']);
});

test('a camp of long videos only still takes one per day, consecutively', () => {
  const { plans } = buildSchedule([playlist('mat', repeat(3, 150), 'Matematik')], prefs(), { today: '2026-09-21' });
  assert.deepEqual(plans.map(p => p.items.map(i => i.id)), [['mat-1'], ['mat-2'], ['mat-3']]);
});

test('two branches of long videos keep alternating with each other', () => {
  const { plans } = buildSchedule([playlist('a', repeat(2, 150)), playlist('b', repeat(2, 150))], prefs(), { today: '2026-09-21' });
  assert.deepEqual(ids(plans), [['a-1'], ['b-1'], ['a-2'], ['b-2']]);
});

test('manual week plan: a branch only lands on its own weekdays', () => {
  const branches = [playlist('mat', repeat(3, 150), 'Matematik'), playlist('fiz', repeat(3, 30), 'Fizik')];
  const weekPlan = [0, 1, 2, 3, 4, 5, 6].map(d => (d === 1 || d === 2 ? ['mat'] : d === 3 ? ['fiz'] : []));
  const camp: StudyCamp = {
    id: 'c', name: 'c', createdAt: '2026-09-21', branches, shiftEvents: [],
    schedule: { ...prefs(), mode: 'manual', targetEndDate: null, weekPlan },
  };
  const { plans } = buildCampSchedule(camp, { today: '2026-09-21' });
  const byDate = new Map(plans.map(p => [p.date, p.items.map(i => i.id)]));
  // Mon, Tue: only math is eligible, so its long videos continue; Wed is Fizik's.
  assert.deepEqual(byDate.get('2026-09-21'), ['mat-1']);
  assert.deepEqual(byDate.get('2026-09-22'), ['mat-2']);
  assert.deepEqual(byDate.get('2026-09-23'), ['fiz-1', 'fiz-2', 'fiz-3']);
  for (const p of plans) for (const i of p.items) assert.ok(i.playlistId === 'mat' ? [1, 2].includes(new Date(p.date + 'T00:00').getDay()) : new Date(p.date + 'T00:00').getDay() === 3);
});

test('days before today keep the old layout; the rotation starts today', () => {
  const branches = [playlist('mat', repeat(3, 150), 'Matematik'), playlist('fiz', repeat(3, 30), 'Fizik')];
  const past = layout(buildSchedule(branches, prefs(), { today: '2026-09-23' }).plans);
  assert.deepEqual(past.slice(0, 2).map(d => d.items), [['mat-1'], ['mat-2']]);
  // Today (09-23) follows a long day, so the others go first.
  assert.deepEqual(past[2].items, ['fiz-1', 'fiz-2', 'fiz-3']);
});
