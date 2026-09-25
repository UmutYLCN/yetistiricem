import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DailyPlan, StudyCamp } from '../src/types/index.ts';
import type { PlannerData } from '../src/lib/persistence.ts';
import {
  buildAllCampsPlan,
  campIdOf,
  campLabelsOf,
  campOverview,
  campsWithPlans,
  everyCampOff,
  mergeDailyPlans,
  resolveCampScope,
  shiftEventsByCamp,
  summarizeAllCampsDay,
} from '../src/lib/allCamps.ts';
import * as ops from '../src/lib/plannerOps.ts';
import { createStudyCamp, scheduleFromAuto, scheduleFromManual } from '../src/lib/studyCamp.ts';
import { dayOfWeek } from '../src/utils/date.ts';
import { buildCampSchedule } from '../src/utils/roadmapEngine.ts';
import { dateById, deepFreeze, layout, playlist, repeat } from './helpers.ts';

const TODAY = '2026-09-23'; // Wednesday

// Two camps with different rhythms, capacities and start dates:
// - TYT (auto): Sun–Thu study, Fri rest, Sat mock exam; 3 h a day; from Mon 21 Sep.
// - AYT (manual): Mon Geometri, Wed Kimya, Fri both; Sun mock exam; other days rest; 2 h a day; from Mon 28 Sep.
function twoCamps(): { data: PlannerData; tyt: StudyCamp; ayt: StudyCamp } {
  const tyt = createStudyCamp({
    name: 'TYT',
    branches: [playlist('mat', repeat(40, 40), 'Matematik'), playlist('fiz', repeat(12, 50), 'Fizik')],
    schedule: scheduleFromAuto(
      { startDate: '2026-09-21', targetEndDate: null, playbackSpeed: 1, practiceMultiplier: 0 },
      { preset: 'balanced', hours: 3, perDay: 2, days: [0, 1, 2, 3, 4], mockDays: [6] }
    ),
  });
  const ayt = createStudyCamp({
    name: 'AYT',
    branches: [playlist('geo', repeat(8, 45), 'Geometri'), playlist('kim', repeat(6, 30), 'Kimya')],
    schedule: scheduleFromManual(
      { startDate: '2026-09-28', targetEndDate: '2026-10-20', playbackSpeed: 1.5, practiceMultiplier: 0.2 },
      {
        hours: 2,
        dayTypes: ['mock', 'study', 'rest', 'study', 'rest', 'study', 'rest'],
        weekPlan: [[], ['geo'], [], ['kim'], [], ['geo', 'kim'], []],
      },
      { maxSubjectsPerDay: 2 }
    ),
  });
  const data: PlannerData = { camps: [tyt, ayt], activeCampId: tyt.id, completedMap: { 'mat-1': true, 'geo-1': true }, dayNotes: {} };
  return { data, tyt, ayt };
}

const plansOf = (camp: StudyCamp, data: PlannerData, today = TODAY) =>
  buildCampSchedule(camp, { completedMap: data.completedMap, today }).plans;

const sources = (data: PlannerData, today = TODAY) => data.camps.map(camp => ({ campId: camp.id, plans: plansOf(camp, data, today) }));

const itemsOn = (plans: DailyPlan[], date: string) => plans.find(p => p.date === date)?.items.map(i => i.id) ?? [];

