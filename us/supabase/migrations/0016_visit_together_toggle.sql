-- supabase/migrations/0016_visit_together_toggle.sql
--
-- update_visit could only change a visit's date — there was no way to
-- correct whether a visit was solo or together after the fact (e.g. most
-- bulk-imported history was recorded as separate solo visits per person,
-- and a couple may want to mark one of those as "actually we went
-- together"). Adds a p_together param: when true, ensures the space's
-- other member is a participant on this visit; when false, removes them.
-- The visit's original creator is always left as a participant either way
-- — this only toggles the *other* member's participation, mirroring how
-- add_visit's p_together already works for new visits.

drop function if exists public.update_visit(uuid, date);

create or replace function public.update_visit(
  p_visit_id uuid,
  p_visited_at date,
  p_together boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_created_by uuid;
  v_other_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select space_id, created_by into v_space_id, v_created_by
  from public.place_visits
  where id = p_visit_id;

  if v_space_id is null or not public.is_space_member(v_space_id) then
    raise exception 'not_a_member';
  end if;

  update public.place_visits
  set visited_at = p_visited_at
  where id = p_visit_id;

  select user_id into v_other_member_id
  from public.space_members
  where space_id = v_space_id and user_id <> v_created_by
  limit 1;

  if v_other_member_id is not null then
    if p_together then
      insert into public.place_visit_participants (visit_id, user_id, space_id)
      values (p_visit_id, v_other_member_id, v_space_id)
      on conflict (visit_id, user_id) do nothing;
    else
      delete from public.place_visit_participants
      where visit_id = p_visit_id and user_id = v_other_member_id;
    end if;
  end if;
end;
$$;

revoke execute on function public.update_visit(uuid, date, boolean) from public;
revoke execute on function public.update_visit(uuid, date, boolean) from anon;
grant execute on function public.update_visit(uuid, date, boolean) to authenticated;
