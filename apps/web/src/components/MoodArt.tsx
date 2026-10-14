import type { Mood } from '../options';

/** Small looping preview of each mood: a different composition per style, tinted with the chosen colours. */
export const MoodArt = ({ mood, primary, secondary }: { mood: Mood; primary: string; secondary: string }) => {
  const font = `'${mood.font}', sans-serif`;
  const text = (
    <div className="ma-text" style={{ fontFamily: font, color: mood.fg }}>
      <span>صوتك</span>
      <span className="ma-hl" style={{ background: mood.id === 'poster' || mood.id === 'vivid' ? primary : 'none', color: mood.id === 'poster' || mood.id === 'vivid' ? mood.bg : primary }}>
        يصير
      </span>
      <span>فيديو</span>
    </div>
  );

  return (
    <div className={`art ma ma-${mood.id}`} style={{ background: mood.bg }}>
      {mood.id === 'vivid' && (
        <>
          <i className="ma-blob" style={{ background: secondary }} />
          <i className="ma-ring" style={{ borderColor: primary }} />
        </>
      )}
      {mood.id === 'luxury' && <i className="ma-line" style={{ background: primary }} />}
      {mood.id === 'poster' && <i className="ma-slab" style={{ background: secondary }} />}
      {mood.id === 'clean' && (
        <>
          <i className="ma-card" />
          <i className="ma-dot" style={{ background: primary }} />
        </>
      )}
      {mood.id === 'neon' && (
        <>
          <i className="ma-grid" style={{ color: secondary }} />
          <i className="ma-glow" style={{ background: primary }} />
        </>
      )}
      {mood.id === 'editorial' && (
        <>
          <i className="ma-rule" style={{ background: mood.fg }} />
          <i className="ma-num" style={{ color: primary, fontFamily: font }}>01</i>
        </>
      )}
      {text}
    </div>
  );
};
