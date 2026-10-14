import React, { createContext, useContext } from 'react';
import type { Scene, VideoPlan } from '../plan/schema';
import { fontStack } from './fonts';
import { STYLES, type StyleDef } from './styles';
import { isDark } from './util';

export type Theme = {
  plan: VideoPlan;
  style: StyleDef;
  /** 1 unit = 1px on a 1080-wide canvas; scales everything with resolution. */
  u: number;
  width: number;
  height: number;
  vertical: boolean;
  heading: string;
  body: string;
  dark: boolean;
};

const ThemeContext = createContext<Theme | null>(null);

export const ThemeProvider: React.FC<{ plan: VideoPlan; children: React.ReactNode }> = ({ plan, children }) => {
  const u = Math.min(plan.width, plan.height) / 1080;
  const value: Theme = {
    plan,
    style: STYLES[plan.style],
    u,
    width: plan.width,
    height: plan.height,
    vertical: plan.height > plan.width,
    heading: fontStack(plan.fonts.heading),
    body: fontStack(plan.fonts.body),
    dark: isDark(plan.palette.background),
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme outside ThemeProvider');
  return t;
};

/** Per-scene info available to layouts. */
export type SceneInfo = {
  scene: Scene;
  index: number;
  /** Frames in this scene. */
  frames: number;
  /** Primary accent for this scene. */
  accent: string;
  /** Convert an absolute video time (ms) to a frame relative to the scene. */
  frameAt: (ms: number) => number;
};

const SceneContext = createContext<SceneInfo | null>(null);
export const SceneProvider = SceneContext.Provider;
export const useScene = () => {
  const s = useContext(SceneContext);
  if (!s) throw new Error('useScene outside SceneProvider');
  return s;
};
