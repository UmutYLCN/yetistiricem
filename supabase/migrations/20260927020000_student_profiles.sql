-- Applied to the Supabase project `yetistiricem` (ttemxjjxhslnjbpmmszq).

-- The student's own profile: picture and school details, asked once after the
-- first sign-in and editable in Profil. Private: only its owner reads it (the
-- public name stays in `profiles`).
create table public.student_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- One of the eight drawn shapes (`shape-1` … `shape-8`) or an uploaded
  -- picture, resized in the browser to a small square data URL.
  avatar text check (
    avatar is null
    or avatar ~ '^shape-[1-8]$'
    or (avatar ~ '^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$' and octet_length(avatar) <= 200000)
  ),
  stage text check (stage is null or stage in ('high-school', 'exam-prep', 'university', 'graduate', 'working')),
  school text check (school is null or char_length(school) between 1 and 80),
  department text check (department is null or char_length(department) between 1 and 80),
  grade text check (grade is null or grade in ('9', '10', '11', '12', 'prep', '1', '2', '3', '4', '5', '6', 'masters', 'phd')),
  profession text check (profession is null or char_length(profession) between 1 and 80),
  -- Set when the welcome questions were answered or skipped, so they are asked once.
  onboarded_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.student_profiles enable row level security;

create policy "Students read their own profile"
  on public.student_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Students create their own profile"
  on public.student_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Students edit their own profile"
  on public.student_profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.student_profiles from public, anon, authenticated;
grant select, insert, update on public.student_profiles to authenticated;
