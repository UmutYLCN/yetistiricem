-- Keşfet: camps students publish for everyone to see (docs/kesfet.md).
-- Applied to the Supabase project `yetistiricem` (ttemxjjxhslnjbpmmszq).

-- The public name shown on published camps (never the e-mail).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 40),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by everyone"
  on public.profiles for select to anon, authenticated using (true);
create policy "Users create their own profile"
  on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users rename themselves"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- A new account gets a profile named after its Google name or its e-mail's local part.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  picked text;
begin
  picked := left(btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  )), 40);
  if char_length(picked) < 2 then
    picked := 'Öğrenci';
  end if;
  insert into public.profiles (id, display_name) values (new.id, picked)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Published camps. `payload` is the camp share document (docs/camp-share-link.md);
-- the summary columns let the list load without it.
create table public.published_camps (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- The author's local camp id: publishing the same camp again updates this row.
  source_camp_id text not null check (char_length(source_camp_id) between 1 and 120),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  subjects text[] not null default '{}' check (cardinality(subjects) <= 40),
  branch_count integer not null check (branch_count between 1 and 40),
  video_count integer not null check (video_count between 1 and 5000),
  total_minutes numeric not null check (total_minutes > 0),
  payload jsonb not null check (octet_length(payload::text) <= 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, source_camp_id)
);

create index published_camps_created_at_idx on public.published_camps (created_at desc);

alter table public.published_camps enable row level security;

create policy "Published camps are readable by everyone"
  on public.published_camps for select to anon, authenticated using (true);
create policy "Users publish as themselves"
  on public.published_camps for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "Users update their own camps"
  on public.published_camps for update to authenticated
  using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "Users remove their own camps"
  on public.published_camps for delete to authenticated using ((select auth.uid()) = author_id);

-- At most 20 published camps per person (spam guard), and a fresh updated_at on edits.
create function public.guard_published_camp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.published_camps where author_id = new.author_id) >= 20 then
      raise exception 'publish_limit' using hint = 'At most 20 published camps per person';
    end if;
  else
    new.updated_at := now();
    new.created_at := old.created_at;
    new.author_id := old.author_id;
  end if;
  return new;
end;
$$;

create trigger published_camps_guard
  before insert or update on public.published_camps
  for each row execute function public.guard_published_camp();

-- Trigger functions run on their own; nobody needs to call them over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_published_camp() from public, anon, authenticated;
