import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StudyCamp } from '../src/types/index.ts';
import {
  CAMP_KEYS, UI_KEYS, activeCampOf, campStore, clearAllStorage, createBackup, loadPlanner, parseBackup, pruneCompletion,
} from '../src/lib/persistence.ts';
import { MIGRATED_CAMP_ID, DEFAULT_CAMP_NAME, migrateLegacyData, normalizeCamps } from '../src/lib/studyCamp.ts';
import { STORAGE_KEYS } from '../src/utils/storage.ts';
import { buildCampSchedule, buildSchedule, createShiftEvent } from '../src/utils/roadmapEngine.ts';
import { todayKey } from '../src/utils/date.ts';
import { layout, playlist, prefs, repeat } from './helpers.ts';

/** A localStorage stand-in; `failOn` makes setItem throw for those keys (quota). */
function withStorage(initial: Record<string, string>, run: (store: Map<string, string>) => void, failOn: string[] = []) {
  const store = new Map(Object.entries(initial));
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalError = console.error;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (failOn.includes(k)) throw new Error('QuotaExceededError');
        store.set(k, v);
      },
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

// An older version's data: three separate "camps" (now branches) with real
// links, a channel, a playlist link, completion, notes and a shift event.
const mat = { ...playlist('mat', repeat(8, 40), 'Matematik'), colorTag: 'ink', source: 'manual' as const };
mat.videos[0] = { ...mat.videos[0], channelName: 'Konuk Kanal', thumbnailUrl: 'https://i.ytimg.com/vi/x/mqdefault.jpg' };
const fiz = playlist('fiz', repeat(5, 55), 'Fizik');
const kim = playlist('kim', [20, 90, 30], 'Kimya');
const legacyPlaylists = [mat, fiz, kim];
const legacyPrefs = prefs({ dailyStudyHours: 2.5, maxSubjectsPerDay: 2, restDays: [0], activeDays: [1, 2, 3, 4, 5, 6], mockExamDays: [6], startDate: '2026-09-14' });
const completed = { 'mat-1': true, 'fiz-1': true, 'gone-7': true };
const notes = { '2026-09-15': 'Türev tekrar', '2026-09-16': 'Deneme analizi' };
const legacyEvent = createShiftEvent('2026-09-16', buildSchedule(legacyPlaylists, legacyPrefs, { completedMap: completed, today: '2026-09-17' }).plans, '2026-09-17')!;

const legacyStorage = (): Record<string, string> => ({
  [STORAGE_KEYS.playlists]: JSON.stringify(legacyPlaylists),
  [STORAGE_KEYS.preferences]: JSON.stringify(legacyPrefs),
  [STORAGE_KEYS.completed]: JSON.stringify(completed),
  [STORAGE_KEYS.shiftEvents]: JSON.stringify([legacyEvent]),
  [UI_KEYS.dayNotes]: JSON.stringify(notes),
  [UI_KEYS.selectedDate]: JSON.stringify('2026-09-16'),
});

