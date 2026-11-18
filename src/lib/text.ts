/** Bỏ ký hiệu nhấn (*từ*) để lấy văn bản thuần dùng làm transcript. */
export const plain = (s: string) => s.replace(/\*/g, '').replace(/\s+/g, ' ').trim();

/** Chuẩn hoá để so khớp: chữ thường, bỏ dấu câu (giữ dấu thanh tiếng Việt). */
export function normalize(s: string): string[] {
  return plain(s).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

/** Tiếng Việt: mỗi âm tiết cách nhau một dấu cách. */
export const countSyllables = (s: string) => normalize(s).length;

export interface DiffWord { word: string; ok: boolean }
/** So bản đọc (ASR) với kịch bản; trả về độ khớp 0..1 và từng từ kịch bản có được đọc đúng không. */
export function compare(script: string, heard: string): { score: number; words: DiffWord[] } {
  const a = normalize(script), b = normalize(heard);
  const m = a.length, n = b.length;
  if (!m) return { score: n ? 0 : 1, words: [] };
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array<number>(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const words: DiffWord[] = [];
  let i = m, j = n;
  while (i > 0) {
    if (j > 0 && a[i - 1] === b[j - 1] && d[i][j] === d[i - 1][j - 1]) { words.push({ word: a[i - 1], ok: true }); i--; j--; }
    else if (j > 0 && d[i][j] === d[i - 1][j - 1] + 1) { words.push({ word: a[i - 1], ok: false }); i--; j--; }
    else if (d[i][j] === d[i - 1][j] + 1) { words.push({ word: a[i - 1], ok: false }); i--; }
    else j--;
  }
  words.reverse();
  return { score: Math.max(0, 1 - d[m][n] / m), words };
}

/** Tách văn bản dài thành các câu để thu từng câu. */
export function splitSentences(s: string): string[] {
  return s.replace(/\r/g, '').split(/(?<=[.!?…])\s+|\n+/).map(x => x.trim()).filter(x => x.length > 1);
}

/** Gom câu thành các đoạn ≤ `max` ký tự để tổng hợp bài dài. */
export function chunkText(s: string, max = 700): string[] {
  const out: string[] = [];
  for (const para of s.replace(/\r/g, '').split(/\n\s*\n|\n/).map(p => p.trim()).filter(Boolean)) {
    let cur = '';
    for (const sent of splitSentences(para)) {
      if (cur && (cur + ' ' + sent).length > max) { out.push(cur); cur = sent; }
      else cur = cur ? cur + ' ' + sent : sent;
    }
    if (cur) out.push(cur);
  }
  return out;
}
