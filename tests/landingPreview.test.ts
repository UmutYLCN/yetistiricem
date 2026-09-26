import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from '../src/utils/date.ts';
import { buildLandingPreview } from '../src/lib/landingPreview.ts';

test('the landing preview shows a day with tasks on every weekday, rest days included', () => {
  for (let offset = 0; offset < 7; offset++) {
    const today = addDays('2026-09-21', offset);
    const preview = buildLandingPreview(today);
    assert.ok(preview.day.total > 0, today);
    assert.ok(preview.day.date >= today && preview.day.date <= addDays(today, 6), today);
    assert.equal(preview.week.length, 7);
    assert.ok(preview.week.some(day => day.date === preview.day.date), today);
  }
});

test('ticking a task off in the preview only marks it done', () => {
  const today = '2026-09-23';
  const before = buildLandingPreview(today);
  const open = before.day.plan?.items.find(item => !item.completed);
  assert.ok(open, 'the demo leaves tasks open today');

  const after = buildLandingPreview(today, [open.videoId]);
  assert.deepEqual(
    after.day.plan?.items.map(item => item.id),
    before.day.plan?.items.map(item => item.id)
  );
  assert.equal(after.day.done, before.day.done + 1);
  assert.equal(after.stats.completedVideos, before.stats.completedVideos + 1);
});
