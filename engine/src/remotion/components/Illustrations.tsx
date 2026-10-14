import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VisualId } from '../../plan/schema';
import { useScene, useTheme } from '../context';
import { mix, onColor } from '../util';

/**
 * Animated flat illustrations, drawn in a 400x400 box. Each one tells a small
 * story (a parcel being wrapped, a truck driving, glass cracking...) so a scene
 * shows what is being said instead of a generic icon.
 */


type Colors = { a: string; b: string; ink: string; paper: string; soft: string; shade: string };

const useColors = (): Colors => {
  const { plan } = useTheme();
  const { accent } = useScene();
  const p = plan.palette;
  const a = accent;
  const b = a === p.secondary ? p.primary : p.secondary;
  return {
    a,
    b,
    ink: '#1B1B2F',
    paper: '#FFFFFF',
    soft: mix(p.background, '#FFFFFF', 0.82),
    shade: 'rgba(0,0,0,0.18)',
  };
};

/** 0..1 progress between frames, eased. */
const useProgress = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return {
    frame,
    t: (from: number, dur: number, ease = Easing.out(Easing.cubic)) =>
      interpolate(frame, [from, from + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease }),
    pop: (from: number, damping = 10) => spring({ frame: frame - from, fps, config: { damping, stiffness: 170, mass: 0.6 } }),
  };
};

const Shadow: React.FC<{ y?: number; w?: number; o?: number }> = ({ y = 360, w = 150, o = 1 }) => (
  <ellipse cx={200} cy={y} rx={w} ry={w * 0.12} fill="rgba(0,0,0,0.22)" opacity={o} />
);

/** Draw-on stroke: dash offset from full length to 0. */
const draw = (len: number, p: number) => ({ strokeDasharray: len, strokeDashoffset: len * (1 - p) });

const Package: React.FC = () => {
  const c = useColors();
  const { t, pop, frame } = useProgress();
  const box = pop(0);
  const flapL = interpolate(t(10, 14), [0, 1], [-120, 0]);
  const flapR = interpolate(t(14, 14), [0, 1], [120, 0]);
  const tape = t(26, 12);
  const label = pop(34);
  return (
    <g>
      <Shadow />
      <g transform={`translate(200 300) scale(${box}) translate(-200 -300)`}>
        <rect x={90} y={170} width={220} height={170} rx={10} fill="#C98A4B" />
        <rect x={90} y={170} width={220} height={30} fill="#B57638" />
        <g transform={`rotate(${flapL} 90 170)`}>
          <rect x={90} y={150} width={110} height={24} rx={4} fill="#D9A066" />
        </g>
        <g transform={`rotate(${flapR} 310 170)`}>
          <rect x={200} y={150} width={110} height={24} rx={4} fill="#D9A066" />
        </g>
        <rect x={185} y={146} width={30} height={194 * tape} fill={c.a} opacity={0.95} />
        <g transform={`translate(250 280) scale(${label}) rotate(-6)`}>
          <rect x={-42} y={-26} width={84} height={52} rx={8} fill={c.paper} />
          <rect x={-30} y={-12} width={60} height={6} rx={3} fill={c.ink} opacity={0.7} />
          <rect x={-30} y={2} width={40} height={6} rx={3} fill={c.ink} opacity={0.4} />
        </g>
      </g>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const p = pop(30 + i * 3, 14);
        const ang = (i / 6) * Math.PI * 2 + frame / 60;
        return <circle key={i} cx={200 + Math.cos(ang) * 170} cy={240 + Math.sin(ang) * 130} r={9 * p} fill="none" stroke={c.b} strokeWidth={4} opacity={0.8} />;
      })}
    </g>
  );
};

