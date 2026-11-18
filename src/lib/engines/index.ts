import type { Config } from '../db';
import { custom } from './custom';
import { elevenlabs } from './elevenlabs';
import type { Engine, EngineId } from './types';

export function getEngine(id: EngineId, cfg: Config): Engine {
  if (id === 'custom') {
    if (!cfg.customUrl) throw new Error('Chưa nhập địa chỉ máy chủ riêng trong mục Cài đặt.');
    return custom(cfg.customUrl);
  }
  if (!cfg.elevenKey) throw new Error('Chưa nhập khoá API ElevenLabs trong mục Cài đặt.');
  return elevenlabs(cfg.elevenKey);
}
export const availableEngines = (cfg: Config): EngineId[] => [...(cfg.elevenKey ? ['elevenlabs' as const] : []), ...(cfg.customUrl ? ['custom' as const] : [])];
