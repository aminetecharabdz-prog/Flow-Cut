import { useState } from 'react';
import { go, useToast } from '../App';
import { friendlyError, isVideo, requestJob, supabase, uploadAsset } from '../api';
import { Recorder, type Voice } from '../components/Recorder';
import { MoodArt } from '../components/MoodArt';
import { captionModes, formats, goals, languages, moods, paces, palettes, videoTypes, type Opt } from '../options';

const STEPS = ['صوتك', 'فكرتك', 'لمستك'];

const Chips = ({ options, value, onChange }: { options: Opt[]; value: string; onChange: (v: string) => void }) => (
  <div className="chips">
    {options.map((o) => (
      <button key={o.id} type="button" className="chip" aria-pressed={value === o.id} onClick={() => onChange(o.id)} title={o.hint}>
        {o.label}
      </button>
    ))}
  </div>
);

const Choices = ({ options, value, onChange }: { options: Opt[]; value: string; onChange: (v: string) => void }) => (
  <div className="choices">
    {options.map((o) => (
      <button key={o.id} type="button" className="choice" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
        {o.emoji && <span className="emoji">{o.emoji}</span>}
        <span className="t">{o.label}</span>
        {o.hint && <span className="d">{o.hint}</span>}
      </button>
    ))}
  </div>
);

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="card">
    <div className="section-title">
      <h3>{title}</h3>
      {hint && <span className="muted small">{hint}</span>}
    </div>
    {children}
  </section>
);

const Field = ({ label, value, onChange, placeholder, ltr, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; ltr?: boolean; type?: string }) => (
  <div className="field">
    <label>{label}</label>
    <input className={`input ${ltr ? 'ltr' : ''}`} type={type ?? 'text'} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const Files = ({ files, onChange, accept, max, label }: { files: File[]; onChange: (f: File[]) => void; accept: string; max: number; label: string }) => (
  <div className="stack">
    {files.length > 0 && (
      <div className="thumb-strip">
        {files.map((f, i) => (
          <div key={i} className="thumb" style={{ position: 'relative' }}>
            {isVideo(f) ? <video src={URL.createObjectURL(f)} muted /> : f.type.startsWith('image/') ? <img src={URL.createObjectURL(f)} alt="" /> : <span className="small">{f.name}</span>}
            <button type="button" className="btn small" style={{ position: 'absolute', top: 4, insetInlineEnd: 4, padding: '2px 8px' }} onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label="إزالة">
              ✕
            </button>
          </div>
        ))}
      </div>
    )}
    {files.length < max && (
      <label className="btn block">
        {label}
        <input
          type="file"
          hidden
          multiple={max > 1}
          accept={accept}
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []).filter((f) => f.size <= 50 * 1024 * 1024);
            onChange([...files, ...picked].slice(0, max));
            e.target.value = '';
          }}
        />
      </label>
    )}
  </div>
);

const clean = (o: Record<string, string>) => {
  const out = Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  return Object.keys(out).length ? out : null;
};