const Truck: React.FC = () => {
  const c = useColors();
  const { t, pop, frame } = useProgress();
  const drive = interpolate(t(0, 22), [0, 1], [-260, 0]);
  const bob = Math.sin(frame / 3) * 2;
  const wheel = frame * 12;
  return (
    <g>
      <rect x={0} y={330} width={400} height={8} rx={4} fill={c.ink} opacity={0.25} />
      <line x1={0} y1={350} x2={400} y2={350} stroke={c.ink} strokeOpacity={0.25} strokeWidth={4} strokeDasharray="30 22" strokeDashoffset={frame * 8} />
      <g transform={`translate(${drive} ${bob})`}>
        {[0, 1, 2].map((i) => (
          <rect key={i} x={10 - i * 6} y={200 + i * 34} width={50 + i * 10} height={6} rx={3} fill={c.b} opacity={t(18, 8) * (0.9 - i * 0.2)} />
        ))}
        <rect x={80} y={170} width={180} height={140} rx={14} fill={c.a} />
        <rect x={100} y={190} width={140} height={60} rx={8} fill={onColor(c.a)} opacity={0.15} />
        <g transform={`translate(170 220) scale(${pop(16)})`}>
          <rect x={-30} y={-24} width={60} height={48} rx={6} fill="#C98A4B" />
          <rect x={-6} y={-24} width={12} height={48} fill={c.b} />
        </g>
        <path d="M260 210 h52 l38 44 v56 h-90 z" fill={c.b} />
        <path d="M272 222 h36 l26 32 h-62 z" fill={c.paper} opacity={0.85} />
        {[130, 300].map((x) => (
          <g key={x} transform={`translate(${x} 316) rotate(${wheel})`}>
            <circle r={30} fill={c.ink} />
            <circle r={12} fill={c.soft} />
            <rect x={-3} y={-26} width={6} height={14} fill={c.soft} />
          </g>
        ))}
      </g>
    </g>
  );
};

const Pins: React.FC = () => {
  const c = useColors();
  const { t, pop, frame } = useProgress();
  const map = pop(0, 14);
  const pins = [
    [120, 170], [250, 140], [300, 250], [170, 270], [220, 200],
  ];
  return (
    <g>
      <Shadow y={355} w={170} />
      <g transform={`translate(200 230) scale(${map}) translate(-200 -230)`}>
        <path d="M40 120 L150 90 L260 120 L370 90 V330 L260 360 L150 330 L40 360 Z" fill={c.paper} />
        <path d="M150 90 V330 M260 120 V360" stroke={c.ink} strokeOpacity={0.1} strokeWidth={3} />
        <path d="M60 200 C 140 160, 200 280, 350 210" fill="none" stroke={c.b} strokeOpacity={0.5} strokeWidth={8} strokeLinecap="round" style={draw(400, t(8, 20))} />
      </g>
      {pins.map(([x, y], i) => {
        const p = pop(12 + i * 5, 9);
        const drop = (1 - p) * -80;
        const pulse = ((frame - 12 - i * 5) % 30) / 30;
        return (
          <g key={i} transform={`translate(${x} ${y + drop})`} opacity={Math.min(1, p * 2)}>
            <ellipse cx={0} cy={6} rx={22 * (0.5 + pulse)} ry={8 * (0.5 + pulse)} fill={c.a} opacity={(1 - pulse) * 0.4} />
            <path d="M0 0 C -26 -30, -26 -62, 0 -64 C 26 -62, 26 -30, 0 0 Z" fill={i === 4 ? c.b : c.a} />
            <circle cx={0} cy={-42} r={9} fill={c.paper} />
          </g>
        );
      })}
    </g>
  );
};

