import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Metrics } from './analyze';
import type { Lesson } from './curriculum';
import type { EngineId, SynthSettings } from './engines/types';

export interface Take {
  id: string; itemId: string; lessonId: string; text: string; createdAt: number;
  sampleRate: number; blob: Blob; metrics: Metrics; peaks: number[];
  kept: boolean;            // bản được chọn cho câu này
  transcript?: string; match?: number;
}
export interface Voice {
  id: string; name: string; engine: EngineId; takeIds: string[]; remoteId?: string;
  denoise: boolean; seconds: number; createdAt: number;
  finetuned?: boolean;      // giọng từ model đã train trên máy chủ riêng, không cần bản thu mẫu
}
export interface Trial {
  id: string; voiceId: string; voiceName: string; engine: EngineId; model: string; preset: string;
  settings: SynthSettings; textId: string; text: string; blob: Blob; createdAt: number;
  rating: number; note: string;
}
interface Schema extends DBSchema {
  takes: { key: string; value: Take; indexes: { item: string } };
  lessons: { key: string; value: Lesson };
  voices: { key: string; value: Voice };
  trials: { key: string; value: Trial };
}
type Store = 'takes' | 'lessons' | 'voices' | 'trials';

let dbp: Promise<IDBPDatabase<Schema>> | undefined;
const db = () => (dbp ??= openDB<Schema>('datts', 1, {
  upgrade(d) {
    d.createObjectStore('takes', { keyPath: 'id' }).createIndex('item', 'itemId');
    d.createObjectStore('lessons', { keyPath: 'id' });
    d.createObjectStore('voices', { keyPath: 'id' });
    d.createObjectStore('trials', { keyPath: 'id' });
  },
}));

export const all = async <S extends Store>(s: S) => (await db()).getAll(s) as Promise<Schema[S]['value'][]>;
export const put = async <S extends Store>(s: S, v: Schema[S]['value']) => { await (await db()).put(s, v as never); };
export const del = async (s: Store, id: string) => { await (await db()).delete(s, id); };
export const clearAll = async () => { const d = await db(); await Promise.all((['takes', 'lessons', 'voices', 'trials'] as Store[]).map(s => d.clear(s))); };

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Chọn một bản thu làm bản chính của câu (bỏ chọn các bản khác cùng câu). */
export async function keepTake(takes: Take[], take: Take): Promise<void> {
  for (const t of takes.filter(t => t.itemId === take.itemId && t.kept && t.id !== take.id)) await put('takes', { ...t, kept: false });
  await put('takes', { ...take, kept: true });
}

// Cấu hình nhỏ (khoá API, micro, công thức đang dùng) để ở localStorage trên chính thiết bị này.
export interface Config {
  elevenKey: string; customUrl: string; deviceId: string; claudeKey: string;
  recipe?: { voiceId: string; model: string; preset: string; settings: SynthSettings };
}
const KEY = 'datts.config';
export function loadConfig(): Config {
  const empty: Config = { elevenKey: '', customUrl: '', deviceId: '', claudeKey: '' };
  try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return empty; }
}
export function saveConfig(c: Config) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* chế độ riêng tư */ } }
