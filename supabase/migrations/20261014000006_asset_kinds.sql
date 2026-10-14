-- New asset kinds (separate migration: enum values can't be used in the transaction that adds them).
alter type public.asset_kind add value if not exists 'media_image';
alter type public.asset_kind add value if not exists 'media_video';
alter type public.asset_kind add value if not exists 'music';
