import type { Take } from './db';
import { splitSentences } from './text';

/** Ngữ điệu của một đoạn. Mỗi ngữ điệu ứng với vài câu trong giáo trình, dùng làm mẫu khi clone nhanh. */
export const STYLES = [
  { id: 'chao', label: 'Chào, tươi', items: ['ctx-2-1', 'train-4-1', 'train-4-9', 'full-1-2'] },
  { id: 'ke', label: 'Kể bình thường', items: ['ctx-1-1', 'train-1-1', 'train-3-1', 'cau-1-3', 'train-1-6'] },
  { id: 'hoi', label: 'Hỏi, gợi mở', items: ['ctx-1-2', 'train-5-1', 'train-5-2', 'train-4-13'] },
  { id: 'cam-than', label: 'Ngạc nhiên, hào hứng', items: ['train-5-3', 'train-5-6', 'ctx-2-7', 'ctx-1-3'] },
  { id: 'tam-tinh', label: 'Tâm tình, chậm', items: ['ctx-2-5', 'ctx-2-2', 'train-4-8', 'train-1-30'] },
  { id: 'nghiem', label: 'Nghiêm túc, số liệu', items: ['ctx-2-4', 'train-6-1', 'train-3-7', 'cau-2-4'] },
  { id: 'ket', label: 'Chốt, kết', items: ['ctx-1-8', 'ctx-2-8', 'train-4-22', 'train-4-30'] },
] as const;
export type StyleId = (typeof STYLES)[number]['id'];
export const STYLE_IDS = STYLES.map(s => s.id) as [StyleId, ...StyleId[]];

export interface Segment { id: string; style: StyleId; text: string; newPara: boolean }
export interface Script { title: string; segments: Segment[] }

export const TONES = [
  { id: 'tro-chuyen', label: 'Trò chuyện thân mật', brief: 'Một người dẫn nói chuyện trực tiếp với người nghe, xưng "mình", gọi "bạn". Câu ngắn, có câu hỏi tu từ, có ví dụ đời thường.' },
  { id: 'thuyet-minh', label: 'Thuyết minh', brief: 'Giọng thuyết minh phim tài liệu: điềm tĩnh, giàu hình ảnh, không xưng hô với người nghe.' },
  { id: 'ke-chuyen', label: 'Kể chuyện', brief: 'Kể một câu chuyện có mở, thắt, gỡ; nhịp chậm, có khoảng lặng trước chi tiết quan trọng.' },
  { id: 'giai-thich', label: 'Giải thích kiến thức', brief: 'Giải thích một vấn đề cho người không chuyên: đi từ ví dụ quen thuộc tới ý chính, mỗi ý một đoạn.' },
] as const;
export type ToneId = (typeof TONES)[number]['id'];

/** Kịch bản dán sẵn: mỗi câu một đoạn, đoán ngữ điệu từ dấu câu và vị trí. */
export function scriptFromText(text: string): Segment[] {
  const out: Segment[] = [];
  const paras = text.replace(/\r/g, '').split(/\n\s*\n|\n/).map(p => p.trim()).filter(Boolean);
  paras.forEach((p, pi) => {
    let cur = '';
    const flush = (first: boolean) => {
      if (!cur) return;
      const t = cur.trim();
      const style: StyleId = /\?["”']?$/.test(t) ? 'hoi' : /!["”']?$/.test(t) ? 'cam-than' : pi === 0 && !out.length ? 'chao' : pi === paras.length - 1 && paras.length > 1 ? 'ket' : 'ke';
      out.push({ id: `p${pi}-${out.length}`, style, text: t, newPara: first && out.length > 0 });
      cur = '';
    };
    let first = true;
    for (const s of splitSentences(p)) {
      // Câu hỏi/cảm thán đứng riêng để giữ đúng ngữ điệu; câu kể ngắn thì gộp cho liền hơi.
      const special = /[?!]["”']?$/.test(s);
      if (cur && (special || (cur + ' ' + s).length > 200)) { flush(first); first = false; }
      cur = cur ? `${cur} ${s}` : s;
      if (special) { flush(first); first = false; }
    }
    flush(first);
  });
  return out;
}

/** Bản thu của người dùng hợp với ngữ điệu này nhất (3–8 giây, đã chọn làm bản chính). */
export function referenceFor(style: StyleId, takes: Take[]): Take | undefined {
  const ok = (t: Take) => t.kept && t.metrics.duration >= 3 && t.metrics.duration <= 8.5 && t.metrics.score >= 55;
  for (const id of STYLES.find(s => s.id === style)!.items) {
    const t = takes.find(t => t.itemId === id && ok(t));
    if (t) return t;
  }
  return undefined;
}
