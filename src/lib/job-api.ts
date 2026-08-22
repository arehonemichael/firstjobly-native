import { getHotJobIds } from './apply-clicks';
import { JOB_LIST_COLUMNS, type Job } from './jobs';
import { openClosingDateFilter } from './job-availability';
import { supabase } from './supabase';

export const JOB_PAGE_SIZE = 20;

function withComputedHotStatus(rows: Job[], hotJobIds: Set<string>): Job[] {
  return rows.map((job) => ({ ...job, is_urgent: hotJobIds.has(job.id) }));
}

export async function getJobs(page = 0): Promise<Job[]> {
  const from = page * JOB_PAGE_SIZE;
  const to = from + JOB_PAGE_SIZE - 1;

  const [jobsRes, hotJobIds] = await Promise.all([
    supabase
      .from('jobs')
      .select(JOB_LIST_COLUMNS)
      .eq('approval_status', 'approved')
      .eq('is_active', true)
      .or(openClosingDateFilter())
      .order('posted_at', { ascending: false })
      .range(from, to),
    getHotJobIds(),
  ]);

  if (jobsRes.error) throw jobsRes.error;
  return withComputedHotStatus((jobsRes.data ?? []) as unknown as Job[], hotJobIds);
}

export async function getFeaturedJobs(limit = 8): Promise<Job[]> {
  const [jobsRes, hotJobIds] = await Promise.all([
    supabase
      .from('jobs')
      .select(JOB_LIST_COLUMNS)
      .eq('approval_status', 'approved')
      .eq('is_active', true)
      .or(openClosingDateFilter())
      .eq('is_featured', true)
      .order('posted_at', { ascending: false })
      .limit(limit),
    getHotJobIds(),
  ]);

  if (jobsRes.error) throw jobsRes.error;
  return withComputedHotStatus((jobsRes.data ?? []) as unknown as Job[], hotJobIds);
}

export async function getJob(id: string): Promise<Job | null> {
  const [jobRes, hotJobIds] = await Promise.all([
    supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .eq('approval_status', 'approved')
      .eq('is_active', true)
      .or(openClosingDateFilter())
      .maybeSingle(),
    getHotJobIds(),
  ]);

  if (jobRes.error) throw jobRes.error;
  if (!jobRes.data) return null;

  const [job] = withComputedHotStatus([jobRes.data as Job], hotJobIds);
  return job ?? null;
}

export async function getSearchJobs(limit = 300): Promise<Job[]> {
  const [jobsRes, hotJobIds] = await Promise.all([
    supabase
      .from("jobs")
      .select(JOB_LIST_COLUMNS)
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .or(openClosingDateFilter())
      .order("posted_at", { ascending: false })
      .limit(limit),
    getHotJobIds(),
  ]);

  if (jobsRes.error) throw jobsRes.error;
  return withComputedHotStatus((jobsRes.data ?? []) as unknown as Job[], hotJobIds);
}
