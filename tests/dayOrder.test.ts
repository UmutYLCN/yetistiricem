import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule } from '../src/utils/roadmapEngine.ts';
import { groupByBranch } from '../src/lib/planView.ts';
import { deepFreeze, layout, playlist, prefs, repeat } from './helpers.ts';

const task = (playlistId: string, n: number) => ({ id: `${playlistId}${n}`, playlistId });
const ids = (items: { id: string }[]) => items.map(i => i.id);

/** Branch ids in list order, one entry per run of consecutive tasks. */
function runs(items: { playlistId: string }[]): string[] {
  return items.map(i => i.playlistId).filter((id, i, all) => i === 0 || all[i - 1] !== id);
}

test('interleaved branches become contiguous groups', () => {
  const day = [task('A', 1), task('B', 1), task('A', 2), task('B', 2)];
  assert.deepEqual(ids(groupByBranch(day)), ['A1', 'A2', 'B1', 'B2']);
});

test('groups follow the first appearance of each branch and keep their inner order', () => {
  const day = deepFreeze([task('B', 1), task('A', 1), task('C', 1), task('A', 2), task('B', 2), task('A', 3)]);
  const grouped = groupByBranch(day);
  assert.deepEqual(ids(grouped), ['B1', 'B2', 'A1', 'A2', 'A3', 'C1']);
  assert.deepEqual(ids(day), ['B1', 'A1', 'C1', 'A2', 'B2', 'A3'], 'the input is not reordered');
  assert.equal(grouped[0], day[0], 'the same item objects are returned');
});

test('lists that are already grouped, single-branch or empty are unchanged', () => {
  const grouped = [task('A', 1), task('A', 2), task('B', 1)];
  assert.deepEqual(ids(groupByBranch(grouped)), ids(grouped));
  assert.deepEqual(ids(groupByBranch([task('A', 1), task('A', 2)])), ['A1', 'A2']);
  assert.deepEqual(groupByBranch([]), []);
});

test('branches are told apart by id, not by name', () => {
  const day = [
    { id: 'x1', playlistId: 'mat-a', subject: 'Matematik' },
    { id: 'y1', playlistId: 'mat-b', subject: 'Matematik' },
    { id: 'x2', playlistId: 'mat-a', subject: 'Matematik' },
  ];
  assert.deepEqual(ids(groupByBranch(day)), ['x1', 'x2', 'y1']);
});

test('a round-robin day from the engine is grouped without losing or repeating tasks', () => {
  const playlists = [playlist('mat', repeat(6, 20)), playlist('fiz', repeat(6, 20)), playlist('kim', repeat(6, 20))];
  const { plans } = buildSchedule(playlists, prefs({ dailyStudyHours: 2 }), { completedMap: { 'fiz-1': true }, today: '2026-09-21' });
  const before = layout(plans);

  for (const plan of plans) {
    const grouped = groupByBranch(plan.items);
    assert.deepEqual([...ids(grouped)].sort(), [...ids(plan.items)].sort(), `${plan.date}: same tasks`);
    assert.equal(new Set(ids(grouped)).size, grouped.length, `${plan.date}: no task twice`);
    assert.deepEqual(runs(grouped), [...new Set(runs(plan.items))], `${plan.date}: one run per branch, first-seen order`);
    for (const id of new Set(grouped.map(i => i.playlistId))) {
      const own = (list: typeof grouped) => ids(list.filter(i => i.playlistId === id));
      assert.deepEqual(own(grouped), own(plan.items), `${plan.date}: ${id} keeps its order`);
    }
  }

  const first = plans[0].items;
  assert.ok(runs(first).length > new Set(runs(first)).size, 'the engine interleaves the first day');
  assert.deepEqual(ids(groupByBranch(first)), ['mat-1', 'mat-2', 'fiz-1', 'fiz-2', 'kim-1', 'kim-2']);
  assert.ok(groupByBranch(first).find(i => i.id === 'fiz-1')?.completed, 'completion marks come along');
  assert.deepEqual(layout(plans), before, 'the plan itself is not reordered');
});
