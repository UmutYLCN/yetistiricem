import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StudyCamp } from '../src/types/index.ts';
import type { PlannerData } from '../src/lib/persistence.ts';
import { activeCampOf, campStore } from '../src/lib/persistence.ts';
import * as ops from '../src/lib/plannerOps.ts';
import { DEFAULT_AUTO_RHYTHM, createStudyCamp, normalizeCamps, scheduleFromAuto, scheduleFromManual } from '../src/lib/studyCamp.ts';
import { buildCampSchedule } from '../src/utils/roadmapEngine.ts';
import { layout, playlist, repeat } from './helpers.ts';

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
  next = ops.addBranch(next, b.id, playlist('bio', repeat(3, 30), 'Biyoloji'), { weekdays: [2] });
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
