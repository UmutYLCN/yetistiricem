import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DailyPlan } from '../src/types/index.ts';
import { applyShiftEvent, buildSchedule, createShiftEvent, shiftDayPlan, type ShiftEvent } from '../src/utils/roadmapEngine.ts';
import { normalizeShiftEvents } from '../src/utils/storage.ts';
import { dayOfWeek } from '../src/utils/date.ts';
import { allIds, dateById, deepFreeze, layout, playlist, prefs, repeat } from './helpers.ts';

const playlists = [playlist('mat', repeat(12, 40)), playlist('fiz', repeat(8, 50)), playlist('kim', repeat(6, 30))];
const pref = prefs({ restDays: [0], activeDays: [1, 2, 3, 4, 5, 6], startDate: '2026-09-21' });
const TODAY = '2026-09-24'; // Thursday

const schedule = (completedMap: Record<string, boolean> = {}, shiftEvents: ShiftEvent[] = []) =>
  buildSchedule(playlists, pref, { completedMap, shiftEvents, today: TODAY }).plans;

function checkInvariants(plans: DailyPlan[], expectedIds: string[]) {
  assert.deepEqual([...allIds(plans)].sort(), [...expectedIds].sort(), 'no task lost or duplicated');
  for (const plan of plans) {
    if (plan.isRestDay || plan.isMockExamDay) assert.equal(plan.items.length, 0, `${plan.date} is not a study day`);
    if (plan.items.length > 1) assert.ok(plan.totalMinutes <= 120 + 1e-9, `${plan.date} over capacity`);
    assert.equal(plan.totalMinutes, plan.items.reduce((a, i) => a + i.effectiveMinutes, 0));
  }
  const dates = plans.map(p => p.date);
  assert.deepEqual(dates, [...new Set(dates)].sort(), 'dates unique and ordered');
}

test('shiftDayPlan keeps completed tasks in place and moves the rest after the day, without loss', () => {
  const plans = schedule({ 'mat-1': true, 'fiz-2': true });
  const before = dateById(plans);
  const shifted = shiftDayPlan('2026-09-22', plans, pref, TODAY);
  const after = dateById(shifted);
  checkInvariants(shifted, allIds(plans));
  for (const [id, date] of before) {
    const done = id === 'mat-1' || id === 'fiz-2';
    if (date <= '2026-09-22' && done) assert.equal(after.get(id), date, `${id} completed stays`);
    else if (date <= '2026-09-22') assert.ok(after.get(id)! > '2026-09-22', `${id} moved forward`);
    else assert.ok(after.get(id)! >= date, `${id} never moves earlier`);
  }
  assert.ok(shifted.every(p => p.date <= '2026-09-22' ? p.items.every(i => i.completed) : true));
});

test('shiftDayPlan never mutates its input', () => {
  const plans = deepFreeze(schedule({ 'mat-1': true }));
  const snapshot = JSON.stringify(plans);
  const shifted = shiftDayPlan('2026-09-23', plans, pref, TODAY);
  assert.equal(JSON.stringify(plans), snapshot);
  assert.notEqual(shifted[0], plans[0]);
  shifted[0].items.push(shifted[0].items[0]);
  assert.equal(JSON.stringify(plans), snapshot);
});

test('shifting the final day keeps its tasks (old version dropped them)', () => {
  const plans = schedule();
  const last = plans.at(-1)!;
  const shifted = shiftDayPlan(last.date, plans, pref, TODAY);
  checkInvariants(shifted, allIds(plans));
  const moved = last.items.map(i => i.id);
  const after = dateById(shifted);
  for (const id of moved) assert.ok(after.get(id)! > last.date);
  assert.ok(shifted.at(-1)!.items.length > 0);
});

test('repeated shifts never lose tasks and respect capacity and rest days', () => {
  let plans = schedule({ 'mat-1': true });
  const ids = allIds(plans);
  for (const date of ['2026-09-21', '2026-09-22', '2026-09-22', '2026-09-25', '2026-09-26']) {
    plans = shiftDayPlan(date, plans, pref, TODAY);
    checkInvariants(plans, ids);
    assert.ok(plans.filter(p => p.date <= date).every(p => p.items.every(i => i.completed)));
  }
  assert.ok(plans.filter(p => dayOfWeek(p.date) === 0).every(p => p.isRestDay && p.items.length === 0));
});

