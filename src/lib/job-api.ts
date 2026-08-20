import { JOB_LIST_COLUMNS, type Job } from '@/lib/jobs';
import { requireSupabase } from '@/lib/supabase';

export const JOB_PAGE_SIZE = 20;

export async function getJobs(page = 0): Promise<Job[]> {
  const from = page * JOB_PAGE_SIZE;
  const { data, error } = await requireSupabase()
    .from('jobs').select(JOB_LIST_COLUMNS).eq('approval_status', 'approved')
    .eq('is_active', true).order('posted_at', { ascending: false })
    .range(from, from + JOB_PAGE_SIZE - 1);
  if (error) throw error;
  return (data ?? []) as unknown as Job[];
}

export async function getFeaturedJobs(limit = 8): Promise<Job[]> {
  const { data, error } = await requireSupabase()
    .from('jobs').select(JOB_LIST_COLUMNS).eq('approval_status', 'approved')
    .eq('is_active', true).eq('is_featured', true)
    .order('posted_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as Job[];
}

export async function getJob(id: string): Promise<Job | null> {
  const { data, error } = await requireSupabase()
    .from('jobs').select('*').eq('id', id).eq('approval_status', 'approved').eq('is_active', true).maybeSingle();
  if (error) throw error;
  return data as Job | null;
}

export async function getSearchJobs(limit = 300): Promise<Job[]> {
  const { data, error } = await requireSupabase()
    .from('jobs').select(JOB_LIST_COLUMNS).eq('approval_status', 'approved')
    .eq('is_active', true).order('posted_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as Job[];
}