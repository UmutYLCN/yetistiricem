import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StudyCamp } from '../src/types/index.ts';
import type { SharedCamp } from '../src/lib/campShare.ts';
import { MAX_JSON_BYTES, campFromShare, decodeCampShare, encodeCampShare, isImportedCamp, readSharedCamp, shareSummary, toSharedCamp } from '../src/lib/campShare.ts';
import { normalizeCamps } from '../src/lib/studyCamp.ts';
import { buildCampSchedule } from '../src/utils/roadmapEngine.ts';
import { prefs } from './helpers.ts';

const yt = (n: number) => `share${String(n).padStart(6, '0')}`; // 11 characters

function sourceCamp(): StudyCamp {
  const video = (n: number, branch: string) => ({
    id: `${branch}-${n}`,
    title: `Ders ${n}`,
    durationMinutes: 30 + n,
    videoUrl: `https://www.youtube.com/watch?v=${yt(n)}`,
    thumbnailUrl: '',
    completed: true,
    channelName: 'Hoca',
  });
  return {
    id: 'camp-a',
    name: 'TYT 2027',
    createdAt: '2026-09-01',
    branches: [
      {
        id: 'mat',
        title: 'TYT Matematik',
        subject: 'Matematik',
        channelName: 'Hoca',
        playlistUrl: 'https://www.youtube.com/playlist?list=PLabcdefghij1234',
        colorTag: 'ink',
        source: 'manual',
        totalDurationMinutes: 63,
        videos: [video(1, 'mat'), video(2, 'mat')],
      },
      {
        id: 'topics',
        title: 'Elle eklenen konular',
        subject: 'Fizik',
        channelName: '',
        playlistUrl: '',
        colorTag: 'clay',
        source: 'manual',
        totalDurationMinutes: 45,
        videos: [{ id: 't-1', title: 'Vektörler', durationMinutes: 45, videoUrl: '', thumbnailUrl: '', completed: false }],
      },
      {
        id: 'demo',
        title: 'Örnek',
        subject: 'Kimya',
        channelName: '',
        playlistUrl: '',
        colorTag: 'teal',
        source: 'demo-template',
        totalDurationMinutes: 20,
        videos: [{ id: 'd-1', title: 'Mol', durationMinutes: 20, videoUrl: '', thumbnailUrl: '', completed: false }],
      },
    ],
    schedule: {
      ...prefs({ dailyStudyHours: 3, playbackSpeed: 1.5, startDate: '2026-09-01', mockExamDays: [0] }),
      mode: 'manual',
      targetEndDate: '2026-12-01',
      weekPlan: [[], ['mat'], ['topics', 'mat'], ['demo'], [], ['mat'], []],
    },
    shiftEvents: [{ date: '2026-09-02', resumeDate: '2026-09-03', itemIds: ['mat-1'], reason: 'difficult' }],
  };
}

test('a shared camp carries tempo, branches and videos, never ids, progress, shifts or sample data', () => {
  const { shared, leftOut } = toSharedCamp(sourceCamp());
  assert.equal(leftOut, 1, 'the demo template branch stays home');
  assert.deepEqual(shared.branches.map(b => b.subject), ['Matematik', 'Fizik']);
  assert.deepEqual(shared.branches[0], {
    subject: 'Matematik',
    title: 'TYT Matematik',
    channel: 'Hoca',
    playlistId: 'PLabcdefghij1234',
    color: 'ink',
    videos: [
      { title: 'Ders 1', minutes: 31, youtubeId: yt(1), channel: 'Hoca' },
      { title: 'Ders 2', minutes: 32, youtubeId: yt(2), channel: 'Hoca' },
    ],
  });
  assert.deepEqual(shared.branches[1].videos, [{ title: 'Vektörler', minutes: 45 }]);
  assert.deepEqual(shared.schedule.weekPlan, [[], [0], [1, 0], [], [], [0], []]);
  const json = JSON.stringify(shared);
  for (const leaked of ['camp-a', 'mat-1', 'completed', 'difficult', '2026-12-01', 'shiftEvents']) assert.ok(!json.includes(leaked), `${leaked} is not shared`);
});

