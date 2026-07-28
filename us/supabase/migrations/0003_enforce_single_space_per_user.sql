-- supabase/migrations/0003_enforce_single_space_per_user.sql
--
-- Closes a gap flagged during Task 10 review: nothing prevented a user from
-- ending up in more than one space (create_space had no existing-membership
-- guard, and join_space_by_invite_code only deduped re-joining the SAME
-- space). The (app) layout and phase-1 data model both assume at most one
-- space_members row per user; this enforces that invariant server-side.

create or replace function public.create_space(p_name text, p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  if exists (select 1 from public.space_members where user_id = auth.uid()) then
    raise exception 'already_in_space';
  end if;

  insert into public.spaces (name, invite_code)
  values (p_name, p_invite_code)
  returning id into v_space_id;

  insert into public.space_members (space_id, user_id, role)
  values (v_space_id, auth.uid(), 'owner');

  return v_space_id;
end;
$$;

create or replace function public.join_space_by_invite_code(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_space_type text;
  v_already_member boolean;
  v_already_in_other_space boolean;
  v_member_count int;
begin
  select id, type into v_space_id, v_space_type
  from public.spaces
  where invite_code = p_invite_code;

  if v_space_id is null then
    raise exception 'invalid_invite_code';
  end if;

  select exists (
    select 1 from public.space_members
    where space_id = v_space_id and user_id = auth.uid()
  ) into v_already_member;

  if not v_already_member then
    select exists (
      select 1 from public.space_members
      where user_id = auth.uid() and space_id <> v_space_id
    ) into v_already_in_other_space;

    if v_already_in_other_space then
      raise exception 'already_in_space';
    end if;

    select count(*) into v_member_count
    from public.space_members
    where space_id = v_space_id;

    if v_space_type = 'couple' and v_member_count >= 2 then
      raise exception 'space_full';
    end if;
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (v_space_id, auth.uid(), 'member')
  on conflict (space_id, user_id) do nothing;

  return v_space_id;
end;
$$;
