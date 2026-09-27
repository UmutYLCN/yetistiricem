// The Yetişir MCP tools (docs/mcp.md). The client acts for one signed-in
// student (`ToolContext.account`): it can read their plan and progress, prepare
// a private camp review (`send_camp`, a camp JSON held to `campFormat.ts`),
// and read YouTube and Keşfet. Only the student adds the reviewed camp.
//
// Data truth: every YouTube video in a camp is looked up with the YouTube Data
// API; its title, channel and exact length come from YouTube, and a video
// YouTube does not return refuses the camp. Topics without a video carry the
// minutes the student agreed to.
import type { SharedCamp, SharedVideo } from '../../src/lib/campShare.ts';
import { campFromShare, shareDocument, shareSummary } from '../../src/lib/campShare.ts';
import type { CatalogEntry } from '../../src/lib/catalog.ts';
import { CATALOG_COLUMNS, readCatalogCamp, readCatalogRow, searchCatalog } from '../../src/lib/catalog.ts';
import { fromCloudDocument } from '../../src/lib/cloudState.ts';
import type { PlannerData } from '../../src/lib/persistence.ts';
import { emptyData } from '../../src/lib/persistence.ts';
import type { ReviewRow } from '../../src/lib/playlistImport.ts';
import { reviewPlaylist, rowLabel } from '../../src/lib/playlistImport.ts';
import { isDateKey } from '../../src/utils/date.ts';
import { buildCampSchedule } from '../../src/utils/roadmapEngine.ts';
import { inspectPlaylistLink, isYoutubeVideoId, parseYoutubeVideoId } from '../../src/utils/youtubeParser.ts';
import type { PlaylistEntry, PlaylistErrorCode, PlaylistResponse } from '../../src/utils/youtubePlaylist.ts';
import { MAX_VIDEOS_PER_REQUEST } from '../../src/utils/youtubePlaylist.ts';
import { YouTubeApiError } from '../youtubeApi.ts';
import type { Account, FetchText, SupabaseConfig } from './account.ts';
import { AccountError, readPlan } from './account.ts';
import { CAMP_EXAMPLE, CAMP_JSON_SCHEMA, CAMP_RULES, checkCampJson } from './campFormat.ts';
import { planDays, progressOverview } from './myPlan.ts';
import type { Tool, ToolResult } from './protocol.ts';

export interface ToolDeps {
  /** A playlist by validated id; throws `YouTubeApiError`. */
  loadPlaylist: (playlistId: string) => Promise<PlaylistResponse>;
  /** Up to 50 validated video ids, answered in the same order; throws `YouTubeApiError`. */
  loadVideos: (videoIds: string[]) => Promise<PlaylistEntry[]>;
  supabase: SupabaseConfig;
  fetch?: FetchText;
  /** The app's address, for "open Yetişir" links; by default the request's own origin. */
  appOrigin?: string | (() => string | undefined);
  /** Today as a local `YYYY-MM-DD` key. */
  today: () => string;
}

/** The most videos `read_youtube_videos` looks up at once (4 videos.list calls). */
export const MAX_VIDEO_REFS = 200;
const LISTED_VIDEOS = 400;
const MAX_PLAN_DAYS = 14;
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

class InputError extends Error {}

const problem = (text: string): ToolResult => ({ text, isError: true });
const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

