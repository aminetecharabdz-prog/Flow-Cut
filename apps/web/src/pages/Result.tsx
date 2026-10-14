import { useEffect, useState } from 'react';
import { go, useToast } from '../App';
import { currentPlan, friendlyError, requestJob, signedUrl, supabase } from '../api';
import { MoodArt } from '../components/MoodArt';
import { captionModes, moods, palettes } from '../options';

type Project = { id: string; title: string; status: string; template_id: string; caption_mode: string; palette: Record<string, string>; preview_asset_id: string | null };
type Export = { id: string; resolution: string; fps: number; has_watermark: boolean; video_asset_id: string | null; subtitles_asset_id: string | null };
type Scene = { id: string; position: number; display_text: string; keywords: string[]; spoken_text: string };
type Panel = null | 'texts' | 'look' | 'export';

export const Result = ({ projectId }: { projectId: string }) => {
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [exp, setExp] = useState<Export | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [plan, setPlan] = useState('free');
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: p, error } = await supabase.from('projects').select('id, title, status, template_id, caption_mode, palette, preview_asset_id').eq('id', projectId).maybeSingle();
      if (error || !p) {
        toast('لم نجد هذا الفيديو.');
        return go('/');
      }
      const { data: e } = await supabase.from('exports').select('id, resolution, fps, has_watermark, video_asset_id, subtitles_asset_id').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1);
      setProject(p as Project);
      setExp((e?.[0] as Export) ?? null);
      setVideo(await signedUrl(p.preview_asset_id));
      setPlan(await currentPlan().catch(() => 'free'));
    })();
  }, [projectId]);

  const start = async (action: 'rerender' | 'export', extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const res = await requestJob(projectId, action, extra);
      go(`/job/${projectId}/${res.job.id}${res.dispatched ? '' : '/late'}`);
    } catch (e) {
      toast(friendlyError(e));
      setBusy(false);
    }
  };

  const download = async (assetId: string | null | undefined, name: string) => {
    const url = await signedUrl(assetId, name);
    if (!url) return toast('الملف غير متاح بعد.');
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  };

  if (!project) return <div className="empty"><div className="spinner" /></div>;

  return (
    <div className="stack" style={{ paddingBottom: 24 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22 }}>{project.title || 'فيديوك'}</h1>
        <button className="btn ghost small" onClick={() => go('/')}>
          كل الفيديوهات
        </button>
      </div>

      {video ? <video className="player" src={video} controls autoPlay playsInline loop /> : <div className="card empty muted">لا توجد معاينة بعد.</div>}

      {exp && (
        <div className="card row" style={{ justifyContent: 'space-between' }}>
          <span>
            ✓ النسخة النهائية · {exp.resolution} · {exp.fps}fps{exp.has_watermark ? ' · بعلامة مائية' : ''}
          </span>
          {exp.subtitles_asset_id && (
            <button className="btn small" onClick={() => download(exp.subtitles_asset_id, 'motioncut.srt')}>
              ملف الترجمة
            </button>
          )}
        </div>
      )}

      <button className="btn primary big block" onClick={() => download(exp?.video_asset_id ?? project.preview_asset_id, 'motioncut.mp4')}>
        ⬇ تحميل {exp ? 'النسخة النهائية' : 'الفيديو'}
      </button>

      <div className="row">
        <button className="btn grow" aria-pressed={panel === 'texts'} onClick={() => setPanel(panel === 'texts' ? null : 'texts')}>
          ✎ النصوص
        </button>
        <button className="btn grow" aria-pressed={panel === 'look'} onClick={() => setPanel(panel === 'look' ? null : 'look')}>
          ◐ الشكل
        </button>
        <button className="btn grow" aria-pressed={panel === 'export'} onClick={() => setPanel(panel === 'export' ? null : 'export')}>
          ⇪ الجودة
        </button>
      </div>

      {panel === 'texts' && <TextsPanel projectId={projectId} busy={busy} onApply={() => start('rerender')} />}
      {panel === 'look' && (
        <LookPanel
          project={project}
          busy={busy}
          onApply={async (patch) => {
            const { error } = await supabase.from('projects').update(patch).eq('id', projectId);
            if (error) return toast(error.message);
            start('rerender');
          }}
        />
      )}
      {panel === 'export' && <ExportPanel plan={plan} busy={busy} onApply={(o) => start('export', o)} />}
    </div>
  );
};

