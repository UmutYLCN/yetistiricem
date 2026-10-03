import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CampSchedule, DailyPlan, StudyCamp } from '../src/types/index.ts';
import { DAILY_LIMIT_KEY, DEFAULT_DAILY_LIMIT, getDailyLimit, normalizeDailyLimit, saveDailyLimit } from '../src/lib/dailyLimit.ts';
import { campWithDailyHours, deadlineOverrun, hoursToMeetTarget, isIntense } from '../src/lib/deadlineOverrun.ts';
import { emptyData } from '../src/lib/persistence.ts';
import { addShiftEvent, removeShiftEvent, setCampSchedule } from '../src/lib/plannerOps.ts';
import { buildCampSchedule, createShiftEvent, dailyHoursForDeadline, planEndDate } from '../src/utils/roadmapEngine.ts';
import { layout, playlist, prefs, repeat } from './helpers.ts';

// The prompt after a postponement pushes a camp past its target date
// (`deadlineOverrun`), and the daily time it suggests (`hoursToMeetTarget`).

const week = (): string[][] => [[], [], [], [], [], [], []];

function camp(branches: StudyCamp['branches'], schedule: Partial<CampSchedule>): StudyCamp {
  return {
    id: 'camp-tyt',
    name: 'TYT',
    createdAt: '2026-09-01',
    branches,
    schedule: { ...prefs(), mode: 'auto', targetEndDate: null, weekPlan: week(), ...schedule },
    shiftEvents: [],
  };
}

/** The review's B-1c camp: started 09-01, 2 h every day, 80 h of work; on 10-01, 20 h remain and the target is 10-06. */
const startedCamp = () =>
  camp([playlist('mat', repeat(240, 10)), playlist('fiz', repeat(240, 10))], { startDate: '2026-09-01', targetEndDate: '2026-10-06' });
const START_TODAY = '2026-10-01';

/** The report's base camp: Mat 8×40, Fiz 6×50, Kim 5×30; 2 h, Sunday rest, 3 branches a day, from Monday 09-21. */
const baseCamp = (targetEndDate: string | null) =>
  camp([playlist('mat', repeat(8, 40)), playlist('fiz', repeat(6, 50)), playlist('kim', repeat(5, 30))], {
    activeDays: [1, 2, 3, 4, 5, 6],
    restDays: [0],
    maxSubjectsPerDay: 3,
    targetEndDate,
  });

/** Wednesday 09-23: Monday and Tuesday were missed and the red card ("Ritmi güncelle") carries them to today. */
const POSTPONE_TODAY = '2026-09-23';
function postponed(c: StudyCamp): StudyCamp {
  const event = createShiftEvent('2026-09-22', buildCampSchedule(c, { today: POSTPONE_TODAY }).plans, POSTPONE_TODAY);
  assert.ok(event);
  return { ...c, shiftEvents: [...c.shiftEvents, event] };
}

const before = (plans: DailyPlan[], today: string) => plans.filter(plan => plan.date < today);
const end = (c: StudyCamp, today: string) => planEndDate(buildCampSchedule(c, { today }).plans);

test('suggestion on a started camp counts only the days from today and really meets the target', () => {
  const c = startedCamp();
  assert.equal(end(c, START_TODAY), '2026-10-10');

  const hours = hoursToMeetTarget(c, { today: START_TODAY });
  // 20 h over the 6 days 10-01..10-06 need 3 h 20 min a day: the next half hour is 3.5.
  assert.equal(hours, 3.5);
  const applied = campWithDailyHours(c, hours, START_TODAY);
  assert.ok(end(applied, START_TODAY)! <= '2026-10-06');
  assert.ok(end(campWithDailyHours(c, hours - 0.5, START_TODAY), START_TODAY)! > '2026-10-06', 'the smallest half-hour step');
  // Past days keep their layout, so a plan on track up to today stays on track.
  assert.deepEqual(layout(before(buildCampSchedule(applied, { today: START_TODAY }).plans, START_TODAY)), layout(before(buildCampSchedule(c, { today: START_TODAY }).plans, START_TODAY)));

  // The old whole-plan search counted the past days' extra capacity and under-suggested (finding B-1c).
  const wholePlan = dailyHoursForDeadline(c, { today: START_TODAY });
  assert.ok(wholePlan !== null && wholePlan < hours);
  assert.ok(end(campWithDailyHours(c, wholePlan, START_TODAY), START_TODAY)! > '2026-10-06', 'applied from today it misses the target');
});

test('the prompt shows only when the stored plan ends after the target', () => {
  // On track before the postponement: the plan ends on 09-28.
  assert.equal(end(baseCamp('2026-09-28'), POSTPONE_TODAY), '2026-09-28');
  assert.equal(deadlineOverrun(baseCamp('2026-09-28'), { today: POSTPONE_TODAY }), null);

  const late = postponed(baseCamp('2026-09-28'));
  const overrun = deadlineOverrun(late, { today: POSTPONE_TODAY });
  assert.ok(overrun);
  assert.equal(overrun.targetEndDate, '2026-09-28');
  assert.equal(overrun.finishDate, '2026-09-30');
  assert.equal(overrun.currentHours, 2);
  assert.equal(overrun.targetPassed, false);
  assert.deepEqual(overrun.suggestion, { hours: 3, finishDate: end(campWithDailyHours(late, 3, POSTPONE_TODAY), POSTPONE_TODAY), intense: false });
  assert.ok(overrun.suggestion.finishDate <= '2026-09-28');

  // Finishing on the target day itself is on time; no target, no prompt.
  assert.equal(deadlineOverrun(postponed(baseCamp('2026-09-30')), { today: POSTPONE_TODAY }), null);
  assert.equal(deadlineOverrun(postponed(baseCamp(null)), { today: POSTPONE_TODAY }), null);
});

