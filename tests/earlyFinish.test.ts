import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DailyPlan, StudyCamp } from '../src/types/index.ts';
import type { PlannerData } from '../src/lib/persistence.ts';
import { campWithDailyHours, deadlineOverrun, hoursToMeetTarget } from '../src/lib/deadlineOverrun.ts';
import { completionDatesStore, createBackup, emptyData, normalizeCompletionDates, parseBackup } from '../src/lib/persistence.ts';
import * as ops from '../src/lib/plannerOps.ts';
import { DEFAULT_AUTO_RHYTHM, createStudyCamp, scheduleFromAuto, scheduleFromManual } from '../src/lib/studyCamp.ts';
import { addDays, dayOfWeek } from '../src/utils/date.ts';
import { buildCampSchedule, createShiftEvent, planEndDate } from '../src/utils/roadmapEngine.ts';
import { allIds, dateById, layout, playlist, repeat } from './helpers.ts';

// Early finishes: a task ticked before its planned day counts on the day it
// was done, and the open tasks after it move up into the freed time
// (docs/planner-engine.md, "Early finishes").

const START = '2026-09-21'; // Monday
const base = { startDate: START, targetEndDate: null, playbackSpeed: 1, practiceMultiplier: 0 };

/** Two hours every day, two branches of 40-minute lessons: three lessons a day. */
function autoCamp(): StudyCamp {
  return createStudyCamp(
    {
      name: 'TYT',
      branches: [playlist('mat', repeat(10, 40)), playlist('fiz', repeat(8, 40))],
      schedule: scheduleFromAuto(base, { ...DEFAULT_AUTO_RHYTHM, hours: 2, perDay: 3, days: [0, 1, 2, 3, 4, 5, 6], mockDays: [] }),
    },
    START
  );
}

function dataOf(camp: StudyCamp, aheadSince = START): PlannerData {
  return { ...emptyData(), camps: [camp], activeCampId: camp.id, completionDates: { since: START, dates: {}, aheadSince } };
}

const plan = (data: PlannerData, today: string) =>
  buildCampSchedule(data.camps[0], { completedMap: data.completedMap, completionDays: data.completionDates, today }).plans;

/** Days before `before`: their tasks and which are done. */
const pastOf = (plans: DailyPlan[], before: string) =>
  plans.filter(p => p.date < before).map(p => ({ date: p.date, items: p.items.map(i => `${i.id}${i.completed ? '✓' : ''}`) }));

const openMinutes = (day: DailyPlan | undefined) => (day?.items ?? []).filter(i => !i.completed).reduce((sum, i) => sum + i.effectiveMinutes, 0);

/** Every branch's open tasks come in lesson order through the plan. */
function assertLessonOrder(plans: DailyPlan[], branches: string[]) {
  for (const branch of branches) {
    const open = plans.flatMap(p => p.items.filter(i => i.playlistId === branch && !i.completed).map(i => Number(i.id.split('-')[1])));
    assert.deepEqual(open, [...open].sort((a, b) => a - b), `${branch} open lessons in order: ${open.join(',')}`);
  }
}

/** Open tasks never exceed a day's capacity. */
function assertCapacity(plans: DailyPlan[], minutes = 120) {
  for (const day of plans) assert.ok(openMinutes(day) <= minutes + 1e-9, `${day.date} holds ${openMinutes(day)} open minutes`);
}

test('working ahead frees the later day at once and brings the finish date closer', () => {
  const data = dataOf(autoCamp());
  const before = plan(data, START);
  const thursday = '2026-09-24';
  assert.deepEqual(before.find(p => p.date === thursday)!.items.map(i => i.id), ['fiz-5', 'mat-6', 'fiz-6']);
  const finishBefore = planEndDate(before)!;

  // Monday: Thursday's mat-6 is done ahead (the reported S7 scenario).
  const ahead = ops.setCompleted(data, 'mat-6', true, START);
  const after = plan(ahead, START);
  assert.equal(dateById(after).get('mat-6'), START, 'counts on the day it was done');
  assert.ok(after.find(p => p.date === START)!.items.find(i => i.id === 'mat-6')!.completed);
  const thursdayAfter = after.find(p => p.date === thursday)!;
  assert.ok(!thursdayAfter.items.some(i => i.id === 'mat-6'), 'it no longer holds Thursday');
  assert.equal(openMinutes(thursdayAfter), 120, 'Thursday is filled with the open work after it, not left at 80 minutes');
  assert.deepEqual(pastOf(after, thursday).slice(1), pastOf(before, thursday).slice(1), 'the days between stay as they were');
  assert.deepEqual([...allIds(after)].sort(), [...allIds(before)].sort(), 'no task lost or doubled');
  assertCapacity(after);
  assertLessonOrder(after, ['mat', 'fiz']);

  // A whole day's work done ahead takes a whole day off the plan.
  let more = ahead;
  for (const id of ['fiz-6', 'mat-7']) more = ops.setCompleted(more, id, true, START);
  const finishAfter = planEndDate(plan(more, START))!;
  assert.equal(finishAfter, addDays(finishBefore, -1), `finish ${finishBefore} -> ${finishAfter}`);
});

