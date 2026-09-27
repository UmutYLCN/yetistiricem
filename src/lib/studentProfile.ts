// The student's profile. The picture, stage, department / profession and bio
// are public (Supabase `profiles`, shown with their camps in Keşfet); the
// school name, class and `onboarded_at` stay private (`student_profiles`).
// See supabase/migrations/20260927040000_public_author_profile.sql. Pure: the
// limits here mirror the tables' checks.

export const AVATAR_SHAPES = ['shape-1', 'shape-2', 'shape-3', 'shape-4', 'shape-5', 'shape-6', 'shape-7', 'shape-8'] as const;
export type AvatarShape = (typeof AVATAR_SHAPES)[number];

export const STAGES = ['high-school', 'exam-prep', 'university', 'graduate', 'working'] as const;
export type Stage = (typeof STAGES)[number];

export const GRADES = ['9', '10', '11', '12', 'prep', '1', '2', '3', '4', '5', '6', 'masters', 'phd'] as const;
export type Grade = (typeof GRADES)[number];

export type ProfileField = 'school' | 'department' | 'grade' | 'profession';

export const MAX_PROFILE_TEXT = 80;
export const MAX_BIO = 280;

export interface StudentProfile {
  /** A drawn shape id or an uploaded photo's path in the `avatars` bucket (`<user id>/<name>.webp`); null shows the initial. */
  avatar: string | null;
  stage: Stage | null;
  school: string | null;
  department: string | null;
  grade: Grade | null;
  profession: string | null;
  /** A few optional lines of the student's own (goals, what they are working toward). */
  bio: string | null;
  /** When the welcome questions were answered or skipped; null asks them. */
  onboardedAt: string | null;
}

export const EMPTY_PROFILE: StudentProfile = {
  avatar: null,
  stage: null,
  school: null,
  department: null,
  grade: null,
  profession: null,
  bio: null,
  onboardedAt: null,
};

export const STAGE_OPTIONS: readonly { stage: Stage; label: string; hint: string }[] = [
  { stage: 'high-school', label: 'Lise öğrencisiyim', hint: 'Okula devam ediyorum' },
  { stage: 'exam-prep', label: 'Sınava hazırlanıyorum', hint: 'Mezunum, YKS’ye çalışıyorum' },
  { stage: 'university', label: 'Üniversite öğrencisiyim', hint: 'Lisans ya da lisansüstü' },
  { stage: 'graduate', label: 'Üniversiteden mezunum', hint: 'Bölümümü bitirdim' },
  { stage: 'working', label: 'Çalışıyorum', hint: 'Bir meslekte ilerliyorum' },
];

/** How a stage reads on the profile ("Üniversite öğrencisi"). */
const STAGE_BADGE: Record<Stage, string> = {
  'high-school': 'Lise öğrencisi',
  'exam-prep': 'Sınava hazırlanıyor',
  university: 'Üniversite öğrencisi',
  graduate: 'Üniversite mezunu',
  working: 'Çalışıyor',
};

export function stageLabel(stage: Stage): string {
  return STAGE_BADGE[stage];
}

const GRADE_LABEL: Record<Grade, string> = {
  '9': '9. sınıf',
  '10': '10. sınıf',
  '11': '11. sınıf',
  '12': '12. sınıf',
  prep: 'Hazırlık',
  '1': '1. sınıf',
  '2': '2. sınıf',
  '3': '3. sınıf',
  '4': '4. sınıf',
  '5': '5. sınıf',
  '6': '6. sınıf',
  masters: 'Yüksek lisans',
  phd: 'Doktora',
};

export function gradeLabel(grade: Grade): string {
  return GRADE_LABEL[grade];
}

/** The classes a stage can pick from (none: the stage asks no class). */
export function gradesFor(stage: Stage | null): readonly Grade[] {
  if (stage === 'high-school') return ['9', '10', '11', '12'];
  if (stage === 'university') return ['prep', '1', '2', '3', '4', '5', '6', 'masters', 'phd'];
  return [];
}

export interface FieldSpec {
  field: ProfileField;
  label: string;
  placeholder: string;
}

