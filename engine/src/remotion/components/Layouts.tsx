import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { LayoutId } from '../../plan/schema';
import { useScene, useTheme } from '../context';
import { alpha, clamp, isRtlText, mix, onColor, revealTimes, splitWords } from '../util';
import { KineticText, useEnter } from './KineticText';
import { Decorations, IconBadge, IconGlyph } from './Visuals';

/** Content area that keeps clear of platform UI and captions. */
const useSafeArea = () => {
  const { width, height, vertical, plan, u } = useTheme();
  const captions = plan.captions.mode !== 'none' && plan.captions.position === 'bottom';
  const top = vertical ? height * 0.11 : height * 0.1;
  const bottom = vertical ? height * (captions ? 0.25 : 0.17) : height * (captions ? 0.22 : 0.12);
  const side = 80 * u;
  return { top, bottom, side, innerW: (width - side * 2) / u, innerH: (height - top - bottom) / u };
};

const Stack: React.FC<{ children: React.ReactNode; gap?: number; justify?: 'center' | 'space-between' }> = ({
  children,
  gap = 56,
  justify = 'center',
}) => {
  const { u } = useTheme();
  const sa = useSafeArea();
  return (
    <AbsoluteFill
      style={{
        paddingTop: sa.top,
        paddingBottom: sa.bottom,
        paddingLeft: sa.side,
        paddingRight: sa.side,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: justify,
        gap: gap * u,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Subtitle: React.FC<{ text?: string; delay?: number; color?: string }> = ({ text, delay = 10, color }) => {
  const { plan } = useTheme();
  const sa = useSafeArea();
  if (!text) return null;
  return (
    <KineticText
      text={text}
      size={56}
      maxWidth={sa.innerW * 0.92}
      font="body"
      weight={600}
      color={color ?? plan.palette.muted}
      entrance="rise"
      delay={delay}
    />
  );
};

const Hook: React.FC = () => {
  const { scene, accent } = useScene();
  const sa = useSafeArea();
  return (
    <>
      <Decorations seed={scene.id} accent={accent} />
      <Stack gap={50}>
        {scene.icon && <IconBadge icon={scene.icon} size={290} accent={accent} />}
        <KineticText
          text={scene.title ?? ''}
          size={190}
          maxWidth={sa.innerW}
          maxHeight={sa.innerH * 0.62}
          emphasis={scene.emphasis}
        />
        <Subtitle text={scene.subtitle} />
      </Stack>
    </>
  );
};

const Statement: React.FC = () => {
  const { scene, accent } = useScene();
  const { u, plan, style, dark } = useTheme();
  const sa = useSafeArea();
  const card = random(`card${scene.id}`) > 0.45;
  const enter = useEnter(0, 60);
  const content = (
    <>
      {scene.icon && <IconBadge icon={scene.icon} size={200} accent={accent} variant="soft" delay={3} />}
      <KineticText text={scene.title ?? ''} size={124} maxWidth={sa.innerW * (card ? 0.86 : 1)} emphasis={scene.emphasis} />
      <Subtitle text={scene.subtitle} />
    </>
  );
  if (!card) return <Stack gap={44}>{content}</Stack>;
  return (
    <Stack>
      <div
        style={{
          ...enter.style,
          width: '100%',
          padding: `${70 * u}px ${50 * u}px`,
          borderRadius: style.cornerRadius * u,
          background: dark ? alpha('#FFFFFF', 0.06) : plan.palette.surface,
          border: `${2 * u}px solid ${alpha(accent, 0.35)}`,
          boxShadow: `0 ${30 * u}px ${80 * u}px ${alpha('#000000', dark ? 0.4 : 0.12)}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 40 * u,
        }}
      >
        {content}
      </div>
    </Stack>
  );
};

const IconPoint: React.FC = () => {
  const { scene, accent } = useScene();
  const sa = useSafeArea();
  return (
    <>
      <Decorations seed={scene.id} accent={accent} />
      <Stack gap={60}>
        <Rings accent={accent}>
          <IconBadge icon={scene.icon} size={400} accent={accent} />
        </Rings>
        <KineticText text={scene.title ?? ''} size={116} maxWidth={sa.innerW} emphasis={scene.emphasis} />
        <Subtitle text={scene.subtitle} />
      </Stack>
    </>
  );
};

/** Expanding rings behind a focal element. */
const Rings: React.FC<{ accent: string; children: React.ReactNode }> = ({ accent, children }) => {
  const frame = useCurrentFrame();
  const { u } = useTheme();
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1, 2].map((i) => {
        const t = ((frame + i * 20) % 60) / 60;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 400 * u,
              height: 400 * u,
              borderRadius: '50%',
              border: `${4 * u}px solid ${accent}`,
              transform: `scale(${1 + t * 0.9})`,
              opacity: (1 - t) * 0.5 * clamp(frame / 10),
            }}
          />
        );
      })}
      {children}
    </div>
  );
};

/** Reveal frame for each item, synced to when its first words are spoken. */
const useItemFrames = () => {
  const { scene, frameAt } = useScene();
  const { plan, style } = useTheme();
  return useMemo(() => {
    const firstWords = scene.items.map((it) => splitWords(it.text).slice(0, 2).join(' '));
    const times = revealTimes(firstWords, plan.words, scene.startMs, scene.endMs, 900);
    // Items follow the voice, but never later than a brisk default rhythm.
    return times.map((t, i) => Math.min(Math.max(6, frameAt(t)), 10 + i * (8 + style.stagger * 2)));
  }, [scene, plan.words, frameAt, style.stagger]);
};

const List: React.FC = () => {
  const { scene, accent } = useScene();
  const { heading,  u, plan, style, dark } = useTheme();
  const sa = useSafeArea();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frames = useItemFrames();
  const rtl = plan.direction === 'rtl';
  return (
    <Stack gap={34}>
      {scene.title && <KineticText text={scene.title} size={110} maxWidth={sa.innerW} emphasis={scene.emphasis} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 * u, width: '100%' }}>
        {scene.items.map((it, i) => {
          const p = spring({ frame: frame - frames[i], fps, config: style.spring });
          const itemRtl = isRtlText(it.text) || (rtl && !/[A-Za-z]/.test(it.text));
          return (
            <div
              key={i}
              dir={itemRtl ? 'rtl' : 'ltr'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 28 * u,
                padding: `${34 * u}px ${40 * u}px`,
                borderRadius: style.cornerRadius * 0.6 * u,
                background: dark ? alpha('#FFFFFF', 0.07) : plan.palette.surface,
                boxShadow: `0 ${14 * u}px ${40 * u}px ${alpha('#000000', dark ? 0.35 : 0.08)}`,
                transform: `translateX(${(1 - p) * (itemRtl ? 1 : -1) * 160 * u}px) scale(${0.9 + 0.1 * p})`,
                opacity: clamp(p * 1.5),
              }}
            >
              <div
                style={{
                  flex: 'none',
                  width: 124 * u,
                  height: 124 * u,
                  borderRadius: style.cornerRadius > 30 ? '50%' : 18 * u,
                  background: i % 2 ? plan.palette.secondary : accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: onColor(i % 2 ? plan.palette.secondary : accent),
                  fontFamily: heading,
                  fontWeight: 900,
                  fontSize: 48 * u,
                }}
              >
                {it.icon?.body ? (
                  <IconGlyph icon={it.icon} size={72 * u} color={onColor(i % 2 ? plan.palette.secondary : accent)} />
                ) : (
                  i + 1
                )}
              </div>
              <div
                style={{
                  fontFamily: heading,
                  fontWeight: style.headingWeight,
                  fontSize: Math.min(78, 1700 / Math.max(14, it.text.length)) * u,
                  lineHeight: 1.3,
                  color: plan.palette.text,
                }}
              >
                {it.text}
              </div>
            </div>
          );
        })}
      </div>
    </Stack>
  );
};

const Steps: React.FC = () => {
  const { scene, accent } = useScene();
  const { heading,  u, plan, style } = useTheme();
  const sa = useSafeArea();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frames = useItemFrames();
  const rtl = plan.direction === 'rtl';
  const lineP = interpolate(frame, [frames[0] ?? 0, (frames[frames.length - 1] ?? 0) + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <Stack gap={50}>
      {scene.title && <KineticText text={scene.title} size={84} maxWidth={sa.innerW} emphasis={scene.emphasis} />}
      <div dir={rtl ? 'rtl' : 'ltr'} style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', gap: 46 * u }}>
        <div
          style={{
            position: 'absolute',
            top: 50 * u,
            bottom: 50 * u,
            [rtl ? 'right' : 'left']: 49 * u,
            width: 6 * u,
            background: alpha(accent, 0.25),
          }}
        >
          <div style={{ width: '100%', height: `${lineP * 100}%`, background: accent }} />
        </div>
        {scene.items.map((it, i) => {
          const p = spring({ frame: frame - frames[i], fps, config: style.spring });
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 34 * u, opacity: clamp(p * 1.5) }}>
              <div
                style={{
                  flex: 'none',
                  width: 124 * u,
                  height: 124 * u,
                  borderRadius: '50%',
                  background: accent,
                  color: onColor(accent),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: heading,
                  fontWeight: 900,
                  fontSize: 52 * u,
                  transform: `scale(${p})`,
                  boxShadow: `0 0 0 ${10 * u}px ${alpha(accent, 0.18)}`,
                }}
              >
                {it.icon?.body ? <IconGlyph icon={it.icon} size={56 * u} color={onColor(accent)} /> : i + 1}
              </div>
              <div
                style={{
                  fontFamily: heading,
                  fontWeight: style.headingWeight,
                  fontSize: Math.min(76, 1700 / Math.max(14, it.text.length)) * u,
                  color: plan.palette.text,
                  transform: `translateY(${(1 - p) * 30 * u}px)`,
                }}
              >
                {it.text}
              </div>
            </div>
          );
        })}
      </div>
    </Stack>
  );
};

const Compare: React.FC = () => {
  const { scene, accent } = useScene();
  const { heading,  u, plan, style } = useTheme();
  const sa = useSafeArea();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frames = useItemFrames();
  const [a, b] = [scene.items[0], scene.items[1]];
  const rtl = plan.direction === 'rtl';
  const lineStart = (frames[0] ?? 8) + 8;
  const lineP = interpolate(frame, [lineStart, lineStart + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const node = (it: typeof a, i: number) => {
    const p = spring({ frame: frame - (frames[i] ?? 8 + i * 20), fps, config: style.spring });
    const c = i === 0 ? plan.palette.muted : accent;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 * u, width: 440 * u }}>
        <div
          style={{
            width: 300 * u,
            height: 300 * u,
            borderRadius: '50%',
            background: i === 0 ? alpha(c, 0.16) : c,
            border: `${6 * u}px solid ${c}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${p})`,
            boxShadow: i === 1 ? `0 ${20 * u}px ${60 * u}px ${alpha(c, 0.4)}` : 'none',
          }}
        >
          <IconGlyph icon={it?.icon} size={150 * u} color={i === 0 ? c : onColor(c)} />
        </div>
        <div
          style={{
            fontFamily: heading,
            fontWeight: style.headingWeight,
            fontSize: 66 * u,
            color: i === 0 ? plan.palette.muted : plan.palette.text,
            textAlign: 'center',
            opacity: clamp(p * 1.4),
            lineHeight: 1.25,
          }}
        >
          {it?.text}
        </div>
      </div>
    );
  };
  return (
    <Stack gap={70}>
      {scene.title && <KineticText text={scene.title} size={120} maxWidth={sa.innerW} emphasis={scene.emphasis} />}
      <div dir={rtl ? 'rtl' : 'ltr'} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
        <div
          style={{
            position: 'absolute',
            top: 150 * u,
            [rtl ? 'right' : 'left']: 300 * u,
            width: `calc(100% - ${600 * u}px)`,
            height: 8 * u,
            borderRadius: 8 * u,
            background: alpha(plan.palette.muted, 0.25),
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${lineP * 100}%`,
              background: `linear-gradient(${rtl ? 270 : 90}deg, ${plan.palette.muted}, ${accent})`,
              borderRadius: 8 * u,
              marginInlineStart: 0,
              float: rtl ? 'right' : 'left',
            }}
          />
        </div>
        {node(a, 0)}
        {node(b, 1)}
      </div>
      <Subtitle text={scene.subtitle} delay={lineStart} />
    </Stack>
  );
};

const Stat: React.FC = () => {
  const { scene, accent } = useScene();
  const { heading,  u, plan, style } = useTheme();
  const frame = useCurrentFrame();
  const sa = useSafeArea();
  const st = scene.stat ?? { value: 0, decimals: 0, prefix: '', suffix: '' };
  const p = interpolate(frame, [4, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const value = (st.value * p).toFixed(st.decimals);
  const digits = plan.direction === 'rtl' && plan.words.some((w) => /[٠-٩]/.test(w.text))
    ? value.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])
    : value;
  const R = 360;
  const C = 2 * Math.PI * (R - 20);
  return (
    <>
      <Decorations seed={scene.id} accent={accent} />
      <Stack gap={40}>
        <div style={{ position: 'relative', width: R * 2 * u, height: R * 2 * u, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox={`0 0 ${R * 2} ${R * 2}`} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
            <circle cx={R} cy={R} r={R - 20} fill="none" stroke={alpha(accent, 0.15)} strokeWidth={24} />
            <circle
              cx={R}
              cy={R}
              r={R - 20}
              fill="none"
              stroke={accent}
              strokeWidth={24}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - p * 0.82)}
            />
          </svg>
          <div
            dir="ltr"
            style={{
              fontFamily: heading,
              fontWeight: 900,
              fontSize: Math.min(200, 900 / Math.max(3, (st.prefix + value + st.suffix).length)) * u,
              color: plan.palette.text,
              display: 'flex',
              alignItems: 'baseline',
              gap: 8 * u,
            }}
          >
            <span style={{ color: accent, fontSize: '0.55em' }}>{st.prefix}</span>
            {digits}
            <span style={{ color: accent, fontSize: '0.55em' }}>{st.suffix}</span>
          </div>
        </div>
        {(st.label || scene.title) && (
          <KineticText text={st.label ?? scene.title ?? ''} size={100} maxWidth={sa.innerW} emphasis={scene.emphasis} />
        )}
        <Subtitle text={scene.subtitle} />
      </Stack>
    </>
  );
};

const Quote: React.FC = () => {
  const { scene, accent } = useScene();
  const { u, plan, heading } = useTheme();
  const sa = useSafeArea();
  const enter = useEnter(0, 40);
  const byline = useEnter(20);
  return (
    <Stack gap={30}>
      <div style={{ ...enter.style, fontFamily: heading, fontSize: 300 * u, lineHeight: 0.6, color: accent, height: 170 * u }}>
        {plan.direction === 'rtl' ? '”' : '“'}
      </div>
      <KineticText text={scene.title ?? ''} size={112} maxWidth={sa.innerW * 0.95} emphasis={scene.emphasis} lineHeight={1.45} />
      {scene.subtitle && (
        <div style={{ ...byline.style, display: 'flex', alignItems: 'center', gap: 20 * u }}>
          <div style={{ width: 70 * u, height: 4 * u, background: accent }} />
          <Subtitle text={scene.subtitle} delay={20} />
        </div>
      )}
    </Stack>
  );
};

const Product: React.FC = () => {
  const { scene, accent } = useScene();
  const { u, plan, heading, style } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sa = useSafeArea();
  const pr = scene.product ?? {};
  const imgP = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const badgeP = spring({ frame: frame - 14, fps, config: { damping: 8, stiffness: 160, mass: 0.5 } });
  const float = Math.sin(frame / 16) * 14 * u;
  const wiggle = Math.sin(frame / 5) * 4 * clamp((frame - 30) / 10) * clamp((60 - frame) / 10);
  return (
    <Stack gap={36}>
      {scene.title && <KineticText text={scene.title} size={84} maxWidth={sa.innerW} emphasis={scene.emphasis} />}
      <div style={{ position: 'relative', width: 760 * u, height: 760 * u, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            position: 'absolute',
            width: 640 * u,
            height: 640 * u,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(accent, 0.45)} 0%, ${alpha(accent, 0)} 70%)`,
            transform: `scale(${imgP})`,
          }}
        />
        {pr.imageUrl ? (
          <Img
            src={pr.imageUrl}
            style={{
              maxWidth: 680 * u,
              maxHeight: 680 * u,
              objectFit: 'contain',
              transform: `translateY(${float + (1 - imgP) * 200 * u}px) scale(${0.6 + 0.4 * imgP}) rotate(${(1 - imgP) * -12}deg)`,
              filter: `drop-shadow(0 ${40 * u}px ${50 * u}px ${alpha('#000000', 0.35)})`,
            }}
          />
        ) : (
          <IconBadge icon={scene.icon} size={360} accent={accent} />
        )}
        {pr.price && (
          <div
            style={{
              position: 'absolute',
              top: 40 * u,
              [plan.direction === 'rtl' ? 'left' : 'right']: 0,
              width: 250 * u,
              height: 250 * u,
              borderRadius: '50%',
              background: plan.palette.secondary,
              color: onColor(plan.palette.secondary),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: heading,
              fontWeight: 900,
              transform: `scale(${badgeP}) rotate(${-12 + wiggle}deg)`,
              boxShadow: `0 ${18 * u}px ${40 * u}px ${alpha('#000000', 0.3)}`,
              border: `${6 * u}px solid ${onColor(plan.palette.secondary)}`,
            }}
          >
            {pr.oldPrice && (
              <span style={{ fontSize: 38 * u, textDecoration: 'line-through', opacity: 0.7 }}>{pr.oldPrice}</span>
            )}
            <span style={{ fontSize: Math.min(72, 380 / Math.max(3, pr.price.length)) * u, lineHeight: 1.05 }}>{pr.price}</span>
          </div>
        )}
        {pr.badge && (
          <div
            style={{
              position: 'absolute',
              bottom: 60 * u,
              [plan.direction === 'rtl' ? 'right' : 'left']: 10 * u,
              padding: `${14 * u}px ${34 * u}px`,
              background: accent,
              color: onColor(accent),
              fontFamily: heading,
              fontWeight: 900,
              fontSize: 48 * u,
              borderRadius: style.cornerRadius * 0.5 * u,
              transform: `scale(${spring({ frame: frame - 24, fps, config: style.spring })}) rotate(4deg)`,
            }}
          >
            {pr.badge}
          </div>
        )}
      </div>
      {pr.name && (
        <KineticText text={pr.name} size={64} maxWidth={sa.innerW} font="body" color={plan.palette.text} delay={10} together />
      )}
    </Stack>
  );
};

const MediaFull: React.FC = () => {
  const { scene, frames, accent } = useScene();
  const { u, plan, width, height } = useTheme();
  const frame = useCurrentFrame();
  const sa = useSafeArea();
  const m = scene.media;
  const zoom = interpolate(frame, [0, frames], [1.04, 1.16]);
  const panX = (random(`pan${scene.id}`) - 0.5) * 60 * u * (frame / Math.max(1, frames));
  return (
    <AbsoluteFill>
      {m && (
        <AbsoluteFill style={{ transform: `scale(${zoom}) translateX(${panX}px)` }}>
          {m.type === 'image' ? (
            <Img src={m.url} style={{ width, height, objectFit: m.fit }} />
          ) : (
            <OffthreadVideo
              src={m.url}
              muted
              startFrom={Math.round((m.startFromMs / 1000) * plan.fps)}
              style={{ width, height, objectFit: m.fit }}
            />
          )}
        </AbsoluteFill>
      )}
      <AbsoluteFill
        style={{ background: `linear-gradient(180deg, ${alpha('#000000', 0.15)} 30%, ${alpha('#000000', 0.7)} 100%)` }}
      />
      {scene.title && (
        <AbsoluteFill
          style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: sa.bottom + 30 * u, paddingLeft: sa.side, paddingRight: sa.side }}
        >
          <KineticText text={scene.title} size={92} maxWidth={sa.innerW} color="#FFFFFF" emphasis={scene.emphasis} />
          {scene.subtitle && <Subtitle text={scene.subtitle} color={mix('#FFFFFF', accent, 0.2)} />}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/** Graphic panel under the speaker (speaker itself is drawn by SpeakerLayer). */
const SpeakerSplit: React.FC = () => {
  const { scene, accent } = useScene();
  const { heading,  u, height, plan, style } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sa = useSafeArea();
  const p = spring({ frame, fps, config: style.spring });
  return (
    <AbsoluteFill style={{ top: height * 0.5, transform: `translateY(${(1 - p) * 300 * u}px)` }}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${mix(plan.palette.background, accent, 0.25)} 0%, ${plan.palette.background} 100%)`,
          borderTop: `${8 * u}px solid ${accent}`,
        }}
      />
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 30 * u,
          paddingLeft: sa.side,
          paddingRight: sa.side,
          paddingBottom: plan.captions.mode !== 'none' ? height * 0.14 : 40 * u,
        }}
      >
        {scene.icon && <IconBadge icon={scene.icon} size={170} accent={accent} delay={6} />}
        {scene.title && <KineticText text={scene.title} size={80} maxWidth={sa.innerW} emphasis={scene.emphasis} />}
        {scene.items.length > 0 && (
          <div style={{ display: 'flex', gap: 20 * u, flexWrap: 'wrap', justifyContent: 'center' }}>
            {scene.items.map((it, i) => (
              <div
                key={i}
                style={{
                  padding: `${12 * u}px ${28 * u}px`,
                  borderRadius: 999,
                  background: alpha(accent, 0.18),
                  border: `${3 * u}px solid ${accent}`,
                  color: plan.palette.text,
                  fontFamily: heading,
                  fontWeight: 800,
                  fontSize: 42 * u,
                  transform: `scale(${spring({ frame: frame - 12 - i * 6, fps, config: style.spring })})`,
                }}
              >
                {it.text}
              </div>
            ))}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Floating icon callout over a full-frame speaker. */
const SpeakerCallout: React.FC = () => {
  const { scene, accent } = useScene();
  const { u, plan, width } = useTheme();
  const sa = useSafeArea();
  if (!scene.icon && !scene.title) return null;
  const right = random(`side${scene.id}`) > 0.5;
  return (
    <AbsoluteFill style={{ paddingTop: sa.top }}>
      <div style={{ position: 'absolute', top: sa.top, [right ? 'right' : 'left']: 60 * u, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 * u, maxWidth: width * 0.45 }}>
        {scene.icon && <IconBadge icon={scene.icon} size={170} accent={accent} />}
        {scene.title && (
          <div style={{ padding: `${10 * u}px ${24 * u}px`, background: alpha(plan.palette.background, 0.85), borderRadius: 18 * u }}>
            <KineticText text={scene.title} size={50} maxWidth={420} emphasis={scene.emphasis} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

const Cta: React.FC = () => {
  const { scene, accent } = useScene();
  const { u, plan, heading, body, style } = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sa = useSafeArea();
  const ec = plan.endCard ?? {};
  const pulse = 1 + 0.05 * Math.sin(frame / 5);
  const rows = [
    ec.handle && { icon: '@', text: ec.handle },
    ec.phone && { icon: '☎', text: ec.phone },
    ec.website && { icon: '⌂', text: ec.website },
  ].filter(Boolean) as { icon: string; text: string }[];
  return (
    <>
      <Decorations seed={scene.id} accent={accent} />
      <Stack gap={44}>
        {plan.logoUrl ? (
          <Img
            src={plan.logoUrl}
            style={{ maxWidth: 300 * u, maxHeight: 220 * u, objectFit: 'contain', transform: `scale(${spring({ frame, fps, config: style.spring })})` }}
          />
        ) : (
          scene.icon && <IconBadge icon={scene.icon} size={260} accent={accent} />
        )}
        <KineticText text={scene.title ?? ec.title ?? ''} size={140} maxWidth={sa.innerW} emphasis={scene.emphasis} />
        {rows.map((r, i) => {
          const p = spring({ frame: frame - 14 - i * 6, fps, config: style.spring });
          return (
            <div
              key={i}
              dir="ltr"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18 * u,
                fontFamily: body,
                fontWeight: 700,
                fontSize: 62 * u,
                color: plan.palette.text,
                opacity: clamp(p * 1.5),
                transform: `translateY(${(1 - p) * 30 * u}px)`,
              }}
            >
              <span style={{ color: accent }}>{r.icon}</span>
              {r.text}
            </div>
          );
        })}
        {(ec.buttonText || scene.subtitle) && (
          <div
            style={{
              marginTop: 20 * u,
              padding: `${28 * u}px ${70 * u}px`,
              background: accent,
              color: onColor(accent),
              fontFamily: heading,
              fontWeight: 900,
              fontSize: 72 * u,
              borderRadius: style.cornerRadius === 0 ? 0 : 999,
              transform: `scale(${spring({ frame: frame - 22, fps, config: style.spring }) * pulse})`,
              boxShadow: `0 ${20 * u}px ${50 * u}px ${alpha(accent, 0.45)}`,
            }}
          >
            {ec.buttonText ?? scene.subtitle}
          </div>
        )}
      </Stack>
    </>
  );
};

export const LAYOUTS: Record<LayoutId, React.FC> = {
  hook: Hook,
  statement: Statement,
  icon_point: IconPoint,
  list: List,
  steps: Steps,
  compare: Compare,
  stat: Stat,
  quote: Quote,
  product: Product,
  media: MediaFull,
  speaker: SpeakerCallout,
  speaker_split: SpeakerSplit,
  cta: Cta,
};
