import { getHotJobIds } from './apply-clicks';
import { JOB_LIST_COLUMNS, type Job } from './jobs';
import { openClosingDateFilter } from './job-availability';
import { supabase } from './supabase';

export const JOB_PAGE_SIZE = 20;

async function withComputedHotStatus(rows: Job[]): Promise<Job[]> {
  const hotJobIds = await getHotJobIds();
  return rows.map((job) => ({ ...job, is_urgent: hotJobIds.has(job.id) }));
}

export async function getJobs(page = 0): Promise<Job[]> {
  const from = page * JOB_PAGE_SIZE;
  const to = from + JOB_PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_LIST_COLUMNS)
    .eq('approval_status', 'approved')
    .eq('is_active', true)
    .or(openClosingDateFilter())
    .order('posted_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return withComputedHotStatus((data ?? []) as unknown as Job[]);
}

export async function getFeaturedJobs(limit = 8): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_LIST_COLUMNS)
    .eq('approval_status', 'approved')
    .eq('is_active', true)
    .or(openClosingDateFilter())
    .eq('is_featured', true)
    .order('posted_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return withComputedHotStatus((data ?? []) as unknown as Job[]);
}

export async function getJob(id: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('approval_status', 'approved')
    .eq('is_active', true)
    .or(openClosingDateFilter())
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [job] = await withComputedHotStatus([data as Job]);
  return job ?? null;
}

export async function getSearchJobs(limit = 300): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_LIST_COLUMNS)
    .eq("approval_status", "approved")
    .eq("is_active", true)
    .or(openClosingDateFilter())
    .order("posted_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return withComputedHotStatus((data ?? []) as unknown as Job[]);
}
