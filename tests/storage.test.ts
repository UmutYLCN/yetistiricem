import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEYS, defaultPreferences, inspectPreferences, loadCompletedMap, loadPreferences, loadShiftEvents,
  normalizeCompletedMap, saveShiftEvents,
} from '../src/utils/storage.ts';
import { isDateKey, todayKey } from '../src/utils/date.ts';

test('default start date is today as a local date key', () => {
  assert.ok(isDateKey(defaultPreferences.startDate));
  assert.equal(defaultPreferences.startDate, todayKey());
});

test('stored preferences are repaired field by field', () => {
  const legacy = { ...defaultPreferences, startDate: new Date(2026, 8, 21, 0, 30).toISOString() };
  const { preferences, invalidFields } = inspectPreferences(legacy);
  assert.equal(preferences.startDate, '2026-09-21');
  assert.deepEqual(invalidFields, []);

  const broken = inspectPreferences({ dailyStudyHours: '4', playbackSpeed: 0, practiceMultiplier: -1, maxSubjectsPerDay: 2.7, activeDays: [1, 1, 9], restDays: [6, 0], startDate: 5 });
  assert.equal(broken.preferences.dailyStudyHours, 4);
  assert.equal(broken.preferences.playbackSpeed, 1);
  assert.equal(broken.preferences.practiceMultiplier, 0.2);
  assert.equal(broken.preferences.maxSubjectsPerDay, 2);
  assert.deepEqual(broken.preferences.activeDays, defaultPreferences.activeDays);
  assert.deepEqual(broken.preferences.restDays, [0, 6]);
  assert.deepEqual(broken.preferences.mockExamDays, []);
  assert.deepEqual(broken.invalidFields, ['dailyStudyHours', 'playbackSpeed', 'practiceMultiplier', 'activeDays', 'mockExamDays']);
  assert.equal(inspectPreferences({ ...defaultPreferences, dailyStudyHours: 30 }).preferences.dailyStudyHours, 24);
  assert.deepEqual(inspectPreferences(null).preferences.activeDays, defaultPreferences.activeDays);
});

test('loaders read localStorage and survive corrupt values', () => {
  const store = new Map<string, string>();
  const original = globalThis.localStorage;
  const originalError = console.error;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
  });
  console.error = () => {};
  try {
    store.set(STORAGE_KEYS.preferences, JSON.stringify({ ...defaultPreferences, startDate: '2026-09-21T21:00:00.000Z', dailyStudyHours: 0 }));
    store.set(STORAGE_KEYS.completed, JSON.stringify({ a: true, b: false, c: 'yes' }));
    saveShiftEvents([{ date: '2026-09-21', resumeDate: '2026-09-23', itemIds: ['a'] }]);
    const prefs = loadPreferences();
    assert.equal(prefs.dailyStudyHours, 4);
    assert.ok(isDateKey(prefs.startDate));
    assert.deepEqual(loadCompletedMap(), { a: true });
    assert.deepEqual(loadShiftEvents(), [{ date: '2026-09-21', resumeDate: '2026-09-23', itemIds: ['a'] }]);
    store.set(STORAGE_KEYS.shiftEvents, '{not json');
    assert.deepEqual(loadShiftEvents(), []);
  } finally {
    console.error = originalError;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
  }
  assert.deepEqual(normalizeCompletedMap([true]), {});
});
