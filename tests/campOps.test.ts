import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StudyCamp } from '../src/types/index.ts';
import type { PlannerData } from '../src/lib/persistence.ts';
import { activeCampOf, campStore } from '../src/lib/persistence.ts';
import * as ops from '../src/lib/plannerOps.ts';
import { DEFAULT_AUTO_RHYTHM, createStudyCamp, normalizeCamps, scheduleFromAuto, scheduleFromManual } from '../src/lib/studyCamp.ts';
import { dayOfWeek } from '../src/utils/date.ts';
import { buildCampSchedule } from '../src/utils/roadmapEngine.ts';
import { dateById, deepFreeze, layout, playlist, repeat } from './helpers.ts';

const base = { startDate: '2026-09-21', targetEndDate: null, playbackSpeed: 1, practiceMultiplier: 0.2 };

function twoCamps(): { data: PlannerData; a: StudyCamp; b: StudyCamp } {
  const a = createStudyCamp({
    name: 'TYT',
    branches: [playlist('mat', repeat(10, 40), 'Matematik'), playlist('fiz', repeat(6, 50), 'Fizik')],
    schedule: scheduleFromAuto(base, { ...DEFAULT_AUTO_RHYTHM, hours: 3 }),
  });
  const b = createStudyCamp({
    name: 'AYT',
    branches: [playlist('geo', repeat(8, 45), 'Geometri'), playlist('kim', repeat(5, 30), 'Kimya')],
    schedule: scheduleFromManual(
      { ...base, targetEndDate: '2026-11-30' },
      { hours: 2, dayTypes: ['rest', 'study', 'rest', 'study', 'rest', 'study', 'mock'], weekPlan: [[], ['geo'], [], ['kim'], [], ['geo', 'kim'], []] },
      { maxSubjectsPerDay: 2 }
    ),
  });
  const data: PlannerData = { camps: [a, b], activeCampId: a.id, completedMap: { 'mat-1': true, 'geo-1': true }, dayNotes: {} };
  return { data, a, b };
}

const snapshot = (value: unknown) => JSON.parse(JSON.stringify(value));

test('editing camp A tempo leaves camp B, its plan and shared progress untouched', () => {
  const { data, a, b } = twoCamps();
  const bBefore = snapshot(b);
  const bPlanBefore = layout(buildCampSchedule(b, { today: '2026-09-21' }).plans);

  const faster = scheduleFromAuto({ ...base, startDate: '2026-10-01', targetEndDate: '2026-12-01' }, { ...DEFAULT_AUTO_RHYTHM, preset: 'intense', perDay: 1 });
  const next = ops.setCampSchedule(data, a.id, faster);

  const [aAfter, bAfter] = next.camps;
  assert.deepEqual(aAfter.schedule, faster, 'A has the new tempo');
  assert.deepEqual(snapshot(bAfter), bBefore, 'B is exactly as it was');
  assert.equal(bAfter, b, 'B is not even copied');
  assert.deepEqual(layout(buildCampSchedule(bAfter, { today: '2026-09-21' }).plans), bPlanBefore);
  assert.deepEqual(next.completedMap, data.completedMap);
  assert.deepEqual(snapshot(data.camps[0].schedule), snapshot(a.schedule), 'the input data is not mutated');
});

test('switching the active camp keeps each camp’s own tempo, also after a save and reload', () => {
  const { data, a, b } = twoCamps();
  const edited = ops.setCampSchedule(data, b.id, { ...b.schedule, dailyStudyHours: 5 });
  const onB = ops.setActiveCamp(edited, b.id);
  assert.equal(activeCampOf(onB)!.schedule.dailyStudyHours, 5);
  assert.equal(activeCampOf(onB)!.schedule.mode, 'manual');
  const backOnA = ops.setActiveCamp(onB, a.id);
  assert.deepEqual(activeCampOf(backOnA)!.schedule, a.schedule);
  assert.equal(ops.setActiveCamp(backOnA, 'nope'), backOnA, 'unknown ids are ignored');

  const reloaded = normalizeCamps(snapshot(campStore(backOnA.camps)).camps);
  assert.deepEqual(reloaded.camps.map(c => c.schedule), backOnA.camps.map(c => c.schedule));
});

