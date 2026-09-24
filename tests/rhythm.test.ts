import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AUTO_RHYTHM, RHYTHM_PRESETS, autoRhythmOf, createStudyCamp, guessBranchName, manualRhythmOf, resolveAutoRhythm,
  scheduleFromAuto, scheduleFromManual, suggestWeekPlan, unassignedBranches,
} from '../src/lib/studyCamp.ts';
import { buildCampSchedule } from '../src/utils/roadmapEngine.ts';
import { dayOfWeek } from '../src/utils/date.ts';
import { allIds, playlist, repeat } from './helpers.ts';

const base = { startDate: '2026-09-21', targetEndDate: null, playbackSpeed: 1, practiceMultiplier: 0 };
const branches = [playlist('mat', repeat(12, 40), 'Matematik'), playlist('fiz', repeat(8, 50), 'Fizik'), playlist('kim', repeat(6, 30), 'Kimya'), playlist('bio', repeat(6, 30), 'Biyoloji')];
const ids = branches.map(b => b.id);

test('the balanced preset fills every omitted value; set values win', () => {
  assert.deepEqual(resolveAutoRhythm(DEFAULT_AUTO_RHYTHM), { hours: 4, perDay: 3, days: [1, 2, 3, 4, 5, 6], mockDays: [] });
  assert.deepEqual(resolveAutoRhythm({ ...DEFAULT_AUTO_RHYTHM, perDay: 2 }), { hours: 4, perDay: 2, days: [1, 2, 3, 4, 5, 6], mockDays: [] });
  assert.deepEqual(resolveAutoRhythm({ ...DEFAULT_AUTO_RHYTHM, preset: 'intense', days: [0, 2, 4] }), {
    hours: 6, perDay: 4, days: [0, 2, 4], mockDays: [], // Sunday is studied, so it cannot stay the mock exam day
  });
  const light = resolveAutoRhythm({ ...DEFAULT_AUTO_RHYTHM, preset: 'light', hours: 3 });
  assert.equal(light.hours, 3);
  assert.deepEqual(light.days, RHYTHM_PRESETS.light.days);
});

test('an automatic schedule caps distinct branches per day and round-trips to the form', () => {
  const schedule = scheduleFromAuto(base, { ...DEFAULT_AUTO_RHYTHM, perDay: 2, hours: 2 });
  assert.equal(schedule.mode, 'auto');
  assert.deepEqual(schedule.restDays, [0]);
  const camp = createStudyCamp({ name: '  TYT  ', branches, schedule }, '2026-09-20');
  assert.equal(camp.name, 'TYT');
  const { plans, unscheduledItems } = buildCampSchedule(camp, { today: '2026-09-21' });
  assert.equal(unscheduledItems.length, 0);
  assert.equal(allIds(plans).length, 32);
  for (const plan of plans) {
    assert.ok(new Set(plan.items.map(i => i.playlistId)).size <= 2, `${plan.date}: at most 2 branches`);
    if (dayOfWeek(plan.date) === 0) assert.ok(plan.isRestDay);
  }
  // Three distinct branches a day means three branches, not three videos.
  const three = buildCampSchedule(createStudyCamp({ name: 'x', branches, schedule: scheduleFromAuto(base, { ...DEFAULT_AUTO_RHYTHM, hours: 6 }) }), { today: '2026-09-21' });
  assert.equal(new Set(three.plans[0].items.map(i => i.playlistId)).size, 3);
  assert.ok(three.plans[0].items.length > 3);

  assert.deepEqual(autoRhythmOf(schedule), { preset: 'balanced', hours: 2, perDay: 2, days: null, mockDays: null });
});

test('suggested week plans rotate the branches fairly through the study days', () => {
  const plan = suggestWeekPlan(ids, [1, 2, 3, 4, 5, 6], 2);
  assert.deepEqual(plan[0], []);
  assert.deepEqual(plan[1], ['mat', 'fiz']);
  assert.deepEqual(plan[2], ['kim', 'bio']);
  assert.deepEqual(plan[3], ['mat', 'fiz']);
  const counts = new Map<string, number>();
  for (const day of plan) for (const id of day) counts.set(id, (counts.get(id) ?? 0) + 1);
  assert.deepEqual([...counts.values()], [3, 3, 3, 3]);
  // Never more per day than there are branches.
  assert.deepEqual(suggestWeekPlan(['mat'], [1, 3], 3), [[], ['mat'], [], ['mat'], [], [], []]);
  assert.deepEqual(suggestWeekPlan([], [1], 2), [[], [], [], [], [], [], []]);
});

test('a manual schedule places only the chosen branches and flags forgotten ones', () => {
  const manual = {
    hours: 2,
    dayTypes: ['mock', 'study', 'study', 'rest', 'study', 'study', 'study'] as const,
    weekPlan: [['mat'], ['mat', 'fiz'], ['kim'], ['bio'], ['fiz'], [], ['mat', 'kim']],
  };
  const form = { ...manual, dayTypes: [...manual.dayTypes] };
  assert.deepEqual(unassignedBranches(form, branches).map(b => b.id), ['bio'], 'Wednesday rests, so Biyoloji is unassigned');

  const schedule = scheduleFromManual(base, form, { maxSubjectsPerDay: 3 });
  // Sunday is a mock exam day, Wednesday rests, Friday has no branch.
  assert.deepEqual(schedule.mockExamDays, [0]);
  assert.deepEqual(schedule.activeDays, [1, 2, 4, 6]);
  assert.deepEqual(schedule.restDays, [3, 5]);
  assert.deepEqual(schedule.weekPlan, [[], ['mat', 'fiz'], ['kim'], [], ['fiz'], [], ['mat', 'kim']]);

  const camp = createStudyCamp({ name: 'Elle', branches, schedule });
  const result = buildCampSchedule(camp, { today: '2026-09-21' });
  assert.deepEqual(result.issues, [{ kind: 'unassigned-branch', playlistId: 'bio', unscheduledCount: 6 }]);
  assert.deepEqual(manualRhythmOf(camp.schedule, ids), {
    hours: 2,
    dayTypes: ['mock', 'study', 'study', 'rest', 'study', 'rest', 'study'],
    weekPlan: schedule.weekPlan,
  });
});

test('branch names are guessed from the list title and stay editable labels', () => {
  assert.equal(guessBranchName('2026 TYT MATEMATİK Kampı | 60 günde'), 'Matematik');
  assert.equal(guessBranchName('AYT Fizik Soru Çözümü'), 'Fizik');
  assert.equal(guessBranchName('Paragraf Taktikleri'), 'Türkçe');
  assert.equal(guessBranchName('   Hocamın   özel listesi  '), 'Hocamın özel listesi');
  assert.equal(guessBranchName(''), 'Yeni branş');
  assert.ok(guessBranchName('x'.repeat(90)).length <= 40);
});