test('legacy flat data becomes one default camp without losing or inventing anything', () => {
  const before = legacyStorage();
  withStorage(before, store => {
    const { data, notices, selectedDate } = loadPlanner();
    assert.equal(data.camps.length, 1);
    const [camp] = data.camps;
    assert.equal(camp.id, MIGRATED_CAMP_ID);
    assert.equal(camp.name, DEFAULT_CAMP_NAME);
    assert.equal(camp.origin, 'migrated');
    assert.equal(data.activeCampId, camp.id);

    // Branches are the old playlists, field for field.
    assert.deepEqual(camp.branches, JSON.parse(JSON.stringify(legacyPlaylists)));
    assert.equal(camp.branches[0].videos[0].channelName, 'Konuk Kanal');
    // Settings, shift events, completion, notes and the selected day survive.
    const { mode, targetEndDate, weekPlan, ...plannerFields } = camp.schedule;
    assert.deepEqual(plannerFields, legacyPrefs);
    assert.equal(mode, 'auto');
    assert.equal(targetEndDate, null);
    assert.deepEqual(weekPlan, [[], [], [], [], [], [], []]);
    assert.deepEqual(camp.shiftEvents, [legacyEvent]);
    assert.deepEqual(data.completedMap, completed, 'completion is kept as stored');
    assert.deepEqual(data.dayNotes, notes);
    assert.equal(selectedDate, '2026-09-16');

    // The plan is exactly the one the older version showed.
    const today = '2026-09-24';
    const old = buildSchedule(legacyPlaylists, legacyPrefs, { completedMap: completed, shiftEvents: [legacyEvent], today });
    const now = buildCampSchedule(camp, { completedMap: data.completedMap, today });
    assert.deepEqual(layout(now.plans), layout(old.plans));
    assert.deepEqual(now.plans, old.plans);

    // The new layout is saved; the older keys are left exactly as they were.
    const saved = JSON.parse(store.get(CAMP_KEYS.camps)!);
    assert.equal(saved.version, 1);
    assert.deepEqual(saved.camps, JSON.parse(JSON.stringify(data.camps)));
    assert.equal(JSON.parse(store.get(CAMP_KEYS.activeCamp)!), camp.id);
    for (const [key, value] of Object.entries(before)) assert.equal(store.get(key), value, `${key} untouched`);
    assert.ok(notices.some(n => n.id === 'camps-migrated' && n.tone === 'info'));
  });
});

test('after migration the saved camps are authoritative and nothing is migrated twice', () => {
  withStorage(legacyStorage(), store => {
    loadPlanner();
    // The user renames the camp; an old key changing later must not matter.
    const saved = JSON.parse(store.get(CAMP_KEYS.camps)!);
    saved.camps[0].name = 'TYT 2027';
    store.set(CAMP_KEYS.camps, JSON.stringify(saved));
    store.set(STORAGE_KEYS.playlists, JSON.stringify([playlist('other', [10])]));
    const again = loadPlanner();
    assert.equal(again.data.camps.length, 1);
    assert.equal(again.data.camps[0].name, 'TYT 2027');
    assert.deepEqual(again.data.camps[0].branches.map(b => b.id), ['mat', 'fiz', 'kim']);
    assert.ok(!again.notices.some(n => n.id.startsWith('camps-migrated')));

    // Deleting every camp is respected too: the old snapshot is not revived.
    store.set(CAMP_KEYS.camps, JSON.stringify(campStore([])));
    assert.deepEqual(loadPlanner().data.camps, []);
  });
});

test('if the new layout cannot be saved, the data still loads and the older keys stay', () => {
  const before = legacyStorage();
  withStorage(
    before,
    store => {
      const { data, notices } = loadPlanner();
      assert.equal(data.camps.length, 1);
      assert.equal(data.camps[0].branches.length, 3);
      assert.equal(store.has(CAMP_KEYS.camps), false);
      for (const [key, value] of Object.entries(before)) assert.equal(store.get(key), value, `${key} untouched`);
      assert.ok(notices.some(n => n.id === 'camps-migrated-unsaved' && n.tone === 'warn'));
    },
    [CAMP_KEYS.camps]
  );
  // A later successful load migrates to the same camp id (retries are identical).
  withStorage(legacyStorage(), () => assert.equal(loadPlanner().data.camps[0].id, MIGRATED_CAMP_ID));
});

test('the oldest single shift date becomes a stored shift event of the migrated camp', () => {
  const initial = legacyStorage();
  delete initial[STORAGE_KEYS.shiftEvents];
  initial[STORAGE_KEYS.shiftedDate] = JSON.stringify('2026-09-16');
  withStorage(initial, store => {
    const { data, notices } = loadPlanner();
    const [event] = data.camps[0].shiftEvents;
    assert.equal(event.date, '2026-09-16');
    assert.equal(event.resumeDate, '2026-09-17');
    assert.ok(event.itemIds.length > 0);
    assert.ok(notices.some(n => n.id === 'legacy-shift'));
    assert.equal(store.get(STORAGE_KEYS.shiftedDate), JSON.stringify('2026-09-16'), 'legacy key left alone');
  });
});

