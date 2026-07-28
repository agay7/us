-- supabase/migrations/0008_restrict_anon_execute.sql
--
-- Plan 1's 0005 migration tried to close "RPCs callable unauthenticated" by
-- doing `revoke execute ... from public`. That does not work on Supabase:
-- EXECUTE on new functions is granted directly to `anon`/`authenticated`
-- via `alter default privileges` at the project/schema level, not via the
-- `public` pseudo-role, so revoking from `public` is a no-op against it.
-- Confirmed live via `pg_proc.proacl` showing `anon=X/postgres` still
-- present on every affected function. This revokes EXECUTE from `anon`
-- explicitly on all six functions affected (the two from Plan 1 plus the
-- four added in this plan's Task 3). `authenticated`'s grant is untouched.
--
-- Functional impact of the original gap was low — every one of these
-- functions already guards on `auth.uid() is null` as its first statement,
-- so an anonymous caller only ever got a clean error, never data access.
-- This migration makes the ACL match what it always claimed to do.

revoke execute on function public.create_space(text, text) from anon;
revoke execute on function public.join_space_by_invite_code(text) from anon;
revoke execute on function public.find_or_create_place(text, text) from anon;
revoke execute on function public.add_visit(uuid, uuid, date, text, boolean) from anon;
revoke execute on function public.add_visit_photo(uuid, text) from anon;
revoke execute on function public.add_wishlist_item(uuid, uuid) from anon;