const ShieldV: React.FC = () => {
  const c = useColors();
  const { t, pop, frame } = useProgress();
  const s = pop(0);
  const glow = 0.5 + 0.5 * Math.sin(frame / 8);
  return (
    <g>
      <Shadow />
      <circle cx={200} cy={200} r={150 + glow * 10} fill={c.a} opacity={0.12 * s} />
      <g transform={`translate(200 200) scale(${s}) translate(-200 -200)`}>
        <path d="M200 50 L320 95 V190 C320 270 265 320 200 345 C135 320 80 270 80 190 V95 Z" fill={c.a} />
        <path d="M200 50 L320 95 V190 C320 270 265 320 200 345 Z" fill={c.ink} opacity={0.12} />
        <path d="M145 200 L185 240 L262 160" fill="none" stroke={c.paper} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" style={draw(200, t(12, 14))} />
      </g>
      {[0, 1, 2].map((i) => {
        const p = pop(22 + i * 4, 8);
        const pos = [[90, 90], [320, 110], [330, 300]][i];
        return (
          <path key={i} transform={`translate(${pos[0]} ${pos[1]}) scale(${p}) rotate(${frame * 2})`} d="M0 -16 L4 -4 L16 0 L4 4 L0 16 L-4 4 L-16 0 L-4 -4 Z" fill={c.b} />
        );
      })}
    </g>
  );
};

const Crack: React.FC = () => {
  const c = useColors();
  const { t, pop, frame } = useProgress();
  const shake = frame > 10 && frame < 18 ? Math.sin(frame * 3) * 6 : 0;
  const cracks = ['M200 190 L150 120 L160 70', 'M200 190 L270 140 L320 120', 'M200 190 L250 260 L240 330', 'M200 190 L120 230 L80 300', 'M200 190 L215 110', 'M200 190 L300 220'];
  return (
    <g transform={`translate(${shake} 0)`}>
      <Shadow />
      <rect x={70} y={50} width={260} height={290} rx={10} fill={mix('#BFE3FF', c.a, 0.15)} stroke={c.ink} strokeOpacity={0.2} strokeWidth={6} />
      <path d={`M${90 + t(0, 30) * 200} 60 l40 0 l-80 280 l-40 0 z`} fill="#FFFFFF" opacity={0.35} />
      {cracks.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={c.ink} strokeWidth={4} strokeLinecap="round" style={draw(200, t(10 + i, 10))} />
      ))}
      {[0, 1, 2, 3].map((i) => {
        const p = t(14, 20);
        const dir = [[-1, -1], [1, -0.6], [0.8, 1], [-1, 0.7]][i];
        return (
          <path key={i} transform={`translate(${200 + dir[0] * p * 140} ${190 + dir[1] * p * 140}) rotate(${p * 200 * dir[0]})`} d="M0 -12 L10 8 L-10 6 Z" fill={mix('#BFE3FF', '#FFFFFF', 0.4)} opacity={1 - p * 0.8} />
        );
      })}
      <g transform={`translate(310 80) scale(${pop(22)})`}>
        <circle r={42} fill={c.b} />
        <path d="M0 -20 V6" stroke={onColor(c.b)} strokeWidth={10} strokeLinecap="round" />
        <circle cy={20} r={6} fill={onColor(c.b)} />
      </g>
    </g>
  );
};

const Frame: React.FC = () => {
  const c = useColors();
  const { t, pop, frame } = useProgress();
  const s = pop(0, 12);
  const swing = Math.sin(frame / 14) * 3 * (1 - t(0, 60));
  return (
    <g>
      <path d="M200 40 L130 110 M200 40 L270 110" stroke={c.ink} strokeOpacity={0.5} strokeWidth={4} />
      <circle cx={200} cy={40} r={8} fill={c.ink} />
      <g transform={`rotate(${swing} 200 40) translate(200 220) scale(${s}) translate(-200 -220)`}>
        <rect x={90} y={105} width={220} height={240} rx={6} fill="#D4A64A" />
        <rect x={108} y={123} width={184} height={204} fill={c.paper} />
        <rect x={108} y={123} width={184} height={204} fill={mix(c.a, '#FFFFFF', 0.75)} />
        <circle cx={240} cy={175} r={22 * pop(10)} fill={c.b} />
        <path d="M108 327 L170 230 L215 285 L245 250 L292 327 Z" fill={c.a} />
        <path d="M108 327 L170 230 L195 268 L150 327 Z" fill={c.ink} opacity={0.15} />
        <rect x={108 + t(14, 22) * 150} y={123} width={30} height={204} fill="#FFFFFF" opacity={0.35 * (1 - t(30, 8))} />
      </g>
    </g>
  );
};

