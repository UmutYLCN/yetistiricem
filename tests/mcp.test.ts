import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../server/app.ts';
import type { McpHandlerOptions } from '../server/mcpEndpoint.ts';
import { createMcpHandler, createResourceMetadataHandler, turkeyToday } from '../server/mcpEndpoint.ts';
import { createPlaylistHandler } from '../server/playlistEndpoint.ts';
import { createVideosHandler } from '../server/videosEndpoint.ts';
import { checkCampJson } from '../server/mcp/campFormat.ts';
import type { SharedCamp } from '../src/lib/campShare.ts';
import { campFromShare, shareDocument } from '../src/lib/campShare.ts';
import { fromCloudDocument, toCloudDocument } from '../src/lib/cloudState.ts';
import { emptyData } from '../src/lib/persistence.ts';
import { createCamp } from '../src/lib/plannerOps.ts';
import { PLAYLIST_ID, TEST_KEY, fakeVideo, fakeYouTube, vid } from './youtubeFake.ts';

const ORIGIN = 'https://yetistiricem.example';
const SUPABASE = 'https://project.supabase.co';
const PUBLISHABLE = 'sb_publishable_test';
const TODAY = '2026-09-28';
const USER = '11111111-2222-4333-8444-555555555555';

const jwt = (claims: Record<string, unknown>) => `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
const OAUTH_TOKEN = jwt({ sub: USER, client_id: 'claude-client', role: 'authenticated' });
const SESSION_TOKEN = jwt({ sub: USER, role: 'authenticated' });

const KESFET_ID = '6f1c2a3b-1111-4222-8333-944455556666';
const kesfetCamp: SharedCamp = {
  name: 'Yayınlanan kamp',
  schedule: { dailyStudyHours: 3, playbackSpeed: 1, practiceMultiplier: 0.2, maxSubjectsPerDay: 3, activeDays: [1, 2, 3, 4, 5, 6], restDays: [0], mockExamDays: [], mode: 'auto' },
  branches: [{ subject: 'Kimya', title: 'Kimya', channel: '', videos: [{ title: 'Mol', minutes: 30, youtubeId: vid(1) }] }],
};
const kesfetRow = {
  id: KESFET_ID,
  author_id: 'a1',
  source_camp_id: 'c1',
  name: 'Kimya kampı',
  description: 'AYT kimya',
  subjects: ['Kimya'],
  branch_count: 1,
  video_count: 1,
  total_minutes: 30,
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
  author: { display_name: 'umut' },
};

/** Supabase as the MCP server sees it: auth, the student's plan, private draft rows and Keşfet. */
function fakeSupabase() {
  const store = { data: null as unknown, revision: 0, saves: 0, conflictsLeft: 0, drafts: [] as { id: string; origin: string; payload: unknown }[] };
  const fetch = async (input: string, init: RequestInit) => {
    const url = new URL(input);
    const headers = new Headers(init.headers);
    assert.equal(headers.get('apikey'), PUBLISHABLE);
    const auth = headers.get('authorization');
    if (url.pathname === '/auth/v1/user') {
      return auth === `Bearer ${OAUTH_TOKEN}` || auth === `Bearer ${SESSION_TOKEN}`
        ? new Response(JSON.stringify({ id: USER, email: 'umut@example.com' }), { status: 200 })
        : new Response('{}', { status: 401 });
    }
    if (url.pathname === '/rest/v1/published_camps') {
      const body = url.searchParams.get('id') ? [{ ...kesfetRow, payload: shareDocument(kesfetCamp) }] : [kesfetRow, { ...kesfetRow, id: 'broken', name: '' }];
      return new Response(JSON.stringify(body), { status: 200 });
    }
    assert.equal(auth, `Bearer ${OAUTH_TOKEN}`, 'the plan is read and written with the student’s own token');
    if (url.pathname === '/rest/v1/mcp_camp_drafts') {
      const row = JSON.parse(String(init.body)) as { user_id: string; origin: string; payload: unknown };
      assert.equal(row.user_id, USER);
      const id = `00000000-0000-4000-8000-${String(store.drafts.length + 1).padStart(12, '0')}`;
      store.drafts.push({ id, origin: row.origin, payload: row.payload });
      return new Response(JSON.stringify([{ id }]), { status: 201 });
    }
    if (url.pathname === '/rest/v1/planner_states') {
      assert.equal(url.searchParams.get('user_id'), `eq.${USER}`);
      return new Response(JSON.stringify(store.data === null ? [] : [{ data: store.data, revision: store.revision }]), { status: 200 });
    }
    if (url.pathname === '/rest/v1/rpc/save_planner_state') {
      const { p_data, p_base_revision } = JSON.parse(String(init.body)) as { p_data: unknown; p_base_revision: number };
      if (store.conflictsLeft > 0 || p_base_revision !== store.revision) {
        store.conflictsLeft = Math.max(0, store.conflictsLeft - 1);
        store.revision++; // another device saved meanwhile
        return new Response(JSON.stringify({ code: 'P0001', message: 'revision_conflict' }), { status: 400 });
      }
      store.data = p_data;
      store.revision++;
      store.saves++;
      return new Response(JSON.stringify(store.revision), { status: 200 });
    }
    throw new Error(`unexpected ${url.pathname}`);
  };
  return { fetch, store };
}

function youtube() {
  return fakeYouTube({
    playlists: [{ id: PLAYLIST_ID, title: 'TYT Matematik Kampı', channelTitle: 'Örnek Kanal', items: [1, 2, 3, 4, 5, 6].map(n => ({ videoId: vid(n) })) }],
    videos: [
      fakeVideo(1),
      fakeVideo(2, { duration: 'PT1H' }),
      fakeVideo(3, { privacyStatus: 'private' }),
      fakeVideo(4),
      fakeVideo(5, { regionRestriction: { blocked: ['TR'] } }),
      fakeVideo(6),
    ],
  });
}

let nextId = 1;

function server(options: Partial<McpHandlerOptions> = {}, token: string | null = OAUTH_TOKEN) {
  const yt = youtube();
  const supabase = fakeSupabase();
  const handler = createMcpHandler({
    apiKey: TEST_KEY,
    fetch: yt.fetch,
    supabase: { url: SUPABASE, key: PUBLISHABLE },
    supabaseFetch: supabase.fetch,
    today: () => TODAY,
    log: () => {},
    ...options,
  });
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    handler(
      new Request(`${ORIGIN}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      })
    );
  const rpc = async (method: string, params?: unknown) => {
    const response = await post({ jsonrpc: '2.0', id: nextId++, method, ...(params === undefined ? {} : { params }) });
    assert.equal(response.status, 200);
    return (await response.json()) as { result?: Record<string, unknown>; error?: { code: number; message: string } };
  };
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const { result, error } = await rpc('tools/call', { name, arguments: args });
    assert.equal(error, undefined);
    const content = result!.content as { text: string }[];
    return { text: content[0].text, isError: result!.isError === true, data: result!.structuredContent as Record<string, unknown> | undefined };
  };
  const plan = () => (supabase.store.data === null ? null : fromCloudDocument(supabase.store.data, TODAY));
  return { handler, post, rpc, call, yt, supabase, plan };
}

