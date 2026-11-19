import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/analyze';
import { chunkText, compare, countSyllables, plain, splitSentences } from '../src/lib/text';
import { concatFloat32, encodeWav, trimSilence } from '../src/lib/wav';
import { referenceFor, scriptFromText, STYLES } from '../src/lib/podcast';
import { LESSONS } from '../src/lib/curriculum';
import { TRAIN_LESSONS } from '../src/lib/corpus';
import type { Take } from '../src/lib/db';

const SR = 48000;
/** Im lặng (nhiễu nền) – giọng giả (sin) – im lặng. */
function fake(amp: number, noise = 0.0005, lead = 0.5, body = 2, trail = 0.5): Float32Array {
  const out = new Float32Array(Math.round((lead + body + trail) * SR));
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = rnd() * noise + (t >= lead && t < lead + body ? amp * Math.sin(2 * Math.PI * 180 * t) : 0);
  }
  return out;
}

describe('analyze', () => {
  it('chấm cao bản thu sạch, mức vừa', () => {
    const m = analyze(fake(0.25), SR, 'một hai ba bốn năm sáu bảy tám');
    expect(m.issues).toEqual([]);
    expect(m.score).toBe(100);
    expect(m.lead).toBeCloseTo(0.5, 1);
    expect(m.trail).toBeCloseTo(0.5, 1);
    expect(m.rate).toBeCloseTo(4, 0);
    expect(m.snrDb).toBeGreaterThan(40);
  });
  it('bắt lỗi vỡ tiếng', () => {
    const s = fake(1.4).map(x => Math.max(-1, Math.min(1, x)));
    const m = analyze(s, SR);
    expect(m.clipped).toBeGreaterThan(3);
    expect(m.issues[0].level).toBe('bad');
  });
  it('bắt lỗi quá nhỏ, phòng ồn, cắt sát', () => {
    expect(analyze(fake(0.01), SR).issues.some(i => i.text.includes('quá nhỏ'))).toBe(true);
    expect(analyze(fake(0.25, 0.02), SR).issues.some(i => i.text.includes('ồn'))).toBe(true);
    expect(analyze(fake(0.25, 0.0005, 0.02, 2, 0.02), SR).issues.filter(i => i.text.includes('sát') || i.text.includes('sớm'))).toHaveLength(2);
  });
  it('im lặng hoàn toàn thì 0 điểm', () => {
    expect(analyze(new Float32Array(SR), SR).score).toBe(0);
  });
});

describe('wav', () => {
  it('ghi header đúng và giữ độ dài', async () => {
    const b = encodeWav(new Float32Array([0, 1, -1, 0.5]), SR);
    const v = new DataView(await b.arrayBuffer());
    expect(b.size).toBe(44 + 8);
    expect(v.getUint32(24, true)).toBe(SR);
    expect(v.getInt16(46, true)).toBe(32767);
    expect(v.getInt16(48, true)).toBe(-32768);
  });
  it('cắt im lặng nhưng chừa đệm', () => {
    const s = fake(0.25, 0.0005, 2, 1, 2);
    const m = analyze(s, SR);
    expect(trimSilence(s, SR, m.speechStart, m.speechEnd).length / SR).toBeCloseTo(1.6, 1);
    expect(concatFloat32([new Float32Array(2), new Float32Array(3)]).length).toBe(5);
  });
});

describe('text', () => {
  it('bỏ dấu nhấn và đếm âm tiết', () => {
    expect(plain('Tôi *không* nói.')).toBe('Tôi không nói.');
    expect(countSyllables('Tôi *không* nói anh ấy lấy tiền.')).toBe(7);
  });
  it('so khớp lời đọc, chỉ ra chữ sai', () => {
    expect(compare('Xin chào, các bạn!', 'xin chào các bạn').score).toBe(1);
    const r = compare('Mẹ mua mớ rau muống', 'mẹ mua mớ rau muốn');
    expect(r.score).toBeCloseTo(0.8);
    expect(r.words.filter(w => !w.ok).map(w => w.word)).toEqual(['muống']);
    expect(compare('một hai ba', 'một ba').words.map(w => w.ok)).toEqual([true, false, true]);
    expect(compare('một hai', '').score).toBe(0);
  });
  it('tách câu và gom đoạn', () => {
    expect(splitSentences('Câu một. Câu hai? Câu ba…\nCâu bốn')).toHaveLength(4);
    const chunks = chunkText('A một. B hai. C ba.\n\nĐoạn hai.', 11);
    expect(chunks).toEqual(['A một.', 'B hai.', 'C ba.', 'Đoạn hai.']);
    expect(chunkText('A một. B hai.', 100)).toEqual(['A một. B hai.']);
  });
});

describe('podcast', () => {
  it('chia kịch bản dán sẵn thành đoạn và đoán ngữ điệu', () => {
    const segs = scriptFromText('Xin chào các bạn. Hôm nay mình kể một chuyện.\n\nBạn có tin không? Thật bất ngờ! Mình thì tin. Và mình sẽ nói vì sao.\n\nHẹn gặp lại tuần sau.');
    expect(segs.map(s => s.style)).toEqual(['chao', 'hoi', 'cam-than', 'ke', 'ket']);
    expect(segs.map(s => s.newPara)).toEqual([false, true, false, false, true]);
    expect(segs[3].text).toBe('Mình thì tin. Và mình sẽ nói vì sao.');
  });
  it('mọi câu mẫu ngữ điệu đều có thật trong giáo trình', () => {
    const ids = new Set([...LESSONS, ...TRAIN_LESSONS].flatMap(l => l.items.map(i => i.id)));
    for (const s of STYLES) for (const id of s.items) expect(ids.has(id), `${s.id}: ${id}`).toBe(true);
  });
  it('chọn bản thu mẫu theo ngữ điệu, bỏ qua bản quá dài hoặc chưa chọn', () => {
    const take = (itemId: string, duration: number, kept = true) => ({ itemId, kept, metrics: { duration, score: 90 } }) as unknown as Take;
    const takes = [take('ctx-1-2', 12), take('train-5-1', 5), take('ctx-2-1', 4, false)];
    expect(referenceFor('hoi', takes)?.itemId).toBe('train-5-1');
    expect(referenceFor('chao', takes)).toBeUndefined();
  });
});