const Phone: React.FC = () => {
  const c = useColors();
  const { t, pop, frame } = useProgress();
  const s = pop(0, 12);
  return (
    <g>
      <Shadow />
      <g transform={`translate(200 210) scale(${s}) rotate(${(1 - s) * -10}) translate(-200 -210)`}>
        <rect x={120} y={40} width={160} height={310} rx={26} fill={c.ink} />
        <rect x={132} y={56} width={136} height={278} rx={16} fill={mix(c.a, '#FFFFFF', 0.85)} />
        <rect x={180} y={62} width={40} height={8} rx={4} fill={c.ink} />
        {[0, 1, 2].map((i) => {
          const p = t(10 + i * 6, 12);
          return (
            <g key={i} transform={`translate(0 ${(1 - p) * 60})`} opacity={p}>
              <rect x={144} y={90 + i * 78} width={112} height={66} rx={10} fill={i === 1 ? c.a : c.paper} />
              <circle cx={164} cy={112 + i * 78} r={10} fill={i === 1 ? c.paper : c.b} />
              <rect x={182} y={106 + i * 78} width={60} height={6} rx={3} fill={i === 1 ? c.paper : c.ink} opacity={0.6} />
              <rect x={156} y={132 + i * 78} width={86} height={6} rx={3} fill={i === 1 ? c.paper : c.ink} opacity={0.3} />
            </g>
          );
        })}
      </g>
      <g transform={`translate(300 110) scale(${pop(28)})`}>
        <circle r={30} fill={c.b} />
        <path d="M0 12 C -22 -4, -12 -22, 0 -10 C 12 -22, 22 -4, 0 12 Z" fill={onColor(c.b)} transform={`scale(${1 + Math.sin(frame / 4) * 0.08})`} />
      </g>
    </g>
  );
};

