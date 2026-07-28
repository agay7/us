-- supabase/migrations/0004_unique_space_membership.sql
--
-- Migration 0003 enforced "one space per user" via a check-then-insert in
-- application logic, which review flagged as a TOCTOU race: two concurrent
-- calls from the same user could both pass the existence check before
-- either commits. This adds a real DB-level unique constraint as the
-- backstop, and teaches both RPCs to translate the resulting unique
-- violation into the same already_in_space error the client already
-- handles, instead of leaking a raw Postgres error message.

alter table public.space_members
  add constraint space_members_user_id_key unique (user_id);

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
