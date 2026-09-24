import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CampSchedule, StudyCamp } from '../src/types/index.ts';
import {
  assessDeadline, buildCampSchedule, buildSchedule, createShiftEvent, dailyHoursForDeadline, planEndDate, sanitizeWeekPlan,
} from '../src/utils/roadmapEngine.ts';
import { dayOfWeek } from '../src/utils/date.ts';
import { allIds, dateById, layout, playlist, prefs, repeat } from './helpers.ts';

// 2026-09-21 is a Monday. Weekday index: 0 = Sunday ... 6 = Saturday.
const week = (plan: Partial<Record<number, string[]>>): string[][] => [0, 1, 2, 3, 4, 5, 6].map(d => plan[d] ?? []);

const mat = playlist('mat', repeat(10, 40), 'Matematik');
const fiz = playlist('fiz', repeat(6, 50), 'Fizik');
const kim = playlist('kim', repeat(4, 30), 'Kimya');
const branches = [mat, fiz, kim];

function camp(schedule: Partial<CampSchedule> = {}, shiftEvents: StudyCamp['shiftEvents'] = []): StudyCamp {
  return {
    id: 'camp-1',
    name: 'TYT',
    createdAt: '2026-09-21',
    branches,
    shiftEvents,
    schedule: { ...prefs({ dailyStudyHours: 2 }), mode: 'manual', targetEndDate: null, weekPlan: week({}), ...schedule },
  };
}

test('manual mode: each weekday only studies its own branches, in playlist order', () => {
  const weekPlan = week({ 1: ['mat', 'fiz'], 3: ['kim', 'mat'], 5: ['fiz'] });
  const result = buildCampSchedule(camp({ weekPlan }), { today: '2026-09-21' });
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.unscheduledItems, []);
  for (const plan of result.plans) {
    const allowed = new Set(sanitizeWeekPlan(weekPlan, ['mat', 'fiz', 'kim'])[dayOfWeek(plan.date)]);
    for (const item of plan.items) assert.ok(allowed.has(item.playlistId), `${item.id} on ${plan.date}`);
    if (allowed.size === 0) assert.ok(plan.isRestDay && plan.items.length === 0, `${plan.date} rests`);
    assert.ok(plan.totalMinutes <= 120 + 1e-9, `${plan.date} within capacity`);
  }
  const ids = allIds(result.plans);
  assert.equal(ids.length, 20, 'every video is placed once');
  for (const pl of branches) assert.deepEqual(ids.filter(id => id.startsWith(`${pl.id}-`)), pl.videos.map(v => v.id));
  // Monday alternates its two branches until the day is full: 40 + 50 fits, the next 40 does not.
  assert.deepEqual(result.plans[0].items.map(i => i.id), ['mat-1', 'fiz-1']);
  // Wednesday lists Kimya first but branches are studied in camp order.
  assert.deepEqual(result.plans.find(p => p.date === '2026-09-23')!.items.map(i => i.id), ['mat-2', 'kim-1', 'mat-3']);
  // The engine reports the study weekdays it derived, for the screens.
  assert.deepEqual(result.preferences.activeDays, [1, 3, 5]);
  assert.deepEqual(result.preferences.restDays, [0, 2, 4, 6]);
});

test('manual mode ignores the automatic branch cap and the automatic weekdays', () => {
  const weekPlan = week({ 2: ['mat', 'fiz', 'kim'] });
  const result = buildCampSchedule(camp({ weekPlan, maxSubjectsPerDay: 1, activeDays: [1], dailyStudyHours: 3 }), { today: '2026-09-21' });
  const tuesday = result.plans.find(p => p.date === '2026-09-22')!;
  assert.deepEqual(new Set(tuesday.items.map(i => i.subject)), new Set(['Matematik', 'Fizik', 'Kimya']));
  assert.ok(result.plans.every(p => p.items.length === 0 || dayOfWeek(p.date) === 2));
});

