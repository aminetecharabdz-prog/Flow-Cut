import React from 'react';
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Icon } from '../../plan/schema';
import { useTheme } from '../context';
import { alpha, mix, onColor } from '../util';

/** Renders a pre-resolved icon (raw SVG body from the icon set). */
export const IconGlyph: React.FC<{ icon?: Icon; size: number; color: string; style?: React.CSSProperties }> = ({
  icon,
  size,
  color,
  style,
}) => {
  if (!icon?.body) return null;
  return (
    <svg
      viewBox={icon.viewBox ?? '0 0 256 256'}
      width={size}
      height={size}
      style={{ color, display: 'block', ...style }}
      // Icon bodies come from the bundled Phosphor set, resolved server side.
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
};

/** Icon inside an animated badge (circle/rounded square) that pops in. */
export const IconBadge: React.FC<{
  icon?: Icon;
  size: number;
  accent: string;
  delay?: number;
  variant?: 'solid' | 'soft' | 'ring';
}> = ({ icon, size, accent, delay = 0, variant = 'solid' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, style, plan } = useTheme();
  const p = spring({ frame: frame - delay, fps, config: style.spring });
  const iconP = spring({ frame: frame - delay - 4, fps, config: { damping: 9, stiffness: 150, mass: 0.6 } });
  const float = Math.sin((frame + delay * 3) / 18) * 6 * u;
  const s = size * u;
  const radius = style.cornerRadius === 0 ? 0 : style.cornerRadius > 30 ? s / 2 : s * 0.28;
  const bg = variant === 'solid' ? accent : variant === 'soft' ? alpha(accent, 0.16) : 'transparent';
  const fg = variant === 'solid' ? onColor(accent) : accent;
  return (
    <div
      style={{
        width: s,
        height: s,
        borderRadius: radius,
        background: bg,
        border: variant === 'ring' ? `${6 * u}px solid ${accent}` : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `translateY(${float}px) scale(${p}) rotate(${(1 - p) * -25}deg)`,
        boxShadow: variant === 'solid' ? `0 ${24 * u}px ${60 * u}px ${alpha(accent, 0.35)}` : 'none',
        opacity: Math.min(1, p * 2),
      }}
    >
      <IconGlyph
        icon={icon}
        size={s * 0.56}
        color={variant === 'solid' ? fg : plan.palette.text === fg ? accent : fg}
        style={{ transform: `scale(${iconP}) rotate(${(1 - iconP) * 30}deg)` }}
      />
    </div>
  );
};

/** Persistent animated backdrop for the whole video, driven by the style. */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { plan, style, u, width, height } = useTheme();
  const { background: bg, primary, secondary, surface } = plan.palette;

  switch (style.background) {
    case 'blobs': {
      const blobs = [0, 1, 2].map((i) => {
        const x = width * (0.2 + 0.6 * random(`bx${i}${plan.seed}`)) + Math.sin(frame / (60 + i * 17)) * 80 * u;
        const y = height * (0.15 + 0.7 * random(`by${i}${plan.seed}`)) + Math.cos(frame / (70 + i * 13)) * 90 * u;
        const c = i === 1 ? secondary : primary;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - 380 * u,
              top: y - 380 * u,
              width: 760 * u,
              height: 760 * u,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${alpha(c, 0.32)} 0%, ${alpha(c, 0)} 70%)`,
            }}
          />
        );
      });
      return (
        <AbsoluteFill style={{ background: `linear-gradient(160deg, ${bg} 0%, ${mix(bg, surface, 0.6)} 100%)` }}>
          {blobs}
        </AbsoluteFill>
      );
    }
    case 'vignette': {
      const glow = 0.5 + 0.12 * Math.sin(frame / 40);
      return (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at 50% 40%, ${mix(bg, primary, 0.14 * glow)} 0%, ${bg} 55%, ${mix(bg, '#000000', 0.5)} 100%)`,
          }}
        >
          <Particles color={primary} count={26} />
          <Grain />
        </AbsoluteFill>
      );
    }
    case 'stripes': {
      const shift = (frame * 1.2 * u) % (80 * u);
      return (
        <AbsoluteFill style={{ background: bg }}>
          <div
            style={{
              position: 'absolute',
              left: -200 * u,
              right: -200 * u,
              bottom: 120 * u,
              height: 46 * u,
              transform: 'rotate(-6deg)',
              background: `repeating-linear-gradient(90deg, ${primary} 0 ${40 * u}px, ${mix(primary, '#000000', 0.3)} ${40 * u}px ${80 * u}px)`,
              backgroundPosition: `${shift}px 0`,
              opacity: 0.9,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: -200 * u,
              right: -200 * u,
              bottom: 180 * u,
              height: 10 * u,
              transform: 'rotate(-6deg)',
              background: secondary,
            }}
          />
        </AbsoluteFill>
      );
    }
    case 'paper':
      return (
        <AbsoluteFill
          style={{
            background: bg,
            backgroundImage: `radial-gradient(${alpha(plan.palette.muted, 0.22)} ${2.2 * u}px, transparent ${2.4 * u}px)`,
            backgroundSize: `${44 * u}px ${44 * u}px`,
            backgroundPosition: `0 ${-frame * 0.4 * u}px`,
          }}
        />
      );
    case 'grid': {
      const off = (frame * 2 * u) % (90 * u);
      return (
        <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              inset: '-20%',
              backgroundImage: `linear-gradient(${alpha(primary, 0.16)} ${2 * u}px, transparent ${2 * u}px), linear-gradient(90deg, ${alpha(primary, 0.16)} ${2 * u}px, transparent ${2 * u}px)`,
              backgroundSize: `${90 * u}px ${90 * u}px`,
              backgroundPosition: `0 ${off}px`,
              transform: 'perspective(900px) rotateX(55deg) translateY(30%)',
            }}
          />
          <AbsoluteFill
            style={{ background: `radial-gradient(circle at 50% 30%, ${alpha(secondary, 0.22)} 0%, transparent 60%)` }}
          />
        </AbsoluteFill>
      );
    }
    case 'lines':
      return (
        <AbsoluteFill
          style={{
            background: bg,
            backgroundImage: `repeating-linear-gradient(0deg, ${alpha(plan.palette.muted, 0.12)} 0 ${2 * u}px, transparent ${2 * u}px ${64 * u}px)`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              [plan.direction === 'rtl' ? 'right' : 'left']: 110 * u,
              width: 3 * u,
              background: alpha(primary, 0.5),
            }}
          />
        </AbsoluteFill>
      );
  }
};

