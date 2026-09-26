import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ShiftEvent, StudyCamp, SubjectPlaylist } from '../src/types/index.ts';
import type { CompletionDates, PlannerData } from '../src/lib/persistence.ts';
import {
  PROGRESS_KEYS, createBackup, loadPlanner, parseBackup,
} from '../src/lib/persistence.ts';
import * as ops from '../src/lib/plannerOps.ts';
import type { InsightSource } from '../src/lib/insights.ts';
import {
  activityByDay, analyzePostpones, buildHeatmap, commitmentScore, computeStreak, studyDaysOf, undatedCompletions,
} from '../src/lib/insights.ts';
import { formatPercentShare } from '../src/lib/format.ts';
import { isCriticallyPostponed, microTipFor, REASON_COPY } from '../src/lib/postpone.ts';
import { POSTPONE_REASONS, normalizeShiftEvents } from '../src/utils/storage.ts';
import { buildCampSchedule } from '../src/utils/roadmapEngine.ts';
import { todayKey } from '../src/utils/date.ts';
import { playlist, prefs, repeat } from './helpers.ts';

// Two videos a day, every day: 21 Sep holds mat-1 and fiz-1, 22 Sep mat-2 and fiz-2, ...
function camp(branches: SubjectPlaylist[], overrides: Partial<StudyCamp> = {}): StudyCamp {
  return {
    id: 'tyt',
    name: 'TYT',
    createdAt: '2026-09-01',
    branches,
    schedule: { ...prefs({ dailyStudyHours: 2 }), mode: 'auto', targetEndDate: null, weekPlan: [[], [], [], [], [], [], []] },
    shiftEvents: [],
    ...overrides,
  };
}

const mat = playlist('mat', repeat(8, 60), 'Matematik');
const fiz = playlist('fiz', repeat(8, 60), 'Fizik');

function source(c: StudyCamp, completedMap: Record<string, boolean>, today: string): InsightSource {
  return { camp: c, result: buildCampSchedule(c, { completedMap, today }) };
}

test('shift events keep a known reason, a trimmed note and the branch-added origin', () => {
  const base = { date: '2026-09-21', resumeDate: '2026-09-22' };
  const events = normalizeShiftEvents([
    { ...base, itemIds: ['a'], reason: 'difficult', note: '  Türev zor geldi  ' },
    { ...base, itemIds: ['b'], reason: 'bored', note: 5, origin: 'someone' },
    { ...base, itemIds: ['c'], origin: 'branch-added', note: 'x'.repeat(400) },
    { ...base, itemIds: ['d'], note: '   ' },
  ]);
  assert.deepEqual(events[0], { ...base, itemIds: ['a'], reason: 'difficult', note: 'Türev zor geldi' });
  assert.deepEqual(events[1], { ...base, itemIds: ['b'] }, 'unknown reason and origin are left out');
  assert.equal(events[2].origin, 'branch-added');
  assert.equal(events[2].note?.length, 280);
  assert.deepEqual(events[3], { ...base, itemIds: ['d'] });
});

test('every reason has copy and a micro intervention', () => {
  for (const reason of POSTPONE_REASONS) {
    assert.ok(REASON_COPY[reason].label && REASON_COPY[reason].hint && REASON_COPY[reason].phrase);
    const tip = microTipFor(reason);
    assert.ok(tip.title && tip.body);
  }
  assert.match(microTipFor('difficult').body, /ilk 5 dakikasını/);
});

