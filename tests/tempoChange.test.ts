import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CampSchedule, DailyPlan, ShiftEvent, StudyCamp } from '../src/types/index.ts';
import { createBackup, emptyData, parseBackup } from '../src/lib/persistence.ts';
import { withTempo } from '../src/lib/plannerOps.ts';
import { normalizeCamps } from '../src/lib/studyCamp.ts';
import { addDays } from '../src/utils/date.ts';
import { buildCampSchedule, createShiftEvent } from '../src/utils/roadmapEngine.ts';
import { layoutScenarios } from './fixtures/layoutScenarios.ts';
import { playlist, prefs, repeat } from './helpers.ts';

// "Tempoyu düzenle" on a started camp applies from today: the days before
// today keep exactly the layout they had (see `withTempo`).

const week = (): string[][] => [[], [], [], [], [], [], []];

/** The report's base camp: Mat 8×40, Fiz 6×50, Kim 5×30; 2 h, Sunday rest, 3 branches a day, from Monday 09-21. */
function baseCamp(overrides: Partial<CampSchedule> = {}): StudyCamp {
  return {
    id: 'camp-tyt',
    name: 'TYT',
    createdAt: '2026-09-21',
    branches: [playlist('mat', repeat(8, 40), 'Matematik'), playlist('fiz', repeat(6, 50), 'Fizik'), playlist('kim', repeat(5, 30), 'Kimya')],
    schedule: {
      ...prefs({ activeDays: [1, 2, 3, 4, 5, 6], restDays: [0], maxSubjectsPerDay: 3 }),
      mode: 'auto',
      targetEndDate: null,
      weekPlan: week(),
      ...overrides,
    },
    shiftEvents: [],
  };
}

const build = (camp: StudyCamp, completedMap: Record<string, boolean>, today: string) =>
  buildCampSchedule(camp, { completedMap, today }).plans;

const before = (plans: DailyPlan[], today: string) => plans.filter(plan => plan.date < today);

/** Ticks every task on the days before `today`. */
function tickedUntil(camp: StudyCamp, today: string, completedMap: Record<string, boolean> = {}): Record<string, boolean> {
  const next = { ...completedMap };
  for (const plan of before(build(camp, completedMap, today), today)) for (const item of plan.items) next[item.videoId] = true;
  return next;
}

const overdue = (plans: DailyPlan[], today: string) => before(plans, today).flatMap(plan => plan.items.filter(item => !item.completed).map(item => item.id));

/** Every branch's tasks appear in lesson order: walking the plan day by day, video numbers only go up. */
function assertLessonOrder(plans: DailyPlan[], label: string) {
  const last = new Map<string, number>();
  for (const plan of plans) {
    for (const item of plan.items) {
      const n = Number(item.videoId.split('-').pop());
      assert.ok(n > (last.get(item.playlistId) ?? 0), `${label}: ${item.id} on ${plan.date} comes after a later lesson of its branch`);
      last.set(item.playlistId, n);
    }
  }
}

const tempoVariants: { label: string; change: Partial<CampSchedule> }[] = [
  { label: 'more hours', change: { dailyStudyHours: 3 } },
  { label: 'fewer hours', change: { dailyStudyHours: 1.5 } },
  { label: 'other study days', change: { activeDays: [1, 3, 5], restDays: [0, 2, 4, 6] } },
  { label: 'one branch a day', change: { maxSubjectsPerDay: 1 } },
  { label: 'faster playback with practice', change: { playbackSpeed: 1.5, practiceMultiplier: 0.3 } },
  { label: 'a mock exam day', change: { activeDays: [1, 2, 3, 4, 5], restDays: [0], mockExamDays: [6] } },
  {
    label: 'a manual week',
    change: { mode: 'manual', weekPlan: [[], ['mat'], ['fiz', 'kim'], ['mat'], ['fiz', 'kim'], ['mat', 'fiz'], []], activeDays: [1, 2, 3, 4, 5], restDays: [0, 6] },
  },
];

test('(a) a tempo change never changes any day before today', () => {
  const today = '2026-09-25'; // Friday
  const histories: { label: string; events: ShiftEvent[]; ticks: Record<string, boolean> }[] = [
    { label: 'no shifts', events: [], ticks: { 'mat-1': true, 'fiz-1': true, 'kim-2': true } },
    {
      label: 'a red-card shift and a today shift',
      events: [
        { date: '2026-09-22', resumeDate: '2026-09-23', itemIds: ['mat-2', 'fiz-2', 'kim-2'], reason: 'exhausted' },
        { date: '2026-09-24', resumeDate: '2026-09-25', itemIds: ['mat-4'] },
      ],
      ticks: { 'mat-1': true, 'fiz-1': true, 'kim-1': true, 'mat-3': true },
    },
  ];
  for (const { label, events, ticks } of histories) {
    const camp = { ...baseCamp(), shiftEvents: events };
    const was = before(build(camp, ticks, today), today);
    for (const variant of tempoVariants) {
      const changed = withTempo(camp, { ...camp.schedule, ...variant.change }, today);
      assert.equal(changed.tempoHistory?.length, 1, `${label}, ${variant.label}: the old tempo is kept`);
      assert.deepEqual(before(build(changed, ticks, today), today), was, `${label}, ${variant.label}: past days unchanged`);

      // A second change on a later day keeps both earlier stretches.
      const later = addDays(today, 3);
      const wasLater = before(build(changed, ticks, later), later);
      const again = withTempo(changed, { ...changed.schedule, dailyStudyHours: 4 }, later);
      assert.equal(again.tempoHistory?.length, 2);
      assert.deepEqual(before(build(again, ticks, later), later), wasLater, `${label}, ${variant.label}: a second change keeps the days before it`);
    }
  }
});

