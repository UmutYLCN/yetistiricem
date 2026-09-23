// Prints date results for the time zone in TZ, for tests/dates.test.ts.
import { buildSchedule, createShiftEvent } from '../../src/utils/roadmapEngine.ts';
import { addDays, dayOfWeek, formatDateKey, normalizeDateKey, parseDateKey, toDateKey } from '../../src/utils/date.ts';
import { layout, playlist, prefs, repeat } from '../helpers.ts';

const playlists = [playlist('mat', repeat(20, 50)), playlist('geo', repeat(12, 45))];
const pref = prefs({ restDays: [0], activeDays: [1, 2, 3, 4, 5, 6], startDate: '2026-10-22' }); // spans EU and US DST ends
const schedule = buildSchedule(playlists, pref, { today: '2026-10-28' });
const event = createShiftEvent('2026-10-27', schedule.plans, '2026-10-28');
const shifted = buildSchedule(playlists, pref, { today: '2026-10-28', shiftEvents: event ? [event] : [] });

console.log(JSON.stringify({
  layout: layout(schedule.plans),
  dayNames: schedule.plans.map(p => p.dayName),
  shifted: layout(shifted.plans),
  legacyIstanbulLateNight: normalizeDateKey('2026-09-23T22:30:00.000Z'),
  legacyMidday: normalizeDateKey('2026-09-24T12:00:00.000Z'),
  plainKey: normalizeDateKey('2026-09-24'),
  roundTrip: toDateKey(parseDateKey('2026-03-29')),
  dstWalk: Array.from({ length: 10 }, (_, i) => addDays('2026-10-24', i)),
  dow: dayOfWeek('2026-11-01'),
  formatted: formatDateKey('2026-09-24'),
}));
