import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CampSchedule, StudyCamp, SubjectPlaylist } from '../types/index.ts';
import type { CampScope, CampShift } from '../lib/allCamps';
import { STORAGE_KEYS } from '../lib/engine';
import { buildDemoData } from '../lib/demo';
import * as ops from '../lib/plannerOps';
import type { Notice, PlannerData } from '../lib/persistence';
import type { FocusSession } from '../lib/focus';
import type { CompletionDates } from '../lib/persistence';
import type { PlaylistFailure } from '../lib/playlistImport';
import type { PlaylistSync } from '../lib/playlistSync';
import { playlistSyncStore } from '../lib/playlistSync';
import type { PlaylistEntry } from '../utils/youtubePlaylist';
import {
  CAMP_KEYS,
  PROGRESS_KEYS,
  UI_KEYS,
  campStore,
  clearAllStorage,
  completionDatesStore,
  emptyData,
  focusSessionsStore,
  loadPlannerOnce,
  writeKey,
} from '../lib/persistence';

interface StoreState {
  real: PlannerData;
  /** In-memory sample data while the demo preview is open; never saved. */
  demo: PlannerData | null;
  realSelected: string;
  demoSelected: string;
  /** "Tüm Kamplar" or one camp; null until the user picks (see `resolveCampScope`). */
  realScope: CampScope | null;
  demoScope: CampScope | null;
}

/** Saves `value` under `key` whenever it changes after the first load. */
function usePersist(key: string, value: unknown, onFail: () => void, serialize: (value: unknown) => unknown = v => v) {
  const last = useRef(value);
  useEffect(() => {
    if (value === last.current) return;
    last.current = value;
    if (!writeKey(key, serialize(value))) onFail();
  }, [key, value, onFail, serialize]);
}

const serializeCamps = (camps: unknown) => campStore(camps as StudyCamp[]);
const serializeCompletionDates = (value: unknown) => completionDatesStore(value as CompletionDates);
const serializeFocusSessions = (value: unknown) => focusSessionsStore(value as FocusSession[]);
const serializePlaylistSync = (value: unknown) => playlistSyncStore(value as PlaylistSync);