test('a task counts the user shifts that carried it; app-made events and undone shifts do not count', () => {
  const e1: ShiftEvent = { date: '2026-09-22', resumeDate: '2026-09-23', itemIds: ['mat-2'], reason: 'difficult' };
  const e2: ShiftEvent = { date: '2026-09-23', resumeDate: '2026-09-24', itemIds: ['mat-2', 'fiz-3'], reason: 'distraction' };
  const e3: ShiftEvent = { date: '2026-09-24', resumeDate: '2026-09-25', itemIds: ['mat-2'] };
  const added: ShiftEvent = { date: '2026-09-24', resumeDate: '2026-09-25', itemIds: ['mat-2', 'fiz-4'], origin: 'branch-added' };
  const items = (events: ShiftEvent[], completedMap: Record<string, boolean> = {}) =>
    new Map(
      buildCampSchedule(camp([mat, fiz], { shiftEvents: events }), { completedMap, today: '2026-09-24' })
        .plans.flatMap(p => p.items)
        .map(i => [i.id, i] as const)
    );

  const after = items([e1, e2, e3, added]);
  assert.equal(after.get('mat-2')?.postponeCount, 3);
  assert.equal(after.get('fiz-3')?.postponeCount, 1);
  assert.equal(after.get('fiz-4')?.postponeCount, undefined, 'branch-added is not a postponement');
  assert.equal('postponeCount' in after.get('mat-1')!, false);
  assert.ok(isCriticallyPostponed(after.get('mat-2')!));
  assert.ok(!isCriticallyPostponed(after.get('fiz-3')!));
  assert.ok(!isCriticallyPostponed(items([e1, e2, e3], { 'mat-2': true }).get('mat-2')!), 'a done task is no longer critical');
  assert.equal(items([e1, e2]).get('mat-2')?.postponeCount, 2, 'undoing a shift lowers the count');
});

test('a tick records its day, an untick clears it, and removed videos drop their dates', () => {
  const c = camp([mat, fiz]);
  const data: PlannerData = {
    camps: [c],
    activeCampId: c.id,
    completedMap: {},
    completionDates: { since: '2026-09-21', dates: {} },
    focusSessions: [],
    playlistSync: { lastAttempt: null, lastFailure: null, branches: {} },
    dayNotes: {},
  };
  const ticked = ops.setCompleted(data, 'mat-1', true, '2026-09-22');
  assert.deepEqual(ticked.completedMap, { 'mat-1': true });
  assert.deepEqual(ticked.completionDates, { since: '2026-09-21', dates: { 'mat-1': '2026-09-22' } });
  assert.equal(ops.setCompleted(ticked, 'mat-1', true, '2026-09-25'), ticked, 'a done task keeps its first day');
  const unticked = ops.setCompleted(ticked, 'mat-1', false, '2026-09-22');
  assert.deepEqual(unticked.completedMap, {});
  assert.deepEqual(unticked.completionDates.dates, {});

  const both = ops.setCompleted(ops.setCompleted(data, 'mat-1', true, '2026-09-22'), 'fiz-1', true, '2026-09-22');
  const removed = ops.removeBranch(both, c.id, 'fiz');
  assert.deepEqual(removed.completionDates.dates, { 'mat-1': '2026-09-22' });
});

test('daily activity uses recorded days only, and the heatmap scales days against the busiest one', () => {
  const c = camp([mat, fiz]);
  const completedMap = { 'mat-1': true, 'fiz-1': true, 'mat-2': true };
  const completion: CompletionDates = { since: '2026-09-21', dates: { 'mat-1': '2026-09-21', 'fiz-1': '2026-09-21', 'mat-3': '2026-09-22' } };
  const sources = [source(c, completedMap, '2026-09-24')];
  const activity = activityByDay(sources, completedMap, completion);
  assert.deepEqual([...activity], [['2026-09-21', { count: 2, minutes: 120 }]], 'mat-3 is not done; mat-2 has no day');
  assert.equal(undatedCompletions(sources, completedMap, completion), 1);

  activity.set('2026-09-23', { count: 1, minutes: 30 });
  const map = buildHeatmap(activity, '2026-09-24', 2);
  assert.equal(map.weeks.length, 2);
  assert.equal(map.weeks[0][0].date, '2026-09-14', 'columns start on Monday');
  assert.equal(map.weeks[1][0].level, 4);
  assert.equal(map.weeks[1][2].level, 1);
  assert.equal(map.weeks[1][1].level, 0);
  assert.deepEqual(
    map.weeks[1].slice(4).map(cell => cell.future),
    [true, true, true],
    'the rest of this week is in the future'
  );
  assert.deepEqual({ activeDays: map.activeDays, videos: map.videos, minutes: map.minutes }, { activeDays: 2, videos: 3, minutes: 150 });
});

