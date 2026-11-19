import { useEffect, useMemo, useRef, useState } from 'react';
import { uid } from '../lib/db';
import { getEngine } from '../lib/engines';
import type { SynthSettings } from '../lib/engines/types';
import { download } from '../lib/export';
import { referenceFor, scriptFromText, STYLES, TONES, type Segment, type StyleId, type ToneId } from '../lib/podcast';
import { decodeToMono } from '../lib/recorder';
import { plain } from '../lib/text';
import { concatFloat32, encodeWav } from '../lib/wav';
import { useStore } from '../store';
import { errMsg, fmtSec, Player } from '../ui';
import { clipsOf } from './LabView';

const DRAFT = 'datts.podcast';
interface Draft { source: string; minutes: number; tone: ToneId; host: string; title: string; segments: Segment[]; voiceId: string; byStyle: boolean }
const EMPTY: Draft = { source: '', minutes: 3, tone: 'tro-chuyen', host: '', title: '', segments: [], voiceId: '', byStyle: true };
function loadDraft(): Draft { try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(DRAFT) || '{}') }; } catch { return EMPTY; } }

const PAUSE = 0.32, PARA_PAUSE = 0.85;
const DEFAULTS: SynthSettings = { stability: 0.5, similarity: 0.75, style: 0.2, speed: 1 };

