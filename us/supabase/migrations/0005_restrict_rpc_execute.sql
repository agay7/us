-- supabase/migrations/0005_restrict_rpc_execute.sql
--
-- Final-review finding: CREATE FUNCTION grants EXECUTE to PUBLIC by
-- default, and no prior migration ever revoked it, so create_space and
-- join_space_by_invite_code were callable with the anon key even without
-- a session. With auth.uid() null, both membership checks evaluate false,
-- letting an unauthenticated caller use join_space_by_invite_code as an
-- oracle for "does this invite code exist" / "is that space full" before
-- failing on the user_id not-null constraint. This revokes the implicit
-- PUBLIC grant (authenticated keeps its explicit grant from 0001, which
-- create-or-replace preserves across migrations) and adds an explicit
-- auth guard in both functions as defense in depth.

revoke execute on function public.create_space(text, text) from public;
revoke execute on function public.join_space_by_invite_code(text) from public;

create or replace function public.create_space(p_name text, p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if exists (select 1 from public.space_members where user_id = auth.uid()) then
    raise exception 'already_in_space';
  end if;

  insert into public.spaces (name, invite_code)
  values (p_name, p_invite_code)
  returning id into v_space_id;

  begin
    insert into public.space_members (space_id, user_id, role)
    values (v_space_id, auth.uid(), 'owner');
  exception when unique_violation then
    raise exception 'already_in_space';
  end;

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
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

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

  begin
    insert into public.space_members (space_id, user_id, role)
    values (v_space_id, auth.uid(), 'member')
    on conflict (space_id, user_id) do nothing;
  exception when unique_violation then
    raise exception 'already_in_space';
  end;

  return v_space_id;
end;
$$;
