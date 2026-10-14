# MotionCut (Flow-Cut)

Mobile app that turns a voice-over into a vertical motion-graphics short video
(Reels / TikTok / Shorts). Arabic-first (RTL, dialects), works with any language.

```
apps/mobile/        Flutter app (built on Codemagic, codemagic.yaml)
engine/             Motion engine + generation worker (Node, Remotion)
supabase/           Database migrations and the `generate` edge function
.github/workflows/  Render worker (GitHub Actions)
```

## How a video is made

1. The app uploads the voice (or speaker video), logo, product images and media
   to Supabase Storage and calls the `generate` edge function.
2. `generate` queues a job with the database RPCs (credits and plan limits are
   enforced in Postgres) and dispatches the **Render worker** workflow.
3. The worker (`engine/src/worker.ts`) cleans the audio, transcribes it with
   word timings, asks Claude to plan the scenes (layouts chosen from what is
   said, so videos never look like one repeated template), renders a 720p
   preview with Remotion and uploads it.
4. The app shows live progress, the preview, a per-scene text editor, a
   restyle sheet (style / colours / font / captions, no re-transcription) and
   export (720p / 1080p / 4K, 30 / 60 fps, SRT).

## Engine

- 6 motion styles: vivid, luxury, poster, clean, neon, editorial
- 13 layouts: hook, statement, icon_point, list, steps, compare, stat, quote,
  product, media, speaker, speaker_split, cta
- Voice-synced kinetic typography, captions (word box, word colour, karaoke line)
- Talking-head mode: speaker full frame / top half with explanation panel
- Music ducking, synthesized SFX, bundled OFL fonts, Phosphor icons

```bash
cd engine
npm ci
npm test                     # planner tests
npx tsx src/scripts/render-sample.ts content vivid   # sample video in out/
```

## One-time setup

GitHub repository secrets (Settings → Secrets and variables → Actions):

| Secret | Required | Purpose |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Worker access to the queue and storage |
| `ANTHROPIC_API_KEY` | recommended | Claude scene planning (falls back to rules) |
| `ELEVENLABS_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY` | optional | Cloud speech-to-text; default is free local Whisper |

Supabase edge function secret: `GH_DISPATCH_TOKEN`, a GitHub fine-grained token
for this repository with **Contents: Read and write** (lets `generate` start the
worker).

The app only ships the Supabase URL and publishable key. Never put the
service-role key in the app.
