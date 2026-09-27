-- Applied to the Supabase project `yetistiricem` (ttemxjjxhslnjbpmmszq).

-- Keşfet shows who made a camp: the picture, stage, department / profession
-- and bio move to the public `profiles` row. The school name, the class and
-- `onboarded_at` stay in the private `student_profiles`.
alter table public.profiles
  add column avatar text,
  add column stage text check (stage is null or stage in ('high-school', 'exam-prep', 'university', 'graduate', 'working')),
  add column department text check (department is null or char_length(department) between 1 and 80),
  add column profession text check (profession is null or char_length(profession) between 1 and 80),
  add column bio text check (bio is null or char_length(bio) between 1 and 280);

-- A drawn shape, or a photo in the `avatars` bucket under the owner's own folder.
alter table public.profiles
  add constraint profiles_avatar_check check (
    avatar is null
    or avatar ~ '^shape-[1-8]$'
    or avatar ~ ('^' || id::text || '/[A-Za-z0-9_-]{1,64}\.(webp|jpg|png)$')
  );

update public.profiles p
set avatar = case when s.avatar ~ '^shape-[1-8]$' then s.avatar end,
    stage = s.stage,
    department = s.department,
    profession = s.profession,
    bio = s.bio
from public.student_profiles s
where s.user_id = p.id;

alter table public.student_profiles
  drop column avatar,
  drop column stage,
  drop column department,
  drop column profession,
  drop column bio;

-- Uploaded profile photos: public to read, each student writes only their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 262144, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "Students list their own avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Students upload their own avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Students remove their own avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