test('a link round-trips, compressed or plain, into a fresh camp that starts today', async () => {
  const { shared } = toSharedCamp(sourceCamp());
  const payload = await encodeCampShare(shared);
  assert.match(payload, /^z\.[A-Za-z0-9_-]+$/);
  const decoded = await decodeCampShare(payload);
  assert.ok(decoded.ok);
  if (!decoded.ok) return;
  assert.deepEqual(decoded.camp, shared);

  const plain = `j.${Buffer.from(JSON.stringify({ app: 'yetistiricem', type: 'camp', version: 1, camp: shared })).toString('base64url')}`;
  const fromPlain = await decodeCampShare(plain);
  assert.ok(fromPlain.ok && JSON.stringify(fromPlain.camp) === JSON.stringify(shared), 'tools may build uncompressed links');

  const camp = campFromShare(decoded.camp, '2026-09-26');
  assert.notEqual(camp.id, 'camp-a');
  assert.equal(camp.createdAt, '2026-09-26');
  assert.equal(camp.schedule.startDate, '2026-09-26');
  assert.equal(camp.schedule.targetEndDate, null);
  assert.deepEqual(camp.shiftEvents, []);
  assert.equal(camp.schedule.playbackSpeed, 1.5);
  const [mat, topics] = camp.branches;
  assert.equal(mat.playlistUrl, 'https://www.youtube.com/playlist?list=PLabcdefghij1234');
  assert.equal(mat.videos[0].videoUrl, `https://www.youtube.com/watch?v=${yt(1)}`);
  assert.ok(mat.videos.every(v => !v.completed && !v.id.startsWith('mat-')));
  assert.equal(topics.videos[0].videoUrl, '', 'a typed topic stays link-free');
  assert.deepEqual(camp.schedule.weekPlan, [[], [mat.id], [mat.id, topics.id], [], [], [mat.id], []]);
  assert.deepEqual(camp.schedule.activeDays, [1, 2, 5], 'manual weekdays follow the plan');
  assert.equal(buildCampSchedule(camp, { today: '2026-09-26' }).unscheduledItems.length, 0);
  assert.deepEqual(shareSummary(decoded.camp), { branches: 2, videos: 3, minutes: 108 });
});

test('broken, foreign, newer or oversized links are refused instead of imported in part', async () => {
  const { shared } = toSharedCamp(sourceCamp());
  const plain = (body: unknown) => `j.${Buffer.from(JSON.stringify(body)).toString('base64url')}`;
  const wrap = (camp: unknown, extra: object = {}) => plain({ app: 'yetistiricem', type: 'camp', version: 1, camp, ...extra });

  for (const payload of ['', 'x.abc', 'z.@@@', 'j.bm90IGpzb24', 'z.AAAA']) {
    const result = await decodeCampShare(payload);
    assert.equal(result.ok, false, `refused: ${payload}`);
  }
  assert.match((await decodeCampShare(plain({ app: 'other', type: 'camp', version: 1, camp: shared })) as { error: string }).error, /Yetişir kampı içermiyor/);
  assert.match((await decodeCampShare(wrap(shared, { version: 2 })) as { error: string }).error, /daha yeni bir sürümle/);

  const withVideo = (video: object): SharedCamp => ({ ...shared, branches: [{ ...shared.branches[0], videos: [video as never] }] });
  assert.equal((await decodeCampShare(wrap(withVideo({ title: 'x', minutes: 10, youtubeId: 'javascript:alert(1)' })))).ok, false);
  assert.equal((await decodeCampShare(wrap(withVideo({ title: 'x', minutes: 0 })))).ok, false);
  assert.equal((await decodeCampShare(wrap(withVideo({ title: 'x', minutes: 601 })))).ok, false);
  assert.equal((await decodeCampShare(wrap({ ...shared, branches: [{ ...shared.branches[0], playlistId: 'WL' }] }))).ok, false);
  assert.equal((await decodeCampShare(wrap({ ...shared, branches: [] }))).ok, false);
  assert.equal(readSharedCamp({ ...shared, branches: Array.from({ length: 41 }, () => shared.branches[1]) }), null);

  // Unusable tempo values and unknown colors fall back quietly.
  const lenient = readSharedCamp({ ...shared, name: '  ', schedule: { dailyStudyHours: -3, mode: 'weird' }, branches: [{ ...shared.branches[1], color: '#ff0000' }] });
  assert.ok(lenient);
  assert.equal(lenient.name, 'Paylaşılan kamp');
  assert.equal(lenient.schedule.dailyStudyHours, 4);
  assert.equal(lenient.schedule.mode, 'auto');
  assert.equal(lenient.branches[0].color, undefined);
});

test('a small link that inflates past the limit is not opened', async () => {
  const huge = JSON.stringify({ app: 'yetistiricem', type: 'camp', version: 1, camp: { name: ' '.repeat(MAX_JSON_BYTES + 10) } });
  const stream = new Blob([huge]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const payload = `z.${Buffer.from(bytes).toString('base64url')}`;
  assert.ok(payload.length < 10_000, 'the link itself is small');
  const result = await decodeCampShare(payload);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /çok büyük/);
});

test('a camp added from Keşfet or a link stays marked as someone else’s, so it is not published again', () => {
  const { shared } = toSharedCamp(sourceCamp());
  assert.equal(isImportedCamp(sourceCamp()), false, 'the student’s own camp can be published');
  assert.equal(campFromShare(shared, '2026-09-27').origin, undefined, 'a preview carries no mark');
  for (const origin of ['kesfet', 'link'] as const) {
    const camp = campFromShare(shared, '2026-09-27', origin);
    assert.equal(camp.origin, origin);
    assert.ok(isImportedCamp(camp));
    const [stored] = normalizeCamps(JSON.parse(JSON.stringify([camp])), '2026-09-27').camps;
    assert.equal(stored.origin, origin, 'the mark survives saving and loading');
  }
  const [unknown] = normalizeCamps([{ ...campFromShare(shared, '2026-09-27'), origin: 'elsewhere' }], '2026-09-27').camps;
  assert.equal(unknown.origin, undefined, 'an unknown mark is dropped');
});