test('merging keeps every task on the day its own camp gave it, with its camp', () => {
  const { data, tyt, ayt } = twoCamps();
  const tytPlans = plansOf(tyt, data);
  const aytPlans = plansOf(ayt, data);
  const merged = mergeDailyPlans(sources(data));

  assert.deepEqual(merged.map(p => p.date), [...new Set([...tytPlans, ...aytPlans].map(p => p.date))].sort(), 'one day per date, in order');
  const mergedDates = new Map(merged.flatMap(p => p.items.map(item => [`${item.campId}/${item.id}`, p.date] as const)));
  for (const [camp, plans] of [[tyt, tytPlans], [ayt, aytPlans]] as const) {
    for (const [id, date] of dateById(plans)) assert.equal(mergedDates.get(`${camp.id}/${id}`), date, `${id} stays on ${date}`);
  }
  assert.equal(mergedDates.size, dateById(tytPlans).size + dateById(aytPlans).size, 'no task is added, dropped or repeated');

  const tytIds = new Set(tyt.branches.flatMap(b => b.videos.map(v => v.id)));
  for (const item of merged.flatMap(p => p.items)) {
    assert.equal(item.campId, tytIds.has(item.id) ? tyt.id : ayt.id, `${item.id} is labelled with its own camp`);
    assert.equal(campIdOf(item), item.campId);
  }
  assert.equal(campIdOf(tytPlans[0].items[0]), null, 'a single-camp task carries no camp');

  // Before AYT starts, only TYT takes part.
  const early = merged.find(p => p.date === '2026-09-22')!;
  assert.deepEqual(early.camps.map(c => c.campId), [tyt.id]);
  assert.ok(early.items.every(i => i.campId === tyt.id));
});

test('each camp keeps its own daily capacity; the merged day adds them up, it does not share them', () => {
  const { data, tyt, ayt } = twoCamps();
  const merged = mergeDailyPlans(sources(data));
  const capacity = new Map([
    [tyt.id, 3 * 60],
    [ayt.id, 2 * 60],
  ]);
  let busiest = 0;
  for (const day of merged) {
    for (const part of day.camps) {
      const minutes = part.items.reduce((acc, i) => acc + i.effectiveMinutes, 0);
      assert.ok(minutes <= capacity.get(part.campId)! + 1e-9, `${day.date}: ${part.campId} stays within its own day`);
      assert.equal(part.plan.totalMinutes, minutes);
    }
    assert.ok(Math.abs(day.totalMinutes - day.camps.reduce((acc, c) => acc + c.plan.totalMinutes, 0)) < 1e-9);
    busiest = Math.max(busiest, day.totalMinutes);
  }
  assert.ok(busiest > 3 * 60, 'a shared day can hold more than either camp alone');
  // AYT's effective minutes follow its own speed and practice share (45 / 1.5 * 1.2 = 36).
  const geo = merged.flatMap(p => p.items).find(i => i.id === 'geo-2')!;
  assert.equal(geo.effectiveMinutes, 36);
});

test('rest, mock exam and study days: study tasks stay, other camps show their own day type', () => {
  const { data, tyt, ayt } = twoCamps();
  const plan = buildAllCampsPlan(data.camps, { completedMap: data.completedMap, today: TODAY });
  const prefs = plan.camps.map(s => s.result.preferences);
  const day = (date: string) => summarizeAllCampsDay(date, plan.index, prefs);
  const kinds = (date: string) => Object.fromEntries(day(date).camps!.map(c => [c.campId === tyt.id ? 'tyt' : 'ayt', c.kind]));

  // Sunday 4 Oct: TYT studies, AYT has a mock exam.
  const sunday = day('2026-10-04');
  assert.equal(dayOfWeek(sunday.date), 0);
  assert.equal(sunday.kind, 'study');
  assert.deepEqual(kinds(sunday.date), { tyt: 'study', ayt: 'mock' });
  assert.ok(sunday.total > 0 && sunday.plan!.items.every(i => campIdOf(i) === tyt.id), 'only TYT tasks');
  assert.equal(sunday.plan!.isMockExamDay, false);

  // Tuesday 29 Sep: TYT studies, AYT rests.
  assert.equal(day('2026-09-29').kind, 'study');
  assert.deepEqual(kinds('2026-09-29'), { tyt: 'study', ayt: 'rest' });

  // Friday 2 Oct: TYT rests, AYT studies.
  const friday = day('2026-10-02');
  assert.equal(friday.kind, 'study');
  assert.deepEqual(kinds(friday.date), { tyt: 'rest', ayt: 'study' });
  assert.ok(friday.total > 0 && friday.plan!.items.every(i => campIdOf(i) === ayt.id), 'only AYT tasks');

  // Saturday 3 Oct: TYT mock exam, AYT rests: nobody studies, so the whole day is empty.
  const saturday = day('2026-10-03');
  assert.equal(saturday.kind, 'mock');
  assert.equal(saturday.total, 0);
  assert.deepEqual(kinds(saturday.date), { tyt: 'mock', ayt: 'rest' });
  assert.equal(saturday.plan!.isMockExamDay, true);
  assert.equal(saturday.plan!.isRestDay, false);
});

