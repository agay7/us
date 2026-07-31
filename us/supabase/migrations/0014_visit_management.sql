-- supabase/migrations/0014_visit_management.sql
--
-- Adds edit/delete for visits (date can be filled in later, or corrected;
-- the visit itself can be removed) and delete for wishlist items. Visits are
-- shared space data (like the rest of the Viajes schema), so update/delete
-- is gated on space membership, same as add_visit — not restricted to the
-- original creator. Wishlist items are personal rankings, so delete is
-- restricted to the owning user.

create or replace function public.update_visit(
  p_visit_id uuid,
  p_visited_at date,
  p_note text
)
returns void
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

  select space_id into v_space_id from public.place_visits where id = p_visit_id;

  if v_space_id is null or not public.is_space_member(v_space_id) then
    raise exception 'not_a_member';
  end if;

  update public.place_visits
  set visited_at = p_visited_at,
      note = p_note
  where id = p_visit_id;
end;
$$;

create or replace function public.delete_visit(p_visit_id uuid)
returns void
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

  select space_id into v_space_id from public.place_visits where id = p_visit_id;

  if v_space_id is null or not public.is_space_member(v_space_id) then
    raise exception 'not_a_member';
  end if;

  -- place_visit_participants and visit_photos rows cascade on this delete.
  -- Storage objects for any photos are removed by the client before calling
  -- this function (it only has the DB path, not Storage access).
  delete from public.place_visits where id = p_visit_id;
end;
$$;

create or replace function public.delete_wishlist_item(p_wishlist_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.place_wishlist
  where id = p_wishlist_id and user_id = auth.uid();
end;
$$;

revoke execute on function public.update_visit(uuid, date, text) from public;
revoke execute on function public.update_visit(uuid, date, text) from anon;
revoke execute on function public.delete_visit(uuid) from public;
revoke execute on function public.delete_visit(uuid) from anon;
revoke execute on function public.delete_wishlist_item(uuid) from public;
revoke execute on function public.delete_wishlist_item(uuid) from anon;

grant execute on function public.update_visit(uuid, date, text) to authenticated;
grant execute on function public.delete_visit(uuid) to authenticated;
grant execute on function public.delete_wishlist_item(uuid) to authenticated;
