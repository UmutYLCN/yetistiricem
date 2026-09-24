import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignLeftovers, campFromDraft, detailErrors, hasRhythmErrors, hasSourceErrors, initialDraft, initialRhythm, pickColor,
  rhythmDraftOf, rhythmErrors, sameSchedule, scheduleOf, sourceErrors, startManualWeek, syncManual,
} from '../src/lib/campDraft.ts';
import { unassignedBranches } from '../src/lib/studyCamp.ts';
import { buildCampSchedule } from '../src/utils/roadmapEngine.ts';
import { allIds, playlist, prefs, repeat } from './helpers.ts';

const branches = [playlist('mat', repeat(6, 40), 'Matematik'), playlist('fiz', repeat(4, 50), 'Fizik'), playlist('kim', repeat(3, 30), 'Kimya')];

test('each step blocks until it is complete', () => {
  assert.equal(sourceErrors([]).empty, 'En az bir oynatma listesi ya da video ekle.');
  const unnamed = { ...branches[0], subject: '  ' };
  const empty = { ...branches[1], videos: [] };
  const errors = sourceErrors([unnamed, empty, branches[2]]);
  assert.deepEqual(Object.keys(errors.branches), ['mat', 'fiz']);
  assert.equal(hasSourceErrors(sourceErrors(branches)), false);

  assert.deepEqual(detailErrors({ name: '', startDate: '2026-09-24', targetEndDate: '' }), { name: 'Kampına bir ad ver.' });
  assert.deepEqual(detailErrors({ name: 'TYT', startDate: '2026-02-30', targetEndDate: '' }), { startDate: 'Geçerli bir başlangıç tarihi seç.' });
  assert.deepEqual(detailErrors({ name: 'TYT', startDate: '2026-09-24', targetEndDate: '2026-09-23' }), {
    targetEndDate: 'Hedef tarih başlangıçtan önce olamaz.',
  });
  assert.deepEqual(detailErrors({ name: 'TYT', startDate: '2026-09-24', targetEndDate: '2026-09-24' }), {});

  const rhythm = initialRhythm(null);
  assert.equal(rhythm.mode, null, 'the user chooses the mode first');
  assert.ok(rhythmErrors(rhythm, branches).mode);
  assert.equal(hasRhythmErrors(rhythmErrors({ ...rhythm, mode: 'auto' }, branches)), false, 'the balanced preset is enough');
  assert.ok(rhythmErrors({ ...rhythm, mode: 'auto', auto: { ...rhythm.auto, days: [] } }, branches).days);
});

test('manual mode never lets a branch drop out silently', () => {
  const rhythm = { ...initialRhythm(null), mode: 'manual' as const };
  const manual = startManualWeek(rhythm, branches);
  assert.deepEqual(unassignedBranches(manual, branches), [], 'the suggested week uses every branch');

  const withoutKimya = { ...manual, weekPlan: manual.weekPlan.map(day => day.filter(id => id !== 'kim')) };
  const errors = rhythmErrors({ ...rhythm, manual: withoutKimya }, branches);
  assert.match(errors.unassigned ?? '', /Kimya/);

  const fixed = assignLeftovers(withoutKimya, branches);
  assert.deepEqual(unassignedBranches(fixed, branches), []);
  assert.equal(hasRhythmErrors(rhythmErrors({ ...rhythm, manual: fixed }, branches)), false);

  // A study day without branches must be filled or turned into a rest day.
  const bare = { ...fixed, weekPlan: fixed.weekPlan.map((day, dow) => (dow === 2 ? [] : day)) };
  const dayErrors = rhythmErrors({ ...rhythm, manual: bare }, branches).weekdays;
  assert.deepEqual(Object.keys(dayErrors), ['2']);

  // Removing a branch from the draft also removes it from the week.
  const synced = syncManual(fixed, branches.slice(0, 2));
  assert.ok(synced.weekPlan.every(day => !day.includes('kim')));
});

