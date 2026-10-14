import React, { useMemo } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useScene, useTheme } from '../context';
import type { Emphasis, TextEntrance } from '../styles';
import { alpha, clamp, isEmphasis, isRtlText, onColor, revealTimes, splitWords } from '../util';

type Props = {
  text: string;
  /** Max font size in units (1080 canvas). */
  size: number;
  maxWidth: number;
  maxHeight?: number;
  font?: 'heading' | 'body';
  weight?: number;
  color?: string;
  emphasis?: string[];
  align?: 'center' | 'start';
  /** Delay in frames added to every reveal (for secondary text). */
  delay?: number;
  /** Ignore voice timing and reveal everything together after `delay`. */
  together?: boolean;
  entrance?: TextEntrance;
  emphasisStyle?: Emphasis;
  lineHeight?: number;
};

const CHAR_W = 0.5;

/** Largest font size (<= max) at which the text fits the box. */
export const fitFontSize = (text: string, max: number, maxWidth: number, maxHeight: number, lineHeight: number) => {
  const words = splitWords(text);
  const longest = Math.max(1, ...words.map((w) => w.length));
  for (let s = max; s > 18; s *= 0.94) {
    if (longest * CHAR_W * s > maxWidth) continue;
    // Greedy line packing estimate.
    let lines = 1;
    let line = 0;
    for (const w of words) {
      const wW = (w.length + 1) * CHAR_W * s;
      if (line + wW > maxWidth && line > 0) {
        lines++;
        line = wW;
      } else line += wW;
    }
    if (lines * s * lineHeight <= maxHeight) return s;
  }
  return 18;
};

