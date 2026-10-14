import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './api';
import { Auth } from './pages/Auth';
import { Create } from './pages/Create';
import { Home } from './pages/Home';
import { Progress } from './pages/Progress';
import { Result } from './pages/Result';

export const APP_VERSION = '2.0.0';

/** Tiny hash router: #/, #/new, #/video/:id, #/job/:projectId/:jobId */
const useRoute = () => {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash || '#/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash.replace(/^#/, '').split('/').filter(Boolean);
};

export const go = (path: string) => {
  window.location.hash = path;
};

const ToastContext = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export const App = () => {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const route = useRoute();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const show = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 4500);
  }, []);

  let page: JSX.Element;
  if (session === undefined) page = <div className="empty"><div className="spinner" /></div>;
  else if (!session) page = <Auth />;
  else if (route[0] === 'new') page = <Create />;
  else if (route[0] === 'video' && route[1]) page = <Result key={route[1]} projectId={route[1]} />;
  else if (route[0] === 'job' && route[1] && route[2]) page = <Progress key={route[2]} projectId={route[1]} jobId={route[2]} late={route[3] === 'late'} />;
  else page = <Home />;

  return (
    <ToastContext.Provider value={show}>
      <header className="topbar">
        <a className="logo" href="#/">
          <span className="logo-mark" aria-hidden />
          MotionCut
        </a>
        {session && (
          <button className="btn ghost small" onClick={() => supabase.auth.signOut()}>
            خروج
          </button>
        )}
      </header>
      <main className="shell">{page}</main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </ToastContext.Provider>
  );
};
