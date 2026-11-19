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
      if (req.finetuned) fd.append('voice', 'finetuned');
      else for (const c of req.clips) fd.append('ref_audio', c.blob, c.name);
      let res: Response;
      try { res = await fetch(`${base}/synthesize`, { method: 'POST', body: fd }); }
      catch { throw new Error('Không gọi được máy chủ riêng. Kiểm tra máy chủ còn chạy và địa chỉ trong mục Dữ liệu còn đúng (địa chỉ đổi mỗi lần chạy lại).'); }
      if (!res.ok) throw await httpError(res);
      return res.blob();
    },
  };
}

export interface TrainStatus { state: 'idle' | 'preparing' | 'training' | 'packaging' | 'done' | 'error'; step: number; total: number; eval_loss: number | null; message: string; log: string[] }
export interface ServerHealth {
  engine?: string; gpu?: boolean; can_train?: boolean; finetuned?: boolean; min_clips?: number;
  dataset?: { clips: number; seconds: number }; train?: TrainStatus;
}
const api = (url: string, path: string) => `${url.replace(/\/+$/, '')}${path}`;
async function json<T>(res: Response): Promise<T> { if (!res.ok) throw await httpError(res); return res.json() as Promise<T>; }

export const serverHealth = async (url: string) => json<ServerHealth>(await fetch(api(url, '/health')));
export const checkServer = async (url: string) => (await serverHealth(url)).engine ?? 'máy chủ không tên';
export const clearDataset = async (url: string) => json<unknown>(await fetch(api(url, '/dataset'), { method: 'DELETE' }));
export async function uploadClip(url: string, name: string, text: string, blob: Blob) {
  const fd = new FormData();
  fd.append('name', name); fd.append('text', text); fd.append('file', blob, `${name}.wav`);
  return json<{ clips: number; seconds: number }>(await fetch(api(url, '/dataset/clip'), { method: 'POST', body: fd }));
}
export async function startTrain(url: string, epochs: number) {
  const fd = new FormData();
  fd.append('epochs', String(epochs));
  return json<TrainStatus>(await fetch(api(url, '/train'), { method: 'POST', body: fd }));
}
export const trainStatus = async (url: string) => json<TrainStatus>(await fetch(api(url, '/train/status')));
