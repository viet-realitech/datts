import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyze, peaks } from '../lib/analyze';
import { STAGES, type Lesson } from '../lib/curriculum';
import { all, del, keepTake, put, uid, type Take } from '../lib/db';
import { transcribe } from '../lib/engines/elevenlabs';
import { listMics, Recorder } from '../lib/recorder';
import { compare, plain, splitSentences } from '../lib/text';
import { encodeWav, trimSilence } from '../lib/wav';
import { useStore } from '../store';
import { errMsg, fmtSec, Marked, Player, Wave } from '../ui';

type Status = 'off' | 'opening' | 'ready' | 'recording';

export default function RecordView() {
  const { takes, lessons, cfg, setCfg, refresh } = useStore();
  const [lessonId, setLessonId] = useState(lessons[0].id);
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState<Status>('off');
  const [error, setError] = useState('');
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [adding, setAdding] = useState(false);
  const rec = useRef<Recorder>(undefined);
  const meter = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0);

  const lesson = lessons.find(l => l.id === lessonId) ?? lessons[0];
  const item = lesson.items[Math.min(idx, lesson.items.length - 1)];
  const itemTakes = useMemo(() => takes.filter(t => t.itemId === item.id).sort((a, b) => b.createdAt - a.createdAt), [takes, item.id]);
  const done = useMemo(() => new Set(takes.filter(t => t.kept).map(t => t.itemId)), [takes]);

  useEffect(() => () => { void rec.current?.close(); }, []);

  const openMic = useCallback(async (deviceId = cfg.deviceId) => {
    setError(''); setStatus('opening');
    try {
      const r = (rec.current ??= new Recorder());
      let hold = 0;
      r.onLevel = p => {
        hold = Math.max(p, hold * 0.92);
        const el = meter.current; if (!el) return;
        const db = hold > 1e-5 ? 20 * Math.log10(hold) : -100;
        el.style.width = `${Math.max(0, Math.min(100, ((db + 60) / 60) * 100))}%`;
        el.dataset.zone = db > -1 ? 'clip' : db > -6 ? 'hot' : 'ok';
      };
      await r.start(deviceId || undefined);
      setMics(await listMics());
      setStatus('ready');
    } catch (e) {
      setStatus('off');
      setError(`Không mở được micro: ${errMsg(e)}. Hãy cho phép quyền micro và mở trang qua HTTPS.`);
    }
  }, [cfg.deviceId]);

  const verify = useCallback(async (take: Take) => {
    if (!cfg.elevenKey) return;
    try {
      const transcript = await transcribe(cfg.elevenKey, take.blob);
      const cur = (await all('takes')).find(t => t.id === take.id);   // có thể đã đổi/xoá trong lúc chờ
      if (!cur) return;
      await put('takes', { ...cur, transcript, match: compare(take.text, transcript).score });
      await refresh();
    } catch (e) { setError(`Chưa kiểm tra được lời đọc: ${errMsg(e)}`); }
  }, [cfg.elevenKey, refresh]);

  const stop = useCallback(async () => {
    const r = rec.current; if (!r) return;
    const raw = r.end();
    setStatus('ready');
    if (raw.length < r.sampleRate * 0.3) return;
    const metrics = analyze(raw, r.sampleRate, item.text);
    const cut = trimSilence(raw, r.sampleRate, metrics.speechStart, metrics.speechEnd);
    const kept = itemTakes.find(t => t.kept);
    // Bản mới thay bản chính nếu điểm kỹ thuật không kém hơn; luôn có thể chọn lại bằng tay.
    const promote = metrics.score > 0 && (!kept || metrics.score >= kept.metrics.score);
    const take: Take = {
      id: uid(), itemId: item.id, lessonId: lesson.id, text: item.text, createdAt: Date.now(), sampleRate: r.sampleRate,
      blob: encodeWav(cut, r.sampleRate), metrics, peaks: Array.from(peaks(cut, 160)), kept: promote,
    };
    if (promote) await keepTake(takes, take);
    else await put('takes', take);
    await refresh();
    if (metrics.score > 0) void verify(take);
  }, [item, lesson.id, itemTakes, takes, refresh, verify]);

  const toggle = useCallback(() => {
    if (status === 'off') { void openMic(); return; }
    if (status === 'ready') { rec.current?.begin(); startedAt.current = Date.now(); setElapsed(0); setStatus('recording'); }
    else if (status === 'recording') void stop();
  }, [status, openMic, stop]);

  useEffect(() => {
    if (status !== 'recording') return;
    const t = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 100);
    return () => clearInterval(t);
  }, [status]);

  const go = useCallback((d: number) => { if (status !== 'recording') setIdx(i => Math.max(0, Math.min(lesson.items.length - 1, i + d))); }, [status, lesson.items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (adding || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.code === 'ArrowRight') go(1);
      else if (e.code === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, go, adding]);

  const pick = (l: Lesson) => {
    if (status === 'recording') return;
    setLessonId(l.id);
    const next = l.items.findIndex(i => !done.has(i.id));
    setIdx(next < 0 ? 0 : next);
  };

  return (
    <main className="record">
      <aside className="lessons">
        {STAGES.map((stage, s) => (
          <section key={stage}>
            <h3><span className="step">{s + 1}</span>{stage}</h3>
            {lessons.filter(l => l.stage === s).map(l => {
              const n = l.items.filter(i => done.has(i.id)).length;
              return (
                <button key={l.id} className={`lesson ${l.id === lesson.id ? 'on' : ''}`} onClick={() => pick(l)}>
                  <span>{l.title}</span>
                  <span className={`count ${n === l.items.length ? 'full' : ''}`}>{n}/{l.items.length}</span>
                </button>
              );
            })}
            {s === 4 && <button className="lesson add" onClick={() => setAdding(true)}>＋ Thêm bài của tôi</button>}
          </section>
        ))}
      </aside>

      <section className="stage">
        <div className="lesson-head">
          <div>
            <h2>{lesson.title}</h2>
            <p className="dim">{lesson.goal}</p>
          </div>
          {lesson.custom && (
            <button className="ghost danger" onClick={async () => {
              if (!confirm(`Xoá bài "${lesson.title}"? Các bản thu của bài vẫn được giữ trong dữ liệu.`)) return;
              await del('lessons', lesson.id); setLessonId(lessons[0].id); setIdx(0); await refresh();
            }}>Xoá bài</button>
          )}
        </div>

        <div className="dots" aria-hidden>
          {lesson.items.map((it, i) => <button key={it.id} tabIndex={-1} className={`${done.has(it.id) ? 'done' : ''} ${i === idx ? 'cur' : ''}`} onClick={() => go(i - idx)} />)}
        </div>

        <article className={`prompt ${status === 'recording' ? 'live' : ''}`}>
          <div className="prompt-meta">
            <span>Câu {Math.min(idx, lesson.items.length - 1) + 1}/{lesson.items.length}</span>
            {item.hint && <span className="hint">{item.hint}</span>}
          </div>
          <p className={`script ${plain(item.text).length > 160 ? 'long' : ''}`}><Marked text={item.text} /></p>
        </article>

        <div className="meter" title="Mức âm lượng vào"><div ref={meter} /><i style={{ left: '80%' }} /><i style={{ left: '90%' }} /></div>

        <div className="transport">
          <button className="ghost big" onClick={() => go(-1)} disabled={idx === 0 || status === 'recording'}>‹ Trước</button>
          <button className={`rec ${status}`} onClick={toggle} disabled={status === 'opening'} data-testid="rec">
            {status === 'off' ? 'Bật micro' : status === 'opening' ? 'Đang mở…' : status === 'recording' ? `Dừng · ${elapsed.toFixed(1)}s` : itemTakes.length ? 'Thu lại' : 'Thu'}
          </button>
          <button className="ghost big" onClick={() => go(1)} disabled={idx >= lesson.items.length - 1 || status === 'recording'}>Sau ›</button>
        </div>

        <div className="micbar dim">
          {status === 'off' ? 'Cắm bộ thu DJI Mic Mini vào cổng USB-C của iPad rồi bấm "Bật micro".' : (
            <>
              <label>Micro{' '}
                <select value={cfg.deviceId} disabled={status === 'recording'} onChange={e => { setCfg({ ...cfg, deviceId: e.target.value }); void openMic(e.target.value); }}>
                  <option value="">Mặc định của hệ thống</option>
                  {mics.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || 'Micro'}</option>)}
                </select>
              </label>
              <span>Đang dùng: <b>{rec.current?.label || '—'}</b> · {Math.round((rec.current?.sampleRate ?? 0) / 1000)} kHz</span>
              <span className="keys">Phím cách: thu/dừng · ← →: đổi câu</span>
            </>
          )}
        </div>
        {error && <p className="error" role="alert">{error}</p>}

        <div className="takes">
          {itemTakes.map(t => <TakeRow key={t.id} take={t} canVerify={!!cfg.elevenKey}
            onKeep={async () => { await keepTake(takes, t); await refresh(); }}
            onDelete={async () => { await del('takes', t.id); await refresh(); }}
            onVerify={() => verify(t)} />)}
          {!itemTakes.length && status !== 'off' && <p className="dim center">Chưa có bản thu cho câu này. Đọc thầm một lượt, bấm Thu, chờ nửa giây rồi đọc.</p>}
        </div>
      </section>

      {adding && <AddLesson onClose={() => setAdding(false)} onSaved={async id => { await refresh(); setAdding(false); setLessonId(id); setIdx(0); }} />}
    </main>
  );
}

