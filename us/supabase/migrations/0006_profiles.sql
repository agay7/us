-- supabase/migrations/0006_profiles.sql

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Comprueba si el usuario que llama comparte space con other_user_id,
-- sin disparar RLS sobre space_members (mismo patrón que is_space_member).
create or replace function public.shares_space_with(other_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members sm1
    join public.space_members sm2 on sm1.space_id = sm2.space_id
    where sm1.user_id = auth.uid() and sm2.user_id = other_user_id
  );
$$;

create policy "profiles readable by self or space-mates"
  on public.profiles for select
  using (user_id = auth.uid() or public.shares_space_with(user_id));

-- Crea automáticamente una fila de perfil para cada usuario nuevo,
-- usando el nombre pasado en el signup (options.data.full_name) o,
-- si falta, la parte del email antes de la @.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: usuarios que ya existían antes de este trigger (de Plan 1)
-- no tienen fila de perfil todavía.
insert into public.profiles (user_id, display_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
from auth.users
where id not in (select user_id from public.profiles);