test('ticking on or after a task’s own day, or without a tick day, moves nothing', () => {
  const data = dataOf(autoCamp());
  const before = layout(plan(data, '2026-09-23'));
  // Monday's task ticked on Monday, Tuesday's ticked late on Wednesday.
  let ticked = ops.setCompleted(data, 'mat-1', true, START);
  ticked = ops.setCompleted(ticked, 'fiz-2', true, '2026-09-23');
  assert.deepEqual(layout(plan(ticked, '2026-09-23')), before);
  // Ticks with no recorded day (made before tick days were kept) never move.
  const undated = { ...data, completedMap: { 'mat-9': true, 'fiz-8': true } };
  assert.deepEqual(layout(plan(undated, START)), layout(plan(data, START)));
});

test('days before today never change while a student works ahead, falls behind and postpones', () => {
  let data = dataOf(autoCamp());
  // What each day's actions do, in order. A missed day leaves its tasks open.
  const days: { today: string; act: (data: PlannerData, plans: DailyPlan[], today: string) => PlannerData }[] = [
    { today: '2026-09-21', act: (d, p, t) => tickAhead(tickToday(d, p, t), p, t, 2) },
    { today: '2026-09-22', act: (d, p, t) => tickToday(d, p, t) },
    { today: '2026-09-23', act: d => d }, // missed
    { today: '2026-09-24', act: (d, p, t) => tickAhead(postponeOverdue(d, p, t), p, t, 1) },
    { today: '2026-09-25', act: (d, p, t) => postponeToday(tickAhead(d, p, t, 1), t) },
    { today: '2026-09-26', act: (d, p, t) => tickToday(d, p, t) },
  ];

  let previous: DailyPlan[] | null = null;
  for (const { today, act } of days) {
    const morning = plan(data, today);
    if (previous) assert.deepEqual(pastOf(morning, today), pastOf(previous, today), `${today}: a new day changes no earlier day`);
    const eventsBefore = data.camps[0].shiftEvents.length;
    data = act(data, morning, today);
    const evening = plan(data, today);
    // A postpone carries the open tasks of passed days on purpose; nothing else leaves them.
    const carried = new Set(data.camps[0].shiftEvents.slice(eventsBefore).flatMap(e => e.itemIds));
    const expected = layout(morning.filter(p => p.date < today)).map(day => ({ ...day, items: day.items.filter(id => !carried.has(id)) }));
    assert.deepEqual(layout(evening.filter(p => p.date < today)), expected, `${today}: the day's actions change no earlier day`);
    assert.deepEqual([...allIds(evening)].sort(), [...allIds(plan(dataOf(autoCamp()), today))].sort(), `${today}: no task lost`);
    assertCapacity(evening.filter(p => p.date > today));
    assertLessonOrder(evening.filter(p => p.date >= today), ['mat', 'fiz']);
    previous = evening;
  }
  // The same data built on any later day shows the same layout.
  assert.deepEqual(layout(plan(data, '2026-10-30')), layout(previous!));
});

function tickToday(data: PlannerData, plans: DailyPlan[], today: string): PlannerData {
  const ids = plans.find(p => p.date === today)?.items.map(i => i.videoId) ?? [];
  return ids.reduce((d, id) => ops.setCompleted(d, id, true, today), data);
}

/** Ticks the first `count` open tasks planned after today. */
function tickAhead(data: PlannerData, plans: DailyPlan[], today: string, count: number): PlannerData {
  const ids = plans.filter(p => p.date > today).flatMap(p => p.items.filter(i => !i.completed).map(i => i.videoId)).slice(0, count);
  return ids.reduce((d, id) => ops.setCompleted(d, id, true, today), data);
}

function addEvent(data: PlannerData, plans: DailyPlan[], date: string, today: string): PlannerData {
  const event = createShiftEvent(date, plans, today);
  return event ? ops.addShiftEvents(data, [{ campId: data.camps[0].id, event }]) : data;
}

const postponeOverdue = (data: PlannerData, plans: DailyPlan[], today: string) => addEvent(data, plans, addDays(today, -1), today);
const postponeToday = (data: PlannerData, today: string) => addEvent(data, plan(data, today), today, today);

