-- supabase/migrations/0021_objetivos_schema.sql
--
-- Objetivos module (spec section 7): a goal is created with a category
-- that determines how progress is measured — savings (numeric bar toward
-- a target amount), habit (streak of check-ins, same weekly-streak
-- concept as Retos' streak challenges), or life (checklist of milestones
-- with a computed %). All three share one `goals` row; category-specific
-- state lives either on that row (savings) or in a child table
-- (milestones for life, check-ins for habit).

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  title text not null,
  category text not null check (category in ('savings', 'habit', 'life')),
  status text not null check (status in ('active', 'completed')) default 'active',
  target_amount numeric,
  current_amount numeric not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint savings_has_target check (category <> 'savings' or target_amount is not null)
);

-- space_id duplicated on both child tables (rather than joining through
-- goals) so their RLS policies are a direct is_space_member(space_id)
-- check — same pattern as place_visit_participants/visit_photos.
create table public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- user_id references profiles (not auth.users directly) so PostgREST can
-- embed profiles(display_name) in nested selects — same reason
-- place_visit_participants/place_wishlist point at profiles.
create table public.habit_checkins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  date date not null default current_date,
  unique (goal_id, user_id, date)
);

alter table public.goals enable row level security;
alter table public.goal_milestones enable row level security;
alter table public.habit_checkins enable row level security;

create policy "members can read their space's goals"
  on public.goals for select
  using (public.is_space_member(space_id));

create policy "members can read their space's milestones"
  on public.goal_milestones for select
  using (public.is_space_member(space_id));

create policy "members can read their space's habit checkins"
  on public.habit_checkins for select
  using (public.is_space_member(space_id));

-- No direct INSERT/UPDATE/DELETE policies: every write goes through the
-- SECURITY DEFINER functions below.

create or replace function public.create_goal(
  p_space_id uuid,
  p_title text,
  p_category text,
  p_target_amount numeric
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

  if p_category not in ('savings', 'habit', 'life') then
    raise exception 'invalid_category';
  end if;

  if p_category = 'savings' and (p_target_amount is null or p_target_amount <= 0) then
    raise exception 'invalid_target_amount';
  end if;

  insert into public.goals (space_id, title, category, target_amount, created_by)
  values (
    p_space_id,
    p_title,
    p_category,
    case when p_category = 'savings' then p_target_amount else null end,
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.add_savings_contribution(p_goal_id uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_category text;
  v_target numeric;
  v_new_amount numeric;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select space_id, category, target_amount into v_space_id, v_category, v_target
  from public.goals where id = p_goal_id;

  if v_space_id is null or not public.is_space_member(v_space_id) then
    raise exception 'not_a_member';
  end if;

  if v_category <> 'savings' then
    raise exception 'not_a_savings_goal';
  end if;

  if p_amount = 0 then
    raise exception 'invalid_amount';
  end if;

  -- p_amount may be negative to correct a mistaken contribution; the
  -- total is clamped at 0 rather than going negative.
  update public.goals
  set current_amount = greatest(0, current_amount + p_amount)
  where id = p_goal_id
  returning current_amount into v_new_amount;

  update public.goals
  set status = case when v_new_amount >= v_target then 'completed' else 'active' end
  where id = p_goal_id;
end;
$$;

create or replace function public.add_milestone(p_goal_id uuid, p_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_category text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select space_id, category into v_space_id, v_category from public.goals where id = p_goal_id;

  if v_space_id is null or not public.is_space_member(v_space_id) then
    raise exception 'not_a_member';
  end if;

  if v_category <> 'life' then
    raise exception 'not_a_life_goal';
  end if;

  insert into public.goal_milestones (goal_id, space_id, title)
  values (p_goal_id, v_space_id, p_title)
  returning id into v_id;

  -- Adding a new (incomplete) milestone to an already-"completed" goal
  -- reopens it: completion means every milestone so far is done, and
  -- there's now one that isn't.
  update public.goals set status = 'active' where id = p_goal_id and status = 'completed';

  return v_id;
end;
$$;

create or replace function public.toggle_milestone(p_milestone_id uuid, p_completed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_goal_id uuid;
  v_total int;
  v_completed_count int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select space_id, goal_id into v_space_id, v_goal_id
  from public.goal_milestones where id = p_milestone_id;

  if v_space_id is null or not public.is_space_member(v_space_id) then
    raise exception 'not_a_member';
  end if;

  update public.goal_milestones
  set completed = p_completed, completed_at = case when p_completed then now() else null end
  where id = p_milestone_id;

  select count(*), count(*) filter (where completed) into v_total, v_completed_count
  from public.goal_milestones where goal_id = v_goal_id;

  update public.goals
  set status = case when v_total > 0 and v_completed_count = v_total then 'completed' else 'active' end
  where id = v_goal_id;
end;
$$;

create or replace function public.checkin_habit(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_category text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select space_id, category into v_space_id, v_category from public.goals where id = p_goal_id;

  if v_space_id is null or not public.is_space_member(v_space_id) then
    raise exception 'not_a_member';
  end if;

  if v_category <> 'habit' then
    raise exception 'not_a_habit_goal';
  end if;

  insert into public.habit_checkins (goal_id, space_id, user_id, date)
  values (p_goal_id, v_space_id, auth.uid(), current_date)
  on conflict (goal_id, user_id, date) do nothing;
end;
$$;

create or replace function public.delete_goal(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select created_by into v_created_by from public.goals where id = p_goal_id;

  if v_created_by is null or v_created_by <> auth.uid() then
    raise exception 'not_the_creator';
  end if;

  delete from public.goals where id = p_goal_id;
end;
$$;

revoke execute on function public.create_goal(uuid, text, text, numeric) from public;
revoke execute on function public.create_goal(uuid, text, text, numeric) from anon;
revoke execute on function public.add_savings_contribution(uuid, numeric) from public;
revoke execute on function public.add_savings_contribution(uuid, numeric) from anon;
revoke execute on function public.add_milestone(uuid, text) from public;
revoke execute on function public.add_milestone(uuid, text) from anon;
revoke execute on function public.toggle_milestone(uuid, boolean) from public;
revoke execute on function public.toggle_milestone(uuid, boolean) from anon;
revoke execute on function public.checkin_habit(uuid) from public;
revoke execute on function public.checkin_habit(uuid) from anon;
revoke execute on function public.delete_goal(uuid) from public;
revoke execute on function public.delete_goal(uuid) from anon;

grant execute on function public.create_goal(uuid, text, text, numeric) to authenticated;
grant execute on function public.add_savings_contribution(uuid, numeric) to authenticated;
grant execute on function public.add_milestone(uuid, text) to authenticated;
grant execute on function public.toggle_milestone(uuid, boolean) to authenticated;
grant execute on function public.checkin_habit(uuid) to authenticated;
grant execute on function public.delete_goal(uuid) to authenticated;
