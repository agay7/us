-- supabase/migrations/0017_retos_schema.sql
--
-- Retos module (spec section 7): either member proposes a challenge (one-off
-- or streak) for the other or for both. It stays pending_acceptance until
-- the recipient accepts or declines. Completing it awards its points to
-- whoever completed it; a small set of achievements unlock automatically.
--
-- assigned_to is nullable: set means "for that specific person" (a
-- surprise challenge FOR your partner), null means "for both" (a shared
-- challenge either of you can complete independently, e.g. a joint
-- streak). Either way, with spaces capped at 2 members, the "other member
-- relative to the creator" is always well-defined and is the one who must
-- accept/decline — mirrors how add_visit/update_visit already treat
-- "the other space member" as a first-class concept.

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  title text not null,
  description text,
  kind text not null check (kind in ('one_off', 'streak')),
  points int not null check (points > 0),
  status text not null check (status in ('pending_acceptance', 'active', 'completed', 'declined')),
  created_by uuid not null references auth.users(id) on delete cascade,
  assigned_to uuid references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now()
);

-- user_id references profiles (not auth.users directly) so PostgREST can
-- embed profiles(display_name) in nested selects — same reason
-- place_visit_participants/place_wishlist point at profiles.
create table public.challenge_completions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  completed_at timestamptz not null default now()
);

-- Small fixed catalog, not user-editable — seeded below. Global (no
-- space_id), like places: the achievement *definitions* aren't
-- space-specific, only who has unlocked them (user_achievements) is.
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  icon text not null,
  criteria text not null
);

create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (space_id, user_id, achievement_id)
);

alter table public.challenges enable row level security;
alter table public.challenge_completions enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

-- Visibility rule from spec section 5: a pending_acceptance challenge is
-- only visible in detail to whoever created it and whoever must respond
-- to it (assigned_to, or any space member when assigned_to is null,
-- i.e. proposed "for both"). Once it leaves pending_acceptance, it's
-- visible to the whole space like everything else.
create policy "members can read visible challenges"
  on public.challenges for select
  using (
    public.is_space_member(space_id)
    and (
      status <> 'pending_acceptance'
      or created_by = auth.uid()
      or assigned_to = auth.uid()
      or assigned_to is null
    )
  );

create policy "members can read their space's completions"
  on public.challenge_completions for select
  using (public.is_space_member(space_id));

create policy "authenticated users can read achievements"
  on public.achievements for select
  to authenticated
  using (true);

create policy "members can read their space's unlocked achievements"
  on public.user_achievements for select
  using (public.is_space_member(space_id));

-- No direct INSERT/UPDATE/DELETE policies: every write goes through the
-- SECURITY DEFINER functions below.

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

create or replace function public.respond_challenge(p_challenge_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_created_by uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select space_id, created_by, status into v_space_id, v_created_by, v_status
  from public.challenges
  where id = p_challenge_id;

  if v_space_id is null or not public.is_space_member(v_space_id) then
    raise exception 'not_a_member';
  end if;

  if auth.uid() = v_created_by then
    raise exception 'cannot_respond_to_own_challenge';
  end if;

  if v_status <> 'pending_acceptance' then
    raise exception 'not_pending';
  end if;

  update public.challenges
  set status = case when p_accept then 'active' else 'declined' end
  where id = p_challenge_id;
end;
$$;

-- Unlocks an achievement for a user if they don't already have it. Small
-- helper so the achievement checks in complete_challenge stay short.
create or replace function public.unlock_achievement(p_space_id uuid, p_user_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_achievements (space_id, user_id, achievement_id)
  select p_space_id, p_user_id, a.id
  from public.achievements a
  where a.code = p_code
  on conflict (space_id, user_id, achievement_id) do nothing;
end;
$$;

-- Consecutive weeks (most recent first) with at least one completion for
-- this challenge+user, counting back from the latest completion. Used
-- both to unlock the "racha de 4 semanas" achievement and to show the
-- current streak in the UI.
create or replace function public.compute_streak_weeks(p_challenge_id uuid, p_user_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_weeks date[];
  v_streak int := 0;
  v_expected date;
  v_wk date;
begin
  select array_agg(distinct date_trunc('week', completed_at)::date order by date_trunc('week', completed_at)::date desc)
  into v_weeks
  from public.challenge_completions
  where challenge_id = p_challenge_id and user_id = p_user_id;

  if v_weeks is null or array_length(v_weeks, 1) = 0 then
    return 0;
  end if;

  v_expected := v_weeks[1];
  foreach v_wk in array v_weeks loop
    if v_wk = v_expected then
      v_streak := v_streak + 1;
      v_expected := v_expected - interval '7 days';
    else
      exit;
    end if;
  end loop;

  return v_streak;
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
revoke execute on function public.respond_challenge(uuid, boolean) from public;
revoke execute on function public.respond_challenge(uuid, boolean) from anon;
revoke execute on function public.complete_challenge(uuid) from public;
revoke execute on function public.complete_challenge(uuid) from anon;
revoke execute on function public.unlock_achievement(uuid, uuid, text) from public;
revoke execute on function public.unlock_achievement(uuid, uuid, text) from anon;
revoke execute on function public.compute_streak_weeks(uuid, uuid) from public;
revoke execute on function public.compute_streak_weeks(uuid, uuid) from anon;

grant execute on function public.propose_challenge(uuid, text, text, text, int, uuid) to authenticated;
grant execute on function public.respond_challenge(uuid, boolean) to authenticated;
grant execute on function public.complete_challenge(uuid) to authenticated;
grant execute on function public.compute_streak_weeks(uuid, uuid) to authenticated;
-- unlock_achievement is only ever called from within complete_challenge
-- (also SECURITY DEFINER) — never exposed to clients directly.

insert into public.achievements (code, name, icon, criteria) values
  ('first_challenge', 'Primer reto completado', '🎯', 'Completar tu primer reto'),
  ('ten_challenges', '10 retos completados', '🏅', 'Completar 10 retos'),
  ('fifty_challenges', '50 retos completados', '🏆', 'Completar 50 retos'),
  ('month_streak', 'Racha de 4 semanas', '🔥', 'Mantener una racha de 4 semanas en un reto');
