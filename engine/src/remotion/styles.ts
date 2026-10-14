import type { SpringConfig } from 'remotion';
import type { StyleId } from '../plan/schema';

export type TextEntrance = 'pop' | 'rise' | 'blur' | 'slide' | 'flicker' | 'type';
export type Emphasis = 'pill' | 'box' | 'gold' | 'underline' | 'glow' | 'marker';
export type Background = 'blobs' | 'vignette' | 'stripes' | 'paper' | 'grid' | 'lines';
export type Transition = 'push' | 'zoom' | 'wipe' | 'fade' | 'glitch' | 'slide';

/**
 * A style is a motion "personality", not a fixed template: it decides how
 * things move and are treated, while layouts are chosen per scene from the
 * content and colours come from the user.
 */
export type StyleDef = {
  spring: Partial<SpringConfig>;
  entrance: TextEntrance;
  emphasis: Emphasis;
  background: Background;
  transitions: Transition[];
  /** Frames between consecutive item reveals when no word timing matches. */
  stagger: number;
  headingWeight: number;
  /** 0..1 how much decorative shapes are used. */
  decoration: number;
  cornerRadius: number;
  uppercaseLatin: boolean;
};

export const STYLES: Record<StyleId, StyleDef> = {
  vivid: {
    spring: { damping: 11, mass: 0.6, stiffness: 160 },
    entrance: 'pop',
    emphasis: 'pill',
    background: 'blobs',
    transitions: ['push', 'zoom', 'slide'],
    stagger: 5,
    headingWeight: 900,
    decoration: 1,
    cornerRadius: 40,
    uppercaseLatin: false,
  },
  luxury: {
    spring: { damping: 200, mass: 1.2, stiffness: 60 },
    entrance: 'blur',
    emphasis: 'gold',
    background: 'vignette',
    transitions: ['fade', 'zoom'],
    stagger: 9,
    headingWeight: 600,
    decoration: 0.35,
    cornerRadius: 8,
    uppercaseLatin: true,
  },
  poster: {
    spring: { damping: 14, mass: 0.5, stiffness: 220 },
    entrance: 'slide',
    emphasis: 'box',
    background: 'stripes',
    transitions: ['wipe', 'push'],
    stagger: 4,
    headingWeight: 900,
    decoration: 0.7,
    cornerRadius: 0,
    uppercaseLatin: true,
  },
  clean: {
    spring: { damping: 26, mass: 0.8, stiffness: 120 },
    entrance: 'rise',
    emphasis: 'underline',
    background: 'paper',
    transitions: ['slide', 'fade'],
    stagger: 6,
    headingWeight: 800,
    decoration: 0.5,
    cornerRadius: 28,
    uppercaseLatin: false,
  },
  neon: {
    spring: { damping: 15, mass: 0.6, stiffness: 180 },
    entrance: 'flicker',
    emphasis: 'glow',
    background: 'grid',
    transitions: ['glitch', 'zoom'],
    stagger: 5,
    headingWeight: 800,
    decoration: 0.8,
    cornerRadius: 20,
    uppercaseLatin: true,
  },
  editorial: {
    spring: { damping: 30, mass: 1, stiffness: 100 },
    entrance: 'type',
    emphasis: 'marker',
    background: 'lines',
    transitions: ['slide', 'wipe'],
    stagger: 7,
    headingWeight: 700,
    decoration: 0.4,
    cornerRadius: 12,
    uppercaseLatin: false,
  },
};
