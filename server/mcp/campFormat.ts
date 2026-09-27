// The camp JSON an assistant sends with `send_camp` (docs/mcp.md): the share
// document's `camp` (docs/camp-share-link.md) held to the limits the app's own
// forms use. Share links read leniently (a bad tempo value falls back to the
// default); here every problem is named with its path, so the assistant can
// fix the JSON with the student instead of the app quietly changing it.
import type { SharedBranch, SharedCamp, SharedVideo } from '../../src/lib/campShare.ts';
import { MAX_SHARED_BRANCHES, MAX_SHARED_VIDEOS } from '../../src/lib/campShare.ts';
import { MAX_BRANCH_NAME, MAX_CAMP_NAME, MAX_DAILY_HOURS, MIN_DAILY_HOURS } from '../../src/lib/studyCamp.ts';
import { PALETTE } from '../../src/lib/subjects.ts';
import { MAX_VIDEO_MINUTES, isFetchablePlaylistId, isYoutubeVideoId } from '../../src/utils/youtubeParser.ts';
import type { JsonSchema } from './protocol.ts';

/** The choices the app's tempo form offers. */
export const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 1.75, 2];
export const PRACTICE_SHARES = [0, 0.1, 0.2, 0.3, 0.5, 0.75, 1];
const MAX_TITLE = 200;
const MAX_CHANNEL = 120;
const MAX_PROBLEMS = 40;
const MAX_SUBJECTS_PER_DAY = 10;
const COLOR_KEYS = PALETTE.map(c => c.key);
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

const weekdayList = (description: string) => ({ type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, uniqueItems: true, description });

export const CAMP_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  description: 'A Yetişir study camp. The app splits the videos into days that fit the daily study time; it starts on the day the student imports it.',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: MAX_CAMP_NAME, description: 'Camp name, e.g. "TYT 2027".' },
    schedule: {
      type: 'object',
      description: 'The tempo.',
      properties: {
        mode: { type: 'string', enum: ['auto', 'manual'], description: '"auto": the app rotates the branches over the study days. "manual": `weekPlan` says which branches each weekday holds.' },
        dailyStudyHours: { type: 'number', minimum: MIN_DAILY_HOURS, maximum: MAX_DAILY_HOURS, description: 'Study hours per study day, videos plus notes and practice.' },
        playbackSpeed: { type: 'number', enum: PLAYBACK_SPEEDS, description: 'Speed the student watches at.' },
        practiceMultiplier: { type: 'number', enum: PRACTICE_SHARES, description: 'Extra time per video for notes and practice: 0.2 = +20%.' },
        maxSubjectsPerDay: { type: 'integer', minimum: 1, maximum: MAX_SUBJECTS_PER_DAY, description: 'Auto mode: most branches on one day; more than the camp has counts as all of them.' },
        activeDays: weekdayList('Auto mode: study weekdays, 0 = Sunday … 6 = Saturday. Manual mode: the weekdays with branches in `weekPlan`.'),
        mockExamDays: weekdayList('Weekdays kept free for mock exams; never study days.'),
        weekPlan: {
          type: 'array',
          minItems: 7,
          maxItems: 7,
          items: { type: 'array', items: { type: 'integer', minimum: 0 }, uniqueItems: true },
          description: 'Manual mode only: seven lists (Sunday first) of branch positions in `branches` (0-based). Every branch needs at least one day.',
        },
      },
      required: ['mode', 'dailyStudyHours', 'playbackSpeed', 'practiceMultiplier'],
      additionalProperties: false,
    },
    branches: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_SHARED_BRANCHES,
      description: `Branches (subjects), at most ${MAX_SHARED_BRANCHES}; ${MAX_SHARED_VIDEOS} videos and topics in all.`,
      items: {
        type: 'object',
        properties: {
          subject: { type: 'string', minLength: 1, maxLength: MAX_BRANCH_NAME, description: 'Branch name, e.g. Matematik.' },
          title: { type: 'string', maxLength: MAX_TITLE, description: 'Source name, e.g. the playlist title. May be empty.' },
          channel: { type: 'string', maxLength: MAX_CHANNEL, description: 'Channel name. May be empty.' },
          playlistId: { type: 'string', description: 'The YouTube playlist the videos come from, when the branch holds that whole playlist; the app then checks it daily for new videos.' },
          color: { type: 'string', enum: COLOR_KEYS },
          videos: {
            type: 'array',
            minItems: 1,
            description: 'In study order.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', minLength: 1, maxLength: MAX_TITLE },
                minutes: { type: 'number', exclusiveMinimum: 0, maximum: MAX_VIDEO_MINUTES, description: 'Length in minutes. For a YouTube video the server replaces it with YouTube\'s exact length.' },
                youtubeId: { type: 'string', pattern: '^[A-Za-z0-9_-]{11}$', description: 'The 11-character YouTube video id. Leave it out for a topic studied without a video.' },
              },
              required: ['title', 'minutes'],
              additionalProperties: false,
            },
          },
        },
        required: ['subject', 'videos'],
        additionalProperties: false,
      },
    },
  },
  required: ['name', 'schedule', 'branches'],
  additionalProperties: false,
};

