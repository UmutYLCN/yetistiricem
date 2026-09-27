import type { StudyCamp } from '../types/index.ts';
import type { SharedCamp } from './campShare.ts';
import { MAX_SHARED_BRANCHES, MAX_SHARED_VIDEOS, readShareDocument, shareDocument, shareSummary } from './campShare.ts';
import { diffDays, isDateKey, toDateKey } from './engine.ts';
import { formatLongDate } from './format.ts';
import type { PublicAuthor } from './studentProfile.ts';
import { authorHeadline, readPublicAuthor } from './studentProfile.ts';

// Keşfet: camps students publish for everyone (Supabase `published_camps`,
// see docs/kesfet.md). This module is the pure part: reading rows, building
// what is published and searching. Rows come from other people, so they are
// checked like share links; a camp whose document is broken is not offered.

export const MAX_DESCRIPTION = 500;
export const MAX_PUBLISHED_NAME = 80;
export const MIN_DISPLAY_NAME = 2;
export const MAX_DISPLAY_NAME = 40;
export const MAX_TAGS = 5;
export const MIN_TAG = 2;
export const MAX_TAG = 24;

/** Columns of the list (everything but the camp document) and the author's public profile. */
export const CATALOG_COLUMNS =
  'id, author_id, source_camp_id, name, description, subjects, tags, cover, save_count, branch_count, video_count, total_minutes, created_at, updated_at, author:profiles(display_name, avatar, stage, department, profession, bio)';

export interface CatalogEntry {
  id: string;
  authorId: string;
  authorName: string;
  /** The author's public profile (picture, stage, department / profession, bio). */
  author: PublicAuthor;
  /** The author's own camp id (publishing it again updates this entry). */
  sourceCampId: string;
  name: string;
  description: string;
  subjects: string[];
  /** Interest tags without "#" (lowercase, at most five). */
  tags: string[];
  /** The cover photo's path in the `camp-covers` bucket; null draws the default cover. */
  cover: string | null;
  /** How many students saved the camp. */
  saveCount: number;
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
  const author = readPublicAuthor(Array.isArray(raw.author) ? raw.author[0] : raw.author);
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
    authorName: author.name,
    author,
    sourceCampId,
    name: name.trim().slice(0, MAX_PUBLISHED_NAME),
    description: typeof description === 'string' ? description.trim().slice(0, MAX_DESCRIPTION) : '',
    subjects: Array.isArray(subjects) ? subjects.filter((s): s is string => typeof s === 'string' && s.trim() !== '').slice(0, MAX_SHARED_BRANCHES) : [],
    tags: readTags(raw.tags),
    cover: isCoverPath(raw.cover, authorId) ? raw.cover : null,
    saveCount: typeof raw.save_count === 'number' && Number.isInteger(raw.save_count) && raw.save_count > 0 ? raw.save_count : 0,
    branchCount,
    videoCount,
    totalMinutes,
    createdAt,
    updatedAt: typeof updatedAt === 'string' && !Number.isNaN(Date.parse(updatedAt)) ? updatedAt : createdAt,
  };
}

const TAG = /^[a-z0-9çğıöşüâîû_]+$/;

/** A typed tag as stored: no "#", lowercase (Turkish rules), letters, digits and "_" only; null when too short. */
export function normalizeTag(input: string): string | null {
  const tag = input
    .replace(/^#+/, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşüâîû_]/g, '')
    .slice(0, MAX_TAG);
  return tag.length >= MIN_TAG ? tag : null;
}

const COMMON_TAGS = ['yks', 'tyt', 'ayt', 'lgs', 'kpss', 'ales', 'yds', 'üniversite', 'vize', 'final', 'yazılım', 'ingilizce'];

/** Tags to offer when publishing: the camp's branch names first, then common exam and topic tags. */
export function suggestTags(subjects: readonly string[]): string[] {
  const fromSubjects = subjects.flatMap(subject => normalizeTag(subject.replace(/\s+/g, '')) ?? []);
  return [...new Set([...fromSubjects, ...COMMON_TAGS])];
}

/** Tags from someone else's row: valid, unique, at most five. */
export function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags = value.filter((t): t is string => typeof t === 'string' && t.length >= MIN_TAG && t.length <= MAX_TAG && TAG.test(t));
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

/** A cover photo path in the author's own folder of the `camp-covers` bucket. */
export function isCoverPath(value: unknown, authorId: string): value is string {
  return typeof value === 'string' && value.startsWith(`${authorId}/`) && /^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,64}\.(webp|jpg)$/.test(value);
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
  tags: string[];
  cover: string | null;
  payload: ReturnType<typeof shareDocument>;
}

