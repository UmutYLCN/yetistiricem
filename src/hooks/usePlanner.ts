import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SubjectPlaylist, UserPreferences } from '../types';
import type { ShiftEvent } from '../lib/engine';
import { STORAGE_KEYS } from '../lib/engine';
import { buildDemoData } from '../lib/demo';
import type { Notice, PlannerData } from '../lib/persistence';
import { MAX_NOTE_LENGTH, UI_KEYS, clearAllStorage, emptyData, loadPlannerOnce, writeKey } from '../lib/persistence';

interface StoreState {
  real: PlannerData;
  /** In-memory sample data while the demo preview is open; never saved. */
  demo: PlannerData | null;
  realSelected: string;
  demoSelected: string;
}

/** Saves `value` under `key` whenever it changes after the first load. */
function usePersist(key: string, value: unknown, onFail: () => void) {
  const last = useRef(value);
  useEffect(() => {
    if (value === last.current) return;
    last.current = value;
    if (!writeKey(key, value)) onFail();
  }, [key, value, onFail]);
}

/** Removes completion marks that belonged only to the given videos. */
function pruneCompletion(completed: Record<string, boolean>, removedIds: string[], remaining: SubjectPlaylist[]) {
  const stillUsed = new Set(remaining.flatMap(p => p.videos.map(v => v.id)));
  const next = { ...completed };
  for (const id of removedIds) {
    if (!stillUsed.has(id)) delete next[id];
  }
  return next;
}

export function usePlanner(today: string) {
  const [state, setState] = useState<StoreState>(() => {
    const initial = loadPlannerOnce();
    return { real: initial.data, demo: null, realSelected: initial.selectedDate, demoSelected: today };
  });
  const [notices, setNotices] = useState<Notice[]>(() => loadPlannerOnce().notices);
  const storageAvailable = loadPlannerOnce().storageAvailable;

  const reportSaveFailure = useCallback(() => {
    setNotices(current =>
      current.some(n => n.id === 'save-failed')
        ? current
        : [
            ...current,
            {
              id: 'save-failed',
              tone: 'warn',
              title: 'Değişiklikler kaydedilemedi',
              body: 'Tarayıcı depolaması dolu ya da engelli. Verilerini kaybetmemek için Ayarlar’dan yedek indir.',
            },
          ]
    );
  }, []);

  usePersist(STORAGE_KEYS.preferences, state.real.preferences, reportSaveFailure);
  usePersist(STORAGE_KEYS.playlists, state.real.playlists, reportSaveFailure);
  usePersist(STORAGE_KEYS.completed, state.real.completedMap, reportSaveFailure);
  usePersist(STORAGE_KEYS.shiftEvents, state.real.shiftEvents, reportSaveFailure);
  usePersist(UI_KEYS.dayNotes, state.real.dayNotes, reportSaveFailure);
  usePersist(UI_KEYS.selectedDate, state.realSelected, reportSaveFailure);

  const update = useCallback((fn: (data: PlannerData) => PlannerData) => {
    setState(s => (s.demo ? { ...s, demo: fn(s.demo) } : { ...s, real: fn(s.real) }));
  }, []);

  const actions = useMemo(
    () => ({
      setSelectedDate: (date: string) =>
        setState(s => (s.demo ? { ...s, demoSelected: date } : { ...s, realSelected: date })),

      setCompleted: (videoId: string, done: boolean) =>
        update(d => {
          const completedMap = { ...d.completedMap };
          if (done) completedMap[videoId] = true;
          else delete completedMap[videoId];
          return { ...d, completedMap };
        }),

      addCamp: (camp: SubjectPlaylist) => update(d => ({ ...d, playlists: [...d.playlists, camp] })),

      updateCamp: (camp: SubjectPlaylist) =>
        update(d => {
          const before = d.playlists.find(p => p.id === camp.id);
          const playlists = d.playlists.map(p => (p.id === camp.id ? camp : p));
          const keptIds = new Set(camp.videos.map(v => v.id));
          const removed = before ? before.videos.filter(v => !keptIds.has(v.id)).map(v => v.id) : [];
          return { ...d, playlists, completedMap: pruneCompletion(d.completedMap, removed, playlists) };
        }),

      removeCamp: (campId: string) =>
        update(d => {
          const camp = d.playlists.find(p => p.id === campId);
          const playlists = d.playlists.filter(p => p.id !== campId);
          const removed = camp ? camp.videos.map(v => v.id) : [];
          return { ...d, playlists, completedMap: pruneCompletion(d.completedMap, removed, playlists) };
        }),

      addShiftEvent: (event: ShiftEvent) => update(d => ({ ...d, shiftEvents: [...d.shiftEvents, event] })),

      removeShiftEvent: (event: ShiftEvent) =>
        update(d => ({ ...d, shiftEvents: d.shiftEvents.filter(e => e !== event) })),

      setPreferences: (preferences: UserPreferences) => update(d => ({ ...d, preferences })),

      setDayNote: (date: string, text: string) =>
        update(d => {
          const dayNotes = { ...d.dayNotes };
          const value = text.slice(0, MAX_NOTE_LENGTH);
          if (value.trim()) dayNotes[date] = value;
          else delete dayNotes[date];
          return { ...d, dayNotes };
        }),

      /** Replaces the saved data with a validated backup. */
      restore: (data: PlannerData, selectedDate: string | null) =>
        setState(s => ({ ...s, demo: null, real: data, realSelected: selectedDate ?? s.realSelected })),

      /** Deletes every saved key and starts empty. */
      reset: (todayKeyNow: string) => {
        clearAllStorage();
        setState(s => ({ ...s, demo: null, real: emptyData(todayKeyNow), realSelected: todayKeyNow }));
      },

      startDemo: (todayKeyNow: string) =>
        setState(s => ({ ...s, demo: buildDemoData(todayKeyNow), demoSelected: todayKeyNow })),

      exitDemo: () => setState(s => ({ ...s, demo: null })),

      dismissNotice: (id: string) => setNotices(current => current.filter(n => n.id !== id)),
    }),
    [update]
  );

  const isDemo = state.demo !== null;
  return {
    data: state.demo ?? state.real,
    realData: state.real,
    isDemo,
    selectedDate: isDemo ? state.demoSelected : state.realSelected,
    notices,
    storageAvailable,
    actions,
  };
}

export type PlannerActions = ReturnType<typeof usePlanner>['actions'];
