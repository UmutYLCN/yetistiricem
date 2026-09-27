import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SharedCamp } from '../src/lib/campShare.ts';
import { hasAuthCallback, hasSavedSignIn, readAuthError } from '../src/lib/authKey.ts';
import { shareDocument } from '../src/lib/campShare.ts';
import type { CatalogEntry } from '../src/lib/catalog.ts';
import {
  displayNameProblem,
  normalizeTag,
  popularSubjects,
  popularTags,
  publishRow,
  publishedLabel,
  readCatalogCamp,
  readCatalogRow,
  readTags,
  searchCatalog,
  sortCatalog,
  suggestTags,
  withSubject,
  withTag,
} from '../src/lib/catalog.ts';

const shared: SharedCamp = {
  name: 'TYT 2027',
  schedule: { dailyStudyHours: 3, playbackSpeed: 1.25, practiceMultiplier: 0.2, maxSubjectsPerDay: 3, activeDays: [1, 2, 3, 4, 5, 6], restDays: [0], mockExamDays: [], mode: 'auto' },
  branches: [
    { subject: 'Matematik', title: 'TYT Matematik', channel: 'Hoca', videos: [{ title: 'Sayılar', minutes: 30, youtubeId: 'abcdefghijk' }, { title: 'Bölünebilme', minutes: 25.5 }] },
    { subject: 'Fizik', title: '', channel: '', videos: [{ title: 'Vektörler', minutes: 40 }] },
    { subject: 'Matematik', title: 'Geometri', channel: '', videos: [{ title: 'Üçgenler', minutes: 20 }] },
  ],
};

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'e1',
  author_id: 'u1',
  source_camp_id: 'camp-1',
  name: '  TYT 2027 ',
  description: 'Her gün 3 saat.',
  subjects: ['Matematik', 'Fizik', 42],
  branch_count: 3,
  video_count: 4,
  total_minutes: '115.5',
  created_at: '2026-09-24T10:00:00Z',
  updated_at: '2026-09-25T10:00:00Z',
  author: { display_name: ' Ayşe ' },
  ...overrides,
});

test('what is published is the share document and the summary the list shows', () => {
  const published = publishRow({ id: 'camp-1' }, shared, { name: '  Yaz kampı ', description: '  3 ay kala.  ' });
  assert.deepEqual(
    { ...published, payload: undefined },
    {
      source_camp_id: 'camp-1',
      name: 'Yaz kampı',
      description: '3 ay kala.',
      subjects: ['Matematik', 'Fizik'],
      branch_count: 3,
      video_count: 4,
      total_minutes: 115.5,
      tags: [],
      cover: null,
      payload: undefined,
    }
  );
  assert.deepEqual(published.payload, shareDocument({ ...shared, name: 'Yaz kampı' }));
  assert.equal(publishRow({ id: 'c' }, shared, { name: '   ', description: '' }).name, 'TYT 2027', 'an empty name keeps the camp’s');
  assert.deepEqual(readCatalogCamp(published.payload), { ...shared, name: 'Yaz kampı' });
});

test('catalog rows from other people are checked; unusable rows and documents are left out', () => {
  const entry = readCatalogRow(row());
  assert.deepEqual(entry, {
    id: 'e1',
    authorId: 'u1',
    authorName: 'Ayşe',
    author: { name: 'Ayşe', avatar: null, stage: null, department: null, profession: null, bio: null },
    sourceCampId: 'camp-1',
    name: 'TYT 2027',
    description: 'Her gün 3 saat.',
    subjects: ['Matematik', 'Fizik'],
    tags: [],
    cover: null,
    saveCount: 0,
    branchCount: 3,
    videoCount: 4,
    totalMinutes: 115.5,
    createdAt: '2026-09-24T10:00:00Z',
    updatedAt: '2026-09-25T10:00:00Z',
  });
  assert.equal(readCatalogRow(row({ author: [{ display_name: 'Liste' }] }))?.authorName, 'Liste', 'PostgREST may embed the author as a list');
  assert.equal(readCatalogRow(row({ author: null }))?.authorName, 'Bir öğrenci');
  for (const broken of [{ name: '  ' }, { branch_count: 0 }, { video_count: 9000 }, { total_minutes: 'x' }, { created_at: 'dün' }, { id: 5 }]) {
    assert.equal(readCatalogRow(row(broken)), null, JSON.stringify(broken));
  }
  assert.equal(readCatalogCamp({ app: 'yetistiricem', type: 'camp', version: 1, camp: { ...shared, branches: [] } }), null);
  assert.equal(readCatalogCamp(null), null);
});

