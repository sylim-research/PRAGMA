// Prepare fixed demo audio using the existing TTS service.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const output = new URL('public/demo-audio/', root);
const voices = { ko: 'tjTX4kAaf3HNGHJnq6iy', zh: 'nUrEpZ0St3GU2UgOHW3h' };
const snapshots = [['ko', 'representativeMissionSnapshot.ts'], ['zh', 'reverseRepresentativeSnapshot.ts']];
const hash = value => createHash('sha256').update(value).digest('hex');
const base = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!base || !key) throw new Error('Existing Supabase URL and publishable key are required.');
await mkdir(output, { recursive: true });
const recordings = [];
let previous = [];
try { previous = JSON.parse(await readFile(new URL('manifest.json', output), 'utf8')).recordings; } catch {}
for (const [language, file] of snapshots) {
  const source = await readFile(new URL(`src/lib/demo/${file}`, root), 'utf8');
  const snapshot = JSON.parse(source.slice(source.indexOf('=') + 1).trim().replace(/;$/, ''));
  const sourceText = snapshot.mission_content.production_task.source_text;
  const cached = previous.find(item => item.language === language && item.sourceText === sourceText && item.voiceId === voices[language]);
  let reusable = false;
  if (cached) {
    try { reusable = hash(await readFile(new URL(`public${cached.src}`, root))) === cached.audioSha256; } catch {}
  }
  if (reusable) {
    recordings.push(cached);
  } else {
    const response = await fetch(`${base}/functions/v1/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, apikey: key },
      body: JSON.stringify({ text: sourceText, lang: language, level: 'intermediate' }),
      signal: AbortSignal.timeout(90_000),
    });
    const provider = response.headers.get('X-TTS-Provider');
    const voiceId = response.headers.get('X-TTS-Voice-Id');
    if (!response.ok || provider !== 'elevenlabs' || voiceId !== voices[language]
      || response.headers.get('X-TTS-Fallback-Used') !== '0'
      || !response.headers.get('Content-Type')?.startsWith('audio/')) {
      throw new Error(`Unexpected ${language} audio response: status=${response.status}, provider=${provider}, voice=${voiceId}`);
    }
    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length < 1000) throw new Error(`Incomplete ${language} audio`);
    const audioSha256 = hash(audio);
    const filename = `${language}-${audioSha256.slice(0, 12)}.mp3`;
    await writeFile(new URL(filename, output), audio);
    recordings.push({ language, sourceText, sourceTextSha256: hash(sourceText),
      src: `/demo-audio/${filename}`, provider, model: response.headers.get('X-TTS-Model'),
      voiceId, audioSha256, bytes: audio.length, generatedAt: new Date().toISOString() });
  }
  await writeFile(new URL('manifest.json', output), JSON.stringify({ recordings }, null, 2) + '\n');
  console.log(`${language}: ${recordings.at(-1).voiceId}, ${recordings.at(-1).bytes} bytes`);
}