const camp = (overrides: Record<string, unknown> = {}) => ({
  name: 'TYT 2027',
  schedule: { mode: 'auto', dailyStudyHours: 2, playbackSpeed: 1.5, practiceMultiplier: 0.2, maxSubjectsPerDay: 2, activeDays: [1, 2, 3, 4, 5], mockExamDays: [0] },
  branches: [
    {
      subject: 'Matematik',
      title: 'TYT Matematik Kampı',
      channel: 'Örnek Kanal',
      playlistId: PLAYLIST_ID,
      videos: [
        { title: 'uydurma başlık', minutes: 5, youtubeId: vid(1) },
        { title: 'Ders 2', minutes: 60, youtubeId: vid(2) },
      ],
    },
    { subject: 'Türkçe', videos: [{ title: 'Paragraf tekrarı', minutes: 45 }] },
  ],
  ...overrides,
});

test('without an approved OAuth token the server answers 401 and says where to sign in', async () => {
  for (const token of [null, SESSION_TOKEN, jwt({ sub: 'someone-else', client_id: 'x' })]) {
    const { post } = server({}, token);
    const response = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    assert.equal(response.status, 401, `refused: ${token}`);
    assert.ok(response.headers.get('www-authenticate')?.startsWith(`Bearer resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/mcp"`));
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
  }

  const metadata = createResourceMetadataHandler({ supabase: { url: SUPABASE, key: PUBLISHABLE } });
  const body = (await (await metadata(new Request(`${ORIGIN}/.well-known/oauth-protected-resource/mcp`))).json()) as Record<string, unknown>;
  assert.equal(body.resource, `${ORIGIN}/mcp`);
  assert.deepEqual(body.authorization_servers, [`${SUPABASE}/auth/v1`]);

  const off = createMcpHandler({ apiKey: TEST_KEY });
  assert.equal((await off(new Request(`${ORIGIN}/mcp`, { method: 'POST' }))).status, 503, 'no Supabase config: no MCP');
});

