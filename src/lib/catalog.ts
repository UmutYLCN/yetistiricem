import type { StudyCamp } from '../types';
import type { SharedCamp } from './campShare.ts';
import { MAX_SHARED_BRANCHES, MAX_SHARED_VIDEOS, readShareDocument, shareDocument, shareSummary } from './campShare.ts';
import { diffDays, isDateKey, toDateKey } from './engine.ts';
import { formatLongDate } from './format.ts';

// Keşfet: camps students publish for everyone (Supabase `published_camps`,
// see docs/kesfet.md). This module is the pure part: reading rows, building
// what is published and searching. Rows come from other people, so they are
// checked like share links; a camp whose document is broken is not offered.

export const MAX_DESCRIPTION = 500;
export const MAX_PUBLISHED_NAME = 80;
export const MIN_DISPLAY_NAME = 2;
export const MAX_DISPLAY_NAME = 40;

/** Columns of the list (everything but the camp document) and the author's public name. */
export const CATALOG_COLUMNS =
  'id, author_id, source_camp_id, name, description, subjects, branch_count, video_count, total_minutes, created_at, updated_at, author:profiles(display_name)';

export interface CatalogEntry {
  id: string;
  authorId: string;
  authorName: string;
  /** The author's own camp id (publishing it again updates this entry). */
  sourceCampId: string;
  name: string;
  description: string;
  subjects: string[];
  branchCount: number;
  videoCount: number;
  totalMinutes: number;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value: unknown, max: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max ? value : null;

/** One list row, or null when it is not a usable entry. */
export function readCatalogRow(raw: unknown): CatalogEntry | null {
  if (!isRecord(raw)) return null;
  const { id, author_id: authorId, source_camp_id: sourceCampId, name, description, subjects, created_at: createdAt, updated_at: updatedAt } = raw;
  const author = Array.isArray(raw.author) ? raw.author[0] : raw.author;
  const authorName = isRecord(author) && typeof author.display_name === 'string' ? author.display_name.trim() : '';
  const branchCount = count(raw.branch_count, MAX_SHARED_BRANCHES);
  const videoCount = count(raw.video_count, MAX_SHARED_VIDEOS);
  const totalMinutes = typeof raw.total_minutes === 'number' ? raw.total_minutes : Number(raw.total_minutes);
  if (typeof id !== 'string' || typeof authorId !== 'string' || typeof sourceCampId !== 'string') return null;
  if (typeof name !== 'string' || !name.trim() || branchCount === null || videoCount === null) return null;
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return null;
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) return null;
  return {
    id,
    authorId,
    authorName: authorName || 'Bir öğrenci',
    sourceCampId,
    name: name.trim().slice(0, MAX_PUBLISHED_NAME),
    description: typeof description === 'string' ? description.trim().slice(0, MAX_DESCRIPTION) : '',
    subjects: Array.isArray(subjects) ? subjects.filter((s): s is string => typeof s === 'string' && s.trim() !== '').slice(0, MAX_SHARED_BRANCHES) : [],
    branchCount,
    videoCount,
    totalMinutes,
    createdAt,
    updatedAt: typeof updatedAt === 'string' && !Number.isNaN(Date.parse(updatedAt)) ? updatedAt : createdAt,
  };
}

/** The camp document of an entry, checked like a share link; null when any part is broken. */
export function readCatalogCamp(payload: unknown): SharedCamp | null {
  const result = readShareDocument(payload);
  return result.ok ? result.camp : null;
}

export interface PublishRow {
  source_camp_id: string;
  name: string;
  description: string;
  subjects: string[];
  branch_count: number;
  video_count: number;
  total_minutes: number;
  payload: ReturnType<typeof shareDocument>;
}

/** What publishing a camp stores: the share document plus the summary the list shows. */
export function publishRow(camp: Pick<StudyCamp, 'id'>, shared: SharedCamp, details: { name: string; description: string }): PublishRow {
  const name = details.name.trim().slice(0, MAX_PUBLISHED_NAME) || shared.name;
  const summary = shareSummary(shared);
  return {
    source_camp_id: camp.id,
    name,
    description: details.description.trim().slice(0, MAX_DESCRIPTION),
    subjects: [...new Set(shared.branches.map(b => b.subject))],
    branch_count: summary.branches,
    video_count: summary.videos,
    total_minutes: Math.round(summary.minutes * 100) / 100,
    payload: shareDocument({ ...shared, name }),
  };
}

/** Why a public name cannot be used, or null. */
export function displayNameProblem(name: string): string | null {
  const length = name.trim().length;
  if (length < MIN_DISPLAY_NAME) return `En az ${MIN_DISPLAY_NAME} karakter olmalı.`;
  if (length > MAX_DISPLAY_NAME) return `En fazla ${MAX_DISPLAY_NAME} karakter olabilir.`;
  return null;
}

const fold = (text: string) => text.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu, '');

/** Entries whose name, branches, description or author match every word of `query`. */
export function searchCatalog(entries: readonly CatalogEntry[], query: string): CatalogEntry[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...entries];
  return entries.filter(entry => {
    const haystack = fold([entry.name, entry.authorName, entry.description, ...entry.subjects].join(' '));
    return words.every(word => haystack.includes(word));
  });
}

/** "Bugün", "Dün", "3 gün önce" or the date, for when an entry was published. */
export function publishedLabel(iso: string, today: string): string {
  const day = toDateKey(new Date(iso));
  if (!isDateKey(day)) return '';
  const ago = diffDays(day, today);
  if (ago <= 0) return 'Bugün';
  if (ago === 1) return 'Dün';
  if (ago < 7) return `${ago} gün önce`;
  return formatLongDate(day);
}