const Particles: React.FC<{ color: string; count: number }> = ({ color, count }) => {
  const frame = useCurrentFrame();
  const { width, height, u, plan } = useTheme();
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const r = (k: string) => random(`${k}${i}${plan.seed}`);
        const speed = 0.2 + r('s') * 0.6;
        const y = (r('y') * height - frame * speed * u * 2 + height * 2) % height;
        const x = r('x') * width + Math.sin(frame / 50 + i) * 20 * u;
        const size = (2 + r('z') * 5) * u;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: color,
              opacity: 0.25 + 0.5 * r('o'),
              boxShadow: `0 0 ${size * 3}px ${color}`,
            }}
          />
        );
      })}
    </>
  );
};

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: 'overlay' }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 8} />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

/** Seeded floating shapes so each scene's decoration differs. */
export const Decorations: React.FC<{ seed: string; accent: string }> = ({ seed, accent }) => {
  const frame = useCurrentFrame();
  const { width, height, u, style, plan } = useTheme();
  const n = Math.round(5 * style.decoration);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: n }).map((_, i) => {
        const r = (k: string) => random(`${seed}${k}${i}`);
        // Keep shapes near the edges so they never cover text.
        const edge = r('e') > 0.5;
        const x = edge ? width * (0.02 + r('x') * 0.18) : width * (0.8 + r('x') * 0.18);
        const y = height * (0.08 + r('y') * 0.84);
        const kind = Math.floor(r('k') * 4);
        const size = (24 + r('s') * 60) * u;
        const appear = interpolate(frame, [i * 3, i * 3 + 14], [0, 1], { extrapolateRight: 'clamp' });
        const drift = Math.sin(frame / (20 + i * 4)) * 14 * u;
        const color = r('c') > 0.5 ? accent : plan.palette.secondary;
        const common: React.CSSProperties = {
          position: 'absolute',
          left: x,
          top: y + drift,
          width: size,
          height: size,
          opacity: appear * 0.85,
          transform: `scale(${appear}) rotate(${frame * (r('r') - 0.5) * 2}deg)`,
        };
        if (kind === 0) return <div key={i} style={{ ...common, borderRadius: '50%', background: color }} />;
        if (kind === 1)
          return <div key={i} style={{ ...common, borderRadius: '50%', border: `${5 * u}px solid ${color}` }} />;
        if (kind === 2)
          return (
            <svg key={i} viewBox="0 0 24 24" style={common}>
              <path d="M12 3v18M3 12h18" stroke={color} strokeWidth={4} strokeLinecap="round" />
            </svg>
          );
        return (
          <svg key={i} viewBox="0 0 60 20" style={{ ...common, height: size / 3 }}>
            <path d="M2 10 Q 10 0 18 10 T 34 10 T 50 10" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" />
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};
