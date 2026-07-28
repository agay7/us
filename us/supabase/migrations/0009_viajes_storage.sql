-- supabase/migrations/0009_viajes_storage.sql

insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', false)
on conflict (id) do nothing;

create policy "space members can read their visit photos"
  on storage.objects for select
  using (
    bucket_id = 'visit-photos'
    and public.is_space_member((storage.foldername(name))[1]::uuid)
  );

create policy "space members can upload visit photos"
  on storage.objects for insert
  with check (
    bucket_id = 'visit-photos'
    and public.is_space_member((storage.foldername(name))[1]::uuid)
  );
