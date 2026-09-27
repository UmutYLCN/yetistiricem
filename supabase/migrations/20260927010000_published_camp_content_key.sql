-- A camp's content belongs to whoever published it first: a second person
-- cannot publish the same videos (e.g. a camp they added from Keşfet) as their
-- own. The app refuses imported camps too; this also covers camps imported
-- before it marked them, and any client that skips the check.

-- The camp's videos as an order-free fingerprint: YouTube ids, or the title of
-- a link-free typed topic. Renaming, re-describing or reordering keeps it.
create function public.published_camp_content_key(p_payload jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select md5(coalesce(string_agg(k, E'\n' order by k), ''))
  from (
    select coalesce(nullif(v ->> 'youtubeId', ''), 't:' || lower(btrim(coalesce(v ->> 'title', '')))) as k
    from jsonb_array_elements(coalesce(p_payload #> '{camp,branches}', '[]'::jsonb)) as b,
         jsonb_array_elements(coalesce(b -> 'videos', '[]'::jsonb)) as v
  ) as keys;
$$;

alter table public.published_camps add column content_key text;

-- Existing rows get their key without touching updated_at.
alter table public.published_camps disable trigger published_camps_guard;
update public.published_camps set content_key = public.published_camp_content_key(payload);
alter table public.published_camps enable trigger published_camps_guard;

alter table public.published_camps alter column content_key set not null;
create index published_camps_content_key_idx on public.published_camps (content_key);

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
  else
    new.updated_at := now();
    new.created_at := old.created_at;
    new.author_id := old.author_id;
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
-- The key function stays callable: the guard runs as the publishing student.