/** The questions a stage asks, in order, with the labels that fit it. */
export function fieldsFor(stage: Stage | null): readonly FieldSpec[] {
  switch (stage) {
    case 'high-school':
      return [
        { field: 'grade', label: 'Kaçıncı sınıftasın?', placeholder: '' },
        { field: 'school', label: 'Okulun', placeholder: 'Örn. Kadıköy Anadolu Lisesi' },
        { field: 'department', label: 'Hedeflediğin bölüm', placeholder: 'Örn. Tıp' },
      ];
    case 'exam-prep':
      return [
        { field: 'department', label: 'Hedeflediğin bölüm', placeholder: 'Örn. Bilgisayar Mühendisliği' },
        { field: 'school', label: 'Hedeflediğin üniversite', placeholder: 'Örn. ODTÜ' },
      ];
    case 'university':
      return [
        { field: 'school', label: 'Üniversiten', placeholder: 'Örn. İstanbul Teknik Üniversitesi' },
        { field: 'department', label: 'Bölümün', placeholder: 'Örn. Elektrik Mühendisliği' },
        { field: 'grade', label: 'Kaçıncı sınıftasın?', placeholder: '' },
      ];
    case 'graduate':
      return [
        { field: 'school', label: 'Mezun olduğun üniversite', placeholder: 'Örn. Boğaziçi Üniversitesi' },
        { field: 'department', label: 'Bölümün', placeholder: 'Örn. İşletme' },
        { field: 'profession', label: 'Mesleğin', placeholder: 'Örn. Veri analisti' },
      ];
    case 'working':
      return [
        { field: 'profession', label: 'Mesleğin', placeholder: 'Örn. Yazılım geliştirici' },
        { field: 'school', label: 'Mezun olduğun okul', placeholder: 'İsteğe bağlı' },
        { field: 'department', label: 'Bölümün', placeholder: 'İsteğe bağlı' },
      ];
    default:
      return [];
  }
}

export function isAvatarShape(value: unknown): value is AvatarShape {
  return typeof value === 'string' && (AVATAR_SHAPES as readonly string[]).includes(value);
}

const PHOTO_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9_-]{1,64}\.(webp|jpg|png)$/;

/** An uploaded photo's path in the `avatars` bucket (the owner's folder, then the file). */
export function isAvatarPhoto(value: unknown): value is string {
  return typeof value === 'string' && PHOTO_PATH.test(value);
}

export function isAvatarValue(value: unknown): value is string {
  return isAvatarShape(value) || isAvatarPhoto(value);
}

const isStage = (value: unknown): value is Stage => typeof value === 'string' && (STAGES as readonly string[]).includes(value);
const isGrade = (value: unknown): value is Grade => typeof value === 'string' && (GRADES as readonly string[]).includes(value);

/** A trimmed, length-limited answer, or null for an empty one. */
export function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim().slice(0, MAX_PROFILE_TEXT).trim();
  return text || null;
}

/** A trimmed bio of at most `MAX_BIO` characters (line breaks kept, at most one empty line in a row), or null. */
export function cleanBio(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_BIO)
    .trim();
  return text || null;
}

/** A profile from a stored row; anything unexpected reads as unanswered. */
export function readProfileRow(row: unknown): StudentProfile {
  if (typeof row !== 'object' || row === null) return { ...EMPTY_PROFILE };
  const r = row as Record<string, unknown>;
  return {
    avatar: isAvatarValue(r.avatar) ? r.avatar : null,
    stage: isStage(r.stage) ? r.stage : null,
    school: cleanText(r.school),
    department: cleanText(r.department),
    grade: isGrade(r.grade) ? r.grade : null,
    profession: cleanText(r.profession),
    bio: cleanBio(r.bio),
    onboardedAt: typeof r.onboarded_at === 'string' ? r.onboarded_at : null,
  };
}

/**
 * What is saved: the answers the chosen stage asks (others are dropped, so a
 * student who switches from lise to üniversite keeps no stray lise class).
 */
export function normalizeProfile(profile: StudentProfile): StudentProfile {
  const asked = new Set(fieldsFor(profile.stage).map(spec => spec.field));
  const grade = asked.has('grade') && profile.grade && gradesFor(profile.stage).includes(profile.grade) ? profile.grade : null;
  return {
    avatar: isAvatarValue(profile.avatar) ? profile.avatar : null,
    stage: profile.stage,
    school: asked.has('school') ? cleanText(profile.school) : null,
    department: asked.has('department') ? cleanText(profile.department) : null,
    grade,
    profession: asked.has('profession') ? cleanText(profile.profession) : null,
    bio: cleanBio(profile.bio),
    onboardedAt: profile.onboardedAt,
  };
}

