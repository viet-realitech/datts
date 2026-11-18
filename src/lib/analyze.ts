import { countSyllables } from './text';

export interface Metrics {
  duration: number;      // giây
  peakDb: number;        // dBFS
  speechDb: number;      // RMS phần có tiếng, dBFS
  noiseDb: number;       // nền ồn, dBFS
  snrDb: number;
  clipped: number;       // số mẫu chạm trần
  lead: number;          // im lặng đầu, giây
  trail: number;         // im lặng cuối, giây
  speechStart: number;
  speechEnd: number;
  rate: number;          // âm tiết / giây (0 nếu không biết văn bản)
  score: number;         // 0..100
  issues: Issue[];
}
export interface Issue { level: 'bad' | 'warn'; text: string }

const db = (x: number) => (x > 1e-10 ? 20 * Math.log10(x) : -100);
const FRAME = 0.02;

export function analyze(samples: Float32Array, sampleRate: number, text = ''): Metrics {
  const n = Math.max(1, Math.round(FRAME * sampleRate));
  const frames: number[] = [];
  let peak = 0, clipped = 0;
  for (let i = 0; i + n <= samples.length; i += n) {
    let sum = 0;
    for (let j = i; j < i + n; j++) {
      const a = Math.abs(samples[j]);
      if (a > peak) peak = a;
      if (a >= 0.999) clipped++;
      sum += samples[j] * samples[j];
    }
    frames.push(db(Math.sqrt(sum / n)));
  }
  const duration = samples.length / sampleRate;
  const sorted = [...frames].sort((a, b) => a - b);
  const pct = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : -100);
  const noiseDb = pct(0.1);
  const loud = pct(0.95);
  // Ngưỡng "có tiếng": cao hơn nền 12 dB nhưng không quá sát đỉnh giọng.
  const thr = Math.max(-55, Math.min(noiseDb + 12, loud - 6));
  let first = -1, last = -1, e = 0, voiced = 0;
  frames.forEach((f, i) => {
    if (f > thr) {
      if (first < 0) first = i;
      last = i; voiced++;
      e += Math.pow(10, f / 10);
    }
  });
  const has = first >= 0 && loud > -55;
  const speechStart = has ? first * FRAME : 0;
  const speechEnd = has ? (last + 1) * FRAME : duration;
  const speechDb = has ? 10 * Math.log10(e / voiced) : -100;
  const lead = speechStart, trail = Math.max(0, duration - speechEnd);
  const span = speechEnd - speechStart;
  const syl = countSyllables(text);
  const rate = has && syl > 0 && span > 0.2 ? syl / span : 0;
  const snrDb = has ? speechDb - noiseDb : 0;
  const peakDb = db(peak);

  const issues: Issue[] = [];
  let score = 100;
  const add = (level: Issue['level'], t: string, cost: number) => { issues.push({ level, text: t }); score -= cost; };
  if (!has) add('bad', 'Không nghe thấy giọng — kiểm tra micro đã chọn đúng DJI Mic chưa.', 100);
  else {
    if (clipped > 3 || peakDb > -0.3) add('bad', 'Vỡ tiếng (clip). Giảm gain trên DJI Mic hoặc nói xa mic hơn.', 45);
    else if (peakDb > -3) add('warn', 'Đỉnh âm lượng hơi sát trần, nên giảm gain một nấc.', 10);
    if (speechDb < -36) add('bad', 'Giọng quá nhỏ. Tăng gain hoặc gắn mic gần miệng hơn (khoảng một gang tay).', 30);
    else if (speechDb < -30) add('warn', 'Giọng hơi nhỏ, tăng gain một nấc sẽ sạch hơn.', 10);
    if (noiseDb > -45) add('bad', 'Phòng ồn. Tắt quạt/điều hoà, đóng cửa rồi thu lại.', 30);
    else if (snrDb < 30) add('warn', 'Nền hơi ồn so với giọng. Thử phòng yên tĩnh hơn.', 12);
    if (lead < 0.12) add('warn', 'Bắt đầu nói quá sớm — chờ nửa giây sau khi bấm thu.', 8);
    if (trail < 0.12) add('warn', 'Dừng thu quá sát — chờ nửa giây sau chữ cuối.', 8);
    if (rate > 6.2) add('warn', 'Đọc hơi nhanh. Thuyết minh thường ở mức 3,5–5 âm tiết/giây.', 10);
    else if (rate > 0 && rate < 2.2) add('warn', 'Đọc hơi chậm, dễ nghe rời rạc.', 6);
  }
  return {
    duration, peakDb, speechDb, noiseDb, snrDb, clipped, lead, trail, speechStart, speechEnd, rate,
    score: Math.max(0, Math.round(score)), issues,
  };
}

/** Thu nhỏ sóng âm thành `width` cột đỉnh để vẽ. */
export function peaks(samples: Float32Array, width: number): Float32Array {
  const out = new Float32Array(width);
  const step = samples.length / width;
  for (let x = 0; x < width; x++) {
    let m = 0;
    const end = Math.min(samples.length, Math.floor((x + 1) * step));
    for (let i = Math.floor(x * step); i < end; i++) { const a = Math.abs(samples[i]); if (a > m) m = a; }
    out[x] = m;
  }
  return out;
}
