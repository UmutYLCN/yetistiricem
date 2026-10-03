import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DailyPlanItem } from '../src/types/index.ts';
import type { FocusSession } from '../src/lib/focus.ts';
import { focusTotals, focusableVideoId, nextFocusItem, normalizeFocusSessions } from '../src/lib/focus.ts';
import type { PlannerData } from '../src/lib/persistence.ts';
import { PROGRESS_KEYS, createBackup, emptyData, loadPlanner, parseBackup, readFocusSessions } from '../src/lib/persistence.ts';
import * as ops from '../src/lib/plannerOps.ts';
import { playerErrorMessage } from '../src/lib/youtubePlayer.ts';

const session = (overrides: Partial<FocusSession> = {}): FocusSession => ({
  videoId: 'dQw4w9WgXcQ',
  date: '2026-09-26',
  watchedSeconds: 600,
  pauses: 2,
  rate: 1.5,
  ended: true,
  ...overrides,
});

test('stored focus sessions keep valid records and leave the rest out', () => {
  const sessions = normalizeFocusSessions([
    session(),
    { ...session(), watchedSeconds: 61.6, rate: 9, ended: 'yes' },
    { ...session(), date: 'dün' },
    { ...session(), videoId: '' },
    { ...session(), pauses: -1 },
    'x',
  ]);
  assert.deepEqual(sessions, [session(), { ...session(), watchedSeconds: 62, rate: 1, ended: false }]);
  assert.deepEqual(normalizeFocusSessions(null), []);
  assert.deepEqual(focusTotals([session(), session({ watchedSeconds: 30 }), session({ videoId: 'other' })], 'dQw4w9WgXcQ'), {
    seconds: 630,
    sessions: 2,
  });
});

test('only tasks with a real YouTube video play in focus mode', () => {
  assert.equal(focusableVideoId({ videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, 'manual'), 'dQw4w9WgXcQ');
  assert.equal(focusableVideoId({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ?t=40' }, 'manual'), 'dQw4w9WgXcQ');
  assert.equal(focusableVideoId({ videoUrl: '' }, 'manual'), null, 'a topic typed by hand');
  assert.equal(focusableVideoId({ videoUrl: 'https://youtube.com/playlist?list=PL123456789' }, 'legacy-generated'), null);
  assert.equal(focusableVideoId({ videoUrl: 'https://www.youtube.com/watch?v=sample' }, 'legacy-sample'), null);
});

test('the next task is the next open one of the same day that can play', () => {
  const item = (id: string, completed = false, videoUrl = `https://youtu.be/${id.padEnd(11, 'x')}`): DailyPlanItem => ({
    id,
    videoId: id,
    playlistId: 'mat',
    subject: 'Matematik',
    title: id,
    durationMinutes: 30,
    effectiveMinutes: 30,
    completed,
    videoUrl,
  });
  const items = [
    { item: item('a'), date: '2026-09-26' },
    { item: item('b', true), date: '2026-09-26' },
    { item: item('c'), date: '2026-09-26' },
    { item: item('d', false, ''), date: '2026-09-26' },
    { item: item('e'), date: '2026-09-27' },
  ];
  const canFocus = (i: DailyPlanItem) => focusableVideoId(i, 'manual') !== null;
  assert.equal(nextFocusItem(items, { id: 'a', date: '2026-09-26' }, canFocus)?.item.id, 'c', 'skips the done task');
  assert.equal(nextFocusItem(items, { id: 'c', date: '2026-09-26' }, canFocus)?.item.id, 'a', 'wraps to an earlier open task; skips the topic');
  const rest = items.map(s => (s.item.id === 'a' ? { ...s, item: { ...s.item, completed: true } } : s));
  assert.equal(nextFocusItem(rest, { id: 'c', date: '2026-09-26' }, canFocus), null, 'tomorrow is not pulled ahead');
});

test('focus sessions are kept with the data, in storage and in backups', () => {
  const data: PlannerData = { ...emptyData(), completionDates: { since: '2026-09-26', dates: {}, aheadSince: '2026-09-26' } };
  const next = ops.addFocusSession(data, session());
  assert.deepEqual(next.focusSessions, [session()]);
  assert.deepEqual(data.focusSessions, [], 'the input is not changed');

  assert.deepEqual(readFocusSessions({ version: 1, sessions: [session()] }), [session()]);
  assert.equal(readFocusSessions({ version: 2, sessions: [] }), null, 'a newer store is not read');
  assert.equal(readFocusSessions([session()]), null);

  const restored = parseBackup(JSON.stringify(createBackup(next, '2026-09-26')), '2026-10-01');
  assert.ok(restored.ok);
  if (restored.ok) assert.deepEqual(restored.data.focusSessions, [session()]);
  const { focusSessions: _dropped, ...older } = createBackup(next, '2026-09-26');
  const fromOlder = parseBackup(JSON.stringify(older), '2026-10-01');
  assert.ok(fromOlder.ok && fromOlder.data.focusSessions.length === 0);

  const store = new Map<string, string>([[PROGRESS_KEYS.focusSessions, JSON.stringify({ version: 1, sessions: [session()] })]]);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  try {
    assert.deepEqual(loadPlanner().data.focusSessions, [session()]);
    store.set(PROGRESS_KEYS.focusSessions, '{broken');
    const { data: loaded, notices } = loadPlanner();
    assert.deepEqual(loaded.focusSessions, []);
    assert.ok(notices.some(n => n.id === `unreadable-${PROGRESS_KEYS.focusSessions}`));
    assert.equal(store.get(`${PROGRESS_KEYS.focusSessions}__okunamadi`), '{broken', 'the broken value is copied aside');
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

test('player errors explain what happened, embedding refusals included', () => {
  assert.deepEqual(playerErrorMessage(101), playerErrorMessage(150));
  assert.match(playerErrorMessage(150).body, /başka sitelerde oynatılmasını kapatmış/);
  assert.match(playerErrorMessage(100).title, /bulunamadı/);
  assert.match(playerErrorMessage('api').title, /yüklenemedi/);
  assert.ok(playerErrorMessage(5).title);
});