test('unticking a task done ahead the same day restores the plan exactly', () => {
  const data = dataOf(autoCamp());
  const before = plan(data, START);
  const ahead = ops.setCompleted(data, 'mat-6', true, START);
  const undone = ops.setCompleted(ahead, 'mat-6', false, START);
  assert.equal(undone.completionDates.reopened, undefined, 'nothing to remember for a same-day untick');
  assert.deepEqual(layout(plan(undone, START)), layout(before));
});

test('a task done ahead and unticked on a later day rejoins the open plan from that day, in lesson order', () => {
  const data = dataOf(autoCamp());
  const ahead = ops.setCompleted(data, 'mat-6', true, START);
  const tuesday = '2026-09-22';
  const shown = plan(ahead, tuesday);

  const reopened = ops.setCompleted(ahead, 'mat-6', false, tuesday);
  assert.deepEqual(reopened.completionDates.reopened, { 'mat-6': [[START, tuesday]] });
  const after = plan(reopened, tuesday);
  const withoutMat6 = pastOf(shown, tuesday).map(d => ({ ...d, items: d.items.filter(i => i !== 'mat-6✓') }));
  assert.deepEqual(pastOf(after, tuesday), withoutMat6, 'Monday only loses the task that is no longer done');
  assert.ok(dateById(after).get('mat-6')! >= tuesday);
  assert.deepEqual([...allIds(after)].sort(), [...allIds(shown)].sort());
  assertLessonOrder(after, ['mat', 'fiz']);
  assertCapacity(after.filter(p => p.date >= tuesday));
});

test('a task taken back after its later lessons were pulled onto a passed day is carried before them', () => {
  const data = dataOf(autoCamp());
  // Monday: mat-6 done ahead, so mat-7 moves up to Thursday. Thursday is missed.
  const ahead = ops.setCompleted(data, 'mat-6', true, START);
  assert.equal(dateById(plan(ahead, START)).get('mat-7'), '2026-09-24');
  let d = tickToday(ahead, plan(ahead, START), START);
  for (const day of ['2026-09-22', '2026-09-23']) d = tickToday(d, plan(d, day), day);

  // Saturday: mat-6 is unticked, then the overdue tasks are carried.
  const saturday = '2026-09-26';
  d = ops.setCompleted(d, 'mat-6', false, saturday);
  const morning = plan(d, saturday);
  d = postponeOverdue(d, morning, saturday);
  const after = plan(d, saturday);
  const carried = new Set(d.camps[0].shiftEvents[0].itemIds);
  const expected = layout(morning.filter(p => p.date < saturday)).map(day => ({ ...day, items: day.items.filter(id => !carried.has(id)) }));
  assert.deepEqual(layout(after.filter(p => p.date < saturday)), expected, 'only the carried tasks leave the passed days');
  assertLessonOrder(after, ['mat', 'fiz']);
  const mat = after.flatMap(p => p.items.filter(i => i.playlistId === 'mat' && !i.completed).map(i => i.id));
  assert.equal(mat[0], 'mat-6', `mat-6 first: ${mat.join(',')}`);
});

test('saved data loads unchanged: ticks before aheadSince keep their place and old events replay as before', () => {
  const camp = autoCamp();
  const legacyToday = '2026-09-24';
  // An older version: Thursday's mat-6 was ticked on Monday, and Wednesday was postponed.
  const completedMap = { 'mat-1': true, 'fiz-1': true, 'mat-2': true, 'mat-6': true };
  const legacyPlans = buildCampSchedule(camp, { completedMap, today: legacyToday }).plans;
  const event = createShiftEvent('2026-09-23', legacyPlans, legacyToday)!;
  const saved: StudyCamp = { ...camp, shiftEvents: [event] };
  const before = buildCampSchedule(saved, { completedMap, today: legacyToday }).plans;

  // The update loads that value on Friday: early finishes count from then on.
  const stored = { version: 1, since: '2026-09-01', dates: { 'mat-1': START, 'fiz-1': START, 'mat-2': START, 'mat-6': START } };
  const loaded = normalizeCompletionDates(stored, '2026-09-25')!;
  assert.equal(loaded.aheadSince, '2026-09-25');
  const after = buildCampSchedule(saved, { completedMap, completionDays: loaded, today: '2026-09-25' }).plans;
  assert.deepEqual(layout(after), layout(before));
  assert.deepEqual(pastOf(after, '2026-09-25'), pastOf(before, '2026-09-25'));
});

