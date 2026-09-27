-- Applied to the Supabase project `yetistiricem` (ttemxjjxhslnjbpmmszq).

-- Keşfet: a cover photo and interest tags per published camp, and students
-- saving camps for later (a heart with a public count).

alter table public.published_camps
  -- Up to five lowercase tags without "#", e.g. {yks, tyt, matematik}.
  add column tags text[] not null default '{}' check (
    cardinality(tags) <= 5
    and array_position(tags, null) is null
    and (cardinality(tags) = 0 or array_to_string(tags, ' ') ~ '^[a-z0-9çğıöşüâîû_]{2,24}( [a-z0-9çğıöşüâîû_]{2,24}){0,4}$')
  ),
  -- A photo in the `camp-covers` bucket under the author's own folder; null draws the default cover.
  add column cover text,
  -- How many students saved the camp; kept by the trigger on `saved_camps`.
  add column save_count integer not null default 0 check (save_count >= 0);

alter table public.published_camps
  add constraint published_camps_cover_check check (
    cover is null or cover ~ ('^' || author_id::text || '/[A-Za-z0-9_-]{1,64}\.(webp|jpg)$')
  );

-- The author edits their camp, never its save count; the count trigger
-- (one level down) changes only the count and leaves updated_at alone.
create or replace function public.guard_published_camp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.published_camps where author_id = new.author_id) >= 20 then
      raise exception 'publish_limit' using hint = 'At most 20 published camps per person';
    end if;
    new.save_count := 0;
  elsif pg_trigger_depth() > 1 then
    return new;
  else
    new.updated_at := now();
    new.created_at := old.created_at;
    new.author_id := old.author_id;
    new.save_count := old.save_count;
  end if;
  new.content_key := public.published_camp_content_key(new.payload);
  if exists (
    select 1 from public.published_camps
    where content_key = new.content_key and author_id <> new.author_id
  ) then
    raise exception 'duplicate_camp' using hint = 'Another person already published these videos';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_published_camp() from public, anon, authenticated;

-- Camps a student saved for later. Private: only the student sees their list.
create table public.saved_camps (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  camp_id uuid not null references public.published_camps (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, camp_id)
);

create index saved_camps_camp_id_idx on public.saved_camps (camp_id);

alter table public.saved_camps enable row level security;

create policy "Students see what they saved"
  on public.saved_camps for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Students save for themselves"
  on public.saved_camps for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Students unsave their own"
  on public.saved_camps for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.saved_camps from public, anon, authenticated;
grant select, insert, delete on public.saved_camps to authenticated;

create function public.count_camp_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.published_camps set save_count = save_count + 1 where id = new.camp_id;
  else
    update public.published_camps set save_count = greatest(save_count - 1, 0) where id = old.camp_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.count_camp_save() from public, anon, authenticated;

create trigger saved_camps_count
  after insert or delete on public.saved_camps
  for each row execute function public.count_camp_save();

-- Cover photos: public to read, each student writes only their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('camp-covers', 'camp-covers', true, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "Students list their own camp covers"
  on storage.objects for select to authenticated
  using (bucket_id = 'camp-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Students upload their own camp covers"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'camp-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Students remove their own camp covers"
  on storage.objects for delete to authenticated
  using (bucket_id = 'camp-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
