-- Count unique app installations rather than raw repeated taps so one device
-- cannot make a job Hot by repeatedly pressing Apply.
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
  having count(distinct ac.anonymous_id) >= 12;
$$;

revoke all on function public.get_hot_job_ids() from public;
grant execute on function public.get_hot_job_ids() to anon, authenticated;
