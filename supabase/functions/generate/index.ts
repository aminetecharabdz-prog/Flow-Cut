// Queues a generation job for the signed-in user and wakes the render worker.
//
// POST { action: "generate" | "rerender" | "export", project_id, resolution?, fps?, aspect_ratio?, include_subtitles? }
//
// The job is created through the database RPCs *as the user* (their JWT is
// forwarded), so ownership, credits and plan limits are enforced in Postgres.
// Secrets: GH_DISPATCH_TOKEN (GitHub token allowed to dispatch on the repo),
// optional GH_REPO (defaults to aminetecharabdz-prog/Flow-Cut).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const wakeWorker = async (jobId: string) => {
  const token = Deno.env.get('GH_DISPATCH_TOKEN');
  if (!token) return { dispatched: false, reason: 'GH_DISPATCH_TOKEN is not configured' };
  const repo = Deno.env.get('GH_REPO') ?? 'aminetecharabdz-prog/Flow-Cut';
  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'motioncut-generate',
    },
    body: JSON.stringify({ event_type: 'render', client_payload: { job_id: jobId } }),
  });
  return res.ok ? { dispatched: true } : { dispatched: false, reason: `GitHub ${res.status}: ${await res.text()}` };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Not signed in' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const projectId = typeof body.project_id === 'string' ? body.project_id : null;
  if (!projectId) return json({ error: 'project_id is required' }, 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const action = body.action ?? 'generate';
  const rpc =
    action === 'generate'
      ? supabase.rpc('start_generation', { p_project_id: projectId })
      : action === 'rerender'
        ? supabase.rpc('request_rerender', { p_project_id: projectId })
        : action === 'export'
          ? supabase.rpc('request_export', {
              p_project_id: projectId,
              p_resolution: body.resolution ?? '720p',
              p_fps: body.fps ?? 30,
              p_aspect_ratio: body.aspect_ratio ?? null,
              p_include_subtitles: Boolean(body.include_subtitles),
            })
          : null;
  if (!rpc) return json({ error: `Unknown action ${action}` }, 400);

  const { data: job, error } = await rpc;
  if (error) {
    // Hints like INSUFFICIENT_CREDITS / PLAN_LIMIT / JOB_ACTIVE let the app show a precise message.
    return json({ error: error.message, code: error.hint ?? error.code }, 400);
  }
  const wake = await wakeWorker(job.id);
  return json({ job, ...wake });
});
