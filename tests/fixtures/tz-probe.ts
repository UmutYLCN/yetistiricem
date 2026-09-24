// Prints date results for the time zone in TZ, for tests/dates.test.ts.
import { assessDeadline, buildCampSchedule, buildSchedule, createShiftEvent, planEndDate } from '../../src/utils/roadmapEngine.ts';
import { addDays, dayOfWeek, formatDateKey, normalizeDateKey, parseDateKey, toDateKey } from '../../src/utils/date.ts';
import { layout, playlist, prefs, repeat } from '../helpers.ts';

const playlists = [playlist('mat', repeat(20, 50)), playlist('geo', repeat(12, 45))];
const pref = prefs({ restDays: [0], activeDays: [1, 2, 3, 4, 5, 6], startDate: '2026-10-22' }); // spans EU and US DST ends
const schedule = buildSchedule(playlists, pref, { today: '2026-10-28' });
const event = createShiftEvent('2026-10-27', schedule.plans, '2026-10-28');
const shifted = buildSchedule(playlists, pref, { today: '2026-10-28', shiftEvents: event ? [event] : [] });
// A manual week across the same DST changes: Matematik on Mon/Wed, Geometri on Tue/Sat, Sunday mock exam.
const manualCamp = {
  branches: playlists,
  shiftEvents: [],
  schedule: { ...pref, mode: 'manual' as const, targetEndDate: '2026-11-15', mockExamDays: [0], weekPlan: [[], ['mat'], ['geo'], ['mat'], [], [], ['geo']] },
};
const manual = buildCampSchedule(manualCamp, { today: '2026-10-28' });

console.log(JSON.stringify({
  layout: layout(schedule.plans),
  dayNames: schedule.plans.map(p => p.dayName),
  shifted: layout(shifted.plans),
  manual: layout(manual.plans),
  manualDeadline: assessDeadline({ finishDate: planEndDate(manual.plans), targetEndDate: manualCamp.schedule.targetEndDate }),
  legacyIstanbulLateNight: normalizeDateKey('2026-09-23T22:30:00.000Z'),
  legacyMidday: normalizeDateKey('2026-09-24T12:00:00.000Z'),
  plainKey: normalizeDateKey('2026-09-24'),
  roundTrip: toDateKey(parseDateKey('2026-03-29')),
  dstWalk: Array.from({ length: 10 }, (_, i) => addDays('2026-10-24', i)),
  dow: dayOfWeek('2026-11-01'),
  formatted: formatDateKey('2026-09-24'),
}));
