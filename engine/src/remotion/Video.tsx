import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { Scene, VideoPlan } from '../plan/schema';
import { Captions } from './components/Captions';
import { LAYOUTS } from './components/Layouts';
import { Backdrop } from './components/Visuals';
import { SceneProvider, ThemeProvider, useTheme } from './context';
import { loadFonts } from './fonts';
import { scenePalette } from './surfaces';
import { clamp } from './util';

const msToFrame = (ms: number, fps: number) => Math.round((ms / 1000) * fps);

const ENTER = 10;
const EXIT = 6;

const SceneShell: React.FC<{ scene: Scene; index: number; frames: number; children: React.ReactNode }> = ({
  scene,
  index,
  frames,
  children,
}) => {
  const frame = useCurrentFrame();
  const { style, u, plan } = useTheme();
  const transition = style.transitions[Math.floor(random(`tr${scene.id}${plan.seed}`) * style.transitions.length)];
  const dir = (index % 2 === 0 ? 1 : -1) * (plan.direction === 'rtl' ? -1 : 1);
  const e = index === 0 ? 1 : clamp(frame / ENTER);
  const easeIn = 1 - (1 - e) ** 3;
  const x = clamp((frame - (frames - EXIT)) / EXIT);
  const easeOut = x ** 2;
  const drift = 1 + 0.03 * (frame / Math.max(1, frames));

  let transform = `scale(${drift})`;
  let opacity = 1;
  let clipPath: string | undefined;
  let filter: string | undefined;
  switch (transition) {
    case 'push':
      transform += ` translateX(${((1 - easeIn) * 320 * dir - easeOut * 320 * dir) * u}px)`;
      opacity = Math.min(easeIn * 1.4, 1 - easeOut);
      break;
    case 'zoom':
      transform += ` scale(${1.25 - 0.25 * easeIn - 0.12 * easeOut})`;
      opacity = Math.min(easeIn, 1 - easeOut);
      filter = `blur(${((1 - easeIn) + easeOut) * 12 * u}px)`;
      break;
    case 'wipe':
      clipPath = dir > 0 ? `inset(0 ${(1 - easeIn) * 100}% 0 0)` : `inset(0 0 0 ${(1 - easeIn) * 100}%)`;
      opacity = 1 - easeOut;
      break;
    case 'fade':
      opacity = Math.min(easeIn, 1 - easeOut);
      break;
    case 'glitch': {
      const g = frame < 6 ? (random(`g${frame}${scene.id}`) - 0.5) * 40 * u : 0;
      transform += ` translateX(${g}px)`;
      opacity = Math.min(clamp(frame / 3), 1 - easeOut);
      filter = frame < 6 ? `hue-rotate(${g * 4}deg) saturate(1.6)` : undefined;
      break;
    }
    case 'slide':
      transform += ` translateY(${((1 - easeIn) * 160 - easeOut * 120) * u}px)`;
      opacity = Math.min(easeIn * 1.3, 1 - easeOut);
      break;
  }
  return <AbsoluteFill style={{ transform, opacity, clipPath, filter }}>{children}</AbsoluteFill>;
};

