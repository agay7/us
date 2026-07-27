-- supabase/migrations/0001_core_schema.sql

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'couple' check (type in ('couple', 'group')),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;

-- Comprueba pertenencia sin volver a disparar RLS sobre space_members
-- (evita recursión infinita en las políticas de abajo).
create or replace function public.is_space_member(target_space_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = target_space_id and user_id = auth.uid()
  );
$$;

create policy "members can read their space"
  on public.spaces for select
  using (public.is_space_member(id));

create policy "members can read their space_members"
  on public.space_members for select
  using (public.is_space_member(space_id));

-- No hay políticas de INSERT/UPDATE/DELETE directas: toda escritura pasa
-- por las funciones de abajo, que son las únicas con permiso de ejecución.

create or replace function public.create_space(p_name text, p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  insert into public.spaces (name, invite_code)
  values (p_name, p_invite_code)
  returning id into v_space_id;

  insert into public.space_members (space_id, user_id, role)
  values (v_space_id, auth.uid(), 'owner');

  return v_space_id;
end;
$$;

create or replace function public.join_space_by_invite_code(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  select id into v_space_id from public.spaces where invite_code = p_invite_code;

  if v_space_id is null then
    raise exception 'invalid_invite_code';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (v_space_id, auth.uid(), 'member')
  on conflict (space_id, user_id) do nothing;

  return v_space_id;
end;
$$;

grant execute on function public.create_space(text, text) to authenticated;
grant execute on function public.join_space_by_invite_code(text) to authenticated;
