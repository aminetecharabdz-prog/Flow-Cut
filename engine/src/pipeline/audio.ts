import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const FFPROBE = process.env.FFPROBE ?? 'ffprobe';

export const probe = async (file: string) => {
  const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', file]);
  const info = JSON.parse(stdout) as { format?: { duration?: string }; streams?: { codec_type: string }[] };
  return {
    durationMs: Math.round(Number(info.format?.duration ?? 0) * 1000),
    hasVideo: (info.streams ?? []).some((s) => s.codec_type === 'video'),
    hasAudio: (info.streams ?? []).some((s) => s.codec_type === 'audio'),
  };
};

/**
 * Clean up a voice-over: remove rumble, reduce noise, normalise loudness to
 * social-media level (-14 LUFS). Long pauses are shortened only for audio-only
 * sources, because trimming would desync a talking-head video.
 */
export const enhanceVoice = async (input: string, output: string, opts: { trimSilence: boolean }) => {
  const filters = [
    'highpass=f=80',
    'afftdn=nf=-25',
    ...(opts.trimSilence ? ['silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.7:stop_threshold=-45dB'] : []),
    'loudnorm=I=-14:TP=-1.5:LRA=11',
  ];
  await run(FFMPEG, ['-y', '-v', 'error', '-i', input, '-vn', '-af', filters.join(','), '-ar', '48000', '-ac', '1', '-c:a', 'aac', '-b:a', '160k', output], {
    timeout: 5 * 60 * 1000,
  });
};

/** 16 kHz mono WAV for speech recognition. */
export const toAsrWav = async (input: string, output: string) => {
  await run(FFMPEG, ['-y', '-v', 'error', '-i', input, '-vn', '-ar', '16000', '-ac', '1', output], { timeout: 5 * 60 * 1000 });
};

/** Re-encode a talking-head clip to a render-friendly H.264 file (no audio). */
export const normalizeSpeakerVideo = async (input: string, output: string) => {
  await run(
    FFMPEG,
    ['-y', '-v', 'error', '-i', input, '-an', '-vf', "scale='min(1080,iw)':-2,fps=30", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', output],
    { timeout: 10 * 60 * 1000 },
  );
};
