-- supabase/migrations/0020_delete_challenge.sql
--
-- Every other module in this app ended up needing a way to remove a
-- mistaken entry (Viajes got update/delete for visits and wishlist items
-- after the fact) — Retos should have the same safety valve from the
-- start rather than accumulating test/mistaken proposals with no way to
-- remove them. Restricted to the challenge's own creator, in any status:
-- challenge_completions rows cascade-delete with it (on delete cascade,
-- 0017), so the leaderboard (computed fresh from remaining completions on
-- every load, never cached) adjusts automatically. Any achievement already
-- unlocked from that challenge is left alone, same as a video game trophy
-- not un-earning itself if you later undo the run — not worth the
-- complexity of reversing it.

create or replace function public.delete_challenge(p_challenge_id uuid)
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

  select created_by into v_created_by from public.challenges where id = p_challenge_id;

  if v_created_by is null or v_created_by <> auth.uid() then
    raise exception 'not_the_creator';
  end if;

  delete from public.challenges where id = p_challenge_id;
end;
$$;

revoke execute on function public.delete_challenge(uuid) from public;
revoke execute on function public.delete_challenge(uuid) from anon;
grant execute on function public.delete_challenge(uuid) to authenticated;
