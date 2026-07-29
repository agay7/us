-- supabase/migrations/0010_restrict_shares_space_with_execute.sql
--
-- Final whole-branch review found that migration 0008's anon-execute
-- sweep enumerated only the RPCs added by Task 3 (find_or_create_place,
-- add_visit, add_visit_photo, add_wishlist_item) plus Plan 1's two RPCs,
-- and missed public.shares_space_with(uuid) — a SECURITY DEFINER function
-- added in migration 0006 (profiles). Live pg_proc.proacl confirmed both
-- PUBLIC and anon still had EXECUTE on it. Exploitability is low (as
-- anon, auth.uid() is null so it always returns false; as authenticated,
-- it only answers "does this UUID share a space with me", the caller's
-- own information), but it's the same class of gap 0008 was meant to
-- close entirely. This finishes that sweep.

revoke execute on function public.shares_space_with(uuid) from public;
revoke execute on function public.shares_space_with(uuid) from anon;
grant execute on function public.shares_space_with(uuid) to authenticated;