test('branch and shift changes stay inside their camp', () => {
  const { data, a, b } = twoCamps();
  const event = { date: '2026-09-22', resumeDate: '2026-09-23', itemIds: ['mat-2'] };
  let next = ops.addShiftEvent(data, a.id, event);
  next = ops.addBranches(next, b.id, [playlist('bio', repeat(3, 30), 'Biyoloji')], { weekdays: [2], today: '2026-09-21' });
  assert.deepEqual(next.camps[0].shiftEvents, [event]);
  assert.deepEqual(next.camps[1].shiftEvents, []);
  assert.deepEqual(next.camps[1].schedule.weekPlan[2], ['bio'], 'manual camp: the new branch joins Tuesday');
  assert.deepEqual(next.camps[1].schedule.activeDays, [1, 2, 3, 5]);
  assert.deepEqual(next.camps[0].schedule, a.schedule);

  const removed = ops.removeBranch(next, b.id, 'geo');
  assert.deepEqual(removed.camps[1].schedule.weekPlan, [[], [], ['bio'], ['kim'], [], ['kim'], []]);
  assert.deepEqual(removed.camps[1].schedule.activeDays, [2, 3, 5], 'Monday had only Geometri and now rests');
  assert.equal(removed.completedMap['geo-1'], undefined, 'completion of removed videos is pruned');
  assert.equal(removed.completedMap['mat-1'], true);

  const withoutA = ops.removeCamp(removed, a.id);
  assert.deepEqual(withoutA.camps.map(c => c.id), [b.id]);
  assert.equal(withoutA.activeCampId, b.id, 'the next camp becomes active');
  assert.equal(withoutA.completedMap['mat-1'], undefined);
});

// Adding branches to an existing camp (the add-branch wizard saves `ops.addBranches`).

test('adding branches keeps the same camp: same id, name, dates and tempo; no camp is created', () => {
  const { data, a, b } = twoCamps();
  const event = { date: '2026-09-22', resumeDate: '2026-09-23', itemIds: ['mat-2'] };
  const before = deepFreeze(ops.addShiftEvent(data, a.id, event));
  const bio = playlist('bio', repeat(4, 30), 'Biyoloji');

  const next = ops.addBranches(before, a.id, [bio], { today: '2026-09-21' });

  assert.deepEqual(next.camps.map(c => c.id), [a.id, b.id], 'still the same two camps, in order');
  assert.equal(next.activeCampId, before.activeCampId);
  const after = next.camps[0];
  assert.equal(after.name, a.name);
  assert.equal(after.createdAt, a.createdAt);
  assert.deepEqual(after.schedule, a.schedule, 'dates and tempo are unchanged');
  assert.deepEqual(after.branches.map(x => x.id), ['mat', 'fiz', 'bio']);
  assert.equal(after.branches[0], a.branches[0], 'existing branches are kept as they are');
  assert.deepEqual(after.shiftEvents, [event], 'existing shifts are kept; nothing to carry on the first day');
  assert.equal(next.camps[1], before.camps[1], 'the other camp is not even copied');
  assert.deepEqual(next.completedMap, data.completedMap);
  assert.equal(ops.addBranches(before, a.id, [], { today: '2026-09-21' }), before, 'nothing to add changes nothing');
});

