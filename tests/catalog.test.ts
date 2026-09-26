import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SharedCamp } from '../src/lib/campShare.ts';
import { shareDocument } from '../src/lib/campShare.ts';
import type { CatalogEntry } from '../src/lib/catalog.ts';
import { displayNameProblem, publishRow, publishedLabel, readCatalogCamp, readCatalogRow, searchCatalog } from '../src/lib/catalog.ts';

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
    sourceCampId: 'camp-1',
    name: 'TYT 2027',
    description: 'Her gün 3 saat.',
    subjects: ['Matematik', 'Fizik'],
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