export default function PodcastView({ goLab, goSettings }: { goLab: () => void; goSettings: () => void }) {
  const { takes, voices, cfg } = useStore();
  const [d, setD] = useState(loadDraft);
  const [writing, setWriting] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [error, setError] = useState('');
  const [out, setOut] = useState<{ blob: Blob; seconds: number }>();
  // Âm thanh từng đoạn đã đọc, để sửa một đoạn thì không phải đọc lại cả tập.
  const cache = useRef(new Map<string, { samples: Float32Array; rate: number }>());
  const set = (p: Partial<Draft>) => setD(prev => ({ ...prev, ...p }));
  useEffect(() => { try { localStorage.setItem(DRAFT, JSON.stringify(d)); } catch { /* chế độ riêng tư */ } }, [d]);

  const voice = voices.find(v => v.id === d.voiceId) ?? voices.find(v => v.id === cfg.recipe?.voiceId) ?? voices[voices.length - 1];
  const recipe = cfg.recipe && cfg.recipe.voiceId === voice?.id ? cfg.recipe : undefined;
  const canStyle = !!voice && voice.engine === 'custom' && !voice.finetuned;
  const styled = canStyle && d.byStyle;
  const refs = useMemo(() => new Map(STYLES.map(s => [s.id, referenceFor(s.id, takes)] as const)), [takes]);
  const missing = styled ? [...new Set(d.segments.map(s => s.style))].filter(s => !refs.get(s)) : [];
  const chars = d.segments.reduce((n, s) => n + s.text.length, 0);
  const patch = (id: string, p: Partial<Segment>) => set({ segments: d.segments.map(s => (s.id === id ? { ...s, ...p } : s)) });

  const write = async () => {
    setError(''); setWriting(true);
    const { writeScript, claudeError } = await import('../lib/claude');
    try {
      const script = await writeScript(cfg.claudeKey, { source: d.source.trim(), minutes: d.minutes, tone: d.tone, host: d.host.trim() });
      set({ title: script.title, segments: script.segments }); setOut(undefined);
    } catch (e) { setError(claudeError(e)); }
    setWriting(false);
  };

  const build = async () => {
    if (!voice) return;
    setError(''); setOut(undefined);
    const segs = d.segments.filter(s => plain(s.text));
    try {
      const eng = getEngine(voice.engine, cfg);
      const model = recipe?.model ?? (await eng.models()).find(m => m.vi)?.id ?? (await eng.models())[0].id;
      const settings = recipe?.settings ?? DEFAULTS;
      const base = clipsOf(voice, takes);
      const parts: Float32Array[] = [];
      let rate = 48000;
      for (let i = 0; i < segs.length; i++) {
        setProgress({ done: i, total: segs.length });
        const s = segs[i], text = plain(s.text);
        const ref = styled ? refs.get(s.style) : undefined;
        const clips = ref ? [{ name: `${ref.itemId}.wav`, blob: ref.blob, text: plain(ref.text) }] : base;
        const key = JSON.stringify([voice.id, ref?.id ?? '', model, settings, text]);
        let audio = cache.current.get(key);
        if (!audio) {
          const blob = await eng.synthesize({ remoteId: voice.remoteId, clips, finetuned: voice.finetuned, text, model, settings, previousText: segs[i - 1]?.text, nextText: segs[i + 1]?.text });
          const dec = await decodeToMono(blob);
          audio = { samples: dec.samples, rate: dec.sampleRate };
          cache.current.set(key, audio);
        }
        rate = audio.rate;
        if (i) parts.push(new Float32Array(Math.round(rate * (s.newPara ? PARA_PAUSE : PAUSE))));
        parts.push(audio.samples);
      }
      const all = concatFloat32(parts);
      // Đưa đỉnh về -1 dB để các đoạn đọc từ mẫu khác nhau không lệch âm lượng quá tay khi phát hành.
      let peak = 0;
      for (let i = 0; i < all.length; i++) { const a = Math.abs(all[i]); if (a > peak) peak = a; }
      if (peak > 0) { const g = 0.89 / peak; for (let i = 0; i < all.length; i++) all[i] *= g; }
      setOut({ blob: encodeWav(all, rate), seconds: all.length / rate });
    } catch (e) { setError(`${errMsg(e)} — các đoạn đã đọc xong được giữ lại, bấm “Dựng tập” để đọc tiếp.`); }
    setProgress(undefined);
  };

  return (
    <main className="pad lab">
      <section className="card">
        <h2>1 · Viết kịch bản</h2>
        <p className="dim">Đưa chủ đề, ghi chú hoặc dán cả bài viết. AI soạn thành lời nói tự nhiên, chia đoạn và gắn ngữ điệu cho từng đoạn.</p>
        <label>Chủ đề hoặc tư liệu
          <textarea id="pod-source" rows={5} value={d.source} onChange={e => set({ source: e.target.value })} placeholder="VD: Vì sao dậy sớm khó, và ba cách mình đã thử trong 30 ngày. Hoặc dán nguyên bài blog của bạn." />
        </label>
        <div className="row wrap fields">
          <label>Thời lượng
            <select value={d.minutes} onChange={e => set({ minutes: Number(e.target.value) })}>{[1, 2, 3, 5, 8, 12].map(m => <option key={m} value={m}>khoảng {m} phút</option>)}</select>
          </label>
          <label>Kiểu chương trình
            <select value={d.tone} onChange={e => set({ tone: e.target.value as ToneId })}>{TONES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
          </label>
          <label>Tên người dẫn (tuỳ chọn)<input value={d.host} onChange={e => set({ host: e.target.value })} placeholder="VD: Đạt" /></label>
        </div>
        <div className="row end wrap">
          <button className="ghost" onClick={() => setPasting(true)}>Dán kịch bản có sẵn</button>
          {cfg.claudeKey
            ? <button className="primary" disabled={writing || !d.source.trim()} onClick={write}>{writing ? 'Đang viết… (khoảng nửa phút)' : d.segments.length ? 'Viết lại kịch bản' : 'Viết kịch bản'}</button>
            : <button className="primary" onClick={goSettings}>Nhập khoá Claude để AI viết</button>}
        </div>
      </section>

      {d.segments.length > 0 && (
        <section className="card">
          <h2>2 · Kịch bản</h2>
          <p className="dim">Sửa lời cho đúng ý bạn và đổi ngữ điệu nếu AI gắn chưa hợp. Muốn nhấn một ý, hãy tách nó thành một đoạn ngắn riêng.</p>
          <label>Tên tập<input value={d.title} onChange={e => set({ title: e.target.value })} /></label>
          <ol className="segments">
            {d.segments.map((s, i) => (
              <li key={s.id} className={s.newPara ? 'para' : ''}>
                <div className="seg-head">
                  <select aria-label={`Ngữ điệu đoạn ${i + 1}`} value={s.style} onChange={e => patch(s.id, { style: e.target.value as StyleId })}>
                    {STYLES.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
                  </select>
                  <label className="row"><input type="checkbox" checked={s.newPara} disabled={i === 0} onChange={e => patch(s.id, { newPara: e.target.checked })} /> Nghỉ dài trước đoạn</label>
                  <button className="ghost danger" aria-label={`Xoá đoạn ${i + 1}`} onClick={() => set({ segments: d.segments.filter(x => x.id !== s.id) })}>Xoá</button>
                </div>
                <textarea aria-label={`Lời đoạn ${i + 1}`} rows={Math.max(2, Math.ceil(s.text.length / 70))} value={s.text} onChange={e => patch(s.id, { text: e.target.value })} />
              </li>
            ))}
          </ol>
          <div className="row between wrap">
            <button className="ghost" onClick={() => set({ segments: [...d.segments, { id: uid(), style: 'ke', text: '', newPara: false }] })}>＋ Thêm đoạn</button>
            <span className="dim">{d.segments.length} đoạn · {chars.toLocaleString('vi')} ký tự · ước chừng {fmtSec(chars / 14.5)}</span>
          </div>
        </section>
      )}

      {d.segments.length > 0 && (
        <section className="card">
          <h2>3 · Dựng tập</h2>
          {!voice ? (
            <><p>Chưa có giọng nào. Tạo giọng clone hoặc train model riêng trong tab Thử mẫu trước.</p><button className="primary" onClick={goLab}>Sang Thử mẫu</button></>
          ) : (
            <>
              <div className="row wrap fields">
                <label>Giọng đọc
                  <select value={voice.id} onChange={e => set({ voiceId: e.target.value })}>{voices.map(v => <option key={v.id} value={v.id}>{v.name}{v.finetuned ? ' (đã train)' : ''}</option>)}</select>
                </label>
                {canStyle && <label className="row"><input type="checkbox" checked={d.byStyle} onChange={e => set({ byStyle: e.target.checked })} /> Đổi mẫu theo ngữ điệu từng đoạn</label>}
              </div>
              <p className="dim">
                {voice.finetuned ? 'Model đã train đọc cả tập bằng một chất giọng thống nhất; nhãn ngữ điệu chỉ còn dùng để ngắt đoạn.'
                  : styled ? 'Mỗi đoạn được clone từ bản thu của chính bạn có cùng ngữ điệu (câu hỏi lấy mẫu câu hỏi, lời chào lấy mẫu lời chào…), nên tập nghe có lên xuống.'
                  : 'Cả tập đọc theo ngữ điệu của mẫu giọng đã chọn.'}
                {recipe ? ' Tốc độ và thông số lấy từ công thức bạn chọn ở Studio.' : ''}
              </p>
              {missing.length > 0 && <p className="warn">Chưa có bản thu mẫu cho ngữ điệu: {missing.map(m => STYLES.find(s => s.id === m)!.label).join(', ')}. Các đoạn đó sẽ dùng mẫu của giọng đã chọn. Thu các bài “Ngữ cảnh” và “Dẫn podcast” để có đủ.</p>}
              <div className="row end wrap">
                <button className="primary" disabled={!!progress} onClick={build}>{progress ? `Đang đọc đoạn ${progress.done + 1}/${progress.total}…` : out ? 'Dựng lại' : 'Dựng tập'}</button>
              </div>
              {progress && <div className="bar"><i style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>}
            </>
          )}
          {out && (
            <div className="result">
              <Player blob={out.blob} />
              <span className="dim">{fmtSec(out.seconds)}</span>
              <button className="ghost" onClick={() => download(out.blob, `${(d.title || 'podcast').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60)}.wav`)}>Tải WAV</button>
            </div>
          )}
        </section>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      {pasting && <PasteScript onClose={() => setPasting(false)} onDone={segments => { set({ segments, title: d.title || 'Tập mới' }); setOut(undefined); setPasting(false); }} />}
    </main>
  );
}

function PasteScript({ onClose, onDone }: { onClose: () => void; onDone: (s: Segment[]) => void }) {
  const [text, setText] = useState('');
  const segs = scriptFromText(text);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Dán kịch bản có sẵn">
      <form className="sheet" onSubmit={e => { e.preventDefault(); onDone(segs.map(s => ({ ...s, id: uid() }))); }}>
        <h2>Dán kịch bản có sẵn</h2>
        <p className="dim">App tự chia đoạn theo câu và đoán ngữ điệu từ dấu câu. Bạn chỉnh lại ở bước sau.</p>
        <textarea id="pod-paste" aria-label="Kịch bản" rows={10} value={text} onChange={e => setText(e.target.value)} required />
        <div className="row end">
          <span className="dim">{segs.length} đoạn</span>
          <button type="button" className="ghost" onClick={onClose}>Huỷ</button>
          <button className="primary" disabled={!segs.length}>Dùng kịch bản này</button>
        </div>
      </form>
    </div>
  );
}