/** The public part, written to `profiles` (shown with the student's camps in Keşfet). */
export function publicProfileRow(profile: StudentProfile) {
  const clean = normalizeProfile(profile);
  return { avatar: clean.avatar, stage: clean.stage, department: clean.department, profession: clean.profession, bio: clean.bio };
}

/** The private part, written to `student_profiles` (only its owner reads it). */
export function privateProfileRow(profile: StudentProfile) {
  const clean = normalizeProfile(profile);
  return { school: clean.school, grade: clean.grade, onboarded_at: clean.onboardedAt };
}

/** What Keşfet shows of a camp's author (from their public `profiles` row). */
export interface PublicAuthor {
  name: string;
  avatar: string | null;
  stage: Stage | null;
  department: string | null;
  profession: string | null;
  bio: string | null;
}

/** An author from someone else's `profiles` row; anything unexpected is left out. */
export function readPublicAuthor(raw: unknown, fallbackName = 'Bir öğrenci'): PublicAuthor {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const name = typeof r.display_name === 'string' ? r.display_name.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  const stage = isStage(r.stage) ? r.stage : null;
  const asked = new Set(fieldsFor(stage).map(spec => spec.field));
  return {
    name: name || fallbackName,
    avatar: isAvatarValue(r.avatar) ? r.avatar : null,
    stage,
    department: asked.has('department') ? cleanText(r.department) : null,
    profession: asked.has('profession') ? cleanText(r.profession) : null,
    bio: cleanBio(r.bio),
  };
}

/** One public line about an author: "Üniversite öğrencisi · Bilgisayar Mühendisliği", or null. */
export function authorHeadline(author: Pick<PublicAuthor, 'stage' | 'department' | 'profession'>): string | null {
  if (!author.stage) return null;
  const parts: string[] = [stageLabel(author.stage)];
  switch (author.stage) {
    case 'high-school':
    case 'exam-prep':
      if (author.department) parts.push(`Hedef: ${author.department}`);
      break;
    case 'university':
      if (author.department) parts.push(author.department);
      break;
    case 'graduate':
      if (author.profession) parts.push(author.profession);
      else if (author.department) parts.push(`${author.department} mezunu`);
      break;
    case 'working':
      if (author.profession) parts.push(author.profession);
      break;
  }
  return parts.join(' · ');
}

export interface ProfileFact {
  kind: 'school' | 'department' | 'grade' | 'profession' | 'target';
  text: string;
}

/** The profile's details as short facts, in the order the stage reads best. */
export function profileFacts(profile: StudentProfile): ProfileFact[] {
  const p = normalizeProfile(profile);
  const facts: ProfileFact[] = [];
  const push = (kind: ProfileFact['kind'], text: string | null) => {
    if (text) facts.push({ kind, text });
  };
  switch (p.stage) {
    case 'high-school':
      push('grade', p.grade && gradeLabel(p.grade));
      push('school', p.school);
      push('target', p.department && `Hedef: ${p.department}`);
      break;
    case 'exam-prep':
      push('target', p.department && `Hedef: ${p.department}`);
      push('school', p.school && `Hedef: ${p.school}`);
      break;
    case 'university':
      push('school', p.school);
      push('department', p.department);
      push('grade', p.grade && gradeLabel(p.grade));
      break;
    case 'graduate':
      push('profession', p.profession);
      push('school', p.school);
      push('department', p.department && `${p.department} mezunu`);
      break;
    case 'working':
      push('profession', p.profession);
      push('school', p.school);
      push('department', p.department);
      break;
  }
  return facts;
}

/** One line for small places (the sidebar): "ODTÜ · Bilgisayar Mühendisliği". */
export function profileSummary(profile: StudentProfile): string | null {
  const facts = profileFacts(profile);
  if (facts.length > 0) return facts.slice(0, 2).map(f => f.text).join(' · ');
  return profile.stage ? stageLabel(profile.stage) : null;
}
