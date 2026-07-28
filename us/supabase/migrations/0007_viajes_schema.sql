-- supabase/migrations/0007_viajes_schema.sql

-- places es un catálogo GLOBAL (sin space_id): si dos spaces distintos
-- añaden "Roma", comparten la misma fila. No es sensible (solo nombre +
-- zona), así que es legible por cualquier usuario autenticado.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope text not null check (scope in ('spain', 'europe', 'world')),
  created_at timestamptz not null default now(),
  unique (name, scope)
);

alter table public.places enable row level security;

create policy "authenticated users can read places"
  on public.places for select
  to authenticated
  using (true);

create table public.place_visits (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  visited_at date not null,
  note text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- space_id se guarda también aquí (duplicado respecto a place_visits) para
-- que las políticas RLS de estas dos tablas sean una comprobación directa
-- (is_space_member(space_id)) en vez de un join contra place_visits.
--
-- user_id referencia a public.profiles (no a auth.users directamente):
-- PostgREST solo puede incrustar `profiles(display_name)` en una consulta
-- si existe una foreign key explícita hacia esa tabla. profiles.user_id ya
-- referencia a auth.users con cascade, así que el borrado sigue
-- propagándose igual (auth.users -> profiles -> place_visit_participants).
create table public.place_visit_participants (
  visit_id uuid not null references public.place_visits(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  primary key (visit_id, user_id)
);

create table public.visit_photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.place_visits(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  url text not null,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- user_id también referencia a public.profiles, por la misma razón que en
-- place_visit_participants (PostgREST necesita la FK directa para poder
-- incrustar profiles(display_name) en la consulta de la pestaña Pendientes).
create table public.place_wishlist (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  rank int not null,
  created_at timestamptz not null default now(),
  unique (space_id, user_id, place_id),
  unique (space_id, user_id, rank)
);

alter table public.place_visits enable row level security;
alter table public.place_visit_participants enable row level security;
alter table public.visit_photos enable row level security;
alter table public.place_wishlist enable row level security;

create policy "members can read their space's visits"
  on public.place_visits for select
  using (public.is_space_member(space_id));

create policy "members can read their space's visit participants"
  on public.place_visit_participants for select
  using (public.is_space_member(space_id));

create policy "members can read their space's visit photos"
  on public.visit_photos for select
  using (public.is_space_member(space_id));

create policy "members can read their space's wishlist"
  on public.place_wishlist for select
  using (public.is_space_member(space_id));

-- No hay políticas de INSERT/UPDATE/DELETE directas en ninguna de las
-- cuatro tablas de arriba: toda escritura pasa por las funciones de abajo.

create or replace function public.find_or_create_place(p_name text, p_scope text)
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

  insert into public.places (name, scope)
  values (p_name, p_scope)
  on conflict (name, scope) do update set name = excluded.name
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.add_visit(
  p_space_id uuid,
  p_place_id uuid,
  p_visited_at date,
  p_note text,
  p_together boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit_id uuid;
  v_partner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_space_member(p_space_id) then
    raise exception 'not_a_member';
  end if;

  insert into public.place_visits (place_id, space_id, visited_at, note, created_by)
  values (p_place_id, p_space_id, p_visited_at, p_note, auth.uid())
  returning id into v_visit_id;

  insert into public.place_visit_participants (visit_id, user_id, space_id)
  values (v_visit_id, auth.uid(), p_space_id);

  if p_together then
    select user_id into v_partner_id
    from public.space_members
    where space_id = p_space_id and user_id <> auth.uid()
    limit 1;

    if v_partner_id is not null then
      insert into public.place_visit_participants (visit_id, user_id, space_id)
      values (v_visit_id, v_partner_id, p_space_id);
    end if;
  end if;

  return v_visit_id;
end;
$$;

create or replace function public.add_visit_photo(p_visit_id uuid, p_url text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select space_id into v_space_id from public.place_visits where id = p_visit_id;

  if v_space_id is null or not public.is_space_member(v_space_id) then
    raise exception 'not_a_member';
  end if;

  insert into public.visit_photos (visit_id, space_id, url, uploaded_by)
  values (p_visit_id, v_space_id, p_url, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.add_wishlist_item(p_space_id uuid, p_place_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_next_rank int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_space_member(p_space_id) then
    raise exception 'not_a_member';
  end if;

  select coalesce(max(rank), 0) + 1 into v_next_rank
  from public.place_wishlist
  where space_id = p_space_id and user_id = auth.uid();

  begin
    insert into public.place_wishlist (place_id, space_id, user_id, rank)
    values (p_place_id, p_space_id, auth.uid(), v_next_rank)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'already_in_wishlist';
  end;

  return v_id;
end;
$$;

revoke execute on function public.find_or_create_place(text, text) from public;
revoke execute on function public.add_visit(uuid, uuid, date, text, boolean) from public;
revoke execute on function public.add_visit_photo(uuid, text) from public;
revoke execute on function public.add_wishlist_item(uuid, uuid) from public;

grant execute on function public.find_or_create_place(text, text) to authenticated;
grant execute on function public.add_visit(uuid, uuid, date, text, boolean) to authenticated;
grant execute on function public.add_visit_photo(uuid, text) to authenticated;
grant execute on function public.add_wishlist_item(uuid, uuid) to authenticated;
