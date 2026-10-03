import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StudyCamp } from '../src/types/index.ts';
import type { PlannerData } from '../src/lib/persistence.ts';
import * as ops from '../src/lib/plannerOps.ts';
import { DEFAULT_AUTO_RHYTHM, createStudyCamp, scheduleFromAuto } from '../src/lib/studyCamp.ts';
import { buildCampSchedule } from '../src/utils/roadmapEngine.ts';
import { allIds, layout, playlist, repeat } from './helpers.ts';

const TODAY = '2026-09-23';
const base = { startDate: '2026-09-21', targetEndDate: null, playbackSpeed: 1, practiceMultiplier: 0.2 };
const event = { date: '2026-09-22', resumeDate: '2026-09-23', itemIds: ['mat-2', 'fiz-2'] };

function started(): { data: PlannerData; camp: StudyCamp } {
  const camp = createStudyCamp({
    name: 'TYT',
    branches: [playlist('mat', repeat(10, 40), 'Matematik'), playlist('fiz', repeat(6, 50), 'Fizik')],
    schedule: scheduleFromAuto(base, { ...DEFAULT_AUTO_RHYTHM, hours: 3 }),
  });
  const withEvent = { ...camp, shiftEvents: [event] };
  const data: PlannerData = { camps: [withEvent], activeCampId: camp.id, completedMap: { 'mat-1': true, 'fiz-1': true } } as unknown as PlannerData;
  return { data, camp: withEvent };
}

const plansOf = (camp: StudyCamp, completedMap: Record<string, boolean> = {}) => buildCampSchedule(camp, { today: TODAY, completedMap }).plans;

test('moving the start date re-lays the plan from the new date with no old events', () => {
  const { data, camp } = started();
  const next = ops.setCampSchedule(data, camp.id, { ...camp.schedule, startDate: '2026-10-05' }, TODAY);
  const moved = next.camps[0];
  assert.deepEqual(moved.shiftEvents, []);
  const fresh = createStudyCamp({ name: 'TYT', branches: camp.branches, schedule: { ...camp.schedule, startDate: '2026-10-05' } });
  assert.deepEqual(layout(plansOf(moved)), layout(plansOf(fresh)));
  assert.equal(plansOf(moved).find(p => p.items.length > 0)!.date, '2026-10-05');
});

test('no task is ever placed before the start date, even with a stale event stored', () => {
  const { camp } = started();
  const stale = { ...camp, schedule: { ...camp.schedule, startDate: '2026-10-05' } };
  const plans = plansOf(stale);
  assert.equal(plans.find(p => p.items.length > 0)!.date, '2026-10-05');
  for (const plan of plans) if (plan.items.length > 0) assert.ok(plan.date >= '2026-10-05', plan.date);
  assert.deepEqual(layout(plans), layout(plansOf({ ...stale, shiftEvents: [] })), 'the stale event is ignored');
});

test('saving with the same start date keeps the stored events', () => {
  const { data, camp } = started();
  const next = ops.setCampSchedule(data, camp.id, { ...camp.schedule, dailyStudyHours: 4 }, TODAY);
  assert.deepEqual(next.camps[0].shiftEvents, [event]);
});

test('completion ticks survive a start date change and no task is lost', () => {
  const { data, camp } = started();
  const next = ops.setCampSchedule(data, camp.id, { ...camp.schedule, startDate: '2026-10-05' }, TODAY);
  assert.deepEqual(next.completedMap, data.completedMap);
  const plans = plansOf(next.camps[0], next.completedMap);
  assert.equal(allIds(plans).length, 16);
  const done = plans.flatMap(p => p.items).filter(i => i.completed).map(i => i.id).sort();
  assert.deepEqual(done, ['fiz-1', 'mat-1']);
});

test('moving the start date and the tempo in one save: new start, new tempo only, no history or events', () => {
  const { data, camp } = started();
  // First a tempo change on the started camp builds a tempo history.
  const slower = ops.setCampSchedule(data, camp.id, { ...camp.schedule, dailyStudyHours: 2 }, TODAY);
  assert.equal(slower.camps[0].tempoHistory?.length, 1);
  assert.equal(slower.camps[0].shiftEvents.length, 1);

  const both = ops.setCampSchedule(slower, camp.id, { ...camp.schedule, dailyStudyHours: 4, startDate: '2026-10-05' }, TODAY);
  const moved = both.camps[0];
  assert.equal(moved.tempoHistory, undefined);
  assert.deepEqual(moved.shiftEvents, []);
  assert.equal(moved.schedule.dailyStudyHours, 4);
  const fresh = createStudyCamp({ name: 'TYT', branches: camp.branches, schedule: { ...camp.schedule, dailyStudyHours: 4, startDate: '2026-10-05' } });
  assert.deepEqual(layout(plansOf(moved)), layout(plansOf(fresh)));
  assert.equal(plansOf(moved).find(p => p.items.length > 0)!.date, '2026-10-05');
});
