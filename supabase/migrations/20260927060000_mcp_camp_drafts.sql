-- An AI client may prepare a camp, but only the student can add it from the
-- planner after reviewing every item. Drafts are private and expire in a week.
create table public.mcp_camp_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  origin text not null default 'ai' check (origin in ('ai', 'kesfet')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 5000000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  check (expires_at > created_at and expires_at <= created_at + interval '7 days')
);

create index mcp_camp_drafts_expires_at_idx on public.mcp_camp_drafts (expires_at);
create index mcp_camp_drafts_user_id_idx on public.mcp_camp_drafts (user_id);

alter table public.mcp_camp_drafts enable row level security;

create policy "Students read their own active MCP camp drafts"
  on public.mcp_camp_drafts for select to authenticated
  using ((select auth.uid()) = user_id and expires_at > now());

create policy "Approved OAuth clients prepare camps for their student"
  on public.mcp_camp_drafts for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and nullif((select auth.jwt() ->> 'client_id'), '') is not null
    and expires_at > now()
  );

create policy "Students discard their own MCP camp drafts"
  on public.mcp_camp_drafts for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.mcp_camp_drafts from public, anon, authenticated;
grant select, insert, delete on public.mcp_camp_drafts to authenticated;

-- Each new proposal clears expired drafts without exposing another student's
-- data or requiring a separate scheduled service.
create function public.prune_expired_mcp_camp_drafts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.mcp_camp_drafts where expires_at <= now();
  return null;
end;
$$;

revoke all on function public.prune_expired_mcp_camp_drafts() from public, anon, authenticated;
create trigger prune_mcp_camp_drafts_before_insert
  before insert on public.mcp_camp_drafts
  for each statement execute function public.prune_expired_mcp_camp_drafts();
