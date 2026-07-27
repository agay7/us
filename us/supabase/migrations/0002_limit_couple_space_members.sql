-- supabase/migrations/0002_limit_couple_space_members.sql
--
-- Closes a gap flagged during Task 6 review: spec §6 states the invite
-- code is single-use per space, but the original join_space_by_invite_code
-- had no capacity check, so any number of people could join a 'couple'
-- space with the same code. This enforces a 2-member cap for spaces of
-- type 'couple' while leaving 'group' spaces (future phases) uncapped.

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
