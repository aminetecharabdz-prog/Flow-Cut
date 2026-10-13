# MotionCut (Flow-Cut)

Mobile app that turns a single voice-over into a 9:16 motion-graphics short video.

## Supabase

Database migrations live in `supabase/migrations/` (not yet applied to the remote project):

1. `core_schema` — catalogs, profiles, projects, assets, transcripts, scenes, jobs, exports, credit ledger
2. `row_level_security` — RLS policies and column-level grants
3. `generation_functions` — signup grant, credits, generation queue RPCs
4. `storage` — private buckets and per-user storage policies
5. `seed_catalogs` — launch languages, goals, templates, fonts

The mobile app needs only `SUPABASE_URL` and the publishable key (set as Codemagic environment variables).
Never ship the `service_role` / secret key in the app.