export const CAMP_EXAMPLE = {
  name: 'TYT 2027',
  schedule: { mode: 'auto', dailyStudyHours: 3, playbackSpeed: 1.5, practiceMultiplier: 0.2, maxSubjectsPerDay: 2, activeDays: [1, 2, 3, 4, 5, 6], mockExamDays: [0] },
  branches: [
    {
      subject: 'Matematik',
      title: 'TYT Matematik Kampı',
      channel: 'Kanal adı',
      playlistId: 'PLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      videos: [
        { title: 'Temel Kavramlar', minutes: 42, youtubeId: 'xxxxxxxxxxx' },
        { title: 'Sayı Basamakları', minutes: 38, youtubeId: 'yyyyyyyyyyy' },
      ],
    },
    { subject: 'Türkçe', title: 'Paragraf çalışması', channel: '', videos: [{ title: 'Paragraf: ana düşünce (kitaptan 40 soru)', minutes: 60 }] },
  ],
};

export const CAMP_RULES = [
  `name: 1–${MAX_CAMP_NAME} characters. branches: 1–${MAX_SHARED_BRANCHES}, each with at least one video; ${MAX_SHARED_VIDEOS} videos and topics in all.`,
  `subject (branch name): 1–${MAX_BRANCH_NAME} characters. Video/topic title: 1–${MAX_TITLE}. Channel: up to ${MAX_CHANNEL}.`,
  `minutes: more than 0, at most ${MAX_VIDEO_MINUTES}. youtubeId: an 11-character YouTube video id; without it the item is a link-free topic.`,
  `Every youtubeId is looked up on YouTube: the title, channel and exact length come from YouTube, and a video that is private, deleted, live, repeated in its branch, longer than 10 hours or blocked in Turkey is refused. Never invent ids; take them from read_youtube_playlist or read_youtube_videos.`,
  `schedule.mode "auto": activeDays (at least one) and maxSubjectsPerDay (1–${MAX_SUBJECTS_PER_DAY}). "manual": weekPlan, seven lists (Sunday first) of 0-based branch positions; every branch on at least one day, and a mock exam day holds none.`,
  `dailyStudyHours: ${MIN_DAILY_HOURS}–${MAX_DAILY_HOURS}. playbackSpeed: one of ${PLAYBACK_SPEEDS.join(', ')}. practiceMultiplier: one of ${PRACTICE_SHARES.join(', ')}. mockExamDays never overlap study days.`,
  'The camp always starts on the day the student imports it; there is no start or target date in the JSON.',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export type CampCheck = { ok: true; camp: SharedCamp } | { ok: false; problems: string[] };

/**
 * The camp JSON checked against every limit. `raw` may be the camp itself or
 * a whole share document (`{ app, type, version, camp }`).
 */
export function checkCampJson(raw: unknown): CampCheck {
  const problems: string[] = [];
  const add = (path: string, text: string) => {
    if (problems.length < MAX_PROBLEMS) problems.push(`${path}: ${text}`);
  };
  const input = isRecord(raw) && raw.app === 'yetistiricem' && isRecord(raw.camp) ? raw.camp : raw;
  if (!isRecord(input)) return { ok: false, problems: ['camp: must be a JSON object.'] };
  for (const key of Object.keys(input)) if (!['name', 'schedule', 'branches'].includes(key)) add(`camp.${key}`, 'unknown field.');

  const text = (value: unknown, path: string, min: number, max: number): string => {
    if (typeof value !== 'string') {
      add(path, 'must be a string.');
      return '';
    }
    const trimmed = value.trim();
    if (trimmed.length < min) add(path, min === 1 ? 'must not be empty.' : `needs at least ${min} characters.`);
    if (trimmed.length > max) add(path, `at most ${max} characters (has ${trimmed.length}).`);
    return trimmed;
  };
  const weekdays = (value: unknown, path: string): number[] => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || !value.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
      add(path, 'must be a list of weekdays 0 (Sunday) to 6 (Saturday).');
      return [];
    }
    return [...new Set(value as number[])].sort((a, b) => a - b);
  };

  const name = text(input.name, 'camp.name', 1, MAX_CAMP_NAME);

  const branches: SharedBranch[] = [];
  if (!Array.isArray(input.branches) || input.branches.length === 0 || input.branches.length > MAX_SHARED_BRANCHES) {
    add('camp.branches', `must list 1 to ${MAX_SHARED_BRANCHES} branches.`);
  } else {
    let total = 0;
    input.branches.forEach((rawBranch, i) => {
      const path = `camp.branches[${i}]`;
      if (!isRecord(rawBranch)) return add(path, 'must be an object.');
      for (const key of Object.keys(rawBranch)) if (!['subject', 'title', 'channel', 'playlistId', 'color', 'videos'].includes(key)) add(`${path}.${key}`, 'unknown field.');
      const subject = text(rawBranch.subject, `${path}.subject`, 1, MAX_BRANCH_NAME);
      const title = rawBranch.title === undefined ? '' : text(rawBranch.title, `${path}.title`, 0, MAX_TITLE);
      const channel = rawBranch.channel === undefined ? '' : text(rawBranch.channel, `${path}.channel`, 0, MAX_CHANNEL);
      if (rawBranch.playlistId !== undefined && (typeof rawBranch.playlistId !== 'string' || !isFetchablePlaylistId(rawBranch.playlistId))) {
        add(`${path}.playlistId`, 'is not a readable YouTube playlist id (e.g. PL…).');
      }
      if (rawBranch.color !== undefined && (typeof rawBranch.color !== 'string' || !COLOR_KEYS.includes(rawBranch.color))) {
        add(`${path}.color`, `must be one of ${COLOR_KEYS.join(', ')}.`);
      }
      const videos: SharedVideo[] = [];
      if (!Array.isArray(rawBranch.videos) || rawBranch.videos.length === 0) {
        add(`${path}.videos`, 'needs at least one video or topic.');
      } else {
        total += rawBranch.videos.length;
        rawBranch.videos.forEach((rawVideo, j) => {
          const vpath = `${path}.videos[${j}]`;
          if (!isRecord(rawVideo)) return add(vpath, 'must be an object with title and minutes.');
          for (const key of Object.keys(rawVideo)) if (!['title', 'minutes', 'youtubeId'].includes(key)) add(`${vpath}.${key}`, 'unknown field.');
          const videoTitle = text(rawVideo.title, `${vpath}.title`, 1, MAX_TITLE);
          const minutes = rawVideo.minutes;
          if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_VIDEO_MINUTES) {
            add(`${vpath}.minutes`, `must be a number above 0 and at most ${MAX_VIDEO_MINUTES}.`);
          }
          const youtubeId = rawVideo.youtubeId;
          if (youtubeId !== undefined && (typeof youtubeId !== 'string' || !isYoutubeVideoId(youtubeId))) {
            add(`${vpath}.youtubeId`, 'must be an 11-character YouTube video id.');
          }
          videos.push({ title: videoTitle, minutes: typeof minutes === 'number' ? minutes : 0, ...(typeof youtubeId === 'string' ? { youtubeId } : {}) });
        });
      }
      branches.push({
        subject,
        title,
        channel,
        ...(typeof rawBranch.playlistId === 'string' ? { playlistId: rawBranch.playlistId } : {}),
        ...(typeof rawBranch.color === 'string' ? { color: rawBranch.color } : {}),
        videos,
      });
    });
    if (total > MAX_SHARED_VIDEOS) add('camp.branches', `hold ${total} videos and topics; at most ${MAX_SHARED_VIDEOS}.`);
  }

  const schedule = input.schedule;
  let mode: 'auto' | 'manual' = 'auto';
  let dailyStudyHours = 0;
  let playbackSpeed = 1;
  let practiceMultiplier = 0.2;
  let maxSubjectsPerDay = 1;
  let activeDays: number[] = [];
  let mockExamDays: number[] = [];
  let weekPlan: number[][] | undefined;
  if (!isRecord(schedule)) {
    add('camp.schedule', 'must be an object.');
  } else {
    for (const key of Object.keys(schedule)) {
      if (!['mode', 'dailyStudyHours', 'playbackSpeed', 'practiceMultiplier', 'maxSubjectsPerDay', 'activeDays', 'mockExamDays', 'restDays', 'weekPlan'].includes(key)) {
        add(`camp.schedule.${key}`, 'unknown field.');
      }
    }
    if (schedule.mode !== 'auto' && schedule.mode !== 'manual') add('camp.schedule.mode', 'must be "auto" or "manual".');
    else mode = schedule.mode;
    const hours = schedule.dailyStudyHours;
    if (typeof hours !== 'number' || !(hours >= MIN_DAILY_HOURS && hours <= MAX_DAILY_HOURS)) add('camp.schedule.dailyStudyHours', `must be ${MIN_DAILY_HOURS}–${MAX_DAILY_HOURS}.`);
    else dailyStudyHours = hours;
    if (typeof schedule.playbackSpeed !== 'number' || !PLAYBACK_SPEEDS.includes(schedule.playbackSpeed)) add('camp.schedule.playbackSpeed', `must be one of ${PLAYBACK_SPEEDS.join(', ')}.`);
    else playbackSpeed = schedule.playbackSpeed;
    if (typeof schedule.practiceMultiplier !== 'number' || !PRACTICE_SHARES.includes(schedule.practiceMultiplier)) add('camp.schedule.practiceMultiplier', `must be one of ${PRACTICE_SHARES.join(', ')}.`);
    else practiceMultiplier = schedule.practiceMultiplier;
    mockExamDays = weekdays(schedule.mockExamDays, 'camp.schedule.mockExamDays');

    if (mode === 'auto') {
      activeDays = weekdays(schedule.activeDays, 'camp.schedule.activeDays');
      if (activeDays.length === 0) add('camp.schedule.activeDays', 'needs at least one study day.');
      if (activeDays.some(d => mockExamDays.includes(d))) add('camp.schedule.mockExamDays', 'must not be study days.');
      const perDay = schedule.maxSubjectsPerDay;
      if (!Number.isInteger(perDay) || (perDay as number) < 1 || (perDay as number) > MAX_SUBJECTS_PER_DAY) {
        add('camp.schedule.maxSubjectsPerDay', `must be a whole number from 1 to ${MAX_SUBJECTS_PER_DAY}.`);
      } else maxSubjectsPerDay = Math.min(perDay as number, Math.max(1, branches.length));
      if (schedule.weekPlan !== undefined) add('camp.schedule.weekPlan', 'is only for mode "manual".');
    } else {
      const plan = schedule.weekPlan;
      if (!Array.isArray(plan) || plan.length !== 7) {
        add('camp.schedule.weekPlan', 'must be seven lists (Sunday first) of branch positions.');
      } else {
        weekPlan = plan.map((day, d) => {
          if (!Array.isArray(day) || !day.every(i => Number.isInteger(i) && i >= 0 && i < branches.length)) {
            add(`camp.schedule.weekPlan[${d}]`, `must list branch positions 0–${branches.length - 1}.`);
            return [];
          }
          if (day.length > 0 && mockExamDays.includes(d)) add(`camp.schedule.weekPlan[${d}]`, 'is a mock exam day and must be empty.');
          return [...new Set(day as number[])];
        });
        branches.forEach((b, i) => {
          if (!weekPlan!.some(day => day.includes(i))) add(`camp.schedule.weekPlan`, `branch ${i} (${b.subject || 'unnamed'}) is on no day.`);
        });
        activeDays = WEEKDAYS.filter(d => weekPlan![d].length > 0);
        maxSubjectsPerDay = Math.max(1, ...weekPlan.map(day => day.length));
      }
    }
  }

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    camp: {
      name,
      schedule: {
        dailyStudyHours,
        playbackSpeed,
        practiceMultiplier,
        maxSubjectsPerDay,
        activeDays,
        restDays: WEEKDAYS.filter(d => !activeDays.includes(d) && !mockExamDays.includes(d)),
        mockExamDays,
        mode,
        ...(weekPlan ? { weekPlan } : {}),
      },
      branches,
    },
  };
}