test('search matches every word across name, branches, description and author, ignoring case and accents', () => {
  const entries = [
    readCatalogRow(row()),
    readCatalogRow(row({ id: 'e2', name: 'AYT Sayısal', subjects: ['Kimya', 'Biyoloji'], description: '', author: { display_name: 'Burak' } })),
  ].filter((e): e is CatalogEntry => e !== null);
  assert.deepEqual(searchCatalog(entries, '').map(e => e.id), ['e1', 'e2']);
  assert.deepEqual(searchCatalog(entries, 'fizik').map(e => e.id), ['e1']);
  assert.deepEqual(searchCatalog(entries, 'SAYISAL burak').map(e => e.id), ['e2']);
  assert.deepEqual(searchCatalog(entries, 'ayse').map(e => e.id), ['e1'], 'Ayşe matches without the ş');
  assert.deepEqual(searchCatalog(entries, 'kimya fizik'), []);
});

test('public names and publish dates read naturally', () => {
  assert.equal(displayNameProblem('A'), 'En az 2 karakter olmalı.');
  assert.equal(displayNameProblem('x'.repeat(41)), 'En fazla 40 karakter olabilir.');
  assert.equal(displayNameProblem('  Umut  '), null);
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
  assert.equal(publishedLabel(at(2026, 9, 26), '2026-09-26'), 'Bugün');
  assert.equal(publishedLabel(at(2026, 9, 25), '2026-09-26'), 'Dün');
  assert.equal(publishedLabel(at(2026, 9, 22), '2026-09-26'), '4 gün önce');
  assert.equal(publishedLabel(at(2026, 8, 1), '2026-09-26'), '1 Ağustos 2026');
});

test('a sign-in answer is recognised in the address bar hash, and storage errors mean no saved session', () => {
  assert.ok(hasAuthCallback('#access_token=abc&refresh_token=def&type=magiclink'));
  assert.ok(hasAuthCallback('#error=access_denied&error_description=Email+link+is+invalid'));
  assert.ok(!hasAuthCallback(''));
  assert.ok(!hasAuthCallback('#icerik'));
  assert.equal(hasSavedSignIn(), false, 'no localStorage here: not signed in');
  assert.match(readAuthError('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired') ?? '', /süresi dolmuş/);
  assert.match(readAuthError('#error=access_denied') ?? '', /tamamlanmadı/);
  assert.equal(readAuthError('#access_token=abc'), null);
});

test('Keşfet filters by branch, lists the common branches and sorts by date or length', () => {
  const entries = [
    readCatalogRow(row({ id: 'a', subjects: ['Matematik', 'Fizik'], total_minutes: 300, created_at: '2026-09-20T10:00:00Z' })),
    readCatalogRow(row({ id: 'b', subjects: ['matematik', 'Kimya'], total_minutes: 90, created_at: '2026-09-26T10:00:00Z' })),
    readCatalogRow(row({ id: 'c', subjects: ['Biyoloji'], total_minutes: 600, created_at: '2026-09-22T10:00:00Z', author: { display_name: 'Can', stage: 'university', department: 'Moleküler Biyoloji' } })),
  ].filter((e): e is CatalogEntry => e !== null);
  assert.deepEqual(popularSubjects(entries, 3), ['Matematik', 'Biyoloji', 'Fizik']);
  assert.deepEqual(withSubject(entries, 'MATEMATİK').map(e => e.id), ['a', 'b']);
  assert.deepEqual(withSubject(entries, null).map(e => e.id), ['a', 'b', 'c']);
  assert.deepEqual(sortCatalog(entries, 'new').map(e => e.id), ['b', 'c', 'a']);
  assert.deepEqual(sortCatalog(entries, 'short').map(e => e.id), ['b', 'a', 'c']);
  assert.deepEqual(sortCatalog(entries, 'long').map(e => e.id), ['c', 'a', 'b']);
  assert.deepEqual(searchCatalog(entries, 'moleküler').map(e => e.id), ['c'], 'the author’s department is searchable');
});

