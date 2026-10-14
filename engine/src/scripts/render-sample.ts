import { mkdirSync, readFileSync } from 'node:fs';
import { renderPlan } from '../render';
import { SAMPLE_PLAN, productPlan } from '../plan/sample';
import type { StyleId, VideoPlanInput } from '../plan/schema';

// Usage: tsx src/scripts/render-sample.ts <content|product> [style] [outFile] [productImage.png]
const kind = process.argv[2] ?? 'content';
const imagePath = process.argv[5];
const base: VideoPlanInput =
  kind === 'product'
    ? productPlan(imagePath ? `data:image/png;base64,${readFileSync(imagePath).toString('base64')}` : 'https://example.com/none.png')
    : SAMPLE_PLAN;
const style = (process.argv[3] ?? base.style) as StyleId;
const out = process.argv[4] ?? `out/${kind}-${style}.mp4`;
mkdirSync('out', { recursive: true });

let last = -1;
await renderPlan(
  { ...base, style },
  {
    outFile: out,
    onProgress: (p) => {
      const pct = Math.floor(p * 10) * 10;
      if (pct !== last) console.log(`${pct}%`), (last = pct);
    },
  },
);
console.log(`Rendered ${out}`);
