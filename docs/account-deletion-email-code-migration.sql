-- HISTORICAL REVIEW COPY. Owner reports database migration is already live.
-- DO NOT RUN this file again. Mobile code does not apply SQL.
-- =====================================================================
-- PROPOSAL ONLY - NOT APPLIED. Version 2, 14 Nov 2026, for owner review.
-- v2 changes: deadlines use the real clock after waiting for a lock
-- (clock_timestamp), issue retries if the row vanishes mid-way and never
-- reports success unless the code is stored.
-- Purpose: let a signed-in member confirm "delete my account" with a
-- 6-digit code emailed to their OWN account email.
--
-- What this adds (nothing existing is changed):
--   1. A deletion-only table: account_deletion_challenges
--   2. issue_account_deletion_challenge(...)  - stores a new code safely
--   3. claim_account_deletion_challenge(...)  - checks and uses up a code
--   4. void_account_deletion_challenge(...)   - cancels a code whose email
--                                               definitely failed to send
--
-- Untouched: register_code_attempt, graduateroom_email_codes,
-- employer_verification_codes, account_deletion_requests, all sign-in
-- settings and email hooks.
--
-- Rules built into the functions (fixed in the database on purpose so app
-- code cannot loosen them):
--   - A code lasts 10 minutes and can be used once.
--   - One code per account at a time; a new code replaces the old one, and
--     the old one stops working immediately.
--   - 60 seconds between sends; at most 5 sends per account per hour.
--     A double tap therefore sends one email, not two.
--   - 5 wrong guesses on one code locks deletion codes for 15 minutes.
--   - At most 10 guesses per account per hour across ALL codes, so asking
--     for a new code never resets the guessing budget.
--   - While locked, no new code can be sent (a resend cannot lift a lock).
--   - A code only works for the same account, the same account email and
--     the same sign-in session it was sent to, and only for deletion.
--   - Checking and using up the code happens in one locked step, so two
--     requests at the same moment cannot both succeed.
--
-- Access: only the server (service role) can read the table or call the
-- functions. Members, visitors and the website's browser code cannot.
-- Only a keyed hash of the code is stored, never the code itself.
-- =====================================================================

CREATE TABLE public.account_deletion_challenges (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The account the code belongs to. Plain id, no link to the sign-in table
  -- (project rule); the row is removed by the account-deletion steps.
  user_id                  uuid NOT NULL UNIQUE,
  -- The account email the code was sent to, lower-cased.
  email                    text NOT NULL
                           CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254),
  purpose                  text NOT NULL DEFAULT 'account_deletion'
                           CHECK (purpose = 'account_deletion'),
  -- Sign-in session that asked for the code (session_id claim of the token).
  session_id               uuid NOT NULL,
  -- HMAC-SHA256 hex of the code, made on the server with a server-only key.
  code_hash                text NOT NULL CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  expires_at               timestamptz NOT NULL,
  attempts                 integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  locked_until             timestamptz,
  consumed_at              timestamptz,
  voided_at                timestamptz,
  last_sent_at             timestamptz NOT NULL DEFAULT now(),
  send_window_started_at   timestamptz NOT NULL DEFAULT now(),
  sends_in_window          integer NOT NULL DEFAULT 0 CHECK (sends_in_window >= 0),
  guess_window_started_at  timestamptz NOT NULL DEFAULT now(),
  guesses_in_window        integer NOT NULL DEFAULT 0 CHECK (guesses_in_window >= 0),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Server only. No member or visitor access at all.
REVOKE ALL ON public.account_deletion_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_deletion_challenges TO service_role;

ALTER TABLE public.account_deletion_challenges ENABLE ROW LEVEL SECURITY;
-- Deliberately NO policies: with RLS on and no policy, signed-in members and
-- visitors can never read or change a row, even if a grant is added later.

COMMENT ON TABLE public.account_deletion_challenges IS
  'One active account-deletion email code per member. Server-only (service role). Stores a keyed hash, never the code. Read/written only through issue_/claim_/void_account_deletion_challenge.';

-- Same housekeeping triggers as the other code tables.
CREATE TRIGGER account_deletion_challenges_updated_at
  BEFORE UPDATE ON public.account_deletion_challenges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER zz_maintenance_freeze
  BEFORE INSERT OR DELETE OR UPDATE ON public.account_deletion_challenges
  FOR EACH ROW EXECUTE FUNCTION public.block_writes_during_maintenance();

