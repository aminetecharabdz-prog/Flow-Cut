import { useEffect, useState } from 'react';
import { go, useToast } from '../App';
import { creditSeconds, mmss, signedUrl, supabase } from '../api';
import { statusLabels } from '../options';

type Project = { id: string; title: string; status: string; preview_asset_id: string | null; updated_at: string };

const Thumb = ({ assetId }: { assetId: string | null }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    signedUrl(assetId).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [assetId]);
  return <div className="thumb">{url && <video src={`${url}#t=1.2`} muted playsInline preload="metadata" />}</div>;
};

export const Home = () => {
  const toast = useToast();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, title, status, preview_asset_id, updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (error) toast(error.message);
    // Drafts are unfinished uploads: hide them from the gallery.
    setProjects((data ?? []).filter((p) => p.status !== 'draft'));
    setCredits(await creditSeconds());
  };

  useEffect(() => {
    load();
  }, []);

  const open = async (p: Project) => {
    if (p.status === 'ready') return go(`/video/${p.id}`);
    const { data } = await supabase.from('jobs').select('id').eq('project_id', p.id).order('created_at', { ascending: false }).limit(1);
    if (data?.[0]) go(`/job/${p.id}/${data[0].id}`);
  };

  const remove = async (p: Project) => {
    if (!confirm(`حذف "${p.title}"؟`)) return;
    await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', p.id);
    load();
  };

  return (
    <div className="stack">
      <div className="hero" style={{ paddingTop: 16 }}>
        <h1>فيديوهاتك</h1>
        <p className="muted">
          الرصيد المتبقي: <b style={{ color: 'var(--ink)' }}>{credits === null ? '…' : mmss(credits)}</b> دقيقة
        </p>
      </div>

      <button className="btn primary big block" onClick={() => go('/new')}>
        ＋ فيديو جديد
      </button>

      {projects === null ? (
        <div className="empty"><div className="spinner" /></div>
      ) : projects.length === 0 ? (
        <div className="card empty">
          <div style={{ fontSize: 40 }}>🎬</div>
          <h2>أول فيديو لك على بُعد دقيقة</h2>
          <p className="muted">سجّل 15 إلى 60 ثانية عن منتجك أو فكرتك، ونحن نتكفل بالمونتاج.</p>
        </div>
      ) : (
        <div className="projects">
          {projects.map((p) => (
            <div key={p.id} className="project" onClick={() => open(p)} onContextMenu={(e) => (e.preventDefault(), remove(p))}>
              <Thumb assetId={p.preview_asset_id} />
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || 'بدون عنوان'}</b>
                <button className="btn ghost small" style={{ padding: 4 }} aria-label="حذف" onClick={(e) => (e.stopPropagation(), remove(p))}>
                  🗑
                </button>
              </div>
              <span className={`badge ${p.status === 'ready' ? 'ok' : p.status === 'failed' ? 'bad' : 'run'}`}>{statusLabels[p.status] ?? p.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