test('shiftDayPlan without preferences still keeps every task', () => {
  const plans = schedule();
  const shifted = shiftDayPlan('2026-09-23', plans);
  assert.deepEqual([...allIds(shifted)].sort(), [...allIds(plans)].sort());
  const capacity = Math.max(240, ...plans.map(p => p.totalMinutes)); // defaults, widened to the busiest day
  assert.ok(shifted.every(p => p.items.length <= 1 || p.totalMinutes <= capacity + 1e-9));
});

test('a stored shift event keeps every date stable while tasks are ticked afterwards', () => {
  const progress = { 'mat-1': true, 'fiz-1': true };
  const event = createShiftEvent('2026-09-23', schedule(progress), TODAY)!;
  assert.equal(event.resumeDate, '2026-09-25', 'shift of a past day starts tomorrow; today is untouched');
  const shifted = schedule(progress, [event]);
  checkInvariants(shifted, allIds(schedule()));
  const base = layout(shifted);

  // Today's tasks are untouched by shifting the past.
  const todayIds = (plans: DailyPlan[]) => plans.find(p => p.date === TODAY)!.items.map(i => i.id);
  assert.deepEqual(todayIds(shifted), todayIds(schedule(progress)));

  // Tick a carried task, a pinned completed task back off, and a future task.
  const carried = event.itemIds[0];
  for (const map of [{ ...progress, [carried]: true }, { 'fiz-1': true }, { ...progress, 'kim-6': true }]) {
    assert.deepEqual(layout(schedule(map, [event])), base);
  }
  assert.ok(dateById(shifted).get(carried)! >= '2026-09-25');
});

test('several stored shift events replay in order and stay stable', () => {
  let progress: Record<string, boolean> = { 'mat-1': true };
  const events = [createShiftEvent('2026-09-22', schedule(progress), '2026-09-23')!];
  progress = { ...progress, 'fiz-2': true, [events[0].itemIds[1]]: true };
  events.push(createShiftEvent('2026-09-24', schedule(progress, events), '2026-09-25')!);
  const final = schedule(progress, events);
  checkInvariants(final, allIds(schedule()));
  assert.ok(final.filter(p => p.date <= '2026-09-24').every(p => p.items.every(i => i.completed)));
  const base = layout(final);
  for (const id of allIds(final)) assert.deepEqual(layout(schedule({ ...progress, [id]: !progress[id] }, events)), base, id);
});

test('createShiftEvent returns null when there is nothing to carry', () => {
  const plans = schedule();
  const firstDay = plans[0];
  const done = Object.fromEntries(firstDay.items.map(i => [i.videoId, true]));
  assert.equal(createShiftEvent(firstDay.date, schedule(done), TODAY), null);
  assert.equal(createShiftEvent('2026-01-01', plans, TODAY), null);
  const future = createShiftEvent('2026-09-30', plans, TODAY)!;
  assert.equal(future.resumeDate, '2026-10-01');
});

test('applyShiftEvent leaves the plan alone when there is no study day to move to', () => {
  const plans = schedule();
  const event = createShiftEvent('2026-09-22', plans, TODAY)!;
  const shifted = applyShiftEvent(plans, event, prefs({ activeDays: [] }), TODAY);
  assert.deepEqual(layout(shifted), layout(plans));
});

test('stored shift events are validated', () => {
  const good = { date: '2026-09-22', resumeDate: '2026-09-25', itemIds: ['mat-3', 7, 'fiz-2'] };
  assert.deepEqual(normalizeShiftEvents([good, null, { date: 'x' }, { ...good, resumeDate: '2026-09-22' }, { ...good, itemIds: [] }, 'x']), [
    { date: '2026-09-22', resumeDate: '2026-09-25', itemIds: ['mat-3', 'fiz-2'] },
  ]);
  assert.deepEqual(normalizeShiftEvents({}), []);
  // Unknown ids in an event are harmless.
  const plans = schedule({}, [{ date: '2026-09-22', resumeDate: '2026-09-25', itemIds: ['gone-1'] }]);
  checkInvariants(plans, allIds(schedule()));
});