test('a manual camp’s free day next to a resting camp is not an empty rest day', () => {
  // TYT rests on Fridays; AYT studies Kimya on Fridays, which runs out long before Geometri (Mon/Wed).
  const { tyt } = twoCamps();
  const longTyt = { ...tyt, branches: [playlist('mat', repeat(80, 40), 'Matematik')] };
  const ayt = createStudyCamp({
    name: 'AYT',
    branches: [playlist('geo', repeat(20, 45), 'Geometri'), playlist('kim', repeat(6, 30), 'Kimya')],
    schedule: scheduleFromManual(
      { startDate: '2026-09-28', targetEndDate: null, playbackSpeed: 1.5, practiceMultiplier: 0.2 },
      { hours: 2, dayTypes: ['rest', 'study', 'rest', 'study', 'rest', 'study', 'rest'], weekPlan: [[], ['geo'], [], ['geo'], [], ['kim'], []] },
      { maxSubjectsPerDay: 2 }
    ),
  });
  const plan = buildAllCampsPlan([longTyt, ayt], { completedMap: {}, today: TODAY });
  const freeDay = plan.plans.find(p => p.camps.some(c => c.campId === ayt.id && c.plan.isFreeDay))!;
  assert.ok(freeDay, 'AYT has a free Friday while Geometri goes on');
  assert.equal(dayOfWeek(freeDay.date), 5);
  assert.deepEqual(
    freeDay.camps.map(c => [c.campId, c.plan.isRestDay, c.plan.isFreeDay === true]),
    [
      [tyt.id, true, false],
      [ayt.id, false, true],
    ]
  );

  const day = summarizeAllCampsDay(freeDay.date, plan.index, plan.camps.map(s => s.result.preferences));
  assert.equal(day.total, 0);
  assert.equal(day.kind, 'study', 'not a rest day: AYT is on a study weekday');
  assert.equal(day.plan!.isRestDay, false);
  assert.equal(day.plan!.isFreeDay, true);
  assert.deepEqual(
    day.camps!.map(c => [c.kind, c.free]),
    [
      ['rest', false],
      ['study', true],
    ]
  );
  assert.equal(everyCampOff(day.camps!), false, 'each camp’s day type is listed instead of a full rest state');

  // Only when every camp is off does the day get the full empty state.
  assert.equal(everyCampOff([{ kind: 'rest' }, { kind: 'mock' }]), true);
  assert.equal(everyCampOff([{ kind: 'rest' }, { kind: 'rest' }]), true);
  assert.equal(everyCampOff([{ kind: 'mock' }, { kind: 'study' }]), false);
});

test('merged day types: every camp off is a rest day, free and shifted days stay study days', () => {
  const plan = (date: string, flags: Partial<DailyPlan>, ids: string[] = []): DailyPlan => ({
    date,
    dayName: 'x',
    isToday: false,
    isPast: false,
    isRestDay: false,
    isMockExamDay: false,
    items: ids.map(id => ({
      id,
      videoId: id,
      playlistId: 'p',
      subject: 'S',
      title: id,
      durationMinutes: 30,
      effectiveMinutes: 30,
      completed: false,
      videoUrl: '',
    })),
    totalMinutes: ids.length * 30,
    isAllCompleted: false,
    ...flags,
  });
  const merge = (a: DailyPlan, b: DailyPlan) =>
    mergeDailyPlans([
      { campId: 'a', plans: [a] },
      { campId: 'b', plans: [b] },
    ])[0];

  const rest = merge(plan('2026-10-05', { isRestDay: true }), plan('2026-10-05', { isRestDay: true }));
  assert.equal(rest.isRestDay, true);
  assert.equal(rest.isMockExamDay, false);

  const free = merge(plan('2026-10-05', { isFreeDay: true }), plan('2026-10-05', { isRestDay: true }));
  assert.equal(free.isRestDay, false);
  assert.equal(free.isFreeDay, true, 'the only studying camp has nothing left that weekday');

  const shifted = merge(plan('2026-10-05', {}), plan('2026-10-05', { isFreeDay: true }));
  assert.equal(shifted.isFreeDay, undefined, 'a shifted-away study day is not a free day');

  const busy = merge(plan('2026-10-05', { isMockExamDay: true }), plan('2026-10-05', {}, ['x1', 'x2']));
  assert.equal(busy.isMockExamDay, false);
  assert.deepEqual(
    busy.items.map(i => [i.campId, i.id]),
    [
      ['b', 'x1'],
      ['b', 'x2'],
    ]
  );
  assert.equal(busy.totalMinutes, 60);
});