test('(b) a plan on track up to today has no overdue task after raising or lowering daily hours', () => {
  const today = '2026-09-25';
  const camp = baseCamp();
  const ticks = tickedUntil(camp, today);
  assert.deepEqual(overdue(build(camp, ticks, today), today), [], 'on track before the change');
  for (const hours of [3, 1.5, 0.5, 6]) {
    const changed = withTempo(camp, { ...camp.schedule, dailyStudyHours: hours }, today);
    const plans = build(changed, ticks, today);
    assert.deepEqual(overdue(plans, today), [], `${hours} h: nothing overdue`);
    const todays = plans.find(plan => plan.date === today);
    assert.ok(todays && todays.items.some(item => !item.completed), `${hours} h: today holds open work, not only ticked tasks`);
    assert.ok(todays.totalMinutes <= hours * 60 || todays.items.length === 1, `${hours} h: today follows the new capacity`);
    assertLessonOrder(plans, `${hours} h`);
  }
});

test('(c) after a postponement and a tempo change every branch keeps its lesson order', () => {
  // Red card on Wednesday, Wednesday and Thursday ticked, tempo raised on Friday (report B-1b).
  const camp = baseCamp();
  const wednesday = '2026-09-23';
  const redCard = createShiftEvent(addDays(wednesday, -1), build(camp, { 'mat-1': true, 'fiz-1': true, 'kim-1': true }, wednesday), wednesday);
  assert.ok(redCard);
  const shifted: StudyCamp = { ...camp, shiftEvents: [redCard] };
  const friday = '2026-09-25';
  const ticks = tickedUntil(shifted, friday, { 'mat-1': true, 'fiz-1': true, 'kim-1': true });
  assert.deepEqual(overdue(build(shifted, ticks, friday), friday), []);

  for (const variant of tempoVariants) {
    const changed = withTempo(shifted, { ...shifted.schedule, ...variant.change }, friday);
    const plans = build(changed, ticks, friday);
    assertLessonOrder(plans, variant.label);
    assert.deepEqual(overdue(plans, friday), [], `${variant.label}: nothing overdue`);

    // Postponing again after the change, then ticking, keeps the order too.
    const saturday = addDays(friday, 1);
    const again = createShiftEvent(friday, build(changed, ticks, saturday), saturday);
    if (again) {
      const twice: StudyCamp = { ...changed, shiftEvents: [...changed.shiftEvents, again] };
      assertLessonOrder(build(twice, ticks, saturday), `${variant.label}, shifted again`);
    }
  }
});

test('a red-card postpone after a tempo change keeps today’s ticked task on today, within the new capacity', () => {
  const friday = '2026-09-25';
  const camp = baseCamp();
  // Everything before Friday is done except Thursday's Matematik lesson.
  const ticks = tickedUntil(camp, friday);
  const thursdayMat = build(camp, ticks, friday).find(plan => plan.date === '2026-09-24')!.items.find(item => item.playlistId === 'mat')!;
  delete ticks[thursdayMat.videoId];

  for (const hours of [3, 1.5]) {
    const changed = withTempo(camp, { ...camp.schedule, dailyStudyHours: hours }, friday);
    // The student ticks today's first non-Matematik task under the new tempo, then presses Ritmi güncelle.
    const todayTick = build(changed, ticks, friday).find(plan => plan.date === friday)!.items.find(item => item.playlistId !== 'mat')!;
    const ticked = { ...ticks, [todayTick.videoId]: true };
    const redCard = createShiftEvent('2026-09-24', build(changed, ticked, friday), friday);
    assert.ok(redCard);
    assert.deepEqual(redCard.keepOnResume, [todayTick.id], `${hours} h: today’s tick is frozen on today`);
    const shifted: StudyCamp = { ...changed, shiftEvents: [...changed.shiftEvents, redCard] };
    const plans = build(shifted, ticked, friday);
    const today = plans.find(plan => plan.date === friday)!;
    assert.equal(today.items[0].id, todayTick.id, `${hours} h: the ticked task stays first on today`);
    assert.ok(today.items.some(item => item.id === thursdayMat.id), `${hours} h: the carried lesson joins today`);
    assert.ok(today.totalMinutes <= hours * 60 + 1e-9, `${hours} h: carried work fills only what the new tempo leaves today`);
    assert.deepEqual(overdue(plans, friday), [], `${hours} h: nothing overdue`);
    const ids = (days: DailyPlan[]) => days.map(plan => [plan.date, plan.items.map(item => item.id)]);
    assert.deepEqual(
      ids(before(plans, friday)),
      ids(before(build(changed, ticked, friday), friday)).map(([date, items]) => [date, (items as string[]).filter(id => id !== thursdayMat.id)]),
      `${hours} h: past days keep their tasks, minus the carried one`
    );
    assertLessonOrder(plans, `${hours} h`);

    // A later tempo change leaves that red card's day as it was.
    const monday = '2026-09-28';
    const wasMonday = before(build(shifted, ticked, monday), monday);
    const again = withTempo(shifted, { ...shifted.schedule, dailyStudyHours: 4 }, monday);
    assert.deepEqual(before(build(again, ticked, monday), monday), wasMonday, `${hours} h: a later change keeps the red-card day`);
  }
});

