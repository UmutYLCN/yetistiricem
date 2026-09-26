-- Private planner data, one revisioned document per signed-in student.
create table public.planner_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 5000000),
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.planner_states enable row level security;

create policy "Students read their own planner state"
  on public.planner_states for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.planner_states from public, anon, authenticated;
grant select on public.planner_states to authenticated;

-- Compare-and-save prevents a device from overwriting a newer copy from another device.
create function public.save_planner_state(p_data jsonb, p_base_revision integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_revision integer;
begin
  if current_user_id is null then
    raise exception 'authentication_required';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 5000000 then
    raise exception 'invalid_planner_state';
  end if;
  if p_base_revision is null or p_base_revision < 0 then
    raise exception 'invalid_base_revision';
  end if;
  if p_base_revision > 0 and not exists (
    select 1 from public.planner_states where user_id = current_user_id
  ) then
    raise exception 'revision_conflict';
  end if;

  insert into public.planner_states (user_id, data, revision)
  values (current_user_id, p_data, 1)
  on conflict (user_id) do update
    set data = excluded.data,
        revision = public.planner_states.revision + 1,
        updated_at = now()
    where public.planner_states.revision = p_base_revision
  returning revision into saved_revision;

  if saved_revision is null then
    raise exception 'revision_conflict';
  end if;

  return saved_revision;
end;
$$;

revoke execute on function public.save_planner_state(jsonb, integer) from public, anon;
grant execute on function public.save_planner_state(jsonb, integer) to authenticated;
