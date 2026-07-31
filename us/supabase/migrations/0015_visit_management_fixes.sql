-- supabase/migrations/0015_visit_management_fixes.sql
--
-- Fixes from reviewing 0014_visit_management.sql:
--
-- 1. The 'visit-photos' bucket only had SELECT/INSERT storage policies
--    (0009_viajes_storage.sql). The client's delete-visit flow calls
--    storage.remove() before delete_visit, but with no DELETE policy that
--    call is silently denied (RLS just filters it out, no error) and the
--    photo objects are never actually removed. Add the missing policy,
--    same folder-based space-membership check as the existing two.
--
-- 2. update_visit took a p_note parameter that no UI ever sets (always
--    passed as null), so every edit silently clobbered any existing note.
--    Nothing has ever written a real note, so this is a no-op today, but
--    it's a trap for whenever notes get exposed. Since create or replace
--    can't change a function's parameter list, drop the 3-arg version and
--    recreate it without p_note — it only edits the date, which is all the
--    UI needs.
--
-- 3. delete_wishlist_item deleted with `where id = ... and user_id =
--    auth.uid()` but never checked whether a row actually matched, so
--    calling it with someone else's wishlist id (or a stale id) silently
--    "succeeds" with nothing deleted. Not exploitable (ownership is still
--    enforced), but the caller has no way to tell success from a no-op.
--    Raise if nothing was deleted, matching the not_a_member style of the
--    other functions here.

create policy "space members can delete their visit photos"
  on storage.objects for delete
  using (
    bucket_id = 'visit-photos'
    and public.is_space_member((storage.foldername(name))[1]::uuid)
  );

drop function if exists public.update_visit(uuid, date, text);

create or replace function public.update_visit(
  p_visit_id uuid,
  p_visited_at date
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
  set visited_at = p_visited_at
  where id = p_visit_id;
end;
$$;

revoke execute on function public.update_visit(uuid, date) from public;
revoke execute on function public.update_visit(uuid, date) from anon;
grant execute on function public.update_visit(uuid, date) to authenticated;

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

  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

revoke execute on function public.delete_wishlist_item(uuid) from public;
revoke execute on function public.delete_wishlist_item(uuid) from anon;
grant execute on function public.delete_wishlist_item(uuid) to authenticated;