function hoursLabel(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

const YOUTUBE_PROBLEMS: Record<PlaylistErrorCode, string> = {
  'invalid-id': 'That is not a readable YouTube id.',
  'not-found': 'YouTube did not return it: it is private, deleted or the link is wrong.',
  private: 'YouTube does not list this playlist\'s videos (it is private).',
  quota: 'The YouTube quota for today is used up. Try again tomorrow.',
  'not-configured': 'YouTube access is not set up on this Yetişir server.',
  'bad-key': 'YouTube access on this Yetişir server is misconfigured.',
  upstream: 'YouTube did not answer properly. Try again in a moment.',
  method: 'The request was refused.',
};

function youtubeProblem(error: unknown): string {
  return YOUTUBE_PROBLEMS[error instanceof YouTubeApiError ? error.code : 'upstream'];
}

const ACCOUNT_PROBLEMS: Record<AccountError['code'], string> = {
  offline: 'Yetişir could not be reached. Try again in a moment.',
  conflict: 'The plan kept changing while saving (is the app open and saving?). Try again.',
  refused: 'The sign-in to Yetişir has expired or was revoked. Reconnect the Yetişir connector.',
};

// ---------------------------------------------------------------------------
// YouTube

interface ReadyVideo {
  position: number;
  youtubeId: string;
  title: string;
  minutes: number;
  channel: string;
}

interface Skipped {
  position: number;
  youtubeId: string | null;
  reason: string;
}

/** Rows as the app's import review sees them: the same skips (and videos blocked in Turkey left out, as the app leaves them unselected). */
function sortRows(rows: ReviewRow[]): { ready: ReadyVideo[]; skipped: Skipped[] } {
  const ready: ReadyVideo[] = [];
  const skipped: Skipped[] = [];
  for (const row of rows) {
    const position = row.index + 1;
    if (row.status === 'ready' && row.entry.kind === 'video') {
      const { videoId, title, durationSeconds, channelTitle } = row.entry;
      ready.push({ position, youtubeId: videoId, title: title.trim().slice(0, 200), minutes: round(durationSeconds / 60), channel: channelTitle.trim() });
    } else {
      skipped.push({ position, youtubeId: row.entry.videoId, reason: rowLabel(row) ?? 'Skipped' });
    }
  }
  return { ready, skipped };
}

async function loadVideosInBatches(ids: string[], deps: ToolDeps): Promise<PlaylistEntry[]> {
  const unique = [...new Set(ids)];
  const found = new Map<string, PlaylistEntry>();
  for (let i = 0; i < unique.length; i += MAX_VIDEOS_PER_REQUEST) {
    const batch = unique.slice(i, i + MAX_VIDEOS_PER_REQUEST);
    const entries = await deps.loadVideos(batch);
    batch.forEach((id, j) => found.set(id, entries[j]));
  }
  return ids.map(id => found.get(id) ?? { kind: 'unavailable', videoId: id, reason: 'deleted' });
}

function videoLines(videos: ReadyVideo[]): string {
  const shown = videos.slice(0, LISTED_VIDEOS).map(v => `${v.position}. ${v.title} (${round(v.minutes, 1)} min) [${v.youtubeId}]`);
  if (videos.length > LISTED_VIDEOS) shown.push(`… and ${videos.length - LISTED_VIDEOS} more.`);
  return shown.join('\n');
}

function skippedLines(skipped: Skipped[]): string {
  if (skipped.length === 0) return '';
  return `\nSkipped (${skipped.length}): ${skipped.slice(0, 30).map(s => `#${s.position} ${s.reason}`).join('; ')}${skipped.length > 30 ? '; …' : ''}`;
}

function readPlaylistRef(value: unknown): string {
  const check = inspectPlaylistLink(typeof value === 'string' ? value : '');
  if (check.ok) return check.id;
  const why: Record<string, string> = {
    empty: 'is empty',
    'not-youtube': 'is not a YouTube link',
    'video-only': 'is a single video, not a playlist',
    personal: 'is a personal list (Watch later, Liked videos) that YouTube does not share',
    mix: 'is an automatic YouTube mix, not a playlist',
  };
  throw new InputError(`\`playlist\` ${why[check.problem] ?? 'is not a readable YouTube playlist link or id'}.`);
}

function readVideoRefs(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new InputError('`videos` must list at least one video link or id.');
  if (value.length > MAX_VIDEO_REFS) throw new InputError(`\`videos\` may name at most ${MAX_VIDEO_REFS} videos.`);
  return value.map((ref, i) => {
    const text = typeof ref === 'string' ? ref.trim() : '';
    const id = isYoutubeVideoId(text) ? text : parseYoutubeVideoId(text);
    if (!id) throw new InputError(`\`videos[${i}]\` is not a YouTube video link or id.`);
    return id;
  });
}

/**
 * The camp with every YouTube video as YouTube has it (title, channel, exact
 * length). Throws naming each video that cannot be used.
 */
async function withYouTubeTruth(camp: SharedCamp, deps: ToolDeps): Promise<{ camp: SharedCamp; corrected: number }> {
  const ids = camp.branches.flatMap(b => b.videos.flatMap(v => (v.youtubeId ? [v.youtubeId] : [])));
  if (ids.length === 0) return { camp, corrected: 0 };
  let entries: PlaylistEntry[];
  try {
    entries = await loadVideosInBatches(ids, deps);
  } catch (error) {
    throw new InputError(youtubeProblem(error));
  }
  const found = new Map(ids.map((id, i) => [id, entries[i]]));
  const problems: string[] = [];
  let corrected = 0;
  const branches = camp.branches.map((branch, b) => {
    // Each branch is reviewed on its own, as the app reviews one list.
    const rows = reviewPlaylist(branch.videos.flatMap(v => (v.youtubeId ? [found.get(v.youtubeId)!] : [])), []);
    let row = 0;
    const videos = branch.videos.map((video, v): SharedVideo => {
      if (!video.youtubeId) return video;
      const review = rows[row++];
      if (review.status !== 'ready' || review.entry.kind !== 'video') {
        problems.push(`camp.branches[${b}].videos[${v}] (${video.youtubeId}): ${rowLabel(review) ?? 'cannot be used'}`);
        return video;
      }
      const { title, durationSeconds, channelTitle } = review.entry;
      const truth: SharedVideo = {
        title: title.trim().slice(0, 200),
        minutes: round(durationSeconds / 60),
        youtubeId: video.youtubeId,
        ...(channelTitle.trim() ? { channel: channelTitle.trim().slice(0, 120) } : {}),
      };
      if (truth.title !== video.title || Math.abs(truth.minutes - video.minutes) >= 0.5) corrected++;
      return truth;
    });
    return { ...branch, videos };
  });
  if (problems.length > 0) {
    throw new InputError(`YouTube refused ${problems.length} video(s); remove or replace them and send again:\n${problems.slice(0, 40).map(p => `- ${p}`).join('\n')}`);
  }
  return { camp: { ...camp, branches }, corrected };
}

// ---------------------------------------------------------------------------
// Camps and the account

/** What adding `shared` today would plan. */
function estimate(shared: SharedCamp, today: string) {
  const result = buildCampSchedule(campFromShare(shared, today), { today });
  const working = result.plans.filter(plan => plan.items.length > 0);
  return { startDate: today, finishDate: working.at(-1)?.date ?? null, studyDays: working.length, unscheduledTasks: result.unscheduledItems.length };
}

function campLines(camp: SharedCamp, today: string): { lines: string[]; plan: ReturnType<typeof estimate> } {
  const summary = shareSummary(camp);
  const plan = estimate(camp, today);
  const s = camp.schedule;
  const days = s.activeDays.map(d => WEEKDAY_NAMES[d]).join(', ');
  return {
    plan,
    lines: [
      `${summary.branches} branch(es), ${summary.videos} video(s)/topic(s), ${hoursLabel(summary.minutes)} of material.`,
      ...camp.branches.map(b => `- ${b.subject}: ${b.videos.length} item(s), ${hoursLabel(b.videos.reduce((acc, v) => acc + v.minutes, 0))}`),
      `Tempo (${s.mode}): ${s.dailyStudyHours} h a day on ${days || 'no day'}, ${s.playbackSpeed}x speed, +${Math.round(s.practiceMultiplier * 100)}% practice time.`,
      plan.finishDate ? `Starting ${plan.startDate}, it takes ${plan.studyDays} study day(s) and ends on ${plan.finishDate}.` : 'With this tempo nothing can be scheduled.',
      ...(plan.unscheduledTasks > 0 ? [`${plan.unscheduledTasks} task(s) fit on no study day with this tempo.`] : []),
    ],
  };
}

async function loadAccountPlan(account: Account, deps: ToolDeps): Promise<{ data: PlannerData; revision: number }> {
  const stored = await readPlan(deps.supabase, account, deps.fetch);
  if (stored.data === null) return { data: emptyData(), revision: stored.revision };
  const data = fromCloudDocument(stored.data, deps.today());
  if (!data) throw new InputError('The plan saved in this account could not be read. Open Yetişir once, then try again.');
  return { data, revision: stored.revision };
}

/** Stores a private proposal; the planner adds it only after the student reviews and approves it. */
async function prepareCampDraft(shared: SharedCamp, account: Account, deps: ToolDeps, origin: 'ai' | 'kesfet' = 'ai'): Promise<string> {
  let response: Response;
  try {
    response = await (deps.fetch ?? fetch)(`${deps.supabase.url}/rest/v1/mcp_camp_drafts?select=id`, {
      method: 'POST',
      headers: {
        apikey: deps.supabase.key,
        Authorization: `Bearer ${account.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ user_id: account.userId, origin, payload: shareDocument(shared) }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new AccountError('offline');
  }
  if (response.status === 401 || response.status === 403) throw new AccountError('refused');
  if (!response.ok) throw new InputError('Yetişir kamp önizlemesini hazırlayamadı. Biraz sonra tekrar dene.');
  const rows: unknown = await response.json().catch(() => null);
  const id = Array.isArray(rows) && typeof rows[0]?.id === 'string' ? rows[0].id : null;
  if (!id) throw new InputError('Yetişir kamp önizlemesini hazırlayamadı. Biraz sonra tekrar dene.');
  return id;
}

// ---------------------------------------------------------------------------
// Keşfet

async function catalogGet(deps: ToolDeps, query: string): Promise<unknown> {
  const { supabase } = deps;
  let response: Response;
  try {
    response = await (deps.fetch ?? fetch)(`${supabase.url}/rest/v1/published_camps?${query}`, {
      headers: { apikey: supabase.key, Authorization: `Bearer ${supabase.key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new InputError('Keşfet could not be reached. Try again in a moment.');
  }
  if (!response.ok) throw new InputError('Keşfet did not answer properly. Try again in a moment.');
  return response.json();
}

async function catalogCamp(deps: ToolDeps, rawId: unknown): Promise<{ entry: CatalogEntry; camp: SharedCamp }> {
  const id = typeof rawId === 'string' ? rawId.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new InputError('`id` is not a Keşfet camp id.');
  const rows = await catalogGet(deps, `select=${encodeURIComponent(`${CATALOG_COLUMNS.replace(/\s+/g, '')},payload`)}&id=eq.${id}&limit=1`);
  const row = Array.isArray(rows) ? rows[0] : undefined;
  const entry = row ? readCatalogRow(row) : null;
  if (!entry) throw new InputError('No Keşfet camp has that id; it may have been removed.');
  const camp = readCatalogCamp((row as { payload?: unknown }).payload);
  if (!camp) throw new InputError('This Keşfet camp\'s content is broken and cannot be used.');
  return { entry, camp };
}

function entryLine(entry: CatalogEntry): string {
  return `- "${entry.name}" by ${entry.authorName} (id ${entry.id})${entry.tags.length > 0 ? ` ${entry.tags.map(t => `#${t}`).join(' ')}` : ''}: ${entry.subjects.join(', ') || 'no branch names'}; ${entry.branchCount} branch(es), ${entry.videoCount} video(s), ${hoursLabel(entry.totalMinutes)}${entry.description ? ` — ${entry.description.slice(0, 160)}` : ''}`;
}

const publicEntry = ({ id, name, authorName, description, subjects, tags, saveCount, branchCount, videoCount, totalMinutes, createdAt }: CatalogEntry) => ({
  id,
  name,
  author: authorName,
  description,
  subjects,
  tags,
  saves: saveCount,
  branchCount,
  videoCount,
  totalMinutes,
  publishedAt: createdAt,
});

// ---------------------------------------------------------------------------
// The tools

const readOnly = { readOnlyHint: true, openWorldHint: true };
const preparesProposal = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };

export function yetistiricemTools(deps: ToolDeps): Tool[] {
  const appUrl = (request: Request) => {
    const origin = (typeof deps.appOrigin === 'function' ? deps.appOrigin() : deps.appOrigin)?.replace(/\/+$/, '') || new URL(request.url).origin;
    return `${origin}/app`;
  };
  const guard = async (work: () => Promise<ToolResult>): Promise<ToolResult> => {
    try {
      return await work();
    } catch (error) {
      if (error instanceof InputError) return problem(error.message);
      if (error instanceof AccountError) return problem(ACCOUNT_PROBLEMS[error.code]);
      throw error;
    }
  };

  return [
    {
      name: 'get_my_progress',
      title: 'My progress',
      description:
        'The signed-in student\'s standing in Yetişir: each camp\'s progress (tasks done, remaining hours, overdue tasks, today\'s tasks, projected finish vs target date) and their habits (study streak, last 7 days, hours studied, share of tasks done on their planned day, how often and why they postponed, focus-mode use, recent day notes). Use it to evaluate how they are doing and to coach them.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: readOnly,
      run: (_args, { account }) =>
        guard(async () => {
          const { data } = await loadAccountPlan(account, deps);
          const o = progressOverview(data, deps.today());
          if (o.camps.length === 0) {
            return { text: `The student has no camp with videos yet${o.emptyCamps.length ? ` (empty: ${o.emptyCamps.join(', ')})` : ''}.`, structured: o };
          }
          const h = o.habits;
          const lines = [
            `Today is ${o.today}.`,
            ...o.camps.map(c =>
              [
                `Camp "${c.name}": ${c.tasks.done}/${c.tasks.total} tasks (${c.tasks.percent}%), ${c.remainingHours} h left, ends ${c.finishDate ?? '—'}${c.targetDate ? ` (target ${c.targetDate}, ${c.onTrack ? 'on track' : 'behind'})` : ''}.`,
                `  Overdue: ${c.overdue.tasks} task(s), ${c.overdue.hours} h. Today: ${c.today.done}/${c.today.tasks} done (${c.today.hours} h). Postponed ${c.postponements} time(s).`,
                `  Branches: ${c.branches.map(b => `${b.subject} ${b.done}/${b.total}`).join(', ')}.`,
              ].join('\n')
            ),
            `Streak: ${h.streak.current} day(s) (best ${h.streak.best}); today ${h.streak.todayDone ? 'done' : h.streak.todayIsStudyDay ? 'not done yet' : 'not a study day'}.`,
            `Last 7 days: ${h.lastSevenDays.join(', ')}.`,
            `Studied: ${h.studied.last7Days.videos} video(s) / ${h.studied.last7Days.hours} h in 7 days, ${h.studied.last30Days.hours} h in 30 days.`,
            `Done on their planned day: ${h.onTimeShare.percent === null ? 'not measured yet' : `${h.onTimeShare.percent}% (${h.onTimeShare.onTime}/${h.onTimeShare.measured})`}.`,
            `Postponements: ${h.postponements.total}${h.postponements.reasons.length ? ` — ${h.postponements.reasons.map(r => `${r.reason} ${r.percent}%`).join(', ')}` : ''}${h.postponements.mostPostponedBranches.length ? `; most: ${h.postponements.mostPostponedBranches.map(b => `${b.subject} (${b.count})`).join(', ')}` : ''}.`,
            `Focus mode (7 days): ${h.focusMode.sessions} session(s), ${h.focusMode.hours} h, ${h.focusMode.finished} watched to the end.`,
            ...(o.recentNotes.length ? [`Recent day notes: ${o.recentNotes.map(n => `${n.date}: ${n.note}`).join(' | ')}`] : []),
          ];
          return { text: lines.join('\n'), structured: o };
        }),
    },
    {
      name: 'get_my_plan',
      title: 'My plan',
      description: `The signed-in student's tasks day by day, every camp together, for up to ${MAX_PLAN_DAYS} days from \`from\` (default today). From today, overdue tasks are listed first.`,
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'First day, YYYY-MM-DD. Default today.' },
          days: { type: 'integer', minimum: 1, maximum: MAX_PLAN_DAYS, description: 'How many days. Default 7.' },
        },
        additionalProperties: false,
      },
      annotations: readOnly,
      run: (args, { account }) =>
        guard(async () => {
          const today = deps.today();
          const from = args.from === undefined ? today : typeof args.from === 'string' && isDateKey(args.from) ? args.from : null;
          if (!from) throw new InputError('`from` must be a date like 2026-10-01.');
          const days = args.days === undefined ? 7 : Number.isInteger(args.days) && (args.days as number) >= 1 && (args.days as number) <= MAX_PLAN_DAYS ? (args.days as number) : null;
          if (!days) throw new InputError(`\`days\` must be 1 to ${MAX_PLAN_DAYS}.`);
          const { data } = await loadAccountPlan(account, deps);
          const plan = planDays(data, today, from, days);
          const several = data.camps.length > 1;
          const task = (t: (typeof plan.overdue)[number]) =>
            `  ${t.done ? '[x]' : '[ ]'} ${t.subject}: ${t.title} (${Math.round(t.minutes)} min${t.postponed ? `, postponed ${t.postponed}x` : ''})${several ? ` — ${t.camp}` : ''}`;
          const lines = [
            ...(plan.overdue.length ? [`Overdue (${plan.overdue.length}):`, ...plan.overdue.slice(0, 40).map(task)] : []),
            ...plan.days.flatMap(day => [
              `${day.date} ${day.weekday}${day.date === today ? ' (today)' : ''}:${day.tasks.length ? '' : day.kind === 'mock' ? ' mock exam day' : ' no tasks'}`,
              ...day.tasks.map(task),
            ]),
          ];
          return { text: lines.join('\n'), structured: { today, ...plan } };
        }),
    },
    {
      name: 'get_camp_format',
      title: 'Camp JSON format',
      description: 'The JSON format and limits a camp must follow for `send_camp`, with an example. Read it before writing the camp JSON with the student.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, openWorldHint: false },
      run: async () => ({
        text: ['Camp JSON rules:', ...CAMP_RULES.map(r => `- ${r}`), '', 'JSON Schema:', JSON.stringify(CAMP_JSON_SCHEMA), '', 'Example:', JSON.stringify(CAMP_EXAMPLE, null, 2)].join('\n'),
        structured: { schema: CAMP_JSON_SCHEMA, rules: CAMP_RULES, example: CAMP_EXAMPLE },
      }),
    },
    {
      name: 'send_camp',
      title: 'Prepare a camp for my review',
      description: [
        'Prepares a private camp proposal for the student to review. This tool NEVER adds a camp to the plan: only the student can add it from the preview page. `camp` follows `get_camp_format`; fix any reported problem and try again.',
        'Every YouTube video is looked up on YouTube: titles, channels and lengths become YouTube\'s, and a video YouTube does not return refuses the camp. The camp starts today and becomes the open camp.',
        'Set `dryRun` to check the JSON and see the finish date without creating a proposal. Otherwise return the review link; tell the student to open it, inspect the complete list, and approve there. Never say the camp was added until they approve it in Yetişir.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          camp: CAMP_JSON_SCHEMA,
          dryRun: { type: 'boolean', description: 'Only check the camp and show the plan it gives; add nothing.' },
        },
        required: ['camp'],
        additionalProperties: false,
      },
      annotations: preparesProposal,
      run: (args, { account, request }) =>
        guard(async () => {
          const checked = checkCampJson(args.camp);
          if (!checked.ok) return problem(`The camp JSON does not fit the format (see get_camp_format):\n${checked.problems.map(p => `- ${p}`).join('\n')}`);
          const { camp, corrected } = await withYouTubeTruth(checked.camp, deps);
          const { lines, plan } = campLines(camp, deps.today());
          const notes = corrected > 0 ? [`${corrected} video title(s) or length(s) were replaced with what YouTube reports.`] : [];
          if (args.dryRun === true) {
            return { text: [`Camp "${camp.name}" fits the format (nothing added yet).`, ...lines, ...notes].join('\n'), structured: { added: false, camp, estimate: plan } };
          }
          const draftId = await prepareCampDraft(camp, account, deps);
          const previewUrl = `${appUrl(request)}?draft=${draftId}`;
          return {
            text: [
              `Camp "${camp.name}" is ready for the student's review, but has NOT been added to their plan.`,
              ...lines,
              ...notes,
              '',
              `Review the complete list and approve it in Yetişir: [Kampı incele](${previewUrl})`,
              'Show this link to the student. Only their click on "Planıma ekle" in Yetişir will save the camp. Do not call this tool again to bypass approval.',
            ].join('\n'),
            structured: { added: false, awaitingApproval: true, previewUrl, estimate: plan },
          };
        }),
    },
    {
      name: 'read_youtube_playlist',
      title: 'Read a YouTube playlist',
      description:
        'A public or unlisted YouTube playlist: its title, channel and every usable video with its id and exact length, in playlist order, plus what the app skips (private, deleted, live, repeated, longer than 10 hours, blocked in Turkey). Use these ids and lengths in the camp JSON.',
      inputSchema: {
        type: 'object',
        properties: { playlist: { type: 'string', description: 'A YouTube playlist link (…/playlist?list=… or a watch link with &list=…) or a playlist id.' } },
        required: ['playlist'],
        additionalProperties: false,
      },
      annotations: readOnly,
      run: args =>
        guard(async () => {
          const playlistId = readPlaylistRef(args.playlist);
          let data: PlaylistResponse;
          try {
            data = await deps.loadPlaylist(playlistId);
          } catch (error) {
            return problem(youtubeProblem(error));
          }
          const { ready, skipped } = sortRows(reviewPlaylist(data.entries, []));
          const minutes = ready.reduce((acc, v) => acc + v.minutes, 0);
          return {
            text: [
              `Playlist "${data.playlist.title}" by ${data.playlist.channelTitle || 'unknown channel'} (id ${data.playlist.id})`,
              `${ready.length} usable video(s), ${hoursLabel(minutes)} in all.${data.truncated ? ' The playlist is longer than the server reads; only the first part is listed.' : ''}`,
              '',
              videoLines(ready),
              skippedLines(skipped),
            ].join('\n'),
            structured: {
              playlist: { id: data.playlist.id, title: data.playlist.title, channel: data.playlist.channelTitle, url: data.playlist.url },
              videos: ready,
              skipped,
              totalMinutes: round(minutes),
              truncated: data.truncated,
            },
          };
        }),
    },
    {
      name: 'read_youtube_videos',
      title: 'Read YouTube videos',
      description: `YouTube videos by link or id (up to ${MAX_VIDEO_REFS}): the real title, channel and exact length of each, and which cannot be used.`,
      inputSchema: {
        type: 'object',
        properties: { videos: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: MAX_VIDEO_REFS, description: 'YouTube video links or 11-character ids.' } },
        required: ['videos'],
        additionalProperties: false,
      },
      annotations: readOnly,
      run: args =>
        guard(async () => {
          const ids = readVideoRefs(args.videos);
          let entries: PlaylistEntry[];
          try {
            entries = await loadVideosInBatches(ids, deps);
          } catch (error) {
            return problem(youtubeProblem(error));
          }
          const { ready, skipped } = sortRows(reviewPlaylist(entries, []));
          return {
            text: [`${ready.length} usable video(s), ${hoursLabel(ready.reduce((acc, v) => acc + v.minutes, 0))} in all.`, '', videoLines(ready), skippedLines(skipped)].join('\n'),
            structured: { videos: ready, skipped },
          };
        }),
    },
    {
      name: 'search_kesfet',
      title: 'Search Keşfet',
      description: 'Searches Keşfet, the shelf of camps Yetişir students published, by camp name, interest tag (e.g. "#yks"), branch, description or author.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', maxLength: 100, description: 'Words to match, e.g. "tyt matematik". Empty lists the newest camps.' },
          limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Most camps returned. Default 20.' },
        },
        additionalProperties: false,
      },
      annotations: readOnly,
      run: args =>
        guard(async () => {
          const query = typeof args.query === 'string' ? args.query.slice(0, 100) : '';
          const limit = Number.isInteger(args.limit) && (args.limit as number) >= 1 && (args.limit as number) <= 50 ? (args.limit as number) : 20;
          const rows = await catalogGet(deps, `select=${encodeURIComponent(CATALOG_COLUMNS.replace(/\s+/g, ''))}&order=created_at.desc&limit=200`);
          const entries = searchCatalog((Array.isArray(rows) ? rows : []).flatMap(row => readCatalogRow(row) ?? []), query).slice(0, limit);
          return {
            text: entries.length > 0 ? [`${entries.length} camp(s) in Keşfet:`, ...entries.map(entryLine)].join('\n') : 'No published camp matches that.',
            structured: { camps: entries.map(publicEntry) },
          };
        }),
    },
    {
      name: 'get_kesfet_camp',
      title: 'Look inside a Keşfet camp',
      description: 'One published Keşfet camp by id: who made it, its tempo, branches and videos, and the finish date it would give if added today.',
      inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The camp id from `search_kesfet`.' } }, required: ['id'], additionalProperties: false },
      annotations: readOnly,
      run: args =>
        guard(async () => {
          const { entry, camp } = await catalogCamp(deps, args.id);
          const { lines, plan } = campLines(camp, deps.today());
          return {
            text: [`"${entry.name}" by ${entry.authorName}${entry.description ? `: ${entry.description}` : ''}`, ...lines].join('\n'),
            structured: { kesfet: publicEntry(entry), camp, estimate: plan },
          };
        }),
    },
    {
      name: 'add_kesfet_camp',
      title: 'Prepare a Keşfet camp for my review',
      description: 'Prepares a private review of a published Keşfet camp. It does NOT add anything to the plan until the student opens the link, reviews every item and clicks Planıma ekle in Yetişir. The approved copy stays marked as someone else\'s camp, so the student cannot publish it as their own.',
      inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The camp id from `search_kesfet`.' } }, required: ['id'], additionalProperties: false },
      annotations: preparesProposal,
      run: (args, { account, request }) =>
        guard(async () => {
          const { entry, camp } = await catalogCamp(deps, args.id);
          const draftId = await prepareCampDraft(camp, account, deps, 'kesfet');
          const previewUrl = `${appUrl(request)}?draft=${draftId}`;
          const { lines } = campLines(camp, deps.today());
          return {
            text: [`A copy of "${entry.name}" (by ${entry.authorName}) is ready for review, but has NOT been added to the student's plan.`, ...lines, '', `The student must inspect and approve it in Yetişir: [Kampı incele](${previewUrl})`].join('\n'),
            structured: { added: false, awaitingApproval: true, kesfet: publicEntry(entry), previewUrl },
          };
        }),
    },
  ];
}
