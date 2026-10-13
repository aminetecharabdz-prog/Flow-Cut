-- Private storage buckets. Every object path starts with the owner's user id:
--   audio/<user_id>/<project_id>/<file>
--   product-images/<user_id>/<project_id>/<file>
--   brand/<user_id>/<brand_kit_id>/<file>
--   renders/<user_id>/<project_id>/<file>   (written by the worker only)
-- The app should extract audio from videos on-device before upload to save bandwidth.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('audio', 'audio', false, 52428800, array[
    'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac',
    'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm', 'audio/ogg',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]),
  ('product-images', 'product-images', false, 10485760, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic'
  ]),
  ('brand', 'brand', false, 5242880, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'
  ]),
  ('renders', 'renders', false, null, array[
    'video/mp4', 'image/jpeg', 'image/png', 'application/x-subrip', 'text/plain'
  ]);

create policy "Storage: read own files" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('audio', 'product-images', 'brand', 'renders')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Storage: upload own files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('audio', 'product-images', 'brand')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Storage: replace own files" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('audio', 'product-images', 'brand')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('audio', 'product-images', 'brand')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Storage: delete own files" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('audio', 'product-images', 'brand', 'renders')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