test('tags are stored lowercase without "#", letters, digits and _ only, at most five', () => {
  assert.equal(normalizeTag('#YKS'), 'yks');
  assert.equal(normalizeTag('  #İngilizce '), 'ingilizce', 'Turkish lowercase rules');
  assert.equal(normalizeTag('Bilgisayar Mühendisliği'), 'bilgisayarmühendisliği');
  assert.equal(normalizeTag('c++'), null, 'too short once cleaned');
  assert.equal(normalizeTag('#'), null);
  assert.equal(normalizeTag('a'.repeat(40))?.length, 24);
  const published = publishRow({ id: 'c' }, shared, { name: 'X', description: '', tags: ['#TYT', 'tyt', 'Matematik', 'x', 'a1', 'b2', 'c3', 'd4'], cover: 'u/c.webp' });
  assert.deepEqual(published.tags, ['tyt', 'matematik', 'a1', 'b2', 'c3']);
  assert.equal(published.cover, 'u/c.webp');
  assert.deepEqual(readTags(['yks', 'YKS', 'yks', '<b>', 'ok_1', 42, 'x', 'a', 'b1', 'c1', 'd1', 'e1']), ['yks', 'ok_1', 'b1', 'c1', 'd1']);
  assert.deepEqual(suggestTags(['Matematik', 'Türk Dili']).slice(0, 3), ['matematik', 'türkdili', 'yks']);
});

test('someone else’s row keeps only a cover in the author’s own folder and a sane save count', () => {
  const author = '732204ea-e03d-4720-aeaf-5027407a2966';
  const own = readCatalogRow(row({ author_id: author, cover: `${author}/abc123.webp`, save_count: 7, tags: ['yks'] }));
  assert.equal(own?.cover, `${author}/abc123.webp`);
  assert.equal(own?.saveCount, 7);
  assert.deepEqual(own?.tags, ['yks']);
  assert.equal(readCatalogRow(row({ author_id: author, cover: '14e7de51-d578-4754-84f1-51252383657f/abc.webp' }))?.cover, null, 'another folder');
  assert.equal(readCatalogRow(row({ author_id: author, cover: `${author}/../x.webp` }))?.cover, null);
  assert.equal(readCatalogRow(row({ save_count: -3 }))?.saveCount, 0);
});

test('Keşfet searches tags, filters by tag and sorts oldest or most saved first', () => {
  const entries = [
    readCatalogRow(row({ id: 'a', name: 'Kamp A', tags: ['yks', 'tyt'], save_count: 2, created_at: '2026-09-20T10:00:00Z' })),
    readCatalogRow(row({ id: 'b', name: 'Kamp B', tags: ['yazılım'], save_count: 9, created_at: '2026-09-26T10:00:00Z' })),
    readCatalogRow(row({ id: 'c', name: 'Kamp C', tags: ['yks'], save_count: 2, created_at: '2026-09-22T10:00:00Z' })),
  ].filter((e): e is CatalogEntry => e !== null);
  assert.deepEqual(searchCatalog(entries, '#yks').map(e => e.id), ['a', 'c']);
  assert.deepEqual(searchCatalog(entries, 'yazilim').map(e => e.id), ['b'], 'accents optional');
  assert.deepEqual(withTag(entries, 'tyt').map(e => e.id), ['a']);
  assert.deepEqual(popularTags(entries), ['yks', 'tyt', 'yazılım']);
  assert.deepEqual(sortCatalog(entries, 'old').map(e => e.id), ['a', 'c', 'b']);
  assert.deepEqual(sortCatalog(entries, 'popular').map(e => e.id), ['b', 'c', 'a'], 'ties: newest first');
});