test('settings saved without any camp seed the wizard, and nothing is created', () => {
  withStorage({ [STORAGE_KEYS.preferences]: JSON.stringify(legacyPrefs) }, store => {
    const result = loadPlanner();
    assert.deepEqual(result.data.camps, []);
    assert.equal(result.data.activeCampId, null);
    assert.deepEqual(result.seedPreferences, legacyPrefs);
    assert.equal(store.has(CAMP_KEYS.camps), false);
  });
  withStorage({}, () => {
    const result = loadPlanner();
    assert.deepEqual(result.data.camps, []);
    assert.equal(result.seedPreferences, null);
    assert.deepEqual(result.notices, []);
  });
});

test('a corrupt camp store is copied aside and rebuilt from the older keys', () => {
  withStorage({ ...legacyStorage(), [CAMP_KEYS.camps]: '{broken' }, store => {
    const { data, notices } = loadPlanner();
    assert.equal(store.get(`${CAMP_KEYS.camps}__okunamadi`), '{broken');
    assert.equal(data.camps.length, 1);
    assert.deepEqual(data.camps[0].branches.map(b => b.id), ['mat', 'fiz', 'kim']);
    assert.ok(notices.some(n => n.id === `unreadable-${CAMP_KEYS.camps}`));
  });
  // A store from a newer version is kept aside, not overwritten blindly.
  const newer = JSON.stringify({ version: 99, camps: [] });
  withStorage({ [CAMP_KEYS.camps]: newer }, store => {
    loadPlanner();
    assert.equal(store.get(`${CAMP_KEYS.camps}__okunamadi`), newer);
  });
});

test('several camps load with their own branches, schedules and shift events', () => {
  const second: StudyCamp = {
    id: 'camp-ayt',
    name: 'AYT',
    createdAt: '2026-09-20',
    branches: [playlist('geo', repeat(4, 30), 'Geometri')],
    schedule: { ...prefs(), mode: 'manual', targetEndDate: '2026-12-01', weekPlan: [[], ['geo', 'ghost'], [], ['geo'], [], [], []] },
    shiftEvents: [],
  };
  const first = migrateLegacyData({ preferences: legacyPrefs, playlists: legacyPlaylists, shiftEvents: [legacyEvent] }, '2026-09-20');
  withStorage(
    {
      [CAMP_KEYS.camps]: JSON.stringify(campStore([first, second])),
      [CAMP_KEYS.activeCamp]: JSON.stringify('camp-ayt'),
    },
    () => {
      const { data } = loadPlanner();
      assert.deepEqual(data.camps.map(c => c.name), [DEFAULT_CAMP_NAME, 'AYT']);
      assert.equal(activeCampOf(data)!.id, 'camp-ayt');
      const ayt = data.camps[1];
      assert.equal(ayt.schedule.mode, 'manual');
      assert.equal(ayt.schedule.targetEndDate, '2026-12-01');
      assert.deepEqual(ayt.schedule.weekPlan, [[], ['geo'], [], ['geo'], [], [], []], 'unknown branch ids are dropped');
      assert.deepEqual(ayt.schedule.activeDays, [1, 3]);
      assert.deepEqual(data.camps[0].shiftEvents, [legacyEvent]);
    }
  );
  // An unknown active id falls back to the first camp.
  withStorage({ [CAMP_KEYS.camps]: JSON.stringify(campStore([first, second])), [CAMP_KEYS.activeCamp]: JSON.stringify('nope') }, () => {
    assert.equal(loadPlanner().data.activeCampId, first.id);
  });
});

