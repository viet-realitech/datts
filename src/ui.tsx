import { useEffect, useRef } from 'react';
import { useObjectUrl } from './store';

export function Player({ blob }: { blob: Blob }) {
  const url = useObjectUrl(blob);
  return url ? <audio controls preload="metadata" src={url} /> : null;
}

export function Wave({ peaks, from, to }: { peaks: number[]; from?: number; to?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d'); if (!g) return;
    g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
    const css = getComputedStyle(c);
    const bw = w / peaks.length;
    peaks.forEach((p, i) => {
      const x = i / peaks.length;
      const inside = from === undefined || to === undefined || (x >= from && x <= to);
      g.fillStyle = p >= 0.999 ? css.getPropertyValue('--bad') : inside ? css.getPropertyValue('--accent') : css.getPropertyValue('--muted');
      const bh = Math.max(1, p * h);
      g.fillRect(i * bw, (h - bh) / 2, Math.max(1, bw - 1), bh);
    });
  }, [peaks, from, to]);
  return <canvas className="wave" ref={ref} />;
}

export function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span className="stars" role="radiogroup" aria-label="Chấm điểm">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} sao`}
          className={n <= value ? 'on' : ''} onClick={() => onChange(value === n ? 0 : n)}>★</button>
      ))}
    </span>
  );
}

/** Hiện văn bản với phần *nhấn* được tô nổi. */
export function Marked({ text }: { text: string }) {
  return <>{text.split(/(\*[^*]+\*)/).map((p, i) => (p.startsWith('*') && p.endsWith('*') ? <mark key={i}>{p.slice(1, -1)}</mark> : <span key={i}>{p}</span>))}</>;
}

export const fmtSec = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${s.toFixed(1)}s`);
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
