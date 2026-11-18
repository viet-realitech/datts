import { httpError, type Clip, type Engine, type Model, type SynthRequest } from './types';

const API = 'https://api.elevenlabs.io/v1';
// Dùng khi không tải được danh sách model từ tài khoản.
const FALLBACK: Model[] = [
  { id: 'eleven_v3', name: 'Eleven v3', vi: true },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', vi: true },
  { id: 'eleven_flash_v2_5', name: 'Flash v2.5', vi: true },
];

export function elevenlabs(key: string): Engine {
  const h = { 'xi-api-key': key };
  let cache: Model[] | undefined;
  const models = async (): Promise<Model[]> => {
    if (cache) return cache;
    try {
      const res = await fetch(`${API}/models`, { headers: h });
      if (!res.ok) throw await httpError(res);
      const list = (await res.json()) as { model_id: string; name: string; can_do_text_to_speech?: boolean; languages?: { language_id: string }[] }[];
      const out = list.filter(m => m.can_do_text_to_speech).map(m => ({ id: m.model_id, name: m.name, vi: !!m.languages?.some(l => l.language_id === 'vi') }));
      return (cache = out.length ? out.sort((a, b) => Number(b.vi) - Number(a.vi)) : FALLBACK);
    } catch (e) {
      if (e instanceof Error && /401|invalid|api key/i.test(e.message)) throw e;
      return FALLBACK;
    }
  };
  return {
    id: 'elevenlabs', label: 'ElevenLabs', needsVoice: true, models,
    async createVoice(name: string, clips: Clip[], denoise: boolean) {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('description', 'Tạo từ Datts');
      fd.append('labels', JSON.stringify({ language: 'vi' }));
      fd.append('remove_background_noise', String(denoise));
      for (const c of clips) fd.append('files', c.blob, c.name);
      const res = await fetch(`${API}/voices/add`, { method: 'POST', headers: h, body: fd });
      if (!res.ok) throw await httpError(res);
      return ((await res.json()) as { voice_id: string }).voice_id;
    },
    async deleteVoice(remoteId: string) {
      const res = await fetch(`${API}/voices/${remoteId}`, { method: 'DELETE', headers: h });
      if (!res.ok && res.status !== 404) throw await httpError(res);
    },
    async synthesize(req: SynthRequest) {
      if (!req.remoteId) throw new Error('Giọng này chưa được tạo trên ElevenLabs.');
      const vi = (await models()).find(m => m.id === req.model)?.vi;
      const s = req.settings;
      const res = await fetch(`${API}/text-to-speech/${req.remoteId}?output_format=mp3_44100_128`, {
        method: 'POST', headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: req.text, model_id: req.model,
          ...(vi ? { language_code: 'vi' } : {}),
          ...(req.previousText ? { previous_text: req.previousText } : {}),
          ...(req.nextText ? { next_text: req.nextText } : {}),
          voice_settings: { stability: s.stability, similarity_boost: s.similarity, style: s.style, speed: s.speed, use_speaker_boost: true },
        }),
      });
      if (!res.ok) throw await httpError(res);
      return res.blob();
    },
  };
}

/** Nhận dạng bản thu (Scribe) để kiểm tra đọc có đúng kịch bản không. */
export async function transcribe(key: string, blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append('model_id', 'scribe_v2');
  fd.append('language_code', 'vi');
  fd.append('file', blob, 'take.wav');
  const res = await fetch(`${API}/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': key }, body: fd });
  if (!res.ok) throw await httpError(res);
  return ((await res.json()) as { text: string }).text ?? '';
}