const Chat: React.FC = () => {
  const c = useColors();
  const { pop, frame } = useProgress();
  const bubbles = [
    { x: 80, y: 80, w: 190, fill: c.paper, ink: c.ink, side: -1 },
    { x: 130, y: 175, w: 190, fill: c.a, ink: onColor(c.a), side: 1 },
    { x: 80, y: 270, w: 150, fill: c.paper, ink: c.ink, side: -1 },
  ];
  return (
    <g>
      {bubbles.map((b, i) => {
        const p = pop(i * 8, 11);
        return (
          <g key={i} transform={`translate(${b.x + b.w / 2} ${b.y + 35}) scale(${p}) translate(${-b.x - b.w / 2} ${-b.y - 35})`}>
            <rect x={b.x} y={b.y} width={b.w} height={70} rx={24} fill={b.fill} />
            <path d={b.side < 0 ? `M${b.x + 20} ${b.y + 60} l-14 22 l34 -10 z` : `M${b.x + b.w - 20} ${b.y + 60} l14 22 l-34 -10 z`} fill={b.fill} />
            {i === 2 ? (
              [0, 1, 2].map((d) => (
                <circle key={d} cx={b.x + 45 + d * 30} cy={b.y + 35 + Math.sin(frame / 3 + d) * 4} r={8} fill={b.ink} opacity={0.6} />
              ))
            ) : (
              <>
                <rect x={b.x + 24} y={b.y + 22} width={b.w * 0.6} height={8} rx={4} fill={b.ink} opacity={0.6} />
                <rect x={b.x + 24} y={b.y + 40} width={b.w * 0.4} height={8} rx={4} fill={b.ink} opacity={0.35} />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
};

const Chart: React.FC = () => {
  const c = useColors();
  const { t, pop } = useProgress();
  const bars = [0.35, 0.55, 0.45, 0.75, 1];
  return (
    <g>
      <rect x={60} y={60} width={280} height={280} rx={20} fill={c.paper} transform={`translate(200 200) scale(${pop(0, 14)}) translate(-200 -200)`} />
      <path d="M90 300 H310" stroke={c.ink} strokeOpacity={0.2} strokeWidth={4} />
      {bars.map((h, i) => {
        const p = t(8 + i * 4, 14, Easing.out(Easing.back(1.6)));
        return <rect key={i} x={100 + i * 42} y={300 - h * 190 * p} width={28} height={h * 190 * p} rx={6} fill={i === 4 ? c.a : mix(c.a, '#FFFFFF', 0.55)} />;
      })}
      <path d="M100 250 L150 210 L190 225 L240 160 L300 100" fill="none" stroke={c.b} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" style={draw(300, t(20, 16))} />
      <path d="M300 100 l-26 4 M300 100 l-6 26" stroke={c.b} strokeWidth={8} strokeLinecap="round" opacity={t(34, 4)} />
    </g>
  );
};

const Clock: React.FC = () => {
  const c = useColors();
  const { pop, frame } = useProgress();
  const s = pop(0);
  return (
    <g>
      <Shadow />
      <g transform={`translate(200 200) scale(${s})`}>
        <circle r={150} fill={c.a} />
        <circle r={124} fill={c.paper} />
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x={-4} y={-116} width={8} height={i % 3 === 0 ? 22 : 12} rx={4} fill={c.ink} opacity={0.6} transform={`rotate(${i * 30})`} />
        ))}
        <rect x={-6} y={-70} width={12} height={78} rx={6} fill={c.ink} transform={`rotate(${frame * 2})`} />
        <rect x={-4} y={-100} width={8} height={108} rx={4} fill={c.b} transform={`rotate(${frame * 14})`} />
        <circle r={12} fill={c.ink} />
      </g>
    </g>
  );
};

const Tag: React.FC = () => {
  const c = useColors();
  const { pop, frame } = useProgress();
  const s = pop(0, 9);
  const swing = Math.sin(frame / 6) * 10 * Math.max(0, 1 - frame / 50);
  return (
    <g>
      <path d="M200 30 V90" stroke={c.ink} strokeOpacity={0.5} strokeWidth={4} />
      <g transform={`rotate(${swing} 200 90) translate(200 220) scale(${s}) translate(-200 -220)`}>
        <path d="M130 120 H270 L320 180 V320 Q320 340 300 340 H100 Q80 340 80 320 V180 Z" fill={c.a} transform="rotate(0)" />
        <circle cx={200} cy={150} r={14} fill={c.paper} />
        <text x={200} y={275} textAnchor="middle" fontSize={96} fontWeight={900} fill={onColor(c.a)} fontFamily="'MC Cairo', sans-serif">%</text>
      </g>
      {[0, 1, 2].map((i) => {
        const p = pop(16 + i * 4, 8);
        const pos = [[80, 120], [330, 150], [320, 320]][i];
        return <circle key={i} cx={pos[0]} cy={pos[1]} r={14 * p} fill={c.b} />;
      })}
    </g>
  );
};

const Checklist: React.FC = () => {
  const c = useColors();
  const { t, pop } = useProgress();
  return (
    <g>
      <Shadow />
      <g transform={`translate(200 200) scale(${pop(0, 12)}) translate(-200 -200)`}>
        <rect x={90} y={50} width={220} height={290} rx={18} fill={c.paper} />
        <rect x={160} y={36} width={80} height={32} rx={10} fill={c.a} />
      </g>
      {[0, 1, 2].map((i) => {
        const p = t(12 + i * 8, 8);
        const y = 110 + i * 70;
        return (
          <g key={i} opacity={Math.min(1, t(6 + i * 8, 6) * 2)}>
            <rect x={115} y={y} width={44} height={44} rx={10} fill={p > 0.5 ? c.a : 'none'} stroke={c.a} strokeWidth={5} />
            <path d={`M${124} ${y + 22} l10 10 l18 -18`} fill="none" stroke={onColor(c.a)} strokeWidth={6} strokeLinecap="round" style={draw(40, p)} />
            <rect x={175} y={y + 10} width={100} height={10} rx={5} fill={c.ink} opacity={0.55} />
            <rect x={175} y={y + 28} width={64} height={8} rx={4} fill={c.ink} opacity={0.25} />
          </g>
        );
      })}
    </g>
  );
};

const House: React.FC = () => {
  const c = useColors();
  const { t, pop } = useProgress();
  const door = t(14, 10);
  const parcel = interpolate(t(18, 16), [0, 1], [420, 250]);
  return (
    <g>
      <Shadow y={350} w={170} />
      <g transform={`translate(200 340) scale(${pop(0, 12)}) translate(-200 -340)`}>
        <path d="M70 180 L200 70 L330 180" fill="none" stroke={c.b} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
        <rect x={95} y={170} width={210} height={170} fill={c.paper} />
        <rect x={120} y={200} width={50} height={46} rx={6} fill={mix(c.a, '#FFFFFF', 0.6)} />
        <rect x={190} y={240} width={70} height={100} fill={c.ink} opacity={0.85} />
        <rect x={190} y={240} width={70 * (1 - door * 0.7)} height={100} fill={c.a} />
      </g>
      <g transform={`translate(${parcel} 312)`} opacity={t(18, 4)}>
        <rect x={-26} y={-26} width={52} height={52} rx={6} fill="#C98A4B" />
        <rect x={-5} y={-26} width={10} height={52} fill={c.b} />
      </g>
      <g transform={`translate(320 110) scale(${pop(32)})`}>
        <circle r={30} fill={c.a} />
        <path d="M-12 0 l8 9 l16 -18" fill="none" stroke={onColor(c.a)} strokeWidth={7} strokeLinecap="round" />
      </g>
    </g>
  );
};

const Magnifier: React.FC = () => {
  const c = useColors();
  const { t, pop, frame } = useProgress();
  const x = interpolate(Math.sin(frame / 14), [-1, 1], [140, 260]);
  return (
    <g>
      <rect x={70} y={90} width={260} height={220} rx={18} fill={c.paper} transform={`translate(200 200) scale(${pop(0, 14)}) translate(-200 -200)`} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={100} y={125 + i * 42} width={200 - i * 30} height={12} rx={6} fill={c.ink} opacity={0.25} />
      ))}
      <g transform={`translate(${x} 200)`} opacity={t(8, 8)}>
        <circle r={58} fill={mix(c.a, '#FFFFFF', 0.7)} opacity={0.5} />
        <circle r={58} fill="none" stroke={c.a} strokeWidth={16} />
        <rect x={40} y={40} width={22} height={70} rx={10} fill={c.ink} transform="rotate(-45 40 40)" />
      </g>
    </g>
  );
};

const Stars: React.FC = () => {
  const c = useColors();
  const { pop } = useProgress();
  const star = 'M0 -40 L12 -12 L42 -10 L18 10 L26 40 L0 22 L-26 40 L-18 10 L-42 -10 L-12 -12 Z';
  return (
    <g>
      <rect x={40} y={140} width={320} height={120} rx={60} fill={c.paper} transform={`translate(200 200) scale(${pop(0, 14)}) translate(-200 -200)`} />
      {[0, 1, 2, 3, 4].map((i) => {
        const p = pop(8 + i * 5, 8);
        return <path key={i} d={star} transform={`translate(${80 + i * 60} 200) scale(${p * 0.62}) rotate(${(1 - p) * 90})`} fill={c.a} />;
      })}
      <text x={200} y={115} textAnchor="middle" fontSize={56} fontWeight={900} fill={c.a} opacity={pop(30)} fontFamily="'MC Inter', sans-serif">5.0</text>
    </g>
  );
};

const Gift: React.FC = () => {
  const c = useColors();
  const { t, pop, frame } = useProgress();
  const lid = interpolate(t(16, 10), [0, 1], [0, -70]);
  return (
    <g>
      <Shadow />
      <g transform={`translate(200 330) scale(${pop(0)}) translate(-200 -330)`}>
        <rect x={110} y={200} width={180} height={140} rx={10} fill={c.a} />
        <rect x={188} y={200} width={24} height={140} fill={c.b} />
        <g transform={`translate(0 ${lid}) rotate(${lid / 6} 290 180)`}>
          <rect x={95} y={170} width={210} height={40} rx={8} fill={mix(c.a, '#000000', 0.15)} />
          <rect x={188} y={170} width={24} height={40} fill={c.b} />
          <path d="M200 170 C 160 120, 140 160, 200 170 C 260 160, 240 120, 200 170" fill="none" stroke={c.b} strokeWidth={10} />
        </g>
      </g>
      {Array.from({ length: 12 }).map((_, i) => {
        const p = t(20, 26);
        const ang = (i / 12) * Math.PI * 2;
        return (
          <rect key={i} x={-6} y={-12} width={12} height={24} rx={4} fill={i % 2 ? c.a : c.b} transform={`translate(${200 + Math.cos(ang) * p * 170} ${190 + Math.sin(ang) * p * 150 + p * p * 60}) rotate(${frame * 8 + i * 30})`} opacity={p > 0 ? 1 - p * 0.6 : 0} />
        );
      })}
    </g>
  );
};

const Bulb: React.FC = () => {
  const c = useColors();
  const { pop, frame } = useProgress();
  const glow = 0.5 + 0.5 * Math.sin(frame / 6);
  return (
    <g>
      <circle cx={200} cy={170} r={130 + glow * 14} fill={c.a} opacity={0.18 * pop(6)} />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x={-5} y={-170} width={10} height={34} rx={5} fill={c.a} transform={`translate(200 170) rotate(${i * 45}) scale(${pop(14 + i, 10)})`} />
      ))}
      <g transform={`translate(200 200) scale(${pop(0)}) translate(-200 -200)`}>
        <path d="M200 70 C 270 70, 300 130, 280 180 C 268 210, 245 225, 242 260 H158 C155 225, 132 210, 120 180 C100 130, 130 70, 200 70 Z" fill={c.a} />
        <path d="M150 105 C 140 125, 140 150, 150 170" fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={10} strokeLinecap="round" />
        <rect x={158} y={262} width={84} height={26} rx={8} fill={c.ink} opacity={0.8} />
        <rect x={168} y={292} width={64} height={22} rx={8} fill={c.ink} opacity={0.6} />
      </g>
    </g>
  );
};

