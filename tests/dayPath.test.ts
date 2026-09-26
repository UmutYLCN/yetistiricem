import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DailyPlanItem } from '../src/types/index.ts';
import type { CampPlanItem } from '../src/lib/allCamps.ts';
import { bendPath, dayStops, isWalked, labelSideOf, laneOf, pathGeometry } from '../src/lib/dayPath.ts';
import type { PathStop } from '../src/lib/dayPath.ts';
import { daySummaryOf } from '../src/lib/planView.ts';

const TODAY = '2026-09-26';

function task(id: string, playlistId: string, completed = false): DailyPlanItem {
  return {
    id,
    videoId: id,
    playlistId,
    subject: playlistId,
    title: `${id} dersi`,
    durationMinutes: 30,
    effectiveMinutes: 30,
    completed,
    videoUrl: '',
  };
}

function dayOf(date: string, items: DailyPlanItem[]) {
  const plan = {
    date,
    dayName: '',
    isToday: date === TODAY,
    isPast: date < TODAY,
    isRestDay: false,
    isMockExamDay: false,
    items,
    totalMinutes: items.reduce((acc, i) => acc + i.effectiveMinutes, 0),
    isAllCompleted: items.every(i => i.completed),
  };
  return daySummaryOf(date, plan, 'study');
}

const ids = (stops: PathStop[]) => stops.map(s => s.item.id);
const states = (stops: PathStop[]) => stops.map(s => s.state);

test('stops keep the day list order: each branch together, in order of its first task', () => {
  const stops = dayStops(dayOf(TODAY, [task('a1', 'A'), task('b1', 'B'), task('a2', 'A')]), TODAY);
  assert.deepEqual(ids(stops), ['a1', 'a2', 'b1']);
});

test('today the path waits at the first open task, wherever the ticked ones are', () => {
  assert.deepEqual(states(dayStops(dayOf(TODAY, [task('a1', 'A', true), task('a2', 'A'), task('a3', 'A')]), TODAY)), [
    'done',
    'next',
    'open',
  ]);
  assert.deepEqual(states(dayStops(dayOf(TODAY, [task('a1', 'A'), task('a2', 'A', true), task('a3', 'A')]), TODAY)), [
    'next',
    'done',
    'open',
  ]);
  assert.deepEqual(states(dayStops(dayOf(TODAY, [task('a1', 'A', true), task('a2', 'A', true)]), TODAY)), ['done', 'done']);
});

test('a past day marks its open tasks missed; a day to come has no next stop', () => {
  const past = dayStops(dayOf('2026-09-24', [task('a1', 'A', true), task('a2', 'A')]), TODAY);
  assert.deepEqual(states(past), ['done', 'missed']);
  const future = dayStops(dayOf('2026-09-28', [task('a1', 'A'), task('a2', 'A')]), TODAY);
  assert.deepEqual(states(future), ['open', 'open']);
});

test('"Tüm Kamplar" lists the day camp by camp, each branch by branch', () => {
  const item = (id: string, playlistId: string, campId: string): CampPlanItem => ({ ...task(id, playlistId), campId });
  const first = [item('x1', 'X', 'c1'), item('y1', 'Y', 'c1'), item('x2', 'X', 'c1')];
  const second = [item('z1', 'Z', 'c2')];
  const part = (campId: string, items: CampPlanItem[]) => ({
    campId,
    kind: 'study' as const,
    free: false,
    items,
    total: items.length,
    done: 0,
    minutes: 0,
    doneMinutes: 0,
  });
  const summary = { ...dayOf(TODAY, [...second, ...first]), camps: [part('c1', first), part('c2', second)] };
  assert.deepEqual(ids(dayStops(summary, TODAY)), ['x1', 'x2', 'y1', 'z1']);
});

test('the path is walked up to where it waits, and reaches the finish once every stop is done', () => {
  const stops = dayStops(dayOf(TODAY, [task('a1', 'A', true), task('a2', 'A', true), task('a3', 'A'), task('a4', 'A')]), TODAY);
  assert.deepEqual(
    stops.map((_, i) => isWalked(stops, i)),
    [true, true, false, false]
  );
  const done = dayStops(dayOf(TODAY, [task('a1', 'A', true), task('a2', 'A', true)]), TODAY);
  assert.deepEqual(
    done.map((_, i) => isWalked(done, i)),
    [true, true]
  );
  // The last stop is done but an earlier one is not: the finish is not reached.
  const gap = dayStops(dayOf(TODAY, [task('a1', 'A'), task('a2', 'A', true)]), TODAY);
  assert.deepEqual(
    gap.map((_, i) => isWalked(gap, i)),
    [false, false]
  );
});

test('labels sit on the roomier side, away from where the path bends next', () => {
  for (let i = 0; i < 24; i++) {
    const lane = laneOf(i);
    const side = labelSideOf(i);
    if (lane > 0) assert.equal(side, 'left', `stop ${i}`);
    else if (lane < 0) assert.equal(side, 'right', `stop ${i}`);
    else assert.equal(side, laneOf(i + 1) > 0 ? 'left' : 'right', `centred stop ${i}`);
  }
});

test('stops stay inside the path and step down evenly', () => {
  for (const width of [288, 343, 600]) {
    const geometry = pathGeometry(9, width);
    assert.equal(geometry.points.length, 10, 'a point per stop and the finish');
    const radius = geometry.node / 2;
    for (const point of geometry.points) {
      assert.ok(point.x - radius >= 0 && point.x + radius <= width, `inside at width ${width}`);
    }
    const steps = geometry.points.slice(1).map((p, i) => p.y - geometry.points[i].y);
    assert.ok(steps.every(step => step === steps[0] && step > geometry.node), 'even gaps wider than a stop');
    assert.ok(geometry.height > geometry.points[9].y + radius, 'room under the finish');
  }
  assert.ok(pathGeometry(3, 343).node < pathGeometry(3, 600).node, 'smaller stops on phones');
});

test('a bend leaves and enters its stops vertically', () => {
  assert.equal(bendPath({ x: 100, y: 50 }, { x: 180.25, y: 182 }), 'M 100 50 C 100 116 180.3 116 180.3 182');
});
