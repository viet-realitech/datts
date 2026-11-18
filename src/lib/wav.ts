/** Mã hoá PCM float mono thành WAV 16-bit. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

export function concatFloat32(chunks: Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/** Cắt bớt im lặng ở hai đầu, chừa lại `padSec` giây đệm. */
export function trimSilence(samples: Float32Array, sampleRate: number, start: number, end: number, padSec = 0.3): Float32Array {
  const pad = Math.round(padSec * sampleRate);
  const a = Math.max(0, Math.round(start * sampleRate) - pad);
  const b = Math.min(samples.length, Math.round(end * sampleRate) + pad);
  return b > a ? samples.slice(a, b) : samples;
}
