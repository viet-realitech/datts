export type EngineId = 'elevenlabs' | 'custom';
export interface SynthSettings { stability: number; similarity: number; style: number; speed: number }
export interface Clip { name: string; blob: Blob; text: string }
export interface Model { id: string; name: string; vi: boolean }
export interface SynthRequest {
  remoteId?: string; clips: Clip[]; text: string; model: string; settings: SynthSettings;
  previousText?: string; nextText?: string;
}
export interface Engine {
  id: EngineId; label: string;
  /** true nếu cần tạo giọng trên máy chủ trước khi tổng hợp. */
  needsVoice: boolean;
  models(): Promise<Model[]>;
  createVoice(name: string, clips: Clip[], denoise: boolean): Promise<string>;
  deleteVoice(remoteId: string): Promise<void>;
  synthesize(req: SynthRequest): Promise<Blob>;
}

export const PRESETS: { id: string; label: string; settings: SynthSettings }[] = [
  { id: 'thuyet-minh', label: 'Thuyết minh điềm tĩnh', settings: { stability: 0.6, similarity: 0.8, style: 0.1, speed: 0.95 } },
  { id: 'podcast', label: 'Podcast tự nhiên', settings: { stability: 0.4, similarity: 0.75, style: 0.3, speed: 1 } },
  { id: 'bieu-cam', label: 'Biểu cảm', settings: { stability: 0.25, similarity: 0.75, style: 0.55, speed: 1 } },
  { id: 'on-dinh', label: 'Ổn định tối đa', settings: { stability: 0.85, similarity: 0.9, style: 0, speed: 0.95 } },
];

/** Model mã nguồn mở bắt chước ngữ điệu của bản thu mẫu, nên chỉ còn tốc độ là chỉnh được. */
export const CUSTOM_PRESETS: typeof PRESETS = [
  { id: 'cham', label: 'Chậm rãi (0,9×)', settings: { stability: 0.5, similarity: 0.75, style: 0, speed: 0.9 } },
  { id: 'thuong', label: 'Tốc độ thường', settings: { stability: 0.5, similarity: 0.75, style: 0, speed: 1 } },
  { id: 'nhanh', label: 'Nhanh gọn (1,1×)', settings: { stability: 0.5, similarity: 0.75, style: 0, speed: 1.1 } },
];
export const presetsFor = (e: EngineId) => (e === 'custom' ? CUSTOM_PRESETS : PRESETS);
export const presetLabel = (id: string) => [...PRESETS, ...CUSTOM_PRESETS].find(p => p.id === id)?.label ?? 'Mặc định';

export async function httpError(res: Response): Promise<Error> {
  let msg = `${res.status} ${res.statusText}`;
  try {
    const j = await res.clone().json();
    const d = j?.detail;
    msg = (typeof d === 'string' ? d : d?.message ?? (Array.isArray(d) ? d.map((x: { msg?: string }) => x.msg).join('; ') : j?.error ?? j?.message)) || msg;
  } catch { /* không phải JSON */ }
  return new Error(msg);
}