-- ---------------------------------------------------------------------
-- issue: called right BEFORE the email is sent. Only when it returns
-- ok=true does the server send the email. Returns jsonb:
--   {ok:true, expires_at, retry_after_seconds}
--   {ok:false, reason:'cooldown'|'send_limit'|'locked'|'busy', retry_after_seconds, locked_until?}
-- 'busy' = the code could not be stored; nothing may be emailed.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.issue_account_deletion_challenge(
  _user_id uuid, _email text, _session_id uuid, _code_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_ttl       constant interval := interval '10 minutes';
  c_cooldown  constant interval := interval '60 seconds';
  c_window    constant interval := interval '1 hour';
  c_max_sends constant integer  := 5;
  _now    timestamptz;
  _mail   text := lower(btrim(coalesce(_email, '')));
  r       public.account_deletion_challenges%ROWTYPE;
  _new_id uuid;
  _sends  integer;
  _swin   timestamptz;
BEGIN
  IF _user_id IS NULL OR _session_id IS NULL OR _mail = ''
     OR coalesce(_code_hash, '') !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid challenge input';
  END IF;

  -- Up to 3 tries, in case a clean-up removes the row between steps.
  FOR _try IN 1..3 LOOP
    -- First code for this account: create the row.
    INSERT INTO public.account_deletion_challenges
      (user_id, email, session_id, code_hash, expires_at, last_sent_at,
       send_window_started_at, sends_in_window, guess_window_started_at, guesses_in_window)
    VALUES
      (_user_id, _mail, _session_id, _code_hash, clock_timestamp() + c_ttl, clock_timestamp(),
       clock_timestamp(), 1, clock_timestamp(), 0)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING id INTO _new_id;

    IF _new_id IS NOT NULL THEN
      -- The insert may have waited on another request; restamp with the
      -- real time now so the member always gets the full 10 minutes.
      _now := clock_timestamp();
      UPDATE public.account_deletion_challenges SET
        expires_at = _now + c_ttl, last_sent_at = _now,
        send_window_started_at = _now, guess_window_started_at = _now
      WHERE id = _new_id;
      RETURN jsonb_build_object('ok', true, 'expires_at', _now + c_ttl,
                                'retry_after_seconds', extract(epoch FROM c_cooldown)::int);
    END IF;

    -- Existing row: lock it so parallel taps queue behind each other.
    SELECT * INTO r FROM public.account_deletion_challenges
     WHERE user_id = _user_id FOR UPDATE;
    EXIT WHEN FOUND;
    -- Row was deleted while we waited: try the insert again.
  END LOOP;

  IF r.id IS NULL THEN
    -- Could not store a code: fail closed, the server must not send an email.
    RETURN jsonb_build_object('ok', false, 'reason', 'busy', 'retry_after_seconds', 5);
  END IF;

  -- Decisions below use the real time after the lock wait, not the time
  -- this request started.
  _now := clock_timestamp();

  IF r.locked_until IS NOT NULL AND r.locked_until > _now THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', r.locked_until,
      'retry_after_seconds', ceil(extract(epoch FROM r.locked_until - _now))::int);
  END IF;

  IF r.last_sent_at > _now - c_cooldown THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cooldown',
      'retry_after_seconds', ceil(extract(epoch FROM r.last_sent_at + c_cooldown - _now))::int);
  END IF;

  IF r.send_window_started_at <= _now - c_window THEN
    _sends := 0; _swin := _now;
  ELSE
    _sends := r.sends_in_window; _swin := r.send_window_started_at;
  END IF;
  IF _sends >= c_max_sends THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'send_limit',
      'retry_after_seconds', ceil(extract(epoch FROM _swin + c_window - _now))::int);
  END IF;

  -- Replace the code. The old hash is overwritten, so the old code dies now.
  -- attempts resets for the new code, but guesses_in_window does NOT.
  UPDATE public.account_deletion_challenges SET
    email = _mail, session_id = _session_id, purpose = 'account_deletion',
    code_hash = _code_hash, expires_at = _now + c_ttl,
    attempts = 0, locked_until = NULL, consumed_at = NULL, voided_at = NULL,
    last_sent_at = _now, send_window_started_at = _swin, sends_in_window = _sends + 1
  WHERE id = r.id;

  RETURN jsonb_build_object('ok', true, 'expires_at', _now + c_ttl,
                            'retry_after_seconds', extract(epoch FROM c_cooldown)::int);
END;
$$;