/** What publishing a camp stores: the share document plus the summary the list shows. */
export function publishRow(
  camp: Pick<StudyCamp, 'id'>,
  shared: SharedCamp,
  details: { name: string; description: string; tags?: readonly string[]; cover?: string | null }
): PublishRow {
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
    tags: [...new Set((details.tags ?? []).flatMap(tag => normalizeTag(tag) ?? []))].slice(0, MAX_TAGS),
    cover: details.cover ?? null,
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

// Lowercase without accents, dotless ı read as i: "yazilim" finds "Yazılım".
const fold = (text: string) => text.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i');

/** Entries whose name, tags, branches, description or author match every word of `query` ("#yks" matches the tag yks). */
export function searchCatalog(entries: readonly CatalogEntry[], query: string): CatalogEntry[] {
  const words = fold(query)
    .split(/\s+/)
    .map(word => word.replace(/^#+/, ''))
    .filter(Boolean);
  if (words.length === 0) return [...entries];
  return entries.filter(entry => {
    const haystack = fold(
      [entry.name, ...entry.tags, entry.authorName, authorHeadline(entry.author) ?? '', entry.description, ...entry.subjects].join(' ')
    );
    return words.every(word => haystack.includes(word));
  });
}

/** The branch names used most across entries (for Keşfet's filter chips), most common first. */
export function popularSubjects(entries: readonly Pick<CatalogEntry, 'subjects'>[], limit = 8): string[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const entry of entries) {
    for (const key of new Set(entry.subjects.map(fold))) {
      const name = entry.subjects.find(subject => fold(subject) === key) ?? key;
      const current = counts.get(key);
      counts.set(key, { name: current?.name ?? name, count: (current?.count ?? 0) + 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr'))
    .slice(0, limit)
    .map(item => item.name);
}

/** The tags used most across entries (Keşfet's filter chips), most common first. */
export function popularTags(entries: readonly Pick<CatalogEntry, 'tags'>[], limit = 10): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) for (const tag of new Set(entry.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
    .slice(0, limit)
    .map(([tag]) => tag);
}

/** Entries that have a branch of this name (ignoring case and accents). */
export function withSubject(entries: readonly CatalogEntry[], subject: string | null): CatalogEntry[] {
  if (!subject) return [...entries];
  const key = fold(subject);
  return entries.filter(entry => entry.subjects.some(s => fold(s) === key));
}

/** Entries carrying this tag. */
export function withTag(entries: readonly CatalogEntry[], tag: string | null): CatalogEntry[] {
  return tag ? entries.filter(entry => entry.tags.includes(tag)) : [...entries];
}

export type CatalogSort = 'new' | 'old' | 'popular' | 'short' | 'long';

/** Newest or oldest first, most saved first, or by total video time. */
export function sortCatalog(entries: readonly CatalogEntry[], sort: CatalogSort): CatalogEntry[] {
  const copy = [...entries];
  const newest = (a: CatalogEntry, b: CatalogEntry) => b.createdAt.localeCompare(a.createdAt);
  if (sort === 'old') return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (sort === 'popular') return copy.sort((a, b) => b.saveCount - a.saveCount || newest(a, b));
  if (sort === 'short') return copy.sort((a, b) => a.totalMinutes - b.totalMinutes);
  if (sort === 'long') return copy.sort((a, b) => b.totalMinutes - a.totalMinutes);
  return copy.sort(newest);
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