test('totals, stats and daily goals add up over the camps', () => {
  const { data, tyt, ayt } = twoCamps();
  const plan = buildAllCampsPlan(data.camps, { completedMap: data.completedMap, today: TODAY });
  assert.equal(plan.stats.totalVideos, 52 + 14);
  assert.equal(plan.stats.completedVideos, 2);

  const tytPlans = plansOf(tyt, data);
  const aytPlans = plansOf(ayt, data);
  const open = (plans: DailyPlan[]) => plans.flatMap(p => p.items).filter(i => !i.completed);
  const remaining = [...open(tytPlans), ...open(aytPlans)].reduce((acc, i) => acc + i.effectiveMinutes, 0);
  assert.ok(Math.abs(plan.stats.totalMinutes - remaining) < 1e-9);
  const lastOpen = (plans: DailyPlan[]) => plans.filter(p => p.items.some(i => !i.completed)).at(-1)!.date;
  assert.equal(plan.stats.estimatedFinishDate, [lastOpen(tytPlans), lastOpen(aytPlans)].sort().at(-1));

  const day = summarizeAllCampsDay('2026-09-28', plan.index, plan.camps.map(s => s.result.preferences));
  assert.equal(day.total, day.camps!.reduce((acc, c) => acc + c.total, 0));
  assert.equal(day.done, day.camps!.reduce((acc, c) => acc + c.done, 0));
  assert.ok(Math.abs(day.minutes - day.camps!.reduce((acc, c) => acc + c.minutes, 0)) < 1e-9);
  assert.equal(day.done, 1, 'geo-1 is done');
  assert.equal(day.doneMinutes, 36);

  const labels = campLabelsOf(plan.camps);
  assert.deepEqual([...labels.values()].map(l => [l.name, l.dailyMinutes, l.playbackSpeed]), [
    ['TYT', 180, 1],
    ['AYT', 120, 1.5],
  ]);

  const overview = campOverview(plan.camps[1], data.completedMap);
  assert.equal(overview.stats.totalVideos, 14);
  assert.equal(overview.deadline?.kind === 'on-track' || overview.deadline?.kind === 'late', true, 'AYT is measured against its own target');
  assert.equal(campOverview(plan.camps[0], data.completedMap).deadline?.kind, 'none', 'TYT has no target');
});

test('ticking tasks in the combined view moves nothing', () => {
  const { data } = twoCamps();
  const before = mergeDailyPlans(sources(data));
  const firstDay = before.find(p => p.items.length > 0 && p.camps.length > 1)!;
  const ticked = { ...data, completedMap: { ...data.completedMap, ...Object.fromEntries(firstDay.items.map(i => [i.videoId, true])) } };
  const after = mergeDailyPlans(sources(ticked));

  const shape = (plans: DailyPlan[]) => plans.map(p => ({ ...layout([p])[0], items: p.items.map(i => i.id) }));
  assert.deepEqual(shape(after), shape(before));
  const done = after.find(p => p.date === firstDay.date)!;
  assert.ok(done.items.every(i => i.completed));
  assert.equal(done.isAllCompleted, true);
});