test('an automatic camp lays out new branches with its own saved settings', () => {
  const { data, a } = twoCamps();
  const bio = playlist('bio', repeat(6, 30), 'Biyoloji');
  const next = ops.addBranches(data, a.id, [bio], { today: '2026-09-21' });
  const result = buildCampSchedule(next.camps[0], { completedMap: next.completedMap, today: '2026-09-21' });

  assert.deepEqual(
    layout(result.plans),
    layout(buildCampSchedule({ ...a, branches: [...a.branches, bio] }, { today: '2026-09-21' }).plans),
    'the plan is the camp’s own tempo applied to all its branches'
  );
  const study = a.schedule.activeDays.filter(d => !a.schedule.restDays.includes(d) && !a.schedule.mockExamDays.includes(d));
  for (const plan of result.plans) {
    if (plan.items.length === 0) continue;
    assert.ok(study.includes(dayOfWeek(plan.date)), `${plan.date} is one of the camp’s study days`);
    assert.ok(plan.totalMinutes <= a.schedule.dailyStudyHours * 60 + 1e-9, `${plan.date} stays within the camp’s daily time`);
    assert.ok(new Set(plan.items.map(i => i.subject)).size <= a.schedule.maxSubjectsPerDay);
  }
  assert.ok(result.plans.some(p => p.items.some(i => i.playlistId === 'bio')), 'the new branch is in the plan');
  assert.equal(result.plans.flatMap(p => p.items).find(i => i.videoId === 'mat-1')?.completed, true, 'completion marks still show');
});

test('a manual camp puts new branches on the chosen weekdays, never on mock days', () => {
  const { data, a, b } = twoCamps();
  const bio = playlist('bio', repeat(3, 30), 'Biyoloji');
  const next = ops.addBranches(data, b.id, [bio], { weekdays: [2, 6], today: '2026-09-21' });
  const after = next.camps[1];

  assert.equal(after.id, b.id);
  assert.deepEqual(after.schedule.weekPlan, [[], ['geo'], ['bio'], ['kim'], [], ['geo', 'kim'], []], 'Saturday is the mock day');
  assert.deepEqual(after.schedule.activeDays, [1, 2, 3, 5]);
  const { weekPlan: _w, activeDays: _a, restDays: _r, ...tempo } = after.schedule;
  const { weekPlan: _bw, activeDays: _ba, restDays: _br, ...tempoBefore } = b.schedule;
  assert.deepEqual(tempo, tempoBefore, 'dates, daily time, mode and mock days are unchanged');
  const dates = dateById(buildCampSchedule(after, { today: '2026-09-21' }).plans);
  for (const video of bio.videos) assert.equal(dayOfWeek(dates.get(video.id)!), 2, `${video.id} is on a Tuesday`);
  assert.equal(next.camps[0], data.camps[0], 'camp A is untouched');
  assert.deepEqual(next.camps[0].schedule, a.schedule);
});

test('a running camp carries new tasks off past days so each new branch starts in order from tomorrow', () => {
  const { data, a, b } = twoCamps();
  const today = '2026-10-01';
  const bio = playlist('bio', repeat(8, 30), 'Biyoloji');
  const { camp: preview, carried } = ops.withAddedBranches(a, [bio], { completedMap: data.completedMap, today });
  const next = ops.addBranches(data, a.id, [bio], { today });
  const after = next.camps[0];

  assert.deepEqual(after, preview, 'the wizard previews exactly what is saved');
  assert.equal(after.shiftEvents.length, 1);
  assert.deepEqual({ ...after.shiftEvents[0], itemIds: [] }, { date: today, resumeDate: '2026-10-02', itemIds: [] });
  assert.equal(after.shiftEvents[0].itemIds.length, carried);
  assert.ok(carried > 0);

  const result = buildCampSchedule(after, { completedMap: next.completedMap, today });
  const dates = dateById(result.plans);
  const bioDates = bio.videos.map(v => dates.get(v.id)!);
  assert.ok(bioDates.every(d => d > today), 'no new task is overdue or squeezed into today');
  assert.deepEqual([...bioDates].sort(), bioDates, 'the new branch keeps its video order');
  assert.equal(dates.size, [...after.branches].reduce((acc, br) => acc + br.videos.length, 0), 'nothing is dropped');
  assert.deepEqual(next.completedMap, data.completedMap);
  assert.equal(next.camps[1], b);
});

test('a camp that has not started yet needs no carried tasks', () => {
  const { data, a } = twoCamps();
  const next = ops.addBranches(data, a.id, [playlist('bio', repeat(3, 30), 'Biyoloji')], { today: '2026-09-01' });
  assert.deepEqual(next.camps[0].shiftEvents, []);
});
