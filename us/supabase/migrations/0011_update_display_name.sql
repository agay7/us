-- supabase/migrations/0011_update_display_name.sql
--
-- Final whole-branch review found that profiles.display_name (added in
-- 0006) had no way to ever be changed: only a SELECT RLS policy exists,
-- and the trigger that populates it only runs once at signup. This adds
-- an RPC so a user can update their own display name, following the
-- same pattern as every other write in this project (SECURITY DEFINER,
-- auth.uid()-scoped, execute revoked from public/anon, granted only to
-- authenticated).

create or replace function public.update_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if trim(p_display_name) = '' then
    raise exception 'invalid_display_name';
  end if;

  update public.profiles
  set display_name = trim(p_display_name)
  where user_id = auth.uid();
end;
$$;

revoke execute on function public.update_display_name(text) from public;
revoke execute on function public.update_display_name(text) from anon;
grant execute on function public.update_display_name(text) to authenticated;