function TakeRow({ take, canVerify, onKeep, onDelete, onVerify }: { take: Take; canVerify: boolean; onKeep: () => void; onDelete: () => void; onVerify: () => void }) {
  const m = take.metrics;
  const diff = take.transcript !== undefined ? compare(take.text, take.transcript) : undefined;
  return (
    <div className={`take ${take.kept ? 'kept' : ''}`}>
      <div className="take-top">
        <span className={`score ${m.score >= 80 ? 'good' : m.score >= 55 ? 'mid' : 'low'}`}>{m.score}</span>
        <Wave peaks={take.peaks} />
        <Player blob={take.blob} />
      </div>
      <div className="chips">
        <span>{fmtSec(m.duration)}</span>
        <span>Đỉnh {m.peakDb.toFixed(1)} dB</span>
        <span>Giọng {m.speechDb.toFixed(0)} dB</span>
        <span>Nền {m.noiseDb.toFixed(0)} dB</span>
        {m.rate > 0 && <span>{m.rate.toFixed(1)} âm tiết/s</span>}
        {diff && <span className={diff.score >= 0.9 ? 'ok' : 'warn'}>Khớp lời {Math.round(diff.score * 100)}%</span>}
      </div>
      {m.issues.map((i, k) => <p key={k} className={`issue ${i.level}`}>{i.text}</p>)}
      {diff && diff.score < 1 && (
        <p className="diff">{diff.words.map((w, k) => <span key={k} className={w.ok ? '' : 'miss'}>{w.word} </span>)}
          <span className="dim"> — máy nghe được: “{take.transcript}”</span></p>
      )}
      <div className="take-actions">
        {take.kept ? <span className="badge">✓ Bản chính</span> : <button className="ghost" onClick={onKeep}>Chọn làm bản chính</button>}
        {canVerify && take.transcript === undefined && <button className="ghost" onClick={onVerify}>Kiểm tra lời đọc</button>}
        <button className="ghost danger" onClick={onDelete}>Xoá</button>
      </div>
    </div>
  );
}

