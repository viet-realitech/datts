import { httpError, type Engine, type SynthRequest } from './types';

/**
 * Máy chủ tự dựng (F5-TTS, viXTTS, GPT-SoVITS… bọc sau một endpoint).
 * Hợp đồng: POST {url}/synthesize, multipart gồm text, ref_text, speed, và các file ref_audio (WAV);
 * trả về thân là âm thanh (audio/wav hoặc audio/mpeg). Mô tả đầy đủ trong README.
 */
export function custom(url: string): Engine {
  const base = url.replace(/\/+$/, '');
  return {
    id: 'custom', label: 'Máy chủ riêng', needsVoice: false,
    models: async () => [{ id: 'default', name: 'Mặc định của máy chủ', vi: true }],
    createVoice: async () => '',
    deleteVoice: async () => {},
    async synthesize(req: SynthRequest) {
      const fd = new FormData();
      fd.append('text', req.text);
      fd.append('ref_text', req.clips.map(c => c.text).join(' '));
      fd.append('speed', String(req.settings.speed));
      fd.append('model', req.model);
      for (const c of req.clips) fd.append('ref_audio', c.blob, c.name);
      const res = await fetch(`${base}/synthesize`, { method: 'POST', body: fd });
      if (!res.ok) throw await httpError(res);
      return res.blob();
    },
  };
}
