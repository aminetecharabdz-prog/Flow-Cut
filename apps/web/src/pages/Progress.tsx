import { useEffect, useRef, useState } from 'react';
import { go, useToast } from '../App';
import { friendlyError, requestJob, supabase, type Job } from '../api';
import { stageLabels } from '../options';

const FULL = ['enhance_audio', 'transcribe', 'plan_scenes', 'render'];
const action = (t: Job['type']) => (t === 'full_generation' ? 'generate' : t);

export const Progress = ({ projectId, jobId, late }: { projectId: string; jobId: string; late?: boolean }) => {
  const toast = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [retrying, setRetrying] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    let alive = true;
    const fetchJob = async () => {
      const { data } = await supabase.from('jobs').select('id, project_id, type, status, stage, progress, error').eq('id', jobId).maybeSingle();
      if (alive && data) setJob(data as Job);
    };
    fetchJob();
    const channel = supabase
      .channel(`job-${jobId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` }, (p) => alive && setJob((j) => ({ ...(j ?? {}), ...(p.new as Job) })))
      .subscribe();
    // Fallback in case realtime is blocked by the network.
    const poll = window.setInterval(fetchJob, 6000);
    return () => {
      alive = false;
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  useEffect(() => {
    if (job?.status === 'succeeded' && !done.current) {
      done.current = true;
      window.setTimeout(() => go(`/video/${projectId}`), 600);
    }
  }, [job?.status, projectId]);

  const retry = async () => {
    if (!job) return;
    setRetrying(true);
    try {
      const res = await requestJob(projectId, action(job.type));
      go(`/job/${projectId}/${res.job.id}${res.dispatched ? '' : '/late'}`);
    } catch (e) {
      toast(friendlyError(e));
    } finally {
      setRetrying(false);
    }
  };

  if (!job) return <div className="empty"><div className="spinner" /></div>;

  if (job.status === 'failed' || job.status === 'canceled') {
    return (
      <div className="card empty">
        <div style={{ fontSize: 44 }}>⚠️</div>
        <h2>لم يكتمل الفيديو</h2>
        <p className="muted">{job.error || 'حدث خطأ أثناء الصنع.'}</p>
        {job.type === 'full_generation' && <p className="muted small">إن لم ينجح الصنع تعود دقائقك إلى رصيدك تلقائياً.</p>}
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn primary" onClick={retry} disabled={retrying}>
            {retrying ? <span className="spinner" /> : 'أعد المحاولة'}
          </button>
          <button className="btn" onClick={() => go('/')}>
            الرئيسية
          </button>
        </div>
      </div>
    );
  }

  const stages = job.type === 'full_generation' ? FULL : ['render'];
  const current = job.stage ? stages.indexOf(job.stage) : -1;
  const pct = job.status === 'succeeded' ? 100 : Math.max(0, Math.min(100, Math.round(job.progress ?? 0)));
  const r = 66;
  const c = 2 * Math.PI * r;

  return (
    <div className="stack" style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <div className="hero center" style={{ alignItems: 'center' }}>
        <h1>{job.type === 'export' ? 'نجهّز النسخة النهائية' : 'نصنع فيديوك الآن'}</h1>
        <p className="muted">يمكنك إغلاق الصفحة، سنحفظ الفيديو في حسابك.</p>
      </div>
      <div className="progress-ring">
        <svg viewBox="0 0 150 150">
          <circle cx="75" cy="75" r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
          <circle cx="75" cy="75" r={r} fill="none" stroke="var(--brand)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
        </svg>
        <b style={{ fontSize: 30 }}>{pct}%</b>
      </div>
      <div className="card">
        {stages.map((s, i) => {
          const state = job.status === 'succeeded' || i < current ? 'done' : i === current ? 'now' : '';
          return (
            <div key={s} className={`stage ${state}`}>
              <span className="dot">{state === 'done' ? '✓' : state === 'now' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : i + 1}</span>
              <span className={state ? '' : 'muted'}>{stageLabels[s] ?? s}</span>
            </div>
          );
        })}
      </div>
      {job.status === 'queued' && (
        <p className="muted small center">
          {late ? 'الخادم يستيقظ، قد يستغرق البدء دقيقة أو دقيقتين.' : 'في الطابور، يبدأ خلال لحظات.'}
        </p>
      )}
    </div>
  );
};
