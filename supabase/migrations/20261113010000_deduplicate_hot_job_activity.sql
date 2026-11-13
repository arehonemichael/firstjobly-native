-- Audited by Lovable 13 Nov 2026; apply only after owner approval.
-- REVIEW ONLY: do not execute from this app environment.
-- Lovable must audit and approve this DDL against the live database.
-- No refresh invocation, data backfill, cron modification or new index is included.
-- Existing apply_clicks_created_job_idx bounds the seven-day scan.
-- click_count keeps its existing name but now means distinct Apply actors,
-- NOT completed applications. An authenticated actor is user_id; otherwise it
-- is anonymous_id. The same person's earlier anonymous taps and signed-in taps
-- may count twice. We do not infer identities or join anonymous visitors to users.
CREATE OR REPLACE FUNCTION public.refresh_hot_job_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  -- Owner-configurable qualifying threshold; mobile also requires at least 10.
  minimum_unique_activity CONSTANT integer := 10;
BEGIN
  -- DELETE/INSERT run only when the existing authorised cron invokes this
  -- function. The refresh remains atomic within that caller's transaction.
  DELETE FROM public.hot_job_cache;
  INSERT INTO public.hot_job_cache (job_id, rank, click_count, refreshed_at)
  SELECT ranked.job_id, ranked.rank::integer, ranked.activity_count, now()
  FROM (
    SELECT
      c.job_id,
      row_number() OVER (
        ORDER BY count(DISTINCT coalesce(c.user_id::text, c.anonymous_id)) DESC,
                 c.job_id
      ) AS rank,
      count(DISTINCT coalesce(c.user_id::text, c.anonymous_id)) AS activity_count
    FROM public.apply_clicks AS c
    JOIN public.jobs AS j ON j.id = c.job_id
    WHERE c.created_at >= now() - interval '7 days'
      AND c.created_at <= now()
      AND j.is_active = true
      AND j.approval_status = 'approved'
      AND (
        j.closing_date IS NULL
        OR j.closing_date >= (now() AT TIME ZONE 'Africa/Johannesburg')::date
      )
    GROUP BY c.job_id
    HAVING count(DISTINCT coalesce(c.user_id::text, c.anonymous_id))
      >= minimum_unique_activity
    ORDER BY activity_count DESC, c.job_id
    LIMIT 20
  ) AS ranked;
END;
$function$;

-- CREATE OR REPLACE preserves the audited postgres owner. Restore the existing
-- service-only execution boundary explicitly; clients read the public cache.
REVOKE ALL ON FUNCTION public.refresh_hot_job_cache() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_hot_job_cache() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_hot_job_cache() TO service_role;

COMMENT ON FUNCTION public.refresh_hot_job_cache() IS
  'Top 20 active approved jobs by distinct Apply actors in seven days, minimum 10. Counts activity, not applications. Identity: coalesce(user_id::text, anonymous_id); anonymous and later signed-in activity may count twice. SAST closing dates. Existing cron unchanged.';
