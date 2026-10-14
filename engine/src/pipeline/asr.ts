import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { Word } from '../plan/schema';

const run = promisify(execFile);
const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

export type Transcript = { language: string | null; words: Word[]; provider: string };

/** Whisper-family APIs want ISO-639-1; dialect codes collapse to the base language. */
const baseLang = (lang?: string | null) => (lang ? lang.split('-')[0] : undefined);

const cleanWords = (words: Word[]): Word[] =>
  words
    .filter((w) => w.text.trim())
    .map((w) => ({ text: w.text.trim(), startMs: Math.max(0, Math.round(w.startMs)), endMs: Math.max(Math.round(w.startMs) + 1, Math.round(w.endMs)) }))
    .sort((a, b) => a.startMs - b.startMs);

/** faster-whisper on the worker's CPU: free, no API key. */
const local = async (file: string, lang?: string | null): Promise<Transcript> => {
  const python = process.env.PYTHON ?? 'python3';
  const { stdout } = await run(python, [path.join(root, 'asr/transcribe.py'), file, lang ?? 'auto'], {
    maxBuffer: 64 * 1024 * 1024,
    timeout: 15 * 60 * 1000,
  });
  const out = JSON.parse(stdout) as { language: string; words: Word[] };
  return { language: out.language, words: cleanWords(out.words), provider: 'local-whisper' };
};

/** OpenAI-compatible transcription endpoint (OpenAI or Groq). */
const openaiCompatible = async (file: string, lang: string | null | undefined, cfg: { url: string; key: string; model: string; name: string }) => {
  const form = new FormData();
  form.append('file', new Blob([await readFile(file)]), path.basename(file));
  form.append('model', cfg.model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const l = baseLang(lang);
  if (l) form.append('language', l);
  const res = await fetch(cfg.url, { method: 'POST', headers: { Authorization: `Bearer ${cfg.key}` }, body: form });
  if (!res.ok) throw new Error(`${cfg.name} transcription failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { language?: string; words?: { word: string; start: number; end: number }[] };
  return {
    language: body.language ?? null,
    words: cleanWords((body.words ?? []).map((w) => ({ text: w.word, startMs: w.start * 1000, endMs: w.end * 1000 }))),
    provider: cfg.name,
  };
};

/** ElevenLabs Scribe: strong on Arabic dialects. */
const elevenlabs = async (file: string, lang?: string | null): Promise<Transcript> => {
  const form = new FormData();
  form.append('file', new Blob([await readFile(file)]), path.basename(file));
  form.append('model_id', process.env.ELEVENLABS_STT_MODEL ?? 'scribe_v1');
  form.append('timestamps_granularity', 'word');
  const l = baseLang(lang);
  if (l) form.append('language_code', l);
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! },
    body: form,
  });
  if (!res.ok) throw new Error(`ElevenLabs transcription failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { language_code?: string; words?: { text: string; start: number; end: number; type?: string }[] };
  return {
    language: body.language_code ?? null,
    words: cleanWords(
      (body.words ?? []).filter((w) => !w.type || w.type === 'word').map((w) => ({ text: w.text, startMs: w.start * 1000, endMs: w.end * 1000 })),
    ),
    provider: 'elevenlabs',
  };
};

/**
 * Transcribe with the configured provider (ASR_PROVIDER = local | openai | groq | elevenlabs).
 * Defaults to the first provider with a key, else local Whisper.
 */
export const transcribe = async (file: string, lang?: string | null): Promise<Transcript> => {
  const provider =
    process.env.ASR_PROVIDER ??
    (process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : process.env.GROQ_API_KEY ? 'groq' : process.env.OPENAI_API_KEY ? 'openai' : 'local');
  switch (provider) {
    case 'elevenlabs':
      return elevenlabs(file, lang);
    case 'groq':
      return openaiCompatible(file, lang, {
        url: 'https://api.groq.com/openai/v1/audio/transcriptions',
        key: process.env.GROQ_API_KEY!,
        model: process.env.GROQ_STT_MODEL ?? 'whisper-large-v3',
        name: 'groq',
      });
    case 'openai':
      return openaiCompatible(file, lang, {
        url: 'https://api.openai.com/v1/audio/transcriptions',
        key: process.env.OPENAI_API_KEY!,
        model: 'whisper-1',
        name: 'openai',
      });
    default:
      return local(file, lang);
  }
};