test('manual mode: a weekday whose branches are finished becomes a free day, never a trailing one', () => {
  // Kimya (4 x 30 min) finishes on its first Tuesday; Matematik keeps going on Mondays.
  const result = buildCampSchedule(camp({ weekPlan: week({ 1: ['mat'], 2: ['kim'] }) }), { today: '2026-09-21' });
  const tuesdays = result.plans.filter(p => dayOfWeek(p.date) === 2);
  assert.equal(tuesdays[0].items.length, 4);
  assert.ok(tuesdays.slice(1).every(p => p.isFreeDay === true && p.items.length === 0 && !p.isRestDay));
  assert.ok(result.plans.at(-1)!.items.length > 0, 'no trailing empty days');
  assert.ok(result.plans.filter(p => p.items.length > 0).every(p => p.isFreeDay === undefined));
});

test('manual mode: branches on no study weekday are reported and never silently dropped', () => {
  const result = buildCampSchedule(camp({ weekPlan: week({ 1: ['mat'], 4: ['fiz'] }) }), { today: '2026-09-21' });
  assert.deepEqual(result.issues, [{ kind: 'unassigned-branch', playlistId: 'kim', unscheduledCount: 4 }]);
  assert.deepEqual(result.unscheduledItems.map(i => i.id), ['kim-1', 'kim-2', 'kim-3', 'kim-4']);
  assert.equal(allIds(result.plans).length + result.unscheduledItems.length, 20);

  // A branch that only sits on a mock exam day is not studied either.
  const mock = buildCampSchedule(camp({ weekPlan: week({ 1: ['mat', 'fiz'], 6: ['kim'] }), mockExamDays: [6] }), { today: '2026-09-21' });
  assert.deepEqual(mock.issues, [{ kind: 'unassigned-branch', playlistId: 'kim', unscheduledCount: 4 }]);
  assert.ok(mock.plans.filter(p => dayOfWeek(p.date) === 6).every(p => p.isMockExamDay && p.items.length === 0));

  // No branch on any weekday: nothing loops and everything is reported.
  const none = buildCampSchedule(camp({ weekPlan: week({}) }), { today: '2026-09-21' });
  assert.deepEqual(none.plans, []);
  assert.deepEqual(none.issues, [{ kind: 'no-study-days', unscheduledCount: 20 }]);
});

test('manual mode drops unknown branch ids from the week plan', () => {
  const result = buildCampSchedule(camp({ weekPlan: week({ 1: ['mat', 'gone', 'mat'], 2: ['fiz', 'kim'] }) }), { today: '2026-09-21' });
  assert.deepEqual(result.issues, []);
  assert.deepEqual(sanitizeWeekPlan(week({ 1: ['kim', 'gone', 'mat', 'mat'] }), ['mat', 'fiz', 'kim'])[1], ['mat', 'kim']);
});

test('manual mode keeps completion stable and shifts respect the weekday assignment', () => {
  const weekPlan = week({ 1: ['mat', 'fiz'], 2: ['kim'], 3: ['mat'], 4: ['fiz'], 5: ['mat', 'kim'] });
  const base = buildCampSchedule(camp({ weekPlan }), { today: '2026-09-21' });
  const ticked = buildCampSchedule(camp({ weekPlan }), { today: '2026-09-21', completedMap: { 'mat-1': true, 'kim-2': true } });
  assert.deepEqual(layout(ticked.plans), layout(base.plans));

  const today = '2026-09-24';
  const progress = { 'mat-1': true };
  const before = buildCampSchedule(camp({ weekPlan }), { today, completedMap: progress }).plans;
  const event = createShiftEvent('2026-09-23', before, today)!;
  const shifted = buildCampSchedule(camp({ weekPlan }, [event]), { today, completedMap: progress });
  assert.deepEqual([...allIds(shifted.plans)].sort(), [...allIds(base.plans)].sort(), 'no task lost');
  const dates = dateById(shifted.plans);
  for (const id of event.itemIds) assert.ok(dates.get(id)! >= event.resumeDate, `${id} carried`);
  for (const plan of shifted.plans) {
    for (const item of plan.items) assert.ok(weekPlan[dayOfWeek(plan.date)].includes(item.playlistId), `${item.id} on ${plan.date}`);
  }
  // Ticking after the shift moves nothing.
  const later = buildCampSchedule(camp({ weekPlan }, [event]), { today, completedMap: { ...progress, 'fiz-3': true } });
  assert.deepEqual(layout(later.plans), layout(shifted.plans));
});

