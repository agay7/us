-- supabase/migrations/0012_place_coordinates.sql
--
-- Adds coordinates to the global places catalog so Visitados can render a
-- world map with a pin per visited place. Coordinates are optional (a
-- geocoding lookup can fail or be skipped) — nullable columns, and the
-- map only plots places that have them.
--
-- find_or_create_place gets two new optional parameters, defaulted to
-- null so every existing caller (AddWishlistForm never geocodes) keeps
-- working unchanged. On conflict, coalesce(existing, new) so a place
-- first created without coordinates (e.g. via the wishlist) can still
-- pick up coordinates the first time someone logs an actual visit to it,
-- without a later null overwriting a place that already has them.

alter table public.places
  add column lat double precision,
  add column lng double precision;

-- `create or replace` cannot change a function's parameter list — adding
-- p_lat/p_lng would create a second, overloaded find_or_create_place(text,
-- text) alongside this one, making every existing 2-arg call ambiguous.
-- Drop the old signature first so there's exactly one version.
drop function if exists public.find_or_create_place(text, text);

create or replace function public.find_or_create_place(
  p_name text,
  p_scope text,
  p_lat double precision default null,
  p_lng double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.places (name, scope, lat, lng)
  values (p_name, p_scope, p_lat, p_lng)
  on conflict (name, scope) do update
    set name = excluded.name,
        lat = coalesce(public.places.lat, excluded.lat),
        lng = coalesce(public.places.lng, excluded.lng)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.find_or_create_place(text, text, double precision, double precision) from public;
revoke execute on function public.find_or_create_place(text, text, double precision, double precision) from anon;
grant execute on function public.find_or_create_place(text, text, double precision, double precision) to authenticated;
