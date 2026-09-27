import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StudentProfile } from '../src/lib/studentProfile.ts';
import {
  EMPTY_PROFILE,
  MAX_BIO,
  authorHeadline,
  cleanBio,
  fieldsFor,
  isAvatarValue,
  normalizeProfile,
  privateProfileRow,
  profileFacts,
  profileSummary,
  publicProfileRow,
  readProfileRow,
  readPublicAuthor,
} from '../src/lib/studentProfile.ts';

const profile = (overrides: Partial<StudentProfile>): StudentProfile => ({ ...EMPTY_PROFILE, ...overrides });

test('a stored row reads back, and anything unexpected reads as unanswered', () => {
  assert.deepEqual(
    readProfileRow({ avatar: 'shape-3', stage: 'university', school: '  ODTÜ ', department: 'Fizik', grade: '3', profession: null, onboarded_at: '2026-09-27T10:00:00Z' }),
    profile({ avatar: 'shape-3', stage: 'university', school: 'ODTÜ', department: 'Fizik', grade: '3', onboardedAt: '2026-09-27T10:00:00Z' })
  );
  assert.deepEqual(readProfileRow({ avatar: 'shape-9', stage: 'robot', grade: '13', school: 42 }), EMPTY_PROFILE);
  assert.deepEqual(readProfileRow(null), EMPTY_PROFILE);
});

test('avatars are one of the eight shapes or a photo path in the owner’s folder of the avatars bucket', () => {
  const owner = '732204ea-e03d-4720-aeaf-5027407a2966';
  assert.equal(isAvatarValue('shape-1'), true);
  assert.equal(isAvatarValue('shape-8'), true);
  assert.equal(isAvatarValue('shape-0'), false);
  assert.equal(isAvatarValue(`${owner}/0f3a9c.webp`), true);
  assert.equal(isAvatarValue(`${owner}/0f3a9c.jpg`), true);
  assert.equal(isAvatarValue(`${owner}/../x.webp`), false);
  assert.equal(isAvatarValue(`${owner}/x.svg`), false);
  assert.equal(isAvatarValue('https://example.com/a.png'), false);
  assert.equal(isAvatarValue('data:image/webp;base64,AAAA'), false);
});

test('each stage asks its own questions', () => {
  assert.deepEqual(fieldsFor('high-school').map(f => f.field), ['grade', 'school', 'department']);
  assert.deepEqual(fieldsFor('university').map(f => f.field), ['school', 'department', 'grade']);
  assert.deepEqual(fieldsFor('working').map(f => f.field), ['profession', 'school', 'department']);
  assert.deepEqual(fieldsFor(null), []);
});

test('saving keeps only the answers the chosen stage asks', () => {
  const switched = profile({ stage: 'graduate', school: ' Boğaziçi ', department: '', grade: '11', profession: '  Veri   analisti ' });
  assert.deepEqual(normalizeProfile(switched), profile({ stage: 'graduate', school: 'Boğaziçi', profession: 'Veri analisti' }));
  // A high-school class is not a university class.
  assert.equal(normalizeProfile(profile({ stage: 'university', grade: '11' })).grade, null);
  const prep = profile({ avatar: 'shape-2', stage: 'exam-prep', school: 'ODTÜ', department: 'Tıp', bio: 'Hedef', onboardedAt: 'x' });
  // The school and class stay private; the rest is shown with the student's camps in Keşfet.
  assert.deepEqual(publicProfileRow(prep), { avatar: 'shape-2', stage: 'exam-prep', department: 'Tıp', profession: null, bio: 'Hedef' });
  assert.deepEqual(privateProfileRow(prep), { school: 'ODTÜ', grade: null, onboarded_at: 'x' });
});

test('the profile reads as short facts and a one-line summary', () => {
  const student = profile({ stage: 'university', school: 'ODTÜ', department: 'Bilgisayar Mühendisliği', grade: '3' });
  assert.deepEqual(profileFacts(student).map(f => f.text), ['ODTÜ', 'Bilgisayar Mühendisliği', '3. sınıf']);
  assert.equal(profileSummary(student), 'ODTÜ · Bilgisayar Mühendisliği');
  assert.deepEqual(profileFacts(profile({ stage: 'high-school', grade: '12', department: 'Tıp' })).map(f => f.text), ['12. sınıf', 'Tıp']);
  assert.deepEqual(profileFacts(profile({ stage: 'exam-prep', department: 'Doktorluk', school: 'Medipol' })).map(f => f.text), ['Doktorluk', 'Medipol']);
  assert.equal(profileSummary(profile({ stage: 'working' })), 'Çalışıyor');
  assert.equal(profileSummary(EMPTY_PROFILE), null);
});

test('the bio is optional, trimmed, keeps its line breaks and stays within the limit', () => {
  assert.equal(cleanBio('   '), null);
  assert.equal(cleanBio(null), null);
  assert.equal(cleanBio('  2027’de   tıp.\r\n\n\n\nHer gün 3 saat.  '), '2027’de tıp.\n\nHer gün 3 saat.');
  assert.equal(cleanBio('a'.repeat(400))?.length, MAX_BIO);
  // A bio stays whatever the stage asks.
  assert.equal(normalizeProfile(profile({ stage: null, bio: ' Hedef: YKS ' })).bio, 'Hedef: YKS');
  assert.equal(readProfileRow({ bio: 'Merhaba' }).bio, 'Merhaba');
});

test('an author’s public profile is read defensively and summed up in one line', () => {
  const author = readPublicAuthor({ display_name: '  Sude   Y. ', avatar: 'shape-5', stage: 'exam-prep', department: 'Tıp', profession: 'Pilot', bio: '  Merhaba ' });
  assert.deepEqual(author, { name: 'Sude Y.', avatar: 'shape-5', stage: 'exam-prep', department: 'Tıp', profession: null, bio: 'Merhaba' });
  assert.equal(authorHeadline(author), 'Sınava hazırlanıyor · Tıp');
  assert.deepEqual(readPublicAuthor({ display_name: 42, avatar: 'javascript:alert(1)', stage: 'robot' }), {
    name: 'Bir öğrenci',
    avatar: null,
    stage: null,
    department: null,
    profession: null,
    bio: null,
  });
  assert.equal(authorHeadline({ stage: 'university', department: 'Fizik', profession: null }), 'Üniversite öğrencisi · Fizik');
  assert.equal(authorHeadline({ stage: 'graduate', department: 'İşletme', profession: null }), 'Üniversite mezunu · İşletme mezunu');
  assert.equal(authorHeadline({ stage: 'working', department: null, profession: 'Yazılım geliştirici' }), 'Çalışıyor · Yazılım geliştirici');
  assert.equal(authorHeadline({ stage: null, department: 'Fizik', profession: null }), null);
});