test('manual weekdays, rest days and an earlier tempo still hold after working ahead', () => {
  const manual = createStudyCamp(
    {
      name: 'AYT',
      branches: [playlist('mat', repeat(10, 40)), playlist('fiz', repeat(8, 40)), playlist('kim', repeat(6, 30))],
      schedule: scheduleFromManual(
        base,
        { hours: 2, dayTypes: ['rest', 'study', 'study', 'study', 'study', 'study', 'mock'], weekPlan: [[], ['mat', 'fiz'], ['kim'], ['mat'], ['fiz', 'kim'], ['mat', 'fiz'], []] },
        { maxSubjectsPerDay: 2 }
      ),
    },
    START
  );
  // From Wednesday on: three hours a day.
  const wednesday = '2026-09-23';
  const camp = ops.withTempo(manual, { ...manual.schedule, dailyStudyHours: 3 }, wednesday);
  assert.equal(camp.tempoHistory?.length, 1);
  let data = dataOf(camp);
  // Sunday is a rest day: lessons done ahead that day count on it.
  const sunday = '2026-09-27';
  const future = plan(data, sunday).filter(p => p.date > sunday).flatMap(p => p.items.map(i => i.videoId)).slice(0, 2);
  for (const id of future) data = ops.setCompleted(data, id, true, sunday);
  const after = plan(data, sunday);

  const sundayPlan = after.find(p => p.date === sunday)!;
  assert.ok(sundayPlan.isRestDay);
  assert.deepEqual(sundayPlan.items.map(i => i.videoId), future);
  for (const day of after) {
    const open = day.items.filter(i => !i.completed);
    const dow = dayOfWeek(day.date);
    if (open.length === 0) continue;
    assert.ok(!day.isRestDay && !day.isMockExamDay, `${day.date} open tasks on a study day only`);
    for (const item of open) assert.ok(camp.schedule.weekPlan[dow].includes(item.playlistId), `${item.id} on ${day.date}`);
    assert.ok(openMinutes(day) <= (day.date < wednesday ? 120 : 180) + 1e-9, `${day.date} within its tempo`);
  }
  assertLessonOrder(after, ['mat', 'fiz', 'kim']);
  assert.deepEqual([...allIds(after)].sort(), [...allIds(plan(dataOf(camp), sunday))].sort());
});

test('a lesson done ahead before the camp starts counts on its first day', () => {
  const data = dataOf(autoCamp(), '2026-09-15');
  const early = ops.setCompleted(data, 'fiz-4', true, '2026-09-18');
  const plans = plan(early, '2026-09-18');
  assert.equal(plans[0].date, START, 'the plan still starts on its start day');
  assert.equal(dateById(plans).get('fiz-4'), START);
});

test('tick days and taken-back ticks are saved, restored and pruned with their videos', () => {
  const camp = autoCamp();
  let data = ops.setCompleted(dataOf(camp), 'mat-6', true, START);
  data = ops.setCompleted(data, 'mat-6', false, '2026-09-23');
  data = ops.setCompleted(data, 'fiz-8', true, '2026-09-23');
  const saved = completionDatesStore(data.completionDates);
  assert.deepEqual(saved, { version: 1, since: START, dates: { 'fiz-8': '2026-09-23' }, aheadSince: START, reopened: { 'mat-6': [[START, '2026-09-23']] } });
  assert.deepEqual(normalizeCompletionDates(JSON.parse(JSON.stringify(saved)), '2026-10-01'), data.completionDates);
  const restored = parseBackup(JSON.stringify(createBackup(data, START)), '2026-10-01');
  assert.ok(restored.ok);
  if (restored.ok) assert.deepEqual(restored.data.completionDates, data.completionDates, 'the cloud copy and backups carry them');
  // Broken entries are dropped on load.
  const broken = normalizeCompletionDates({ ...saved, aheadSince: 'dün', reopened: { a: [['2026-09-23', '2026-09-22']], b: 'x', c: [[START, '2026-09-22'], ['?', START]] } }, '2026-10-01')!;
  assert.equal(broken.aheadSince, '2026-10-01');
  assert.deepEqual(broken.reopened, { c: [[START, '2026-09-22']] });

  const removed = ops.removeBranch(data, camp.id, camp.branches[0].id);
  assert.equal(removed.completionDates.reopened?.['mat-6'], undefined, 'a removed video takes its record along');
});