test('(d) camps without tempo history lay out exactly as before tempo history existed', () => {
  const golden = JSON.parse(readFileSync(new URL('./fixtures/layout-before-tempo-history.json', import.meta.url), 'utf8')) as unknown[];
  assert.equal(golden.length, layoutScenarios.length);
  layoutScenarios.forEach((scenario, i) => {
    const result = buildCampSchedule(scenario.camp, { completedMap: scenario.completedMap, today: scenario.today });
    const now = JSON.parse(
      JSON.stringify({
        name: scenario.name,
        plans: result.plans,
        unscheduledItems: result.unscheduledItems,
        issues: result.issues,
        capacityMinutes: result.capacityMinutes,
      })
    );
    assert.deepEqual(now, golden[i], scenario.name);
  });
});

test('a camp that has not started takes the new tempo for its whole plan', () => {
  for (const today of ['2026-09-21', '2026-09-10']) {
    const camp = baseCamp();
    const changed = withTempo(camp, { ...camp.schedule, dailyStudyHours: 3 }, today);
    assert.equal(changed.tempoHistory, undefined, `start ${camp.schedule.startDate}, today ${today}: no history`);
    assert.equal(changed.schedule.dailyStudyHours, 3);
    const plans = build(changed, {}, today);
    assert.equal(plans[0].date, '2026-09-21');
    assert.ok(plans[0].totalMinutes > 120, 'the first day already has three hours');
  }
});

test('only real tempo changes are recorded, once per day', () => {
  const today = '2026-09-25';
  const camp = baseCamp();
  const dates = withTempo(camp, { ...camp.schedule, targetEndDate: '2026-10-30' }, today);
  assert.equal(dates.tempoHistory, undefined, 'a new target date alone is no tempo change');
  assert.equal(dates.schedule.targetEndDate, '2026-10-30');

  const first = withTempo(camp, { ...camp.schedule, dailyStudyHours: 3 }, today);
  const second = withTempo(first, { ...first.schedule, dailyStudyHours: 4 }, today);
  assert.deepEqual(second.tempoHistory, [{ until: today, schedule: camp.schedule }], 'the tempo replaced today keeps no stretch of its own');
  assert.equal(second.schedule.dailyStudyHours, 4);
});

test('tempo history survives a save and reload; camps without it stay without it', () => {
  const today = '2026-09-25';
  const camp = baseCamp();
  const changed = withTempo(withTempo(camp, { ...camp.schedule, dailyStudyHours: 3 }, today), { ...camp.schedule, dailyStudyHours: 1 }, '2026-09-29');
  const stored = JSON.parse(JSON.stringify([changed, { ...camp, id: 'camp-plain' }]));
  const [reloaded, plain] = normalizeCamps(stored, today).camps;
  assert.deepEqual(reloaded.tempoHistory, changed.tempoHistory);
  assert.deepEqual(build(reloaded, {}, '2026-10-01'), build(changed, {}, '2026-10-01'));
  assert.equal('tempoHistory' in plain, false);

  // Backups and cloud sync go through the same backup document.
  const restored = parseBackup(JSON.stringify(createBackup({ ...emptyData(), camps: [changed] }, today)), today);
  assert.ok(restored.ok);
  assert.deepEqual(restored.data.camps[0].tempoHistory, changed.tempoHistory);

  // Broken entries are skipped, the rest is sorted and kept.
  const messy = { ...stored[0], tempoHistory: [stored[0].tempoHistory[1], { until: 'dün', schedule: {} }, null, stored[0].tempoHistory[0]] };
  assert.deepEqual(normalizeCamps([messy], today).camps[0].tempoHistory, changed.tempoHistory);
});