test('a finished draft becomes a camp whose plan contains every video', () => {
  const draft = { ...initialDraft('2026-09-24', null), branches, name: ' AYT ', targetEndDate: '2026-12-31' };
  draft.rhythm = { ...draft.rhythm, mode: 'manual', manual: startManualWeek(draft.rhythm, branches) };
  const camp = campFromDraft(draft, '2026-09-24');
  assert.equal(camp.name, 'AYT');
  assert.equal(camp.schedule.mode, 'manual');
  assert.equal(camp.schedule.targetEndDate, '2026-12-31');
  assert.deepEqual(camp.shiftEvents, []);
  const { plans, unscheduledItems } = buildCampSchedule(camp, { today: '2026-09-24' });
  assert.equal(unscheduledItems.length, 0);
  assert.equal(allIds(plans).length, 13);
  assert.equal(plans[0].date >= '2026-09-24', true);

  // Auto mode keeps the manual week aside (so switching back restores it).
  const auto = scheduleOf({ ...draft, rhythm: { ...draft.rhythm, mode: 'auto' } });
  assert.equal(auto.mode, 'auto');
  assert.deepEqual(auto.weekPlan, draft.rhythm.manual.weekPlan);
});

test('a new camp borrows only speed and practice share, never another camp’s tempo', () => {
  const other = { ...prefs({ dailyStudyHours: 7, maxSubjectsPerDay: 1, activeDays: [2, 4], mockExamDays: [0] }), playbackSpeed: 1.5, practiceMultiplier: 0.5 };
  const rhythm = initialRhythm(null, other);
  assert.deepEqual(rhythm.auto, { preset: 'balanced', hours: null, perDay: null, days: null, mockDays: null });
  assert.equal(rhythm.playbackSpeed, 1.5);
  assert.equal(rhythm.practiceMultiplier, 0.5);

  // Settings an older version saved (no camp yet) do seed the first camp.
  const legacy = initialRhythm(other);
  assert.equal(legacy.auto.hours, 7);
  assert.deepEqual(legacy.auto.days, [2, 4]);
});

test('new branches get distinct colours while any are free', () => {
  assert.equal(pickColor('Matematik', []), 'ink');
  assert.notEqual(pickColor('Matematik', ['ink']), 'ink');
  assert.equal(pickColor('Matematik', ['ink', 'forest', 'clay', 'ochre', 'plum', 'teal', 'rose', 'olive', 'slate']), 'ink');
});

test('the tempo form reproduces every saved schedule, so an unchanged save changes nothing', () => {
  const ids = branches.map(b => b.id);
  const cases = [
    // Auto, straight from the wizard.
    campFromDraft({ ...initialDraft('2026-09-24', null), branches, name: 'Oto', rhythm: { ...initialRhythm(null), mode: 'auto' } }, '2026-09-24').schedule,
    // Auto with every field customised, a mock day and a deadline.
    { ...scheduleOf({ startDate: '2026-09-21', targetEndDate: '2026-12-01', rhythm: { ...initialRhythm(null), mode: 'auto', auto: { preset: 'light', hours: 3.5, perDay: 1, days: [0, 2, 4], mockDays: [6] } } }) },
    // Manual with a mock day and a rest day.
    scheduleOf({
      startDate: '2026-09-21',
      targetEndDate: '',
      rhythm: { ...initialRhythm(null), mode: 'manual', manual: { hours: 2, dayTypes: ['mock', 'study', 'rest', 'study', 'study', 'study', 'study'], weekPlan: [[], ['mat', 'kim'], [], ['fiz'], ['mat'], ['kim'], ['fiz', 'mat']] } },
    }),
    // A migrated older schedule: odd hours, no preset, Saturday both active and rest.
    { ...prefs({ dailyStudyHours: 2.75, maxSubjectsPerDay: 2, activeDays: [1, 2, 3, 4, 5, 6], restDays: [0, 6], playbackSpeed: 1.3 }), mode: 'auto' as const, targetEndDate: null, weekPlan: [[], [], [], [], [], [], []] },
  ];
  for (const schedule of cases) {
    const form = rhythmDraftOf(schedule, ids);
    assert.equal(form.mode, schedule.mode);
    const saved = scheduleOf({ startDate: schedule.startDate, targetEndDate: schedule.targetEndDate ?? '', rhythm: form });
    assert.equal(saved.mode, schedule.mode, 'the mode never flips on its own');
    assert.ok(sameSchedule(saved, schedule, ids), JSON.stringify({ saved, schedule }));
    const layout = (s: typeof schedule) => buildCampSchedule({ branches, schedule: s, shiftEvents: [] }, { today: '2026-09-24' }).plans.map(p => [p.date, p.items.map(i => i.id)]);
    assert.deepEqual(layout(saved), layout(schedule), 'same plan');
  }
  // A real change is noticed.
  const [auto] = cases;
  assert.equal(sameSchedule({ ...auto, dailyStudyHours: 5 }, auto, ids), false);
  assert.equal(sameSchedule({ ...auto, mode: 'manual' }, auto, ids), false);
});