test('streaks skip planned rest days, survive an unfinished today and break on a missed study day', () => {
  // Monday–Friday study, weekends off.
  const study = new Set(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-28', '2026-09-29', '2026-09-30']);
  const days = (...dates: string[]) => new Map(dates.map(d => [d, { count: 1, minutes: 30 }]));

  const running = days('2026-09-24', '2026-09-25', '2026-09-28', '2026-09-29');
  assert.deepEqual(computeStreak(running, study, '2026-09-30'), { current: 4, best: 4, todayDone: false, todayIsStudyDay: true });
  running.set('2026-09-30', { count: 2, minutes: 60 });
  assert.equal(computeStreak(running, study, '2026-09-30').current, 5);

  assert.deepEqual(computeStreak(days('2026-09-28', '2026-09-30'), study, '2026-09-30'), {
    current: 1,
    best: 1,
    todayDone: true,
    todayIsStudyDay: true,
  });
  const earlier = computeStreak(days('2026-09-21', '2026-09-22', '2026-09-23', '2026-09-25'), study, '2026-09-25');
  assert.deepEqual([earlier.current, earlier.best], [1, 3]);
  assert.deepEqual(computeStreak(new Map(), study, '2026-09-25'), { current: 0, best: 0, todayDone: false, todayIsStudyDay: true });

  const long = playlist('mat', repeat(20, 60), 'Matematik');
  const withRest = camp([long], { schedule: { ...camp([long]).schedule, activeDays: [1, 2, 3, 4, 5], restDays: [0, 6] } });
  const planned = studyDaysOf([source(withRest, {}, '2026-09-24')]);
  assert.ok(planned.has('2026-09-25') && !planned.has('2026-09-26') && !planned.has('2026-09-27'));
});

test('commitment counts tasks done on their planned day against every task that fell due', () => {
  const today = '2026-09-24';
  const completedMap = { 'mat-1': true, 'fiz-1': true, 'mat-2': true, 'fiz-2': true, 'mat-4': true, 'mat-5': true };
  const completion: CompletionDates = {
    since: '2026-09-21',
    dates: { 'mat-1': '2026-09-21', 'fiz-1': '2026-09-22', 'mat-2': '2026-09-22', 'mat-4': today, 'mat-5': today },
  };
  const c = camp([mat, fiz]);
  // On time: mat-1, mat-2, mat-4 (today), mat-5 (early). Late: fiz-1 (a day late), mat-3 and fiz-3 (left open).
  // Not measured: fiz-2 (no recorded day), fiz-4 (open today), later days.
  assert.deepEqual(commitmentScore([source(c, completedMap, today)], completion, today), {
    score: 57,
    onTime: 4,
    measured: 7,
    since: '2026-09-21',
  });

  // A postponed task is never on time, even when done later.
  const shifted = camp([mat, fiz], {
    shiftEvents: [{ date: '2026-09-23', resumeDate: '2026-09-25', itemIds: ['mat-3', 'fiz-3'], reason: 'exhausted' }],
  });
  const doneLater = { ...completedMap, 'mat-3': true };
  const late = commitmentScore([source(shifted, doneLater, today)], { ...completion, dates: { ...completion.dates, 'mat-3': today } }, today);
  assert.deepEqual([late.onTime, late.measured], [4, 7]);

  // Only tasks first due from the start of the record (and of the camp) on are measured.
  assert.deepEqual(commitmentScore([source(c, completedMap, today)], { ...completion, since: '2026-09-23' }, today).score, 50);
  const newer = camp([mat, fiz], { createdAt: today });
  assert.deepEqual(commitmentScore([source(newer, completedMap, today)], completion, today).score, 100);
  assert.equal(commitmentScore([source(c, {}, '2026-09-21')], completion, '2026-09-21').score, null);
});

test('postpone analysis shares out reasons per shift and finds the branch that stands out', () => {
  const kim = playlist('kim', repeat(4, 60), 'Kimya');
  const base = { date: '2026-09-22', resumeDate: '2026-09-23' };
  const c = camp([mat, fiz, kim], {
    shiftEvents: [
      { ...base, itemIds: ['fiz-1', 'fiz-2', 'mat-1'], reason: 'distraction' },
      { ...base, itemIds: ['fiz-1', 'fiz-3'], reason: 'distraction' },
      { ...base, itemIds: ['fiz-2'], reason: 'difficult' },
      { ...base, itemIds: ['kim-1'] },
      { ...base, itemIds: ['mat-2', 'mat-3', 'mat-4'], origin: 'branch-added' },
    ],
  });
  const analysis = analyzePostpones([source(c, {}, '2026-09-24')]);
  assert.equal(analysis.events, 4);
  assert.deepEqual(analysis.reasons, [
    { reason: 'distraction', count: 2, percent: 50 },
    { reason: 'difficult', count: 1, percent: 25 },
    { reason: 'unspecified', count: 1, percent: 25 },
  ]);
  assert.equal(analysis.topReason?.reason, 'distraction');
  assert.deepEqual(
    analysis.branches.map(b => [b.subject, b.count]),
    [['Fizik', 5], ['Matematik', 1], ['Kimya', 1]]
  );
  assert.deepEqual(analysis.standout, { subject: 'Fizik', count: 5, ratio: 5 });

  const unnamed = analyzePostpones([source(camp([mat, fiz], { shiftEvents: [{ ...base, itemIds: ['mat-1', 'fiz-1'] }] }), {}, '2026-09-24')]);
  assert.equal(unnamed.topReason, null);
  assert.equal(unnamed.standout, null, 'a single postponement per branch does not stand out');
  assert.deepEqual(analyzePostpones([source(camp([mat]), {}, '2026-09-24')]), { events: 0, reasons: [], topReason: null, branches: [], standout: null });
});

/** A localStorage stand-in. */
function withStorage(initial: Record<string, string>, run: (store: Map<string, string>) => void) {
  const store = new Map(Object.entries(initial));
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalError = console.error;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  console.error = () => {};
  try {
    run(store);
  } finally {
    console.error = originalError;
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

test('completion dates start on the first load, keep only done videos and travel with backups', () => {
  withStorage({}, store => {
    const { data } = loadPlanner();
    assert.deepEqual(data.completionDates, { since: todayKey(), dates: {} });
    assert.deepEqual(JSON.parse(store.get(PROGRESS_KEYS.completionDates)!), { version: 1, since: todayKey(), dates: {} }, 'the start day is saved at once');
  });

  withStorage(
    {
      yt_completed: JSON.stringify({ a: true, b: true }),
      [PROGRESS_KEYS.completionDates]: JSON.stringify({ version: 1, since: '2026-09-01', dates: { a: '2026-09-02', c: '2026-09-03', b: 'dün' } }),
    },
    () => {
      const { data, notices } = loadPlanner();
      assert.deepEqual(data.completionDates, { since: '2026-09-01', dates: { a: '2026-09-02' } });
      assert.deepEqual(notices, []);
    }
  );

  withStorage({ [PROGRESS_KEYS.completionDates]: JSON.stringify({ version: 9, since: '2026-09-01', dates: {} }) }, store => {
    const { data, notices } = loadPlanner();
    assert.equal(data.completionDates.since, todayKey());
    assert.ok(notices.some(n => n.id === `unreadable-${PROGRESS_KEYS.completionDates}`));
    assert.ok(store.has(`${PROGRESS_KEYS.completionDates}__okunamadi`), 'a newer value is copied aside, not lost');
  });

  const c = camp([mat]);
  const data: PlannerData = {
    camps: [c],
    activeCampId: c.id,
    completedMap: { 'mat-1': true },
    completionDates: { since: '2026-09-01', dates: { 'mat-1': '2026-09-21' } },
    focusSessions: [],
    playlistSync: { lastAttempt: null, lastFailure: null, branches: {} },
    dayNotes: {},
  };
  const restored = parseBackup(JSON.stringify(createBackup(data, '2026-09-21')), '2026-10-01');
  assert.ok(restored.ok && restored.data.completionDates.dates['mat-1'] === '2026-09-21' && restored.data.completionDates.since === '2026-09-01');
  const { completionDates: _dropped, ...older } = createBackup(data, '2026-09-21');
  const fromOlder = parseBackup(JSON.stringify(older), '2026-10-01');
  assert.ok(fromOlder.ok);
  if (fromOlder.ok) assert.deepEqual(fromOlder.data.completionDates, { since: '2026-10-01', dates: {} }, 'older backups start the record on the restore day');
});

test('percent shares take the suffix of the number read aloud', () => {
  const cases: [number, string][] = [
    [55, "%55'i"], [50, "%50'si"], [40, "%40'ı"], [30, "%30'u"], [100, "%100'ü"], [0, "%0'ı"],
    [23, "%23'ü"], [16, "%16'sı"], [9, "%9'u"], [12, "%12'si"], [80, "%80'i"], [60, "%60'ı"],
  ];
  for (const [value, expected] of cases) assert.equal(formatPercentShare(value), expected);
});
