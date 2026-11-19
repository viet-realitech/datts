import { httpError, type Engine, type SynthRequest } from './types';

/**
 * Máy chủ mã nguồn mở tự chạy — `server/datts_server.py` (VieNeu-TTS) hoặc bất kỳ máy chủ nào theo cùng hợp đồng:
 * POST {url}/synthesize, multipart gồm text, speed, temperature, ref_text và các file ref_audio (WAV);
 * trả về thân là âm thanh. GET {url}/health trả JSON có `engine`.
 */
export function custom(url: string): Engine {
  const base = url.replace(/\/+$/, '');
  return {
    id: 'custom', label: 'Máy chủ riêng', needsVoice: false,
    models: async () => [{ id: 'default', name: 'Model của máy chủ', vi: true }],
    createVoice: async () => '',
    deleteVoice: async () => {},
    async synthesize(req: SynthRequest) {
      const fd = new FormData();
      fd.append('text', req.text);
      fd.append('ref_text', req.clips.map(c => c.text).join(' '));
      fd.append('speed', String(req.settings.speed));
      fd.append('temperature', String(req.settings.temperature ?? 0.8));
      for (const c of req.clips) fd.append('ref_audio', c.blob, c.name);
      let res: Response;
      try { res = await fetch(`${base}/synthesize`, { method: 'POST', body: fd }); }
      catch { throw new Error('Không gọi được máy chủ riêng. Kiểm tra máy chủ còn chạy và địa chỉ trong mục Dữ liệu còn đúng (địa chỉ đổi mỗi lần chạy lại).'); }
      if (!res.ok) throw await httpError(res);
      return res.blob();
    },
  };
}

export async function checkServer(url: string): Promise<string> {
  const res = await fetch(`${url.replace(/\/+$/, '')}/health`);
  if (!res.ok) throw await httpError(res);
  return ((await res.json()) as { engine?: string }).engine ?? 'máy chủ không tên';
}
