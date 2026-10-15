insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their profile avatars" on storage.objects;
create policy "Users can read their profile avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can upload their profile avatars" on storage.objects;
create policy "Users can upload their profile avatars"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}[.](png|jpg|webp)$')
  );

drop policy if exists "Users can delete their profile avatars" on storage.objects;
create policy "Users can delete their profile avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);