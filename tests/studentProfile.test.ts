import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StudentProfile } from '../src/lib/studentProfile.ts';
import { EMPTY_PROFILE, MAX_BIO, cleanBio, fieldsFor, isAvatarValue, normalizeProfile, profileFacts, profileRow, profileSummary, readProfileRow } from '../src/lib/studentProfile.ts';

const profile = (overrides: Partial<StudentProfile>): StudentProfile => ({ ...EMPTY_PROFILE, ...overrides });

test('a stored row reads back, and anything unexpected reads as unanswered', () => {
  assert.deepEqual(
    readProfileRow({ avatar: 'shape-3', stage: 'university', school: '  ODTÜ ', department: 'Fizik', grade: '3', profession: null, onboarded_at: '2026-09-27T10:00:00Z' }),
    profile({ avatar: 'shape-3', stage: 'university', school: 'ODTÜ', department: 'Fizik', grade: '3', onboardedAt: '2026-09-27T10:00:00Z' })
  );
  assert.deepEqual(readProfileRow({ avatar: 'shape-9', stage: 'robot', grade: '13', school: 42 }), EMPTY_PROFILE);
  assert.deepEqual(readProfileRow(null), EMPTY_PROFILE);
});

test('avatars are one of the eight shapes or a small image data URL', () => {
  assert.equal(isAvatarValue('shape-1'), true);
  assert.equal(isAvatarValue('shape-8'), true);
  assert.equal(isAvatarValue('shape-0'), false);
  assert.equal(isAvatarValue('data:image/webp;base64,AAAA'), true);
  assert.equal(isAvatarValue('data:image/svg+xml;base64,AAAA'), false);
  assert.equal(isAvatarValue('https://example.com/a.png'), false);
  assert.equal(isAvatarValue(`data:image/jpeg;base64,${'A'.repeat(200_000)}`), false);
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
  assert.deepEqual(profileRow(profile({ stage: 'exam-prep', department: 'Tıp', onboardedAt: 'x' })), {
    avatar: null,
    stage: 'exam-prep',
    school: null,
    department: 'Tıp',
    grade: null,
    profession: null,
    bio: null,
    onboarded_at: 'x',
  });
});

test('the profile reads as short facts and a one-line summary', () => {
  const student = profile({ stage: 'university', school: 'ODTÜ', department: 'Bilgisayar Mühendisliği', grade: '3' });
  assert.deepEqual(profileFacts(student).map(f => f.text), ['ODTÜ', 'Bilgisayar Mühendisliği', '3. sınıf']);
  assert.equal(profileSummary(student), 'ODTÜ · Bilgisayar Mühendisliği');
  assert.deepEqual(profileFacts(profile({ stage: 'high-school', grade: '12', department: 'Tıp' })).map(f => f.text), ['12. sınıf', 'Hedef: Tıp']);
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
