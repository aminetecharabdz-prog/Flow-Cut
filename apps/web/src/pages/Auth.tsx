import { useState } from 'react';
import { APP_VERSION, useToast } from '../App';
import { supabase } from '../api';

export const Auth = () => {
  const toast = useToast();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const redirect = window.location.origin + window.location.pathname;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        if (!data.session) toast('أرسلنا لك رسالة تأكيد على بريدك. افتحها ثم ارجع هنا.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      toast(m === 'Invalid login credentials' ? 'البريد أو كلمة المرور غير صحيحة.' : m);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) return toast('اكتب بريدك أولاً.');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect });
    toast(error ? error.message : 'أرسلنا لك رابطاً لتغيير كلمة المرور.');
  };

  return (
    <div className="stack" style={{ maxWidth: 440, margin: '0 auto' }}>
      <div className="hero">
        <span className="tag">مونتاج تلقائي بالذكاء الاصطناعي</span>
        <h1>صوتك يصير فيديو موشن في دقائق</h1>
        <p className="muted">سجّل كلامك أو ارفعه، واختر الإحساس الذي تريده. نكتب كلامك، نصمم المشاهد، ونحرّكها مع صوتك.</p>
      </div>
      <form className="card stack" onSubmit={submit}>
        <h2>{mode === 'in' ? 'تسجيل الدخول' : 'حساب جديد'}</h2>
        <div className="field">
          <label htmlFor="email">البريد الإلكتروني</label>
          <input id="email" className="input ltr" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw">كلمة المرور</label>
          <input id="pw" className="input ltr" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn primary big block" disabled={busy}>
          {busy ? <span className="spinner" /> : mode === 'in' ? 'دخول' : 'إنشاء الحساب'}
        </button>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn ghost small" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? 'ليس لديك حساب؟ أنشئه' : 'لديك حساب؟ ادخل'}
          </button>
          {mode === 'in' && (
            <button type="button" className="btn ghost small" onClick={reset}>
              نسيت كلمة المرور
            </button>
          )}
        </div>
      </form>
      <p className="muted small center">الإصدار {APP_VERSION} · 3 دقائق مجانية عند التسجيل</p>
    </div>
  );
};
