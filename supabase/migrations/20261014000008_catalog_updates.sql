-- Retire the first templates and fonts that aren't bundled; open every goal
-- and language (the engine handles them); allow clips in the media bucket.
update public.templates set is_enabled = false
where id not in ('vivid', 'luxury', 'poster', 'clean', 'neon', 'editorial');
update public.projects set template_id = 'vivid'
where template_id not in ('vivid', 'luxury', 'poster', 'clean', 'neon', 'editorial');
update public.fonts set is_enabled = false where id in ('ibm_plex_sans_arabic', 'noto_kufi_arabic', 'poppins');
update public.video_goals set is_enabled = true where not is_enabled;
update public.languages set is_enabled = true where not is_enabled;
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm'],
    file_size_limit = 52428800
where id = 'product-images';