export const KineticText: React.FC<Props> = ({
  text,
  size,
  maxWidth,
  maxHeight,
  font = 'heading',
  weight,
  color,
  emphasis = [],
  align = 'center',
  delay = 0,
  together = false,
  entrance,
  emphasisStyle,
  lineHeight = 1.32,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();
  const { scene, frameAt, accent } = useScene();
  const { u, style, plan } = t;

  const tokens = useMemo(() => splitWords(text), [text]);
  const times = useMemo(
    () => (together ? tokens.map(() => scene.startMs) : revealTimes(tokens, plan.words, scene.startMs, scene.endMs, style.stagger * 33)),
    [tokens, together, plan.words, scene.startMs, scene.endMs, style.stagger],
  );

  const fontSize = fitFontSize(text, size, maxWidth, maxHeight ?? size * 4.2, lineHeight) * u;
  const rtl = isRtlText(text);
  const ent = entrance ?? style.entrance;
  const emp = emphasisStyle ?? style.emphasis;
  const fg = color ?? plan.palette.text;
  const fam = font === 'heading' ? t.heading : t.body;
  const wgt = weight ?? (font === 'heading' ? style.headingWeight : 600);

  return (
    <div
      dir={rtl ? 'rtl' : 'ltr'}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        alignItems: 'center',
        columnGap: fontSize * 0.26,
        rowGap: fontSize * 0.08,
        maxWidth: maxWidth * u,
        fontFamily: fam,
        fontWeight: wgt,
        fontSize,
        lineHeight,
        color: fg,
        textAlign: align === 'center' ? 'center' : rtl ? 'right' : 'left',
      }}
    >
      {tokens.map((tok, i) => {
        const start = Math.max(0, frameAt(times[i])) + delay;
        const local = frame - start;
        const p = spring({ frame: local, fps, config: style.spring });
        const appear = clamp(local / 6);
        const emphasized = isEmphasis(tok, emphasis);
        const display = style.uppercaseLatin && !isRtlText(tok) ? tok.toUpperCase() : tok;

        let transform = '';
        let opacity = appear;
        let filter = '';
        switch (ent) {
          case 'pop':
            transform = `translateY(${(1 - p) * 40 * u}px) scale(${0.35 + 0.65 * p})`;
            break;
          case 'rise':
            transform = `translateY(${(1 - p) * 70 * u}px)`;
            opacity = clamp(local / 9);
            break;
          case 'blur':
            filter = `blur(${(1 - clamp(local / 14)) * 18 * u}px)`;
            transform = `scale(${1.12 - 0.12 * clamp(local / 16)})`;
            opacity = clamp(local / 12);
            break;
          case 'slide':
            transform = `translateX(${(1 - p) * (rtl ? -1 : 1) * -90 * u}px)`;
            break;
          case 'flicker': {
            const on = local < 0 ? 0 : local < 8 ? [1, 0, 1, 0.3, 1, 0, 1, 1][local] : 1;
            opacity = on;
            break;
          }
          case 'type':
            opacity = local >= 0 ? 1 : 0;
            transform = `translateY(${(1 - clamp(local / 5)) * 10 * u}px)`;
            break;
        }

        const wordStyle: React.CSSProperties = {
          display: 'inline-block',
          position: 'relative',
          transform,
          opacity,
          filter,
          whiteSpace: 'nowrap',
          isolation: 'isolate',
        };

        if (!emphasized) return <span key={i} style={wordStyle}>{display}</span>;

        // Emphasis treatment grows in shortly after the word lands.
        const g = spring({ frame: local - 4, fps, config: { damping: 18, stiffness: 140 } });
        const origin = rtl ? 'right' : 'left';
        switch (emp) {
          case 'pill':
          case 'box':
            return (
              <span key={i} style={{ ...wordStyle, color: onColor(accent), padding: `0 ${fontSize * 0.22}px` }}>
                <span
                  style={{
                    position: 'absolute',
                    inset: `${fontSize * 0.06}px 0`,
                    background: accent,
                    borderRadius: emp === 'pill' ? fontSize * 0.28 : 0,
                    transform: `scaleX(${g})${emp === 'box' ? ' rotate(-2deg)' : ''}`,
                    transformOrigin: origin,
                    zIndex: -1,
                    boxShadow: emp === 'box' ? `${8 * u}px ${8 * u}px 0 ${alpha('#000000', 0.25)}` : 'none',
                  }}
                />
                <span style={{ color: g > 0.4 ? onColor(accent) : fg }}>{display}</span>
              </span>
            );
          case 'gold':
            return (
              <span key={i} style={{ ...wordStyle }}>
                <span
                  style={{
                    background: `linear-gradient(180deg, ${accent} 10%, #FFF6D5 55%, ${accent} 90%)`,
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {display}
                </span>
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: fontSize * 0.02,
                    height: Math.max(2, fontSize * 0.04),
                    background: accent,
                    transform: `scaleX(${g})`,
                    transformOrigin: 'center',
                  }}
                />
              </span>
            );
          case 'underline':
            return (
              <span key={i} style={{ ...wordStyle, color: accent }}>
                {display}
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: fontSize * 0.04,
                    height: fontSize * 0.12,
                    borderRadius: fontSize,
                    background: alpha(accent, 0.35),
                    transform: `scaleX(${g})`,
                    transformOrigin: origin,
                    zIndex: -1,
                  }}
                />
              </span>
            );
          case 'glow': {
            const pulse = 0.75 + 0.25 * Math.sin(frame / 6);
            return (
              <span
                key={i}
                style={{
                  ...wordStyle,
                  color: accent,
                  textShadow: `0 0 ${18 * u * pulse}px ${accent}, 0 0 ${42 * u * pulse}px ${alpha(accent, 0.6)}`,
                }}
              >
                {display}
              </span>
            );
          }
          case 'marker':
            return (
              <span key={i} style={wordStyle}>
                <span
                  style={{
                    position: 'absolute',
                    left: -fontSize * 0.08,
                    right: -fontSize * 0.08,
                    top: '45%',
                    height: '42%',
                    background: alpha(accent, 0.55),
                    transform: `scaleX(${g}) skewX(-8deg)`,
                    transformOrigin: origin,
                    zIndex: -1,
                  }}
                />
                {display}
              </span>
            );
        }
      })}
    </div>
  );
};

/** Simple fade/slide-in used for small labels. */
export const useEnter = (delayFrames = 0, dist = 30) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, u } = useTheme();
  const p = spring({ frame: frame - delayFrames, fps, config: style.spring });
  return {
    p,
    style: {
      opacity: interpolate(frame - delayFrames, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      transform: `translateY(${(1 - p) * dist * u}px)`,
    } as React.CSSProperties,
  };
};
