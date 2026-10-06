import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StudyCamp } from '../src/types/index.ts';
import { buildAllCampsPlan } from '../src/lib/allCamps.ts';
import { completionToastSubtitle, indexPlans } from '../src/lib/planView.ts';
import { buildCampSchedule } from '../src/utils/roadmapEngine.ts';
import { playlist, prefs, repeat } from './helpers.ts';

const TODAY = '2026-10-06';
const FUTURE = '2026-10-08';

function camp(id: string): StudyCamp {
  return {
    id,
    name: id,
    createdAt: '2026-10-04',
    branches: [playlist(id, repeat(12, 60))],
    schedule: { ...prefs({ startDate: '2026-10-04' }), mode: 'auto', targetEndDate: null, weekPlan: [[], [], [], [], [], [], []] },
    shiftEvents: [],
  };
}

for (const combined of [false, true]) {
  test(`completion toast explains a future task leaving its day (${combined ? 'all camps' : 'single camp'})`, () => {
    const camps = [camp('mat'), camp('fiz')];
    const build = (completedMap: Record<string, boolean> = {}, dates: Record<string, string> = {}) => {
      const options = { today: TODAY, completedMap, completionDays: { aheadSince: TODAY, dates } };
      return combined ? buildAllCampsPlan(camps, options).plans : buildCampSchedule(camps[0], options).plans;
    };
    const before = indexPlans(build(), TODAY);
    const futureTask = before.items.find(s => s.date === FUTURE && s.item.playlistId === 'mat')!;
    assert.equal(completionToastSubtitle(futureTask.date, TODAY), 'Bugüne eklendi');

    const { videoId } = futureTask.item;
    const after = indexPlans(build({ [videoId]: true }, { [videoId]: TODAY }), TODAY);
    const moved = after.items.find(s => s.item.id === futureTask.item.id)!;
    assert.equal(moved.date, TODAY);
    assert.equal(moved.item.completed, true);
    assert.ok(!after.byDate.get(FUTURE)!.items.some(i => i.id === futureTask.item.id));
    assert.ok(after.byDate.get(FUTURE)!.items.some(i => !before.byDate.get(FUTURE)!.items.some(previous => previous.id === i.id)));

    // Read the pre-tick day: the rebuilt plan already places the completed task on today.
    assert.equal(completionToastSubtitle(moved.date, TODAY), undefined);
    for (const entry of before.items.filter(s => s.date <= TODAY)) {
      assert.equal(completionToastSubtitle(entry.date, TODAY), undefined, `no subtitle for ${entry.date}`);
    }
  });
}

test('completion toast does not claim relocation when a task has no planned date', () => {
  assert.equal(completionToastSubtitle(undefined, TODAY), undefined);
});
