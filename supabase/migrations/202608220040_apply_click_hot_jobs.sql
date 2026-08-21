create table if not exists public.apply_clicks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  anonymous_id text not null check (char_length(anonymous_id) between 16 and 128),
  created_at timestamptz not null default now()
);

create index if not exists apply_clicks_created_job_idx
  on public.apply_clicks (created_at desc, job_id);

alter table public.apply_clicks enable row level security;

revoke all on table public.apply_clicks from anon, authenticated;
grant insert (job_id, user_id, anonymous_id) on public.apply_clicks to anon, authenticated;

-- Anonymous clients may only insert unattributed clicks. They cannot read,
-- update or delete click rows.
drop policy if exists "Anonymous can record apply clicks" on public.apply_clicks;
create policy "Anonymous can record apply clicks"
  on public.apply_clicks
  for insert
  to anon
  with check (
    user_id is null
    and char_length(trim(anonymous_id)) between 16 and 128
  );

-- Signed-in clients may only attribute a click to their own auth user id.
drop policy if exists "Authenticated users can record own apply clicks" on public.apply_clicks;
create policy "Authenticated users can record own apply clicks"
  on public.apply_clicks
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and char_length(trim(anonymous_id)) between 16 and 128
  );

-- Keep the raw event table private. Clients only receive job ids that cross the
-- Hot threshold. Tune the window/threshold here in one place once real traffic
-- data is available.
create or replace function public.get_hot_job_ids()
returns table (job_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select ac.job_id
  from public.apply_clicks ac
  where ac.created_at >= now() - interval '7 days'
  group by ac.job_id
  having count(*) >= 12;
$$;

revoke all on function public.get_hot_job_ids() from public;
grant execute on function public.get_hot_job_ids() to anon, authenticated;