function AddLesson({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [whole, setWhole] = useState(false);
  const parts = whole ? text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean) : splitSentences(text);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Thêm bài của tôi">
      <form className="sheet" onSubmit={async e => {
        e.preventDefault();
        const id = 'my-' + uid();
        await put('lessons', { id, stage: 4, title: title.trim() || 'Bài của tôi', goal: 'Bài do bạn tự soạn — đọc đúng chất giọng bạn muốn nhân bản.', custom: true, items: parts.map((t, i) => ({ id: `${id}-${i + 1}`, text: t })) });
        onSaved(id);
      }}>
        <h2>Thêm bài của tôi</h2>
        <p className="dim">Dán kịch bản thật của bạn (thuyết minh, podcast). Giọng clone học tốt nhất từ đúng kiểu nội dung bạn sẽ dùng. Dùng *dấu sao* quanh chữ cần nhấn.</p>
        <label>Tên bài<input value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Tập 12 — mở đầu" /></label>
        <label>Nội dung<textarea rows={8} value={text} onChange={e => setText(e.target.value)} required /></label>
        <label className="row"><input type="checkbox" checked={whole} onChange={e => setWhole(e.target.checked)} /> Thu theo từng đoạn (cách nhau một dòng trống) thay vì từng câu</label>
        <div className="row end">
          <span className="dim">{parts.length} mục thu</span>
          <button type="button" className="ghost" onClick={onClose}>Huỷ</button>
          <button className="primary" disabled={!parts.length}>Lưu bài</button>
        </div>
      </form>
    </div>
  );
}
