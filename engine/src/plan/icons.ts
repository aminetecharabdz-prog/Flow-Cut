import { createRequire } from 'node:module';
import { getIconData, iconToSVG } from '@iconify/utils';
import type { IconifyJSON } from '@iconify/types';
import type { Icon, StyleId, VideoPlanInput } from './schema';

const require = createRequire(import.meta.url);
const phosphor = require('@iconify-json/ph/icons.json') as IconifyJSON;

/** Icon weight per style: filled for punchy styles, line/duotone for refined ones. */
const WEIGHT: Record<StyleId, '' | '-fill' | '-duotone' | '-bold'> = {
  vivid: '-fill',
  poster: '-fill',
  clean: '-duotone',
  editorial: '-duotone',
  luxury: '',
  neon: '-bold',
};

const normalize = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/^ph:/, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-(fill|duotone|bold|light|thin)$/, '');

/** Names the planner may use; also the fallback search space. */
export const iconNames = (): string[] =>
  Object.keys(phosphor.icons).filter((n) => !/-(fill|duotone|bold|light|thin)$/.test(n));

export const resolveIcon = (name: string, style: StyleId): Icon | undefined => {
  const base = normalize(name);
  const candidates = [base + WEIGHT[style], base, base + '-fill'];
  for (const c of candidates) {
    const data = getIconData(phosphor, c);
    if (data) {
      const svg = iconToSVG(data);
      return { name: base, body: svg.body, viewBox: svg.attributes.viewBox };
    }
  }
  return undefined;
};

/** Replace icon names in a plan with renderable SVG; unknown icons are dropped. */
export const resolvePlanIcons = (plan: VideoPlanInput): VideoPlanInput => {
  const style = plan.style;
  const fix = (icon?: Icon) => (icon && !icon.body ? resolveIcon(icon.name, style) : icon);
  return {
    ...plan,
    scenes: plan.scenes.map((s) => ({
      ...s,
      icon: fix(s.icon),
      items: (s.items ?? []).map((it) => ({ ...it, icon: fix(it.icon) })),
    })),
  };
};