export const Create = () => {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  // 1 · voice
  const [voice, setVoice] = useState<Voice | null>(null);
  const [lang, setLang] = useState('auto');
  // 2 · idea
  const [goal, setGoal] = useState('content_marketing');
  const [videoType, setVideoType] = useState('motion_graphics');
  const [title, setTitle] = useState('');
  const [business, setBusiness] = useState('');
  const [idea, setIdea] = useState('');
  const [product, setProduct] = useState({ name: '', price: '', oldPrice: '', offer: '' });
  const [productImages, setProductImages] = useState<File[]>([]);
  const [media, setMedia] = useState<File[]>([]);
  // 3 · touch
  const [mood, setMood] = useState('vivid');
  const [colors, setColors] = useState<{ primary: string; secondary: string } | null>(null);
  const [logo, setLogo] = useState<File[]>([]);
  const [caption, setCaption] = useState('word_box');
  const [pace, setPace] = useState('medium');
  const [format, setFormat] = useState('9:16');
  const [sfx, setSfx] = useState(true);
  const [music, setMusic] = useState<File[]>([]);
  const [ending, setEnding] = useState({ handle: '', phone: '', website: '', buttonText: '' });

  const moodDef = moods.find((m) => m.id === mood)!;
  const primary = colors?.primary ?? moodDef.a;
  const secondary = colors?.secondary ?? moodDef.b;

  const next = () => {
    if (step === 0 && !voice) return toast('سجّل صوتك أو ارفع ملفاً أولاً.');
    if (step === 1 && goal === 'product_ad' && !product.name.trim()) return toast('اكتب اسم المنتج.');
    if (step === 1 && videoType === 'media_montage' && media.length === 0) return toast('أضف صورة أو مقطعاً واحداً على الأقل.');
    if (step < 2) return setStep(step + 1);
    generate();
  };

  const generate = async () => {
    if (!voice) return;
    try {
      setBusy('نجهّز مشروعك…');
      const script = lang === 'auto' || lang.startsWith('ar') ? 'arabic' : 'latin';
      const { data, error } = await supabase
        .from('projects')
        .insert({
          title: title.trim() || business.trim() || product.name.trim() || 'فيديو جديد',
          business_name: business.trim() || null,
          goal,
          video_type: videoType,
          idea: idea.trim() || null,
          audio_language: lang === 'auto' ? null : lang,
          caption_script: script,
          template_id: mood,
          palette: colors ?? {},
          pace,
          caption_mode: caption,
          aspect_ratio: format,
          sfx,
          music_mode: music.length ? 'music' : 'none',
          product: goal === 'product_ad' ? clean(product) : null,
          end_card: clean(ending),
        })
        .select('id')
        .single();
      if (error) throw error;
      const pid = data.id as string;

      setBusy('نرفع صوتك…');
      const audioId = await uploadAsset({
        projectId: pid,
        file: voice.file,
        bucket: 'audio',
        kind: isVideo(voice.file) ? 'source_video' : 'source_audio',
        name: 'source',
        durationMs: voice.durationMs,
      });
      const upd = await supabase.from('projects').update({ source_audio_id: audioId }).eq('id', pid);
      if (upd.error) throw upd.error;

      if (logo[0]) {
        setBusy('نرفع الشعار…');
        await uploadAsset({ projectId: pid, file: logo[0], bucket: 'brand', kind: 'logo', name: 'logo' });
      }
      if (goal === 'product_ad') {
        for (const [i, f] of productImages.entries()) {
          setBusy(`نرفع صور المنتج ${i + 1}/${productImages.length}…`);
          await uploadAsset({ projectId: pid, file: f, bucket: 'product-images', kind: 'product_image', name: `product_${i}` });
        }
      }
      if (videoType === 'media_montage') {
        for (const [i, f] of media.entries()) {
          setBusy(`نرفع صورك ومقاطعك ${i + 1}/${media.length}…`);
          await uploadAsset({ projectId: pid, file: f, bucket: 'product-images', kind: isVideo(f) ? 'media_video' : 'media_image', name: `media_${i}` });
        }
      }
      if (music[0]) {
        setBusy('نرفع الموسيقى…');
        await uploadAsset({ projectId: pid, file: music[0], bucket: 'audio', kind: 'music', name: 'music' });
      }

      setBusy('ننطلق…');
      const res = await requestJob(pid, 'generate');
      go(`/job/${pid}/${res.job.id}${res.dispatched ? '' : '/late'}`);
    } catch (e) {
      toast(friendlyError(e));
      setBusy(null);
    }
  };

  return (
    <div className="stack" style={{ paddingBottom: 96 }}>
      <div>
        <div className="steps">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        <span className="muted small">
          الخطوة {step + 1} من 3 · {STEPS[step]}
        </span>
      </div>

      {step === 0 && (
        <>
          <h1>قل ما عندك</h1>
          <p className="muted">صوتك هو أساس الفيديو: كل مشهد يتحرك على إيقاع كلامك.</p>
          <Recorder value={voice} onChange={setVoice} />
          <Section title="لغة الكلام" hint="اتركها تلقائية إن لم تكن متأكداً">
            <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
              {languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </Section>
        </>
      )}

      {step === 1 && (
        <>
          <h1>ما الهدف من الفيديو؟</h1>
          <Choices options={goals} value={goal} onChange={setGoal} />
          <Section title="شكل الفيديو">
            <Choices options={videoTypes} value={videoType} onChange={setVideoType} />
          </Section>
          {goal === 'product_ad' && (
            <Section title="منتجك" hint="نبني المشاهد حول المنتج: صورته، سعره، وعرضك">
              <div className="stack">
                <Field label="اسم المنتج" value={product.name} onChange={(v) => setProduct({ ...product, name: v })} />
                <div className="row">
                  <div className="grow"><Field label="السعر" value={product.price} onChange={(v) => setProduct({ ...product, price: v })} placeholder="2900 دج" /></div>
                  <div className="grow"><Field label="السعر قبل التخفيض" value={product.oldPrice} onChange={(v) => setProduct({ ...product, oldPrice: v })} /></div>
                </div>
                <Field label="العرض" value={product.offer} onChange={(v) => setProduct({ ...product, offer: v })} placeholder="التوصيل مجاني لكل الولايات" />
                <Files files={productImages} onChange={setProductImages} accept="image/*,video/*" max={5} label="＋ صور المنتج (حتى 5)" />
              </div>
            </Section>
          )}
          {videoType === 'media_montage' && (
            <Section title="صورك ومقاطعك" hint="نرتّبها على كلامك ونضيف فوقها النصوص">
              <Files files={media} onChange={setMedia} accept="image/*,video/*" max={12} label="＋ أضف صوراً أو مقاطع" />
            </Section>
          )}
          <Section title="تفاصيل تساعدنا" hint="اختياري، لكنها تجعل العناوين أدق">
            <div className="stack">
              <Field label="عنوان الفيديو" value={title} onChange={setTitle} />
              <Field label="اسم نشاطك أو علامتك" value={business} onChange={setBusiness} />
              <div className="field">
                <label>الفكرة في جملتين</label>
                <textarea className="input" rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="لمن الفيديو، وما الذي تريد أن يتذكره المشاهد؟" />
              </div>
            </div>
          </Section>
        </>
      )}

      {step === 2 && (
        <>
          <h1>اختر الإحساس</h1>
          <div className="moods">
            {moods.map((m) => (
              <button key={m.id} type="button" className="mood" aria-pressed={mood === m.id} onClick={() => (setMood(m.id), setColors(null))}>
                <MoodArt mood={m} primary={mood === m.id ? primary : m.a} secondary={mood === m.id ? secondary : m.b} />
                <div className="meta">
                  <b>{m.label}</b>
                  <span>{m.hint}</span>
                </div>
              </button>
            ))}
          </div>

          <Section title="ألوانك" hint="اختر زوجاً جاهزاً أو ألوان علامتك بالضبط">
            <div className="stack">
              <div className="swatches">
                {palettes.map(([a, b]) => (
                  <button key={a + b} type="button" className="swatch" aria-pressed={primary === a && secondary === b} onClick={() => setColors({ primary: a, secondary: b })} aria-label={`${a} ${b}`}>
                    <i style={{ background: a }} />
                    <i style={{ background: b }} />
                  </button>
                ))}
              </div>
              <div className="row">
                <label className="row small">
                  <input className="color-input" type="color" value={primary} onChange={(e) => setColors({ primary: e.target.value, secondary })} />
                  اللون الأساسي
                </label>
                <label className="row small">
                  <input className="color-input" type="color" value={secondary} onChange={(e) => setColors({ primary, secondary: e.target.value })} />
                  اللون الثاني
                </label>
                {colors && (
                  <button type="button" className="btn ghost small" onClick={() => setColors(null)}>
                    ألوان الإحساس الأصلية
                  </button>
                )}
              </div>
              <Files files={logo} onChange={setLogo} accept="image/png,image/jpeg,image/webp,image/svg+xml" max={1} label="＋ شعارك (اختياري)" />
            </div>
          </Section>

          <Section title="الكتابة على الشاشة">
            <Chips options={captionModes} value={caption} onChange={setCaption} />
          </Section>
          <Section title="الإيقاع">
            <Chips options={paces} value={pace} onChange={setPace} />
          </Section>
          <Section title="المقاس">
            <Chips options={formats} value={format} onChange={setFormat} />
          </Section>
          <Section title="الصوت">
            <div className="stack">
              <label className="row">
                <input type="checkbox" checked={sfx} onChange={(e) => setSfx(e.target.checked)} />
                مؤثرات صوتية خفيفة مع الحركة
              </label>
              <Files files={music} onChange={setMusic} accept="audio/*" max={1} label="＋ موسيقى خلفية (اختياري)" />
            </div>
          </Section>
          <Section title="خاتمة الفيديو" hint="كيف يصل إليك المشاهد؟ اترك الحقول فارغة لتخطيها">
            <div className="stack">
              <Field label="حسابك" value={ending.handle} onChange={(v) => setEnding({ ...ending, handle: v })} placeholder="@yourbrand" ltr />
              <Field label="الهاتف" value={ending.phone} onChange={(v) => setEnding({ ...ending, phone: v })} ltr type="tel" />
              <Field label="الموقع" value={ending.website} onChange={(v) => setEnding({ ...ending, website: v })} ltr />
              <Field label="الجملة الأخيرة" value={ending.buttonText} onChange={(v) => setEnding({ ...ending, buttonText: v })} placeholder="اطلب الآن" />
            </div>
          </Section>
        </>
      )}

      <div className="bottom-bar">
        <div className="inner">
          <button className="btn" onClick={() => (step === 0 ? go('/') : setStep(step - 1))} disabled={!!busy}>
            {step === 0 ? 'إلغاء' : 'رجوع'}
          </button>
          <button className="btn primary grow" onClick={next} disabled={!!busy}>
            {busy ? (
              <>
                <span className="spinner" /> {busy}
              </>
            ) : step < 2 ? (
              'التالي'
            ) : (
              'اصنع الفيديو ✦'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