test('the MCP protocol: initialize, ping, tools/list, notifications and malformed requests', async () => {
  const { post, rpc, handler } = server();
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  assert.equal(init.result?.protocolVersion, '2025-06-18');
  assert.deepEqual(init.result?.capabilities, { tools: { listChanged: false } });
  assert.match(String(init.result?.instructions), /Never invent videos/);
  assert.match(String(init.result?.instructions), /contains the word Yetişir/, 'a camp is prepared only when the student says Yetişir');
  assert.equal((await rpc('initialize', { protocolVersion: '2099-01-01' })).result?.protocolVersion, '2025-11-25');
  assert.deepEqual((await rpc('ping')).result, {});
  const tools = (await rpc('tools/list')).result?.tools as { name: string; inputSchema: { type: string } }[];
  assert.deepEqual(
    tools.map(t => t.name),
    ['get_my_progress', 'get_my_plan', 'get_camp_format', 'send_camp', 'read_youtube_playlist', 'read_youtube_videos', 'search_kesfet', 'get_kesfet_camp', 'add_kesfet_camp']
  );
  assert.ok(tools.every(t => t.inputSchema.type === 'object'));
  assert.equal((await rpc('resources/list')).error?.code, -32601);

  assert.equal((await post({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
  const batch = await post([{ jsonrpc: '2.0', id: 'a', method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }]);
  assert.deepEqual(await batch.json(), [{ jsonrpc: '2.0', id: 'a', result: {} }]);
  assert.equal((await post('{not json')).status, 400);
  assert.equal((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'MCP-Protocol-Version': '1999-01-01' })).status, 400);
  assert.equal((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post('x'.repeat(1_600_000))).status, 413);
  assert.equal((await handler(new Request(`${ORIGIN}/mcp`))).status, 405);
  assert.equal((await handler(new Request(`${ORIGIN}/mcp`, { method: 'OPTIONS' }))).status, 204);
});

test('the camp JSON is held to the app’s limits, each problem named with its path', () => {
  const good = checkCampJson(camp());
  assert.ok(good.ok);
  if (good.ok) assert.ok(checkCampJson(shareDocument(good.camp)).ok, 'a whole share document is read too');
  const schedule = camp().schedule;
  const cases: [unknown, RegExp][] = [
    [camp({ name: '' }), /camp\.name: must not be empty/],
    [camp({ name: 'x'.repeat(81) }), /at most 80/],
    [camp({ branches: [] }), /camp\.branches: must list 1 to 40/],
    [camp({ extra: 1 }), /camp\.extra: unknown field/],
    [camp({ schedule: { ...schedule, playbackSpeed: 1.6 } }), /playbackSpeed: must be one of 1, 1.25, 1.5, 1.75, 2/],
    [camp({ schedule: { ...schedule, dailyStudyHours: 20 } }), /dailyStudyHours: must be 0.5–16/],
    [camp({ schedule: { ...schedule, practiceMultiplier: 0.15 } }), /practiceMultiplier/],
    [camp({ schedule: { ...schedule, activeDays: [] } }), /at least one study day/],
    [camp({ schedule: { ...schedule, mockExamDays: [1] } }), /mockExamDays: must not be study days/],
    [camp({ schedule: { ...schedule, maxSubjectsPerDay: 11 } }), /maxSubjectsPerDay: must be a whole number from 1 to 10/],
    [camp({ schedule: { mode: 'manual', dailyStudyHours: 2, playbackSpeed: 1, practiceMultiplier: 0, weekPlan: [[], [0], [], [], [], [], []] } }), /branch 1 \(Türkçe\) is on no day/],
    [camp({ branches: [{ subject: 'Matematik', videos: [{ title: 'a', minutes: 0 }] }] }), /videos\[0\]\.minutes/],
    [camp({ branches: [{ subject: 'Matematik', videos: [{ title: 'a', minutes: 5, youtubeId: 'https://youtu.be/x' }] }] }), /youtubeId: must be an 11-character/],
    [camp({ branches: [{ subject: 'x'.repeat(41), videos: [{ title: 'a', minutes: 5 }] }] }), /subject: at most 40/],
    [camp({ branches: [{ subject: 'Mat', color: 'red', videos: [{ title: 'a', minutes: 5 }] }] }), /color: must be one of/],
  ];
  for (const [input, message] of cases) {
    const result = checkCampJson(input);
    assert.equal(result.ok, false, String(message));
    if (!result.ok) assert.match(result.problems.join('\n'), message);
  }
  const manual = checkCampJson(camp({ schedule: { mode: 'manual', dailyStudyHours: 2, playbackSpeed: 1, practiceMultiplier: 0, weekPlan: [[], [0], [1], [0, 1], [], [], []] } }));
  assert.ok(manual.ok);
  if (manual.ok) {
    assert.deepEqual(manual.camp.schedule.activeDays, [1, 2, 3]);
    assert.equal(manual.camp.schedule.maxSubjectsPerDay, 2);
  }
});

test('send_camp prepares a private review without saving, with YouTube’s own data', async () => {
  const { call, supabase, plan } = server();
  assert.match((await call('get_camp_format')).text, /playbackSpeed: one of 1, 1.25, 1.5, 1.75, 2/);

  const bad = await call('send_camp', { camp: camp({ schedule: { mode: 'auto' } }) });
  assert.ok(bad.isError);
  assert.match(bad.text, /camp\.schedule\.dailyStudyHours/);

  const dry = await call('send_camp', { camp: camp(), dryRun: true });
  assert.equal(dry.isError, false, dry.text);
  assert.equal(supabase.store.saves, 0, 'a dry run saves nothing');
  assert.match(dry.text, /ends on 2026-/);
  assert.equal(supabase.store.drafts.length, 0, 'a dry run stores no proposal');

  const refused = await call('send_camp', {
    camp: camp({ branches: [{ subject: 'Mat', videos: [{ title: 'a', minutes: 5, youtubeId: vid(3) }, { title: 'b', minutes: 5, youtubeId: vid(99) }] }] }),
  });
  assert.ok(refused.isError);
  assert.match(refused.text, /camp\.branches\[0\]\.videos\[0\] \(vid00000003\)/);
  assert.match(refused.text, /camp\.branches\[0\]\.videos\[1\] \(vid00000099\)/);
  assert.equal(supabase.store.saves, 0);
  assert.equal(supabase.store.drafts.length, 0);

  const sent = await call('send_camp', { camp: camp() });
  assert.equal(sent.isError, false, sent.text);
  assert.match(sent.text, /NOT been added/);
  assert.match(sent.text, /1 video title\(s\) or length\(s\) were replaced/);
  assert.equal(sent.data?.added, false);
  assert.equal(sent.data?.awaitingApproval, true);
  assert.match(String(sent.data?.previewUrl), /^https:\/\/yetistiricem\.example\/app\?draft=/);
  assert.equal(supabase.store.saves, 0, 'the AI cannot save a camp directly');
  assert.equal(plan(), null);
  assert.equal(supabase.store.drafts.length, 1);
  assert.equal(supabase.store.drafts[0].origin, 'ai');
  const prepared = (supabase.store.drafts[0].payload as { camp: SharedCamp }).camp;
  const [mat, tr] = prepared.branches;
  assert.deepEqual(
    mat.videos.map(v => [v.title, Math.round(v.minutes * 100) / 100]),
    [
      ['Ders 1', 11.02],
      ['Ders 2', 60],
    ],
    'titles and lengths are YouTube’s'
  );
  assert.equal(mat.videos[0].youtubeId, vid(1));
  assert.equal(tr.videos[0].youtubeId, undefined, 'a topic stays link-free');

  // Another proposal cannot bypass the student's approval either.
  const again = await call('send_camp', { camp: camp({ name: 'İkinci kamp' }) });
  assert.equal(again.isError, false, again.text);
  assert.equal(supabase.store.drafts.length, 2);
  assert.equal(plan(), null);
});

test('the student’s progress and plan come from their saved plan', async () => {
  const { call, supabase } = server();
  assert.match((await call('get_my_progress')).text, /no camp with videos yet/);
  const checked = await call('send_camp', { camp: camp(), dryRun: true });
  const shared = checked.data!.camp as SharedCamp;
  supabase.store.data = toCloudDocument(createCamp(emptyData(), campFromShare(shared, TODAY)));

  const progress = await call('get_my_progress');
  assert.equal(progress.isError, false, progress.text);
  assert.match(progress.text, /Camp "TYT 2027": 0\/3 tasks \(0%\)/);
  assert.match(progress.text, /Streak: 0 day/);
  const camps = progress.data!.camps as { today: { tasks: number } }[];
  assert.ok(camps[0].today.tasks > 0, `${TODAY} is a Monday, a study day`);

  const week = await call('get_my_plan', { days: 3 });
  assert.equal(week.isError, false, week.text);
  assert.match(week.text, /2026-09-28 Monday \(today\):/);
  assert.match(week.text, /\[ \] Matematik: Ders 1/);
  assert.deepEqual(
    (week.data!.days as { date: string }[]).map(d => d.date),
    ['2026-09-28', '2026-09-29', '2026-09-30']
  );
  assert.ok((await call('get_my_plan', { from: '28.09.2026' })).isError);
  assert.ok((await call('get_my_plan', { days: 30 })).isError);
});

test('YouTube and Keşfet tools read real sources, and the key never shows', async () => {
  const { call, supabase, plan } = server();
  const playlist = await call('read_youtube_playlist', { playlist: `https://www.youtube.com/playlist?list=${PLAYLIST_ID}` });
  assert.deepEqual((playlist.data!.videos as { position: number }[]).map(v => v.position), [1, 2, 4, 6]);
  const skipped = playlist.data!.skipped as { position: number; reason: string }[];
  assert.deepEqual(skipped.map(s => s.position), [3, 5]);
  assert.match(skipped[1].reason, /Türkiye/);
  assert.ok((await call('read_youtube_playlist', { playlist: `https://www.youtube.com/watch?v=${vid(1)}` })).isError);

  const videos = await call('read_youtube_videos', { videos: [vid(1), vid(99)] });
  assert.equal((videos.data!.videos as unknown[]).length, 1);

  const found = await call('search_kesfet', { query: 'kimya' });
  assert.deepEqual((found.data!.camps as { name: string; author: string }[]).map(c => [c.name, c.author]), [['Kimya kampı', 'umut']]);
  assert.ok(!found.text.includes('a1'), 'author ids stay out');
  assert.match((await call('get_kesfet_camp', { id: KESFET_ID })).text, /"Kimya kampı" by umut/);
  assert.ok((await call('get_kesfet_camp', { id: 'drop table' })).isError);

  const added = await call('add_kesfet_camp', { id: KESFET_ID });
  assert.equal(added.isError, false, added.text);
  assert.equal(added.data?.awaitingApproval, true);
  assert.equal(supabase.store.drafts[0].origin, 'kesfet', 'an approved Keşfet copy must remain someone else’s');
  assert.equal(plan(), null, 'a Keşfet copy is not saved before approval');

  const noKey = server({ apiKey: '' });
  assert.match((await noKey.call('read_youtube_videos', { videos: [vid(1)] })).text, /not set up/);
  for (const answer of [playlist, videos, found, added]) assert.ok(!JSON.stringify(answer).includes(TEST_KEY));
});

test('the production server runs the MCP server with the token and body it was sent', async () => {
  const base = await mkdtemp(join(tmpdir(), 'yetistiricem-mcp-'));
  await mkdir(join(base, 'dist'), { recursive: true });
  await writeFile(join(base, 'dist', 'index.html'), '<!doctype html>');
  const yt = youtube();
  const supabase = fakeSupabase();
  const options = { supabase: { url: SUPABASE, key: PUBLISHABLE }, appOrigin: ORIGIN };
  const app = createAppServer({
    distDir: join(base, 'dist'),
    playlistHandler: createPlaylistHandler({ apiKey: TEST_KEY, fetch: yt.fetch }),
    videosHandler: createVideosHandler({ apiKey: TEST_KEY, fetch: yt.fetch }),
    mcpHandler: createMcpHandler({ apiKey: TEST_KEY, fetch: yt.fetch, supabaseFetch: supabase.fetch, today: () => TODAY, log: () => {}, ...options }),
    resourceMetadataHandler: createResourceMetadataHandler(options),
  });
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address() as AddressInfo;
    const url = `http://127.0.0.1:${port}`;
    const metadata = (await (await fetch(`${url}/.well-known/oauth-protected-resource/mcp`)).json()) as { resource: string };
    assert.equal(metadata.resource, `${ORIGIN}/mcp`);
    const response = await fetch(`${url}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${OAUTH_TOKEN}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'send_camp', arguments: { camp: camp() } } }),
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { result: { isError: boolean } };
    assert.equal(body.result.isError, false);
    assert.equal(supabase.store.saves, 0);
    assert.equal(supabase.store.drafts.length, 1);
  } finally {
    await new Promise(resolve => app.close(resolve));
  }
});

test('today is the calendar day in Türkiye, whatever zone the server runs in', () => {
  assert.equal(turkeyToday(new Date('2026-09-27T21:30:00Z')), '2026-09-28', 'past midnight in Istanbul');
  assert.equal(turkeyToday(new Date('2026-09-27T20:30:00Z')), '2026-09-27');
});
