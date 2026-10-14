import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { resolvePlanIcons } from './plan/icons';
import { VideoPlan, type VideoPlanInput } from './plan/schema';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let bundled: Promise<string> | null = null;
const getBundle = () =>
  (bundled ??= bundle({
    entryPoint: path.join(root, 'src/remotion/index.ts'),
    publicDir: path.join(root, 'public'),
  }));

export type RenderOptions = {
  outFile: string;
  /** Export scale relative to the plan size (e.g. 0.6667 for 720p from 1080p). */
  scale?: number;
  onProgress?: (p: number) => void;
};

/** Validate, resolve icons and render a plan to MP4 (H.264 + AAC). */
export const renderPlan = async (input: VideoPlanInput, opts: RenderOptions) => {
  const plan = VideoPlan.parse(resolvePlanIcons(input));
  const serveUrl = await getBundle();
  const browserExecutable = process.env.REMOTION_BROWSER ?? null;
  const composition = await selectComposition({ serveUrl, id: 'MotionVideo', inputProps: plan, browserExecutable });
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: opts.outFile,
    inputProps: plan,
    browserExecutable,
    scale: opts.scale ?? 1,
    crf: 20,
    audioCodec: 'aac',
    concurrency: Number(process.env.RENDER_CONCURRENCY ?? 0) || null,
    timeoutInMilliseconds: 120_000,
    onProgress: ({ progress }) => opts.onProgress?.(progress),
  });
  return plan;
};