test('shifting in the combined view writes each camp its own event and leaves the other camps alone', () => {
  const { data, tyt, ayt } = twoCamps();
  const today = '2026-09-30'; // Wednesday; TYT has open tasks since 21 Sep, AYT since 28 Sep

  // Only TYT has open work before AYT starts.
  const early = shiftEventsByCamp(sources(data, today), '2026-09-25', today);
  assert.deepEqual(early.map(s => s.campId), [tyt.id]);
  const tytVideoIds = new Set(tyt.branches.flatMap(b => b.videos.map(v => v.id)));
  assert.ok(early[0].event.itemIds.every(id => tytVideoIds.has(id)));

  const frozen = deepFreeze(data);
  const onlyTyt = ops.addShiftEvents(frozen, early);
  assert.equal(onlyTyt.camps[1], frozen.camps[1], 'AYT is not even copied');
  assert.deepEqual(layout(plansOf(onlyTyt.camps[1], onlyTyt, today)), layout(plansOf(ayt, data, today)), 'AYT’s plan does not move');

  // Both camps have open work up to yesterday: one event each, with their own tasks only.
  const both = shiftEventsByCamp(sources(data, today), '2026-09-29', today);
  assert.deepEqual(both.map(s => s.campId), [tyt.id, ayt.id]);
  const aytVideoIds = new Set(ayt.branches.flatMap(b => b.videos.map(v => v.id)));
  assert.ok(both[0].event.itemIds.every(id => tytVideoIds.has(id)));
  assert.ok(both[1].event.itemIds.every(id => aytVideoIds.has(id)));
  assert.ok(both.every(s => s.event.resumeDate === '2026-10-01'));

  const shifted = ops.addShiftEvents(frozen, both);
  assert.deepEqual(shifted.camps[0].shiftEvents, [both[0].event]);
  assert.deepEqual(shifted.camps[1].shiftEvents, [both[1].event]);
  // Each camp replans with its own rules: same as shifting it alone.
  assert.deepEqual(
    layout(plansOf(shifted.camps[1], shifted, today)),
    layout(buildCampSchedule({ ...ayt, shiftEvents: [both[1].event] }, { completedMap: data.completedMap, today }).plans)
  );
  const aytAfter = plansOf(shifted.camps[1], shifted, today);
  for (const p of aytAfter) {
    if (p.items.length > 0) assert.ok([1, 3, 5].includes(dayOfWeek(p.date)), `${p.date}: AYT still studies only on its own weekdays`);
  }
  assert.deepEqual(itemsOn(aytAfter, '2026-09-30'), itemsOn(plansOf(ayt, data, today), '2026-09-30'), 'today stays as it was');

  // Undo removes both events.
  assert.deepEqual(ops.removeShiftEvents(shifted, both).camps.map(c => c.shiftEvents), [[], []]);
  assert.deepEqual(shiftEventsByCamp(sources(data, today), '2026-09-20', today), [], 'nothing to carry, no event');
});

test('the view scope: all camps by default from two camps, a camp choice sticks, fewer camps fall back', () => {
  assert.equal(resolveCampScope(0, null), 'camp');
  assert.equal(resolveCampScope(1, null), 'camp');
  assert.equal(resolveCampScope(1, 'all'), 'camp', 'nothing to combine with one camp');
  assert.equal(resolveCampScope(2, null), 'all', 'no choice yet: combined');
  assert.equal(resolveCampScope(3, 'all'), 'all');
  assert.equal(resolveCampScope(2, 'camp'), 'camp', 'a single-camp choice is kept');

  const { data, tyt, ayt } = twoCamps();
  const empty = createStudyCamp({ name: 'Boş', branches: [], schedule: tyt.schedule });
  const noVideos = createStudyCamp({ name: 'Videosuz', branches: [playlist('bos', [])], schedule: tyt.schedule });
  assert.deepEqual(campsWithPlans([tyt, empty, ayt, noVideos]).map(c => c.name), ['TYT', 'AYT']);
  const plan = buildAllCampsPlan([empty, noVideos], { completedMap: {}, today: TODAY });
  assert.deepEqual([plan.camps, plan.plans, plan.stats.totalVideos], [[], [], 0]);

  // Deleting down to one camp leaves a real open camp and a one-camp view.
  const left = ops.removeCamp(data, tyt.id);
  assert.equal(left.activeCampId, ayt.id);
  assert.equal(resolveCampScope(left.camps.length, 'all'), 'camp');
});
