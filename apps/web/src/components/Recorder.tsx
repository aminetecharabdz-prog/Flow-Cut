import { useEffect, useRef, useState } from 'react';
import { useToast } from '../App';
import { isVideo, mediaDurationMs, mmss } from '../api';

export type Voice = { file: File; durationMs: number; recorded: boolean };

const MAX_MS = 180_000;
const MIN_MS = 5_000;

/** Record from the microphone (with a live level meter) or pick an audio/video file. */
export const Recorder = ({ value, onChange }: { value: Voice | null; onChange: (v: Voice | null) => void }) => {
  const toast = useToast();
  const [live, setLive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array(24).fill(4));
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const raf = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = value ? URL.createObjectURL(value.file) : null;

  useEffect(() => () => stop(true), []);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const start = async () => {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      toast('اسمح للمتصفح باستعمال الميكروفون ثم أعد المحاولة.');
      return;
    }
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
    const r = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const ms = Date.now() - started.current;
      const mime = r.mimeType || 'audio/webm';
      const ext = mime.includes('mp4') ? 'm4a' : 'webm';
      if (ms < MIN_MS) return toast('التسجيل قصير، 5 ثوانٍ على الأقل.');
      onChange({ file: new File(chunks.current, `voice.${ext}`, { type: mime.split(';')[0] }), durationMs: ms, recorded: true });
    };
    r.start(250);
    rec.current = r;
    started.current = Date.now();
    setLive(true);
    onChange(null);

    // Level meter + timer.
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    ctx.createMediaStreamSource(stream.current).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      setLevels(Array.from({ length: 24 }, (_, i) => 4 + (data[i] / 255) * 36));
      const ms = Date.now() - started.current;
      setElapsed(ms);
      if (ms >= MAX_MS) return stop();
      raf.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const stop = (silent = false) => {
    cancelAnimationFrame(raf.current);
    if (rec.current && rec.current.state !== 'inactive') {
      if (silent) rec.current.onstop = null;
      rec.current.stop();
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    rec.current = null;
    setLive(false);
  };

  const pick = async (file?: File) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return toast('الملف أكبر من 50 ميغا.');
    try {
      const ms = await mediaDurationMs(file);
      if (ms < MIN_MS || ms > MAX_MS) return toast('مدة الصوت يجب أن تكون بين 5 ثوانٍ و3 دقائق.');
      onChange({ file, durationMs: ms, recorded: false });
    } catch {
      toast('تعذّر قراءة هذا الملف. جرّب MP3 أو M4A أو MP4.');
    }
  };

  return (
    <div className="card">
      <div className="recorder">
        <button className={`rec-btn ${live ? 'live' : ''}`} onClick={() => (live ? stop() : start())} aria-label={live ? 'إيقاف التسجيل' : 'ابدأ التسجيل'}>
          {live ? (
            <svg width="30" height="30" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
          ) : (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" /></svg>
          )}
        </button>
        {live ? (
          <>
            <div className="timer">{mmss(elapsed / 1000)} / 3:00</div>
            <div className="bars" aria-hidden>
              {levels.map((h, i) => (
                <i key={i} style={{ height: h }} />
              ))}
            </div>
            <span className="muted small">اضغط مرة أخرى للإنهاء</span>
          </>
        ) : value ? (
          <div className="stack" style={{ width: '100%', alignItems: 'center' }}>
            <span className="badge ok">✓ {value.recorded ? 'تسجيلك جاهز' : value.file.name} · {mmss(value.durationMs / 1000)}</span>
            {preview && (isVideo(value.file) ? <video src={preview} controls style={{ width: '100%', maxHeight: 260, borderRadius: 12 }} /> : <audio src={preview} controls style={{ width: '100%' }} />)}
            <span className="muted small">اضغط الميكروفون لإعادة التسجيل</span>
          </div>
        ) : (
          <>
            <b>اضغط وتكلّم</b>
            <span className="muted small center">من 5 ثوانٍ إلى 3 دقائق. تكلّم بشكل طبيعي، ونحن نقصّ الصمت ونرفع جودة الصوت.</span>
          </>
        )}
      </div>
      {!live && (
        <>
          <button className="btn block" onClick={() => fileInput.current?.click()}>
            أو ارفع ملفاً صوتياً / فيديو
          </button>
          <input ref={fileInput} type="file" hidden accept="audio/*,video/*,.m4a,.mp3,.wav,.mp4,.mov" onChange={(e) => pick(e.target.files?.[0])} />
        </>
      )}
    </div>
  );
};
