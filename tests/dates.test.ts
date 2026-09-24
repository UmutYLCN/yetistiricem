import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  addDays, dayOfWeek, diffDays, formatDateKey, isDateKey, normalizeDateKey, parseDateKey, toDateKey, weekdayName,
} from '../src/utils/date.ts';

test('date keys: validation and calendar arithmetic', () => {
  assert.ok(isDateKey('2028-02-29'));
  for (const bad of ['2026-02-29', '2026-13-01', '2026-9-1', '2026-09-24T00:00:00Z', '', 42, null]) {
    assert.equal(isDateKey(bad), false, String(bad));
  }
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-09-24', '2026-10-24'), 30);
  assert.equal(dayOfWeek('2026-09-24'), 4); // Thursday
  assert.equal(dayOfWeek('2026-09-27'), 0); // Sunday
  assert.equal(weekdayName('2026-09-24'), 'Perşembe');
  assert.equal(formatDateKey('2026-09-24'), '24 Eylül');
  assert.throws(() => addDays('24.09.2026', 1), RangeError);
});

test('normalizeDateKey keeps plain keys and falls back on junk', () => {
  assert.equal(normalizeDateKey('2026-09-24', 'x'), '2026-09-24');
  assert.equal(normalizeDateKey(' 2026-09-24 ', 'x'), '2026-09-24');
  assert.equal(normalizeDateKey('dün', 'x'), 'x');
  assert.equal(normalizeDateKey(undefined, 'x'), 'x');
  assert.equal(normalizeDateKey(new Date(Number.NaN), 'x'), 'x');
  assert.equal(normalizeDateKey('2026-02-30T10:00:00Z', 'x'), 'x');
  const local = new Date(2026, 8, 24, 0, 30);
  assert.equal(normalizeDateKey(local.toISOString(), 'x'), '2026-09-24');
  assert.equal(normalizeDateKey(local.getTime(), 'x'), '2026-09-24');
  assert.equal(toDateKey(parseDateKey('2026-09-24')), '2026-09-24');
});

const probe = fileURLToPath(new URL('./fixtures/tz-probe.ts', import.meta.url));
const runProbe = (tz: string) =>
  JSON.parse(
    execFileSync(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', probe], {
      env: { ...process.env, TZ: tz },
      encoding: 'utf8',
    })
  );

const zones: Record<string, { lateNight: string; midday: string }> = {
  UTC: { lateNight: '2026-09-23', midday: '2026-09-24' },
  'Europe/Istanbul': { lateNight: '2026-09-24', midday: '2026-09-24' }, // UTC+3
  'Pacific/Kiritimati': { lateNight: '2026-09-24', midday: '2026-09-25' }, // UTC+14
  'America/New_York': { lateNight: '2026-09-23', midday: '2026-09-24' }, // DST ends 2026-11-01
  'America/St_Johns': { lateNight: '2026-09-23', midday: '2026-09-24' }, // UTC-2:30 / -3:30
  'Pacific/Pago_Pago': { lateNight: '2026-09-23', midday: '2026-09-24' }, // UTC-11
};

test('schedules and dates are identical in every time zone', () => {
  const results = Object.fromEntries(Object.keys(zones).map(tz => [tz, runProbe(tz)]));
  const reference = results.UTC;
  assert.equal(reference.layout[0].date, '2026-10-22', 'plan starts on the start date');
  const dates = reference.layout.map((d: { date: string }) => d.date);
  dates.forEach((date: string, i: number) => i > 0 && assert.equal(date, addDays(dates[i - 1], 1)));
  assert.ok(reference.layout.filter((d: { isRestDay: boolean }) => d.isRestDay).every((d: { date: string }) => dayOfWeek(d.date) === 0));
  // Manual week: only the assigned weekdays hold videos, Sundays are mock exams.
  for (const day of reference.manual as { date: string; isMockExamDay: boolean; items: string[] }[]) {
    const dow = dayOfWeek(day.date);
    if (day.items.length > 0) assert.ok([1, 2, 3, 6].includes(dow), `${day.date} is an assigned weekday`);
    if (dow === 1 || dow === 3) assert.ok(day.items.every(id => id.startsWith('mat-')), day.date);
    if (dow === 2 || dow === 6) assert.ok(day.items.every(id => id.startsWith('geo-')), day.date);
    if (dow === 0) assert.ok(day.isMockExamDay, day.date);
  }
  assert.deepEqual(reference.manualDeadline, { kind: 'late', finishDate: '2026-11-25', targetEndDate: '2026-11-15', lateDays: 10 });

  for (const [tz, expected] of Object.entries(zones)) {
    const r = results[tz];
    assert.deepEqual(r.layout, reference.layout, `${tz} layout`);
    assert.deepEqual(r.dayNames, reference.dayNames, `${tz} day names`);
    assert.deepEqual(r.shifted, reference.shifted, `${tz} shifted layout`);
    assert.deepEqual(r.manual, reference.manual, `${tz} manual week layout`);
    assert.deepEqual(r.manualDeadline, reference.manualDeadline, `${tz} deadline`);
    assert.deepEqual(r.dstWalk, reference.dstWalk, `${tz} addDays across DST`);
    assert.equal(r.dow, 0, `${tz} weekday`);
    assert.equal(r.plainKey, '2026-09-24', tz);
    assert.equal(r.roundTrip, '2026-03-29', tz);
    assert.equal(r.formatted, '24 Eylül', tz);
    assert.equal(r.legacyIstanbulLateNight, expected.lateNight, `${tz} legacy timestamp → local day`);
    assert.equal(r.legacyMidday, expected.midday, `${tz} legacy midday timestamp`);
  }
});