/** `startInDemo`: open with the demo preview; the saved data still loads underneath. */
export function usePlanner(today: string, { startInDemo = false }: { startInDemo?: boolean } = {}) {
  const [state, setState] = useState<StoreState>(() => {
    const initial = loadPlannerOnce();
    return {
      real: initial.data,
      demo: startInDemo ? buildDemoData(today) : null,
      realSelected: initial.selectedDate,
      demoSelected: today,
      realScope: initial.campScope,
      demoScope: null,
    };
  });
  const [notices, setNotices] = useState<Notice[]>(() => loadPlannerOnce().notices);
  const storageAvailable = loadPlannerOnce().storageAvailable;
  const seedPreferences = loadPlannerOnce().seedPreferences;

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

  usePersist(CAMP_KEYS.camps, state.real.camps, reportSaveFailure, serializeCamps);
  usePersist(CAMP_KEYS.activeCamp, state.real.activeCampId, reportSaveFailure);
  usePersist(STORAGE_KEYS.completed, state.real.completedMap, reportSaveFailure);
  usePersist(PROGRESS_KEYS.completionDates, state.real.completionDates, reportSaveFailure, serializeCompletionDates);
  usePersist(PROGRESS_KEYS.focusSessions, state.real.focusSessions, reportSaveFailure, serializeFocusSessions);
  usePersist(PROGRESS_KEYS.playlistSync, state.real.playlistSync, reportSaveFailure, serializePlaylistSync);
  usePersist(UI_KEYS.dayNotes, state.real.dayNotes, reportSaveFailure);
  usePersist(UI_KEYS.selectedDate, state.realSelected, reportSaveFailure);
  usePersist(UI_KEYS.campScope, state.realScope, reportSaveFailure);

  const update = useCallback((fn: (data: PlannerData) => PlannerData) => {
    setState(s => (s.demo ? { ...s, demo: fn(s.demo) } : { ...s, real: fn(s.real) }));
  }, []);

  const actions = useMemo(
    () => ({
      setSelectedDate: (date: string) =>
        setState(s => (s.demo ? { ...s, demoSelected: date } : { ...s, realSelected: date })),

      /** A view choice only; the active (managed) camp does not change. */
      setCampScope: (scope: CampScope) => setState(s => (s.demo ? { ...s, demoScope: scope } : { ...s, realScope: scope })),

      /** A tick records today as the day the video was done. */
      setCompleted: (videoId: string, done: boolean) => update(d => ops.setCompleted(d, videoId, done, today)),
      addFocusSession: (session: FocusSession) => update(d => ops.addFocusSession(d, session)),
      recordPlaylistCheck: (campId: string, branchId: string, entries: PlaylistEntry[]) =>
        update(d => ops.recordPlaylistCheck(d, campId, branchId, entries, today)),
      finishPlaylistCheck: (failure: Exclude<PlaylistFailure, 'aborted'> | null) => update(d => ops.finishPlaylistCheck(d, today, failure)),
      acceptPlaylistVideos: (campId: string, branchId: string) => update(d => ops.acceptPlaylistVideos(d, campId, branchId, today)),
      dismissPlaylistVideos: (branchId: string) => update(d => ops.dismissPlaylistVideos(d, branchId)),
      createCamp: (camp: StudyCamp) => update(d => ops.createCamp(d, camp)),
      setActiveCamp: (campId: string) => update(d => ops.setActiveCamp(d, campId)),
      renameCamp: (campId: string, name: string) => update(d => ops.renameCamp(d, campId, name)),
      setCampSchedule: (campId: string, schedule: CampSchedule) => update(d => ops.setCampSchedule(d, campId, schedule)),
      removeCamp: (campId: string) => update(d => ops.removeCamp(d, campId)),
      addBranches: (campId: string, branches: SubjectPlaylist[], options: { weekdays?: number[]; today: string }) =>
        update(d => ops.addBranches(d, campId, branches, options)),
      updateBranch: (campId: string, branch: SubjectPlaylist) => update(d => ops.updateBranch(d, campId, branch)),
      removeBranch: (campId: string, branchId: string) => update(d => ops.removeBranch(d, campId, branchId)),
      addShiftEvents: (shifts: CampShift[]) => update(d => ops.addShiftEvents(d, shifts)),
      removeShiftEvents: (shifts: CampShift[]) => update(d => ops.removeShiftEvents(d, shifts)),

      /** Replaces the saved data with a validated backup. */
      restore: (data: PlannerData, selectedDate: string | null) =>
        setState(s => ({ ...s, demo: null, real: data, realSelected: selectedDate ?? s.realSelected })),

      /** Deletes every saved key and starts empty. */
      reset: (todayKeyNow: string) => {
        clearAllStorage();
        setState(s => ({ ...s, demo: null, real: emptyData(), realSelected: todayKeyNow, realScope: null }));
      },

      startDemo: (todayKeyNow: string) =>
        setState(s => ({ ...s, demo: buildDemoData(todayKeyNow), demoSelected: todayKeyNow, demoScope: null })),

      exitDemo: () => setState(s => ({ ...s, demo: null })),

      dismissNotice: (id: string) => setNotices(current => current.filter(n => n.id !== id)),
    }),
    [update, today]
  );

  const isDemo = state.demo !== null;
  return {
    data: state.demo ?? state.real,
    realData: state.real,
    isDemo,
    selectedDate: isDemo ? state.demoSelected : state.realSelected,
    campScope: isDemo ? state.demoScope : state.realScope,
    notices,
    storageAvailable,
    seedPreferences,
    actions,
  };
}

export type PlannerActions = ReturnType<typeof usePlanner>['actions'];
