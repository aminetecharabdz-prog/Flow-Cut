import React, { useMemo } from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Word } from '../../plan/schema';
import { useTheme } from '../context';
import { alpha, isRtlText, onColor } from '../util';

type Chunk = { words: Word[]; startMs: number; endMs: number };

/** Group words into short caption chunks (pauses and punctuation break chunks). */
export const chunkWords = (words: Word[], maxWords = 4, maxChars = 22): Chunk[] => {
  const chunks: Chunk[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) chunks.push({ words: cur, startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs });
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const gap = prev ? w.startMs - prev.endMs : 0;
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    if (cur.length && (cur.length >= maxWords || chars > maxChars || gap > 450)) flush();
    cur.push(w);
    if (/[.!?؟،,:;…]$/.test(w.text)) flush();
  });
  flush();
  return chunks;
};

export const Captions: React.FC<{ hiddenRanges?: [number, number][] }> = ({ hiddenRanges = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { plan, u, height, heading, style } = useTheme();
  const { mode, position } = plan.captions;
  const chunks = useMemo(() => chunkWords(plan.words, mode === 'karaoke_line' ? 7 : 4, mode === 'karaoke_line' ? 40 : 22), [plan.words, mode]);
  if (mode === 'none') return null;

  const ms = (frame / fps) * 1000;
  if (hiddenRanges.some(([a, b]) => ms >= a && ms < b)) return null;
  // Keep a chunk on screen through short gaps so captions don't flicker.
  const chunk = chunks.find((c, i) => ms >= c.startMs - 80 && ms < Math.max(c.endMs + 250, Math.min((chunks[i + 1]?.startMs ?? Infinity) - 80, c.endMs + 700)));
  if (!chunk) return null;

  const enterFrame = Math.round((chunk.startMs / 1000) * fps);
  const p = spring({ frame: frame - enterFrame, fps, config: { damping: 14, stiffness: 200, mass: 0.5 } });
  const text = chunk.words.map((w) => w.text).join(' ');
  const rtl = isRtlText(text);
  const accent = plan.palette.primary;
  // In split scenes the lower half is a graphic panel: keep captions on the speaker's half.
  const split = plan.scenes.some((s) => s.layout === 'speaker_split' && ms >= s.startMs && ms < s.endMs);
  const top = split ? height * 0.36 : position === 'top' ? height * 0.16 : position === 'middle' ? height * 0.46 : height * 0.7;
  const size = (mode === 'karaoke_line' ? 54 : 80) * u;

  return (
    <AbsoluteFill style={{ top, height: 'auto', alignItems: 'center', paddingLeft: 70 * u, paddingRight: 70 * u }}>
      <div
        dir={rtl ? 'rtl' : 'ltr'}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: size * 0.28,
          rowGap: size * 0.1,
          fontFamily: heading,
          fontWeight: mode === 'karaoke_line' ? 700 : 900,
          fontSize: size,
          lineHeight: 1.3,
          transform: `scale(${0.85 + 0.15 * p})`,
          opacity: Math.min(1, p * 2),
          ...(mode === 'karaoke_line'
            ? { padding: `${12 * u}px ${28 * u}px`, borderRadius: 18 * u, background: alpha('#000000', 0.55) }
            : {}),
        }}
      >
        {chunk.words.map((w, i) => {
          const active = ms >= w.startMs && ms < w.endMs + 60;
          const spoken = ms >= w.startMs;
          const display = style.uppercaseLatin && !isRtlText(w.text) ? w.text.toUpperCase() : w.text;
          const outline = `0 ${4 * u}px ${14 * u}px ${alpha('#000000', 0.6)}, 0 0 ${3 * u}px #000`;
          if (mode === 'word_box') {
            return (
              <span
                key={i}
                style={{
                  position: 'relative',
                  padding: `0 ${size * 0.16}px`,
                  color: active ? onColor(accent) : '#FFFFFF',
                  textShadow: active ? 'none' : outline,
                  isolation: 'isolate',
                }}
              >
                {active && (
                  <span
                    style={{
                      position: 'absolute',
                      inset: `${size * 0.04}px 0`,
                      background: accent,
                      borderRadius: size * 0.16,
                      zIndex: -1,
                      transform: 'rotate(-1.5deg)',
                    }}
                  />
                )}
                {display}
              </span>
            );
          }
          if (mode === 'word_color') {
            return (
              <span
                key={i}
                style={{
                  color: active ? accent : '#FFFFFF',
                  textShadow: outline,
                  transform: `scale(${active ? 1.12 : 1})`,
                  display: 'inline-block',
                }}
              >
                {display}
              </span>
            );
          }
          return (
            <span key={i} style={{ color: spoken ? accent : '#FFFFFF' }}>
              {display}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