const TextsPanel = ({ projectId, busy, onApply }: { projectId: string; busy: boolean; onApply: () => void }) => {
  const toast = useToast();
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from('scenes')
      .select('id, position, display_text, keywords, spoken_text')
      .eq('project_id', projectId)
      .order('position')
      .then(({ data }) => setScenes((data as Scene[]) ?? []));
  }, [projectId]);

  const edit = (id: string, patch: Partial<Scene>) => {
    setScenes((s) => s!.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setDirty((d) => new Set(d).add(id));
  };

  const save = async () => {
    for (const s of scenes!.filter((x) => dirty.has(x.id))) {
      const { error } = await supabase.from('scenes').update({ display_text: s.display_text.trim() || s.spoken_text, keywords: s.keywords }).eq('id', s.id);
      if (error) return toast(error.message);
    }
    onApply();
  };

  if (!scenes) return <div className="card empty"><div className="spinner" /></div>;
  return (
    <div className="card">
      <div className="section-title">
        <h3>نصوص المشاهد</h3>
        <span className="muted small">صحّح أي كلمة، والكلمات المميزة تظهر بلونك الأساسي.</span>
      </div>
      {scenes.map((s, i) => (
        <div key={s.id} className="list-item">
          <span className="num">{i + 1}</span>
          <div className="stack grow" style={{ gap: 6 }}>
            <input className="input" value={s.display_text} onChange={(e) => edit(s.id, { display_text: e.target.value })} />
            <input
              className="input small"
              placeholder="كلمات مميزة، افصل بينها بفاصلة"
              value={s.keywords.join('، ')}
              onChange={(e) => edit(s.id, { keywords: e.target.value.split(/[,،]/).map((k) => k.trim()).filter(Boolean) })}
            />
            <span className="muted small">🎙 {s.spoken_text}</span>
          </div>
        </div>
      ))}
      <button className="btn primary block" disabled={busy || dirty.size === 0} onClick={save}>
        احفظ وحدّث الفيديو
      </button>
    </div>
  );
};

const LookPanel = ({ project, busy, onApply }: { project: Project; busy: boolean; onApply: (patch: Record<string, unknown>) => void }) => {
  const [mood, setMood] = useState(project.template_id);
  const [caption, setCaption] = useState(project.caption_mode);
  const m = moods.find((x) => x.id === mood) ?? moods[0];
  const [primary, setPrimary] = useState(project.palette?.primary ?? m.a);
  const [secondary, setSecondary] = useState(project.palette?.secondary ?? m.b);

  return (
    <div className="card stack">
      <h3>الإحساس</h3>
      <div className="moods">
        {moods.map((x) => (
          <button key={x.id} type="button" className="mood" aria-pressed={mood === x.id} onClick={() => setMood(x.id)}>
            <MoodArt mood={x} primary={mood === x.id ? primary : x.a} secondary={mood === x.id ? secondary : x.b} />
            <div className="meta">
              <b>{x.label}</b>
              <span>{x.hint}</span>
            </div>
          </button>
        ))}
      </div>
      <h3>الألوان</h3>
      <div className="swatches">
        {palettes.map(([a, b]) => (
          <button key={a + b} type="button" className="swatch" aria-pressed={primary === a && secondary === b} onClick={() => (setPrimary(a), setSecondary(b))} aria-label={`${a} ${b}`}>
            <i style={{ background: a }} />
            <i style={{ background: b }} />
          </button>
        ))}
        <input className="color-input" type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} aria-label="اللون الأساسي" />
        <input className="color-input" type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} aria-label="اللون الثاني" />
      </div>
      <h3>الكتابة على الشاشة</h3>
      <div className="chips">
        {captionModes.map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={caption === c.id} onClick={() => setCaption(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <button className="btn primary block" disabled={busy} onClick={() => onApply({ template_id: mood, caption_mode: caption, palette: { primary, secondary } })}>
        طبّق وحدّث الفيديو
      </button>
    </div>
  );
};

const ExportPanel = ({ plan, busy, onApply }: { plan: string; busy: boolean; onApply: (o: Record<string, unknown>) => void }) => {
  const [resolution, setResolution] = useState(plan === 'free' ? '720p' : '1080p');
  const [fps, setFps] = useState(30);
  const [subs, setSubs] = useState(false);
  const allowed = (r: string) => r === '720p' || (r === '1080p' && plan !== 'free') || (r === '4k' && plan === 'business');

  return (
    <div className="card stack">
      <h3>النسخة النهائية</h3>
      <div className="chips">
        {['720p', '1080p', '4k'].map((r) => (
          <button key={r} type="button" className="chip" aria-pressed={resolution === r} disabled={!allowed(r)} onClick={() => setResolution(r)}>
            {r.toUpperCase()} {!allowed(r) && '🔒'}
          </button>
        ))}
      </div>
      <div className="chips">
        {[30, 60].map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={fps === f} onClick={() => setFps(f)}>
            {f} fps
          </button>
        ))}
      </div>
      <label className="row">
        <input type="checkbox" checked={subs} onChange={(e) => setSubs(e.target.checked)} />
        ملف ترجمة SRT منفصل
      </label>
      {plan === 'free' && <p className="muted small">الخطة المجانية: 720p مع علامة مائية صغيرة.</p>}
      <button className="btn primary block" disabled={busy} onClick={() => onApply({ resolution, fps, include_subtitles: subs })}>
        جهّز النسخة النهائية
      </button>
    </div>
  );
};