test('a suggestion above 1.5× the current daily time or above the ceiling is flagged', () => {
  assert.equal(isIntense(3, 2, 8), false, 'exactly 1.5× is fine');
  assert.equal(isIntense(3.5, 2, 8), true);
  assert.equal(isIntense(8.5, 6, 8), true, 'above the ceiling');
  assert.equal(isIntense(8, 6, 8), false);

  const overrun = deadlineOverrun(startedCamp(), { today: START_TODAY });
  assert.ok(overrun?.suggestion);
  assert.equal(overrun.suggestion.hours, 3.5);
  assert.equal(overrun.suggestion.intense, true);
});

test('no hour value above the ceiling is offered; when even the ceiling misses, none is', () => {
  const c = startedCamp();
  const capped = deadlineOverrun(c, { today: START_TODAY, limit: 3 });
  assert.ok(capped);
  assert.equal(capped.limit, 3);
  assert.equal(capped.suggestion, null);
  assert.equal(capped.targetPassed, false);
  assert.equal(hoursToMeetTarget(c, { today: START_TODAY, maxHours: 3 }), null);

  assert.equal(deadlineOverrun(c, { today: START_TODAY, limit: 3.5 })?.suggestion?.hours, 3.5);
  // A current time already above the ceiling has nothing to raise to.
  const busy = camp(c.branches, { startDate: '2026-09-01', dailyStudyHours: 9, targetEndDate: '2026-09-05' });
  const overBusy = deadlineOverrun(busy, { today: '2026-09-01', limit: 8 });
  assert.ok(overBusy);
  assert.equal(overBusy.suggestion, null);
});

test('a target already passed gets no daily-time suggestion', () => {
  const overrun = deadlineOverrun(startedCamp(), { today: '2026-10-07' });
  assert.ok(overrun);
  assert.equal(overrun.targetPassed, true);
  assert.equal(overrun.suggestion, null);
});

test('applying the suggestion goes through the from-today tempo path and the postponement can still be undone', () => {
  const late = postponed(baseCamp('2026-09-28'));
  const event = late.shiftEvents[0];
  const data = addShiftEvent({ ...emptyData(), camps: [baseCamp('2026-09-28')], activeCampId: 'camp-tyt' }, 'camp-tyt', event);
  const overrun = deadlineOverrun(data.camps[0], { today: POSTPONE_TODAY });
  assert.ok(overrun?.suggestion);

  const raised = setCampSchedule(data, 'camp-tyt', { ...data.camps[0].schedule, dailyStudyHours: overrun.suggestion.hours }, POSTPONE_TODAY);
  const stored = raised.camps[0];
  assert.deepEqual(stored, campWithDailyHours(data.camps[0], overrun.suggestion.hours, POSTPONE_TODAY));
  assert.deepEqual(stored.tempoHistory, [{ until: POSTPONE_TODAY, schedule: data.camps[0].schedule }]);
  assert.equal(end(stored, POSTPONE_TODAY), overrun.suggestion.finishDate);
  assert.equal(deadlineOverrun(stored, { today: POSTPONE_TODAY }), null, 'back on time');

  // The toast's "Geri al" still finds the stored event after the tempo change.
  const undone = removeShiftEvent(raised, 'camp-tyt', event);
  assert.deepEqual(undone.camps[0].shiftEvents, []);
  assert.equal(undone.camps[0].schedule.dailyStudyHours, overrun.suggestion.hours);
});

test('moving the target date changes only the date and records no tempo', () => {
  const late = postponed(baseCamp('2026-09-28'));
  const data = { ...emptyData(), camps: [late], activeCampId: late.id };
  const moved = setCampSchedule(data, late.id, { ...late.schedule, targetEndDate: '2026-09-30' }, POSTPONE_TODAY).camps[0];
  assert.equal(moved.tempoHistory, undefined);
  assert.deepEqual(layout(buildCampSchedule(moved, { today: POSTPONE_TODAY }).plans), layout(buildCampSchedule(late, { today: POSTPONE_TODAY }).plans));
  assert.equal(deadlineOverrun(moved, { today: POSTPONE_TODAY }), null);
});

test('daily ceiling: half-hour steps within 0.5–16 h, 8 h by default, kept in yt_daily_limit', () => {
  assert.equal(DEFAULT_DAILY_LIMIT, 8);
  assert.equal(normalizeDailyLimit(null), 8);
  assert.equal(normalizeDailyLimit('abc'), 8);
  assert.equal(normalizeDailyLimit('6.5'), 6.5);
  assert.equal(normalizeDailyLimit(6.3), 6.5);
  assert.equal(normalizeDailyLimit(0), 0.5);
  assert.equal(normalizeDailyLimit(40), 16);

  assert.equal(getDailyLimit(), 8, 'no localStorage here: the default');
  const store = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    },
  });
  try {
    assert.equal(saveDailyLimit(6), 6);
    assert.equal(store.get(DAILY_LIMIT_KEY), '6');
    assert.equal(getDailyLimit(), 6);
    assert.equal(saveDailyLimit(8), 8);
    assert.equal(store.has(DAILY_LIMIT_KEY), false, 'the default needs no key');
    assert.equal(getDailyLimit(), 8);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