const Megaphone: React.FC = () => {
  const c = useColors();
  const { pop, frame } = useProgress();
  return (
    <g>
      <g transform={`translate(170 210) scale(${pop(0)}) rotate(-12) translate(-170 -210)`}>
        <path d="M90 180 L250 110 V310 L90 240 Z" fill={c.a} />
        <rect x={60} y={175} width={40} height={70} rx={12} fill={c.b} />
        <path d="M120 245 L140 320 H170 L160 255" fill={c.ink} opacity={0.8} />
      </g>
      {[0, 1, 2].map((i) => {
        const k = ((frame + i * 10) % 30) / 30;
        return <path key={i} d={`M${280 + k * 60} ${140 - k * 30} Q ${320 + k * 80} 210 ${280 + k * 60} ${280 + k * 30}`} fill="none" stroke={c.b} strokeWidth={10} strokeLinecap="round" opacity={(1 - k) * pop(10)} />;
      })}
    </g>
  );
};

const Rocket: React.FC = () => {
  const c = useColors();
  const { t, frame } = useProgress();
  const rise = interpolate(t(0, 30, Easing.inOut(Easing.cubic)), [0, 1], [180, 0]);
  const shake = Math.sin(frame * 2) * 2;
  return (
    <g>
      {Array.from({ length: 6 }).map((_, i) => {
        const k = ((frame + i * 6) % 36) / 36;
        return <circle key={i} cx={200 + Math.sin(i * 7) * 30 * k} cy={330 + k * 60 + rise * 0.5} r={30 * (1 - k)} fill={c.paper} opacity={0.6 * (1 - k)} />;
      })}
      <g transform={`translate(${shake} ${rise})`}>
        <path d="M200 300 Q 185 340 200 370 Q 215 340 200 300" fill={c.b} transform={`scale(1 ${1 + Math.sin(frame) * 0.15})`} style={{ transformOrigin: '200px 300px' }} />
        <path d="M200 40 C 250 80, 260 180, 240 290 H160 C 140 180, 150 80, 200 40 Z" fill={c.paper} />
        <path d="M200 40 C 225 60, 240 90, 245 120 H155 C 160 90, 175 60, 200 40 Z" fill={c.a} />
        <circle cx={200} cy={170} r={26} fill={c.b} stroke={c.ink} strokeOpacity={0.2} strokeWidth={6} />
        <path d="M160 230 L120 300 H165 Z M240 230 L280 300 H235 Z" fill={c.a} />
      </g>
    </g>
  );
};