test('auto mode through buildCampSchedule matches the flat scheduler exactly', () => {
  const schedule: CampSchedule = { ...prefs({ maxSubjectsPerDay: 2, restDays: [0], activeDays: [1, 2, 3, 4, 5, 6] }), mode: 'auto', targetEndDate: null, weekPlan: week({ 1: ['kim'] }) };
  const viaCamp = buildCampSchedule({ branches, schedule, shiftEvents: [] }, { today: '2026-09-21' });
  const flat = buildSchedule(branches, schedule, { today: '2026-09-21' });
  assert.deepEqual(layout(viaCamp.plans), layout(flat.plans), 'the stored week plan is ignored in auto mode');
  for (const plan of viaCamp.plans) assert.ok(new Set(plan.items.map(i => i.subject)).size <= 2, `${plan.date} has at most two branches`);
});

test('deadline: on track, late and incomplete plans are reported without changing the layout', () => {
  const weekPlan = week({ 1: ['mat', 'fiz', 'kim'], 2: ['mat', 'fiz', 'kim'], 3: ['mat', 'fiz', 'kim'], 4: ['mat', 'fiz', 'kim'], 5: ['mat', 'fiz', 'kim'] });
  const open = buildCampSchedule(camp({ weekPlan }), { today: '2026-09-21' });
  const end = planEndDate(open.plans)!;
  const tight = buildCampSchedule(camp({ weekPlan, targetEndDate: '2026-09-25' }), { today: '2026-09-21' });
  assert.deepEqual(layout(tight.plans), layout(open.plans), 'a deadline never squeezes the plan');

  assert.deepEqual(assessDeadline({ finishDate: end, targetEndDate: null }), { kind: 'none' });
  assert.deepEqual(assessDeadline({ finishDate: end, targetEndDate: end }), { kind: 'on-track', finishDate: end, targetEndDate: end, spareDays: 0 });
  assert.deepEqual(assessDeadline({ finishDate: '2026-10-05', targetEndDate: '2026-09-30' }), {
    kind: 'late', finishDate: '2026-10-05', targetEndDate: '2026-09-30', lateDays: 5,
  });
  assert.deepEqual(assessDeadline({ finishDate: '2026-10-05', targetEndDate: '2026-12-31', unscheduledCount: 3 }), {
    kind: 'incomplete', targetEndDate: '2026-12-31', unscheduledCount: 3,
  });
  // Across a month and year boundary, in whole calendar days.
  assert.deepEqual(assessDeadline({ finishDate: '2027-01-02', targetEndDate: '2026-12-30' }), {
    kind: 'late', finishDate: '2027-01-02', targetEndDate: '2026-12-30', lateDays: 3,
  });
});

test('deadline: the suggested daily time really meets the target, or none is offered', () => {
  const weekPlan = week({ 1: ['mat', 'fiz', 'kim'], 2: ['mat', 'fiz', 'kim'], 3: ['mat', 'fiz', 'kim'], 4: ['mat', 'fiz', 'kim'], 5: ['mat', 'fiz', 'kim'] });
  const late = camp({ weekPlan, targetEndDate: '2026-09-25' }); // 20 videos, 11 h of work, 2 h a day
  const hours = dailyHoursForDeadline(late, { today: '2026-09-21' });
  assert.ok(hours !== null && hours > 2 && hours <= 16);
  assert.equal(hours % 0.5, 0);
  const fixed = buildCampSchedule({ ...late, schedule: { ...late.schedule, dailyStudyHours: hours } }, { today: '2026-09-21' });
  assert.ok(planEndDate(fixed.plans)! <= '2026-09-25');
  const lessHours = buildCampSchedule({ ...late, schedule: { ...late.schedule, dailyStudyHours: hours - 0.5 } }, { today: '2026-09-21' });
  assert.ok(planEndDate(lessHours.plans)! > '2026-09-25', 'the smallest half-hour step is suggested');

  // The only study weekday comes after the target, whatever the daily time.
  assert.equal(dailyHoursForDeadline(camp({ weekPlan: week({ 3: ['mat', 'fiz', 'kim'] }), targetEndDate: '2026-09-22' })), null);
  // Unassigned branches can never finish.
  assert.equal(dailyHoursForDeadline(camp({ weekPlan: week({ 1: ['mat'] }), targetEndDate: '2027-09-25' })), null);
  assert.equal(dailyHoursForDeadline(camp({ weekPlan })), null, 'no target, no suggestion');
});