-- ---------------------------------------------------------------------
-- claim: called by the delete endpoint when the member taps
-- "Permanently delete my account". ok=true means the code was correct and
-- is now used up; deletion may start. Returns jsonb:
--   {ok:true}
--   {ok:false, reason:'no_code'|'used'|'expired'|'email_changed'|
--                     'session_mismatch'|'wrong'|'locked',
--    attempts_left?, locked_until?, retry_after_seconds?}
-- Wrong guesses are saved even though ok=false (no exception is raised).
-- ---------------------------------------------------------------------
CREATE FUNCTION public.claim_account_deletion_challenge(
  _user_id uuid, _email text, _session_id uuid, _code_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_max_attempts constant integer  := 5;
  c_lock         constant interval := interval '15 minutes';
  c_window       constant interval := interval '1 hour';
  c_max_guesses  constant integer  := 10;
  _now     timestamptz;
  _mail    text := lower(btrim(coalesce(_email, '')));
  r        public.account_deletion_challenges%ROWTYPE;
  _guesses integer;
  _gwin    timestamptz;
  _att     integer;
  _lock    timestamptz;
BEGIN
  IF _user_id IS NULL OR _session_id IS NULL OR coalesce(_code_hash, '') !~ '^[a-f0-9]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong', 'attempts_left', NULL);
  END IF;

  SELECT * INTO r FROM public.account_deletion_challenges
   WHERE user_id = _user_id FOR UPDATE;
  -- Real time after the lock wait: a code that expired while this request
  -- waited behind another one is refused.
  _now := clock_timestamp();

  IF NOT FOUND OR r.voided_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_code');
  END IF;
  IF r.consumed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'used');
  END IF;
  IF r.locked_until IS NOT NULL AND r.locked_until > _now THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', r.locked_until,
      'retry_after_seconds', ceil(extract(epoch FROM r.locked_until - _now))::int);
  END IF;
  IF r.expires_at <= _now THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  -- The account email changed after the code was sent: the code is cancelled.
  IF r.email <> _mail OR r.purpose <> 'account_deletion' THEN
    UPDATE public.account_deletion_challenges SET voided_at = _now WHERE id = r.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'email_changed');
  END IF;
  -- A different sign-in session (other device/after re-login) cannot use it.
  IF r.session_id <> _session_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_mismatch');
  END IF;

  IF r.guess_window_started_at <= _now - c_window THEN
    _guesses := 0; _gwin := _now;
  ELSE
    _guesses := r.guesses_in_window; _gwin := r.guess_window_started_at;
  END IF;
  IF _guesses >= c_max_guesses THEN
    UPDATE public.account_deletion_challenges SET locked_until = _gwin + c_window WHERE id = r.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', _gwin + c_window,
      'retry_after_seconds', ceil(extract(epoch FROM _gwin + c_window - _now))::int);
  END IF;

  _att := r.attempts + 1;

  IF r.code_hash <> _code_hash THEN
    _lock := CASE WHEN _att >= c_max_attempts THEN _now + c_lock ELSE NULL END;
    UPDATE public.account_deletion_challenges SET
      attempts = _att, guesses_in_window = _guesses + 1,
      guess_window_started_at = _gwin, locked_until = _lock
    WHERE id = r.id;
    IF _lock IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'attempts_left', 0,
        'locked_until', _lock, 'retry_after_seconds', extract(epoch FROM c_lock)::int);
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong',
      'attempts_left', c_max_attempts - _att);
  END IF;

  -- Correct: use it up in the same locked step.
  UPDATE public.account_deletion_challenges SET
    attempts = _att, guesses_in_window = _guesses + 1,
    guess_window_started_at = _gwin, consumed_at = _now
  WHERE id = r.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------
-- void: called only when the email provider DEFINITELY refused the send.
-- Cancels that code. The 60 s cooldown still applies (last_sent_at kept).
-- Not called on a timeout, because the email may still arrive.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.void_account_deletion_challenge(_user_id uuid, _code_hash text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH v AS (
    UPDATE public.account_deletion_challenges SET voided_at = clock_timestamp()
     WHERE user_id = _user_id AND code_hash = _code_hash
       AND consumed_at IS NULL AND voided_at IS NULL
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM v);
$$;

-- Only the server may call these.
REVOKE ALL ON FUNCTION public.issue_account_deletion_challenge(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_account_deletion_challenge(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.void_account_deletion_challenge(uuid, text)              FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_account_deletion_challenge(uuid, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_account_deletion_challenge(uuid, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.void_account_deletion_challenge(uuid, text)              TO service_role;

COMMENT ON FUNCTION public.issue_account_deletion_challenge(uuid, text, uuid, text) IS
  'Server-only. Stores a new deletion code hash (10 min, 60 s cooldown, 5 sends/hour, refused while locked).';
COMMENT ON FUNCTION public.claim_account_deletion_challenge(uuid, text, uuid, text) IS
  'Server-only. Checks and uses up a deletion code in one locked step (5 guesses/code then 15 min lock, 10 guesses/hour).';
COMMENT ON FUNCTION public.void_account_deletion_challenge(uuid, text) IS
  'Server-only. Cancels a deletion code whose email the provider definitely refused.';