test('the re-lay after a tick ahead keeps long videos alternating with the other branches', () => {
  // 150-minute math lessons do not fit a 2-hour day: math days alternate with Fizik/Kimya days.
  const camp = createStudyCamp(
    {
      name: 'Uzun',
      branches: [playlist('mat', repeat(5, 150)), playlist('fiz', repeat(5, 30)), playlist('kim', repeat(5, 30))],
      schedule: scheduleFromAuto(base, { ...DEFAULT_AUTO_RHYTHM, hours: 2, perDay: 3, days: [0, 1, 2, 3, 4, 5, 6], mockDays: [] }),
    },
    START
  );
  const data = dataOf(camp);
  const days = (plans: DailyPlan[]) => plans.filter(p => p.items.length > 0).map(p => p.items.map(i => i.id));
  assert.deepEqual(days(plan(data, START)).slice(0, 4), [['mat-1'], ['fiz-1', 'kim-1', 'fiz-2', 'kim-2'], ['mat-2'], ['fiz-3', 'kim-3', 'fiz-4', 'kim-4']]);

  // Monday: Thursday's fiz-3 is done ahead. Thursday is re-laid right after Wednesday's long math day.
  const after = plan(ops.setCompleted(data, 'fiz-3', true, START), START);
  const thursday = after.find(p => p.date === '2026-09-24')!;
  assert.ok(!thursday.items.some(i => i.playlistId === 'mat'), `Thursday still goes to the others: ${thursday.items.map(i => i.id).join(',')}`);
  // From Thursday on no two math days follow each other while Fizik/Kimya still have work.
  const study = after.filter(p => p.date >= '2026-09-24' && p.items.some(i => !i.completed));
  for (let i = 1; i < study.length; i++) {
    const othersLeft = study.slice(i).some(p => p.items.some(item => item.playlistId !== 'mat'));
    const isMat = (p: DailyPlan) => p.items.length === 1 && p.items[0].playlistId === 'mat';
    if (othersLeft) assert.ok(!(isMat(study[i - 1]) && isMat(study[i])), `${study[i - 1].date} and ${study[i].date} are both math days`);
  }
  assertLessonOrder(after, ['mat', 'fiz', 'kim']);
  assert.deepEqual([...allIds(after)].sort(), [...allIds(plan(data, START))].sort());
});

test('the deadline prompt counts work done ahead: its finish and suggested time match the plan screens', () => {
  // 80 h of 10-minute lessons, 2 h a day from 09-01; on 10-01, 20 h remain and the target is 10-06.
  const camp: StudyCamp = {
    ...createStudyCamp(
      {
        name: 'TYT',
        branches: [playlist('mat', repeat(240, 10)), playlist('fiz', repeat(240, 10))],
        schedule: scheduleFromAuto({ ...base, startDate: '2026-09-01', targetEndDate: '2026-10-06' }, { ...DEFAULT_AUTO_RHYTHM, hours: 2, perDay: 3, days: [0, 1, 2, 3, 4, 5, 6], mockDays: [] }),
      },
      '2026-09-01'
    ),
  };
  const today = '2026-10-01';
  const plain = deadlineOverrun(camp, { today });
  assert.equal(plain?.finishDate, '2026-10-10');
  assert.equal(plain?.suggestion?.hours, 3.5);

  // Today the student also does 5 h of later lessons.
  let data: PlannerData = { ...emptyData(), camps: [camp], activeCampId: camp.id, completionDates: { since: '2026-09-01', dates: {}, aheadSince: '2026-09-01' } };
  const later = plan(data, today).filter(p => p.date > today).flatMap(p => p.items.map(i => i.videoId)).slice(0, 30);
  for (const id of later) data = ops.setCompleted(data, id, true, today);
  const completion = { completedMap: data.completedMap, completionDays: data.completionDates };

  const overrun = deadlineOverrun(camp, { today, ...completion });
  assert.equal(overrun?.finishDate, planEndDate(plan(data, today)), 'the same finish as the plan screens');
  assert.equal(overrun?.finishDate, '2026-10-08');
  const hours = overrun?.suggestion?.hours;
  assert.ok(hours !== undefined && hours < plain!.suggestion!.hours, `less extra time than without the work done ahead: ${hours}`);
  assert.equal(hoursToMeetTarget(camp, { today, ...completion }), hours);
  const raised = { ...data, camps: [campWithDailyHours(camp, hours!, today)] };
  assert.ok(planEndDate(plan(raised, today))! <= '2026-10-06', 'the suggested time really finishes by the target');

  // Another 5 h done ahead: the plan is back on time and nothing is asked.
  for (const id of plan(data, today).filter(p => p.date > today).flatMap(p => p.items.map(i => i.videoId)).slice(0, 30)) data = ops.setCompleted(data, id, true, today);
  assert.equal(deadlineOverrun(camp, { today, completedMap: data.completedMap, completionDays: data.completionDates }), null);
});
