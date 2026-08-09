-- supabase/migrations/0019_retos_fixes.sql
--
-- Three issues found by reviewing 0017/0018:
--
-- 1. complete_challenge placed no limit on how many times a streak
--    challenge could be completed — no schema constraint and no
--    time-based guard. A double-tap, a network retry, or deliberate
--    repeat calls could rack up unlimited points on the shared
--    leaderboard (computeLeaderboard sums challenge.points once per
--    completion row, with no dedup by period). One-off challenges were
--    already safe (status flips to 'completed', and the function's own
--    `v_status <> 'active'` check blocks a second call), but streak
--    challenges stay 'active' forever by design. Fix: block a second
--    completion of the same streak challenge by the same user within the
--    same Monday-start week — one check-in per week, matching the
--    "racha" concept the feature is already built around.
--
-- 2. compute_streak_weeks is SECURITY DEFINER (bypasses RLS) and was
--    granted to `authenticated`, but its body never checks auth.uid() or
--    space membership — the same class of gap 0018 just closed for
--    unlock_achievement, left open here. It's also unnecessary exposure:
--    the app's own UI never calls this RPC directly, it uses the local
--    JS mirror in src/lib/retos/streak.ts. It's still needed as an
--    internal helper (complete_challenge calls it to check the 4-week
--    streak achievement), so keep the function but revoke the client-
--    facing grant, same treatment as unlock_achievement.
--
-- 3. propose_challenge validated that p_assigned_to is A space member,
--    but never that it differs from the caller. Self-assigning produces
--    a pending_acceptance row the actual partner can't even see (none of
--    the RLS OR-branches match them), and respond_challenge's guard only
--    excludes the creator, not an assigned_to mismatch. Low impact
--    (self-inflicted, not exploitable against another user), but it
--    breaks the stated invariant that assigned_to is always "the other
--    member relative to the creator." Reject it outright.

revoke execute on function public.compute_streak_weeks(uuid, uuid) from authenticated;

create or replace function public.propose_challenge(
  p_space_id uuid,
  p_title text,
  p_description text,
  p_kind text,
  p_points int,
  p_assigned_to uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_space_member(p_space_id) then
    raise exception 'not_a_member';
  end if;

  if p_assigned_to = auth.uid() then
    raise exception 'cannot_assign_to_self';
  end if;

  if p_assigned_to is not null and not exists (
    select 1 from public.space_members
    where space_id = p_space_id and user_id = p_assigned_to
  ) then
    raise exception 'assigned_to_not_a_member';
  end if;

  insert into public.challenges (space_id, title, description, kind, points, status, created_by, assigned_to)
  values (p_space_id, p_title, p_description, p_kind, p_points, 'pending_acceptance', auth.uid(), p_assigned_to)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.complete_challenge(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_status text;
  v_kind text;
  v_assigned_to uuid;
  v_one_off_count int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select space_id, status, kind, assigned_to into v_space_id, v_status, v_kind, v_assigned_to
  from public.challenges
  where id = p_challenge_id;

  if v_space_id is null or not public.is_space_member(v_space_id) then
    raise exception 'not_a_member';
  end if;

  if v_status <> 'active' then
    raise exception 'not_active';
  end if;

  if v_assigned_to is not null and v_assigned_to <> auth.uid() then
    raise exception 'not_assigned_to_you';
  end if;

  if v_kind = 'streak' and exists (
    select 1 from public.challenge_completions
    where challenge_id = p_challenge_id
      and user_id = auth.uid()
      and date_trunc('week', completed_at) = date_trunc('week', now())
  ) then
    raise exception 'already_completed_this_week';
  end if;

  insert into public.challenge_completions (challenge_id, space_id, user_id)
  values (p_challenge_id, v_space_id, auth.uid());

  if v_kind = 'one_off' then
    update public.challenges set status = 'completed' where id = p_challenge_id;

    select count(*) into v_one_off_count
    from public.challenge_completions cc
    join public.challenges c on c.id = cc.challenge_id
    where cc.user_id = auth.uid() and c.kind = 'one_off';

    if v_one_off_count >= 1 then
      perform public.unlock_achievement(v_space_id, auth.uid(), 'first_challenge');
    end if;
    if v_one_off_count >= 10 then
      perform public.unlock_achievement(v_space_id, auth.uid(), 'ten_challenges');
    end if;
    if v_one_off_count >= 50 then
      perform public.unlock_achievement(v_space_id, auth.uid(), 'fifty_challenges');
    end if;
  else
    if public.compute_streak_weeks(p_challenge_id, auth.uid()) >= 4 then
      perform public.unlock_achievement(v_space_id, auth.uid(), 'month_streak');
    end if;
  end if;
end;
$$;

revoke execute on function public.propose_challenge(uuid, text, text, text, int, uuid) from public;
revoke execute on function public.propose_challenge(uuid, text, text, text, int, uuid) from anon;
revoke execute on function public.complete_challenge(uuid) from public;
revoke execute on function public.complete_challenge(uuid) from anon;

grant execute on function public.propose_challenge(uuid, text, text, text, int, uuid) to authenticated;
grant execute on function public.complete_challenge(uuid) to authenticated;