test('branch ids stay unique across camps and broken entries are reported', () => {
  const dup = { id: 'c2', name: 'İkinci', branches: [playlist('mat', [10]), { id: '' }, playlist('ok', [5])], schedule: {} };
  const result = normalizeCamps([{ id: 'c1', name: 'Bir', branches: [playlist('mat', [10])], schedule: {} }, dup, { name: 'kimliksiz' }]);
  assert.deepEqual(result.camps.map(c => c.branches.map(b => b.id)), [['mat'], ['ok']]);
  assert.equal(result.droppedCamps, 1);
  assert.equal(result.droppedBranches, 2);
  // A camp with no usable schedule gets defaults and says so.
  assert.equal(result.camps[1].schedule.mode, 'auto');
  assert.ok(result.invalidSchedules.some(s => s.name === 'İkinci'));
});

test('backups: flat v2 files become a camp, v3 files round-trip', () => {
  const v2 = JSON.stringify({
    app: 'yetistiricem',
    version: 2,
    preferences: legacyPrefs,
    playlists: legacyPlaylists,
    completedMap: completed,
    shiftEvents: [legacyEvent],
    dayNotes: notes,
    selectedDate: '2026-09-16',
  });
  const parsed = parseBackup(v2, '2026-09-24');
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(parsed.data.camps.length, 1);
  const [camp] = parsed.data.camps;
  assert.deepEqual(camp.branches, JSON.parse(JSON.stringify(legacyPlaylists)));
  assert.deepEqual(camp.shiftEvents, [legacyEvent]);
  assert.equal(camp.schedule.startDate, '2026-09-14');
  assert.deepEqual(parsed.data.dayNotes, notes);
  assert.deepEqual(parsed.summary, {
    camps: 1, branches: 3, videos: 16, completed: 2, shifts: 1, notes: 2, exportedAt: null, version: 2,
  });

  // Version 1 files had no shift events or notes.
  const v1 = parseBackup(JSON.stringify({ preferences: legacyPrefs, playlists: legacyPlaylists, completedMap: completed }), '2026-09-24');
  assert.ok(v1.ok && v1.data.camps[0].shiftEvents.length === 0);

  const backup = createBackup({ ...parsed.data, camps: [camp, { ...camp, id: 'camp-2', name: 'İkinci', branches: [playlist('geo', [30])] }] }, '2026-09-16');
  const roundTrip = parseBackup(JSON.stringify(backup), '2026-09-24');
  assert.ok(roundTrip.ok);
  if (!roundTrip.ok) return;
  assert.deepEqual(roundTrip.data.camps, JSON.parse(JSON.stringify(backup.camps)));
  assert.equal(roundTrip.summary.camps, 2);
  assert.equal(roundTrip.summary.version, 3);

  // Damaged v3 files are refused instead of restored partially.
  const damaged = { ...backup, camps: [{ ...backup.camps[0], branches: [{ id: 'x', videos: [{}] }] }] };
  const refused = parseBackup(JSON.stringify(damaged));
  assert.equal(refused.ok, false);
  assert.equal(parseBackup(JSON.stringify({ app: 'yetistiricem', version: 4, camps: [] })).ok, false);
});

test('completion marks are pruned only when no camp uses the video any more', () => {
  const a = migrateLegacyData({ preferences: legacyPrefs, playlists: [mat], shiftEvents: [] }, todayKey());
  const b = { ...a, id: 'b', branches: [{ ...fiz, videos: [...fiz.videos, mat.videos[1]] }] };
  const map = { 'mat-1': true, 'mat-2': true, 'fiz-1': true };
  assert.deepEqual(pruneCompletion(map, ['mat-1', 'mat-2'], [b]), { 'mat-2': true, 'fiz-1': true });
});

test('reset clears the camp keys and the older snapshot', () => {
  withStorage(legacyStorage(), store => {
    loadPlanner();
    store.set('unrelated', 'x');
    clearAllStorage();
    assert.deepEqual([...store.keys()], ['unrelated']);
  });
});