const Heart: React.FC = () => {
  const c = useColors();
  const { pop, frame } = useProgress();
  const beat = 1 + Math.max(0, Math.sin(frame / 4)) * 0.08;
  const heart = 'M0 60 C -120 -20, -60 -110, 0 -50 C 60 -110, 120 -20, 0 60 Z';
  return (
    <g>
      <path d={heart} transform={`translate(200 210) scale(${pop(0) * 1.4 * beat})`} fill={c.a} />
      <path d="M-50 -40 C -70 -20, -70 0, -60 15" transform="translate(200 210) scale(1.4)" fill="none" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={8} strokeLinecap="round" opacity={pop(8)} />
      {[0, 1, 2, 3].map((i) => {
        const k = ((frame + i * 9) % 40) / 40;
        const x = [90, 310, 120, 290][i];
        return <path key={i} d={heart} transform={`translate(${x} ${330 - k * 260}) scale(${0.25 * (1 - k * 0.5)})`} fill={i % 2 ? c.b : c.a} opacity={(1 - k) * pop(10)} />;
      })}
    </g>
  );
};

const VISUALS: Record<VisualId, React.FC> = {
  package: Package,
  truck: Truck,
  pins: Pins,
  shield: ShieldV,
  crack: Crack,
  frame: Frame,
  phone: Phone,
  chat: Chat,
  chart: Chart,
  clock: Clock,
  tag: Tag,
  checklist: Checklist,
  house: House,
  magnifier: Magnifier,
  stars: Stars,
  gift: Gift,
  bulb: Bulb,
  megaphone: Megaphone,
  rocket: Rocket,
  heart: Heart,
};

export const Visual: React.FC<{ id: VisualId; size: number }> = ({ id, size }) => {
  const { u } = useTheme();
  const frame = useCurrentFrame();
  const Comp = VISUALS[id] ?? Bulb;
  // Gentle idle float keeps the scene alive after the entrance animation.
  const float = Math.sin(frame / 22) * 6;
  return (
    <svg viewBox="0 0 400 400" width={size * u} height={size * u} style={{ overflow: 'visible', transform: `translateY(${float * u}px)` }}>
      <Comp />
    </svg>
  );
};
