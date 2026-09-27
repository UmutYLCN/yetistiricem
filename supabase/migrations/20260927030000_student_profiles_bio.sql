-- Applied to the Supabase project `yetistiricem` (ttemxjjxhslnjbpmmszq).

-- An optional short bio on the student's profile (goals, what they are working toward).
alter table public.student_profiles
  add column bio text check (bio is null or char_length(bio) between 1 and 280);