/** Scene background colour, revealed with a growing circle or a diagonal wipe. */
const SceneSurface: React.FC<{ scene: Scene; index: number; color: string | null }> = ({ scene, index, color }) => {
  const frame = useCurrentFrame();
  const { u } = useTheme();
  if (!color) return null;
  const p = index === 0 ? 1 : 1 - (1 - clamp(frame / 13)) ** 3;
  const kind = random(`surf${scene.id}`);
  const ox = random(`ox${scene.id}`) > 0.5 ? 100 : 0;
  const oy = random(`oy${scene.id}`) > 0.5 ? 100 : 0;
  const clipPath =
    kind < 0.6 ? `circle(${p * 150}% at ${ox}% ${oy}%)` : `polygon(0 0, ${p * 220}% 0, ${p * 220 - 120}% 100%, 0 100%)`;
  return (
    <AbsoluteFill style={{ clipPath, background: color }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.10) ${2.4 * u}px, transparent ${2.6 * u}px)`,
          backgroundSize: `${46 * u}px ${46 * u}px`,
          opacity: 0.8,
        }}
      />
    </AbsoluteFill>
  );
};

type Rect = { top: number; height: number; opacity: number; radius: number };

/** Talking-head clip that moves between full-frame, top-half and hidden. */
const SpeakerLayer: React.FC<{ hasVoice: boolean }> = ({ hasVoice }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { plan, width, height } = useTheme();
  const speaker = plan.speaker!;
  const rectFor = (s?: Scene): Rect => {
    if (!s || s.layout === 'speaker') return { top: 0, height, opacity: 1, radius: 0 };
    if (s.layout === 'speaker_split') return { top: 0, height: height * 0.5, opacity: 1, radius: 0 };
    return { top: 0, height, opacity: 0, radius: 0 };
  };
  const ms = (frame / fps) * 1000;
  const idx = plan.scenes.findIndex((s) => ms >= s.startMs && ms < s.endMs);
  const cur = rectFor(plan.scenes[idx]);
  const prev = rectFor(plan.scenes[idx - 1] ?? plan.scenes[idx]);
  const t = idx < 0 ? 1 : clamp((frame - msToFrame(plan.scenes[idx].startMs, fps)) / 9);
  const k = 1 - (1 - t) ** 3;
  const lerp = (a: number, b: number) => a + (b - a) * k;
  return (
    <AbsoluteFill
      style={{
        top: lerp(prev.top, cur.top),
        height: lerp(prev.height, cur.height),
        opacity: lerp(prev.opacity, cur.opacity),
        overflow: 'hidden',
      }}
    >
      <OffthreadVideo
        src={speaker.url}
        muted={hasVoice}
        startFrom={msToFrame(speaker.startFromMs, fps)}
        style={{ width, height: '100%', objectFit: 'cover', transform: `scale(${1.02 + 0.02 * Math.sin(frame / 90)})` }}
      />
    </AbsoluteFill>
  );
};

const Soundtrack: React.FC = () => {
  const { plan } = useTheme();
  const { fps, durationInFrames } = useVideoConfig();
  // Duck music while someone is speaking.
  const speaking = useMemo(() => {
    const arr = new Float32Array(durationInFrames);
    plan.words.forEach((w) => {
      for (let f = msToFrame(w.startMs - 120, fps); f <= msToFrame(w.endMs + 200, fps); f++) if (f >= 0 && f < arr.length) arr[f] = 1;
    });
    // Smooth over ~0.3s.
    const out = new Float32Array(durationInFrames);
    const win = Math.round(fps * 0.3);
    for (let f = 0; f < arr.length; f++) {
      let s = 0;
      let n = 0;
      for (let k = -win; k <= win; k++) {
        const v = arr[f + k];
        if (v !== undefined) {
          s += v;
          n++;
        }
      }
      out[f] = s / n;
    }
    return out;
  }, [plan.words, fps, durationInFrames]);

  return (
    <>
      {plan.voice && <Audio src={plan.voice.url} volume={plan.voice.volume} />}
      {plan.music && (
        <Audio
          src={plan.music.url}
          loop
          volume={(f) => {
            const base = plan.music!.volume;
            const duck = 1 - 0.65 * (speaking[f] ?? 0);
            const fadeOut = interpolate(f, [durationInFrames - fps, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });
            const fadeIn = clamp(f / (fps * 0.5));
            return base * duck * fadeOut * fadeIn;
          }}
        />
      )}
      {plan.sfx &&
        plan.scenes.map((s, i) =>
          i === 0 ? null : (
            <Sequence key={s.id} from={Math.max(0, msToFrame(s.startMs, fps) - 4)} durationInFrames={Math.round(fps * 0.6)}>
              <Audio src={staticFile('sfx/whoosh.mp3')} volume={0.32} />
            </Sequence>
          ),
        )}
      {plan.sfx &&
        plan.scenes
          .filter((s) => ['product', 'stat', 'icon_point', 'cta'].includes(s.layout))
          .map((s) => (
            <Sequence key={`pop${s.id}`} from={msToFrame(s.startMs, fps) + 12} durationInFrames={Math.round(fps * 0.4)}>
              <Audio src={staticFile('sfx/pop.mp3')} volume={0.4} />
            </Sequence>
          ))}
    </>
  );
};

const Watermarks: React.FC = () => {
  const { plan, u, heading } = useTheme();
  return (
    <>
      {plan.logoUrl && !plan.scenes.some((s) => s.layout === 'cta') && (
        <Img
          src={plan.logoUrl}
          style={{ position: 'absolute', top: 70 * u, right: 60 * u, height: 90 * u, objectFit: 'contain', opacity: 0.9 }}
        />
      )}
      {plan.watermark && (
        <div
          style={{
            position: 'absolute',
            bottom: 40 * u,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: heading,
            fontWeight: 800,
            fontSize: 30 * u,
            color: '#FFFFFF',
            opacity: 0.55,
            textShadow: '0 2px 6px rgba(0,0,0,.6)',
          }}
        >
          MotionCut
        </div>
      )}
    </>
  );
};

export const MotionVideo: React.FC<VideoPlan> = (plan) => {
  loadFonts([plan.fonts.heading, plan.fonts.body]);
  const { fps } = useVideoConfig();
  const hasVoice = Boolean(plan.voice);
  // Full-frame media scenes carry their own titles; don't stack captions on them.
  const hidden = plan.scenes.filter((s) => s.layout === 'media' && s.title).map((s) => [s.startMs, s.endMs] as [number, number]);
  return (
    <ThemeProvider plan={plan}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Backdrop />
        {plan.speaker && <SpeakerLayer hasVoice={hasVoice} />}
        {plan.scenes.map((scene, index) => {
          const from = msToFrame(scene.startMs, fps);
          const frames = Math.max(1, msToFrame(scene.endMs, fps) - from);
          const Layout = LAYOUTS[scene.layout];
          const palette = scenePalette(plan.palette, scene);
          const scenePlan = palette === plan.palette ? plan : { ...plan, palette };
          const accent = scene.accent === 'secondary' ? palette.secondary : palette.primary;
          return (
            <Sequence key={scene.id} from={from} durationInFrames={frames} name={`${index + 1}. ${scene.layout}`}>
              <ThemeProvider plan={scenePlan}>
                <SceneSurface scene={scene} index={index} color={palette === plan.palette ? null : palette.background} />
                <SceneProvider value={{ scene, index, frames, accent, frameAt: (ms) => msToFrame(ms, fps) - from }}>
                  <SceneShell scene={scene} index={index} frames={frames}>
                    <Layout />
                  </SceneShell>
                </SceneProvider>
              </ThemeProvider>
            </Sequence>
          );
        })}
        <Captions hiddenRanges={hidden} />
        <Watermarks />
        <Soundtrack />
      </AbsoluteFill>
    </ThemeProvider>
  );
};
