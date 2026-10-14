import { continueRender, delayRender, staticFile } from 'remotion';
import type { FontId } from '../plan/schema';

type FontDef = { family: string; file: string; weight: string };

// All fonts are SIL OFL 1.1 and bundled in public/fonts so rendering never
// depends on network access.
export const FONTS: Record<FontId, FontDef> = {
  cairo: { family: 'MC Cairo', file: 'Cairo.ttf', weight: '200 1000' },
  tajawal: { family: 'MC Tajawal', file: 'Tajawal-ExtraBold.ttf', weight: '800' },
  lalezar: { family: 'MC Lalezar', file: 'Lalezar.ttf', weight: '400' },
  el_messiri: { family: 'MC El Messiri', file: 'ElMessiri.ttf', weight: '400 700' },
  readex_pro: { family: 'MC Readex Pro', file: 'ReadexPro.ttf', weight: '160 700' },
  alexandria: { family: 'MC Alexandria', file: 'Alexandria.ttf', weight: '100 900' },
  baloo_bhaijaan: { family: 'MC Baloo Bhaijaan', file: 'BalooBhaijaan2.ttf', weight: '400 800' },
  almarai: { family: 'MC Almarai', file: 'Almarai-ExtraBold.ttf', weight: '800' },
  changa: { family: 'MC Changa', file: 'Changa.ttf', weight: '200 800' },
  noto_kufi: { family: 'MC Noto Kufi', file: 'NotoKufiArabic.ttf', weight: '100 900' },
  rubik: { family: 'MC Rubik', file: 'Rubik.ttf', weight: '300 900' },
  aref_ruqaa: { family: 'MC Aref Ruqaa', file: 'ArefRuqaa-Bold.ttf', weight: '700' },
  amiri: { family: 'MC Amiri', file: 'Amiri-Bold.ttf', weight: '700' },
  inter: { family: 'MC Inter', file: 'Inter.ttf', weight: '100 900' },
  montserrat: { family: 'MC Montserrat', file: 'Montserrat.ttf', weight: '100 900' },
  bebas_neue: { family: 'MC Bebas Neue', file: 'BebasNeue.ttf', weight: '400' },
};

/** Fallback stack so any script (Latin, Arabic, Turkish...) always renders. */
export const fontStack = (id: FontId) => `'${FONTS[id].family}', 'MC Cairo', 'MC Noto Kufi', 'MC Inter', sans-serif`;

const loaded = new Set<FontId>();

export const loadFonts = (ids: FontId[]) => {
  const pending = [...new Set<FontId>([...ids, 'cairo', 'inter'])].filter((id) => !loaded.has(id));
  if (pending.length === 0) return;
  const handle = delayRender(`Loading fonts ${pending.join(',')}`);
  Promise.all(
    pending.map(async (id) => {
      const def = FONTS[id];
      const face = new FontFace(def.family, `url('${staticFile(`fonts/${def.file}`)}') format('truetype')`, {
        weight: def.weight,
      });
      await face.load();
      document.fonts.add(face);
      loaded.add(id);
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error('Font loading failed', err);
      continueRender(handle);
    });
};
