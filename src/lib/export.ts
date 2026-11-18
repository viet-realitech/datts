import { zipSync, strToU8 } from 'fflate';
import type { Take } from './db';
import { plain } from './text';

/** Gói bản thu thành bộ dữ liệu kiểu LJSpeech: wavs/*.wav + metadata.csv (id|văn bản) + takes.json. */
export async function buildDataset(takes: Take[]): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  const rows: string[] = [];
  const meta: unknown[] = [];
  const sorted = [...takes].sort((a, b) => a.itemId.localeCompare(b.itemId) || a.createdAt - b.createdAt);
  const seen = new Map<string, number>();
  for (const t of sorted) {
    const n = (seen.get(t.itemId) ?? 0) + 1; seen.set(t.itemId, n);
    const id = n === 1 ? t.itemId : `${t.itemId}_${n}`;
    files[`wavs/${id}.wav`] = new Uint8Array(await t.blob.arrayBuffer());
    rows.push(`${id}|${plain(t.text)}`);
    meta.push({ id, lesson: t.lessonId, text: plain(t.text), markedText: t.text, sampleRate: t.sampleRate, kept: t.kept, transcript: t.transcript, match: t.match, metrics: t.metrics });
  }
  files['metadata.csv'] = strToU8(rows.join('\n') + '\n');
  files['takes.json'] = strToU8(JSON.stringify(meta, null, 2));
  // WAV không nén thêm được bao nhiêu; lưu nguyên để nhanh và nhẹ RAM trên iPad.
  return new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}
