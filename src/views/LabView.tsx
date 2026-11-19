import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TEST_TEXTS } from '../lib/curriculum';
import { del, put, uid, type Take, type Trial, type Voice } from '../lib/db';
import { availableEngines, getEngine } from '../lib/engines';
import { clearDataset, serverHealth, startTrain, trainStatus, uploadClip, type ServerHealth, type TrainStatus } from '../lib/engines/custom';
import { presetLabel, presetsFor, type Clip, type EngineId, type Model } from '../lib/engines/types';
import { plain } from '../lib/text';
import { useStore } from '../store';
import { errMsg, fmtSec, Player, Stars } from '../ui';

const ENGINE_LABEL: Record<EngineId, string> = { elevenlabs: 'ElevenLabs', custom: 'Máy chủ riêng' };
export const clipsOf = (v: Voice, takes: Take[]): Clip[] =>
  v.takeIds.map(id => takes.find(t => t.id === id)).filter((t): t is Take => !!t).map(t => ({ name: `${t.itemId}.wav`, blob: t.blob, text: plain(t.text) }));

/** Chọn bản thu điểm cao, rải đều các bài, tới khi đủ `target` giây. */
export function autoPick(takes: Take[], target: number): string[] {
  const groups = new Map<string, Take[]>();
  for (const t of takes.filter(t => t.kept && t.metrics.score >= 55 && (t.match ?? 1) >= 0.8)) groups.set(t.lessonId, [...(groups.get(t.lessonId) ?? []), t]);
  const lists = [...groups.values()].map(l => l.sort((a, b) => b.metrics.score - a.metrics.score));
  const out: string[] = []; let sec = 0;
  for (let i = 0; sec < target && lists.some(l => l[i]); i++)
    for (const l of lists) if (l[i] && sec < target) { out.push(l[i].id); sec += l[i].metrics.duration; }
  return out;
}

export default function LabView({ goStudio, goSettings }: { goStudio: () => void; goSettings: () => void }) {
  const { takes, voices, trials, cfg, setCfg } = useStore();
  const engines = availableEngines(cfg);
  const kept = useMemo(() => takes.filter(t => t.kept).sort((a, b) => a.itemId.localeCompare(b.itemId, 'vi', { numeric: true })), [takes]);

  if (!engines.length) return (
    <main className="pad narrow">
      <h2>Thử mẫu giọng</h2>
      <p>Để tạo giọng clone cần một engine. Nhập khoá API ElevenLabs hoặc địa chỉ máy chủ riêng trong mục Dữ liệu.</p>
      <button className="primary" onClick={goSettings}>Mở cài đặt</button>
    </main>
  );
  return (
    <main className="pad lab">
      {cfg.customUrl && <TrainCard kept={kept} />}
      <VoiceMaker kept={kept} engines={engines} />
      {voices.length > 0 && <TrialMaker />}
      {trials.length > 0 && <Compare onUse={t => { setCfg({ ...cfg, recipe: { voiceId: t.voiceId, model: t.model, preset: t.preset, settings: t.settings } }); goStudio(); }} />}
      {voices.length > 0 && !trials.length && <p className="dim">Chưa có mẫu thử nào. Chọn giọng, model và kiểu đọc ở trên rồi bấm tạo.</p>}
    </main>
  );
}

function VoiceMaker({ kept, engines }: { kept: Take[]; engines: EngineId[] }) {
  const { takes, voices, cfg, refresh } = useStore();
  const [open, setOpen] = useState(voices.length === 0);
  const [name, setName] = useState('');
  const [engine, setEngine] = useState<EngineId>(engines[0]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [denoise, setDenoise] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const seconds = kept.filter(t => sel.has(t.id)).reduce((s, t) => s + t.metrics.duration, 0);
  const toggle = (id: string) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const create = async () => {
    setBusy(true); setError('');
    try {
      const v: Voice = { id: uid(), name: name.trim() || `Giọng ${voices.length + 1}`, engine, takeIds: [...sel], denoise, seconds, createdAt: Date.now() };
      const eng = getEngine(engine, cfg);
      if (eng.needsVoice) v.remoteId = await eng.createVoice(v.name, clipsOf(v, takes), denoise);
      await put('voices', v); await refresh();
      setName(''); setSel(new Set()); setOpen(false);
    } catch (e) { setError(errMsg(e)); }
    setBusy(false);
  };
  /** Model mã nguồn mở chỉ nghe ~10 giây mẫu, nên mỗi bản thu là một "giọng" đáng thử riêng. */
  const createEach = async () => {
    setBusy(true);
    for (const t of kept.filter(t => sel.has(t.id)))
      await put('voices', { id: uid(), name: plain(t.text).split(' ').slice(0, 5).join(' ') + '…', engine, takeIds: [t.id], denoise: false, seconds: t.metrics.duration, createdAt: Date.now() });
    await refresh();
    setSel(new Set()); setOpen(false); setBusy(false);
  };
  const remove = async (v: Voice) => {
    if (!confirm(`Xoá giọng "${v.name}"? Giọng trên máy chủ cũng bị xoá; các mẫu đã tạo vẫn giữ.`)) return;
    try { if (v.remoteId) await getEngine(v.engine, cfg).deleteVoice(v.remoteId); } catch (e) { setError(`Chưa xoá được trên máy chủ: ${errMsg(e)}`); }
    await del('voices', v.id); await refresh();
  };

  return (
    <section className="card">
      <div className="row between">
        <h2>1 · Giọng clone</h2>
        <button className="ghost" onClick={() => setOpen(o => !o)}>{open ? 'Đóng' : '＋ Tạo giọng mới'}</button>
      </div>
      <p className="dim">Mỗi giọng là một cách chọn bản thu làm mẫu. Tạo vài giọng từ các nhóm bản thu khác nhau (chỉ câu kể, chỉ full bài, pha trộn…) rồi so ở bước 3.</p>
      {voices.length > 0 && (
        <ul className="voices">
          {voices.map(v => (
            <li key={v.id}><b>{v.name}</b><span className="dim">{v.finetuned ? 'Model đã train trên giọng bạn' : `${ENGINE_LABEL[v.engine]} · ${v.takeIds.length} bản thu · ${fmtSec(v.seconds)}${v.denoise ? ' · khử ồn' : ''}`}</span>
              <button className="ghost danger" onClick={() => remove(v)}>Xoá</button></li>
          ))}
        </ul>
      )}
      {open && (kept.length === 0 ? <p className="warnbox">Chưa có bản thu nào. Sang tab Thu âm thu ít nhất 1–2 phút trước.</p> : (
        <div className="maker">
          <div className="row wrap">
            <label>Tên giọng<input value={name} onChange={e => setName(e.target.value)} placeholder="VD: Pha trộn 2 phút" /></label>
            {engines.length > 1 && <label>Engine<select value={engine} onChange={e => setEngine(e.target.value as EngineId)}>{engines.map(e => <option key={e} value={e}>{ENGINE_LABEL[e]}</option>)}</select></label>}
            <div className="row wrap">
              {engine === 'elevenlabs' && [60, 120, 180].map(s => <button key={s} className="ghost" onClick={() => setSel(new Set(autoPick(takes, s)))}>Tự chọn ~{s / 60} phút</button>)}
              <button className="ghost" onClick={() => setSel(new Set())}>Bỏ chọn</button>
            </div>
          </div>
          {engine === 'custom' && <p className="sample">Model mã nguồn mở chỉ nghe khoảng 5–12 giây mẫu và bắt chước luôn ngữ điệu của mẫu đó. Hãy tick vài câu khác kiểu nhau (kể chậm, podcast tươi, nhấn nhá…) rồi bấm “Mỗi bản thu một giọng” để so xem câu nào cho giọng hay nhất.</p>}
          <div className="picker">
            {kept.map(t => (
              <label key={t.id} className={sel.has(t.id) ? 'on' : ''}>
                <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} />
                <span className={`score sm ${t.metrics.score >= 80 ? 'good' : t.metrics.score >= 55 ? 'mid' : 'low'}`}>{t.metrics.score}</span>
                <span className="t">{plain(t.text)}</span>
                <span className="dim">{fmtSec(t.metrics.duration)}</span>
              </label>
            ))}
          </div>
          {engine === 'elevenlabs' && <label className="row"><input type="checkbox" checked={denoise} onChange={e => setDenoise(e.target.checked)} /> Khử ồn nền trên máy chủ (chỉ bật khi phòng thu ồn — bản thu sạch mà bật sẽ kém đi)</label>}
          <div className="row end wrap">
            {engine === 'elevenlabs'
              ? <span className={seconds < 30 ? 'warn' : 'dim'}>Đã chọn {sel.size} bản · {fmtSec(seconds)}{seconds < 30 ? ' — nên có ít nhất 1 phút' : seconds > 200 ? ' — quá 3 phút thường không tốt hơn' : ''}</span>
              : <span className={seconds > 15 ? 'warn' : 'dim'}>Đã chọn {sel.size} bản · {fmtSec(seconds)}{seconds > 15 ? ' — gộp chung thì chỉ ~12 giây đầu được dùng' : ''}</span>}
            {engine === 'custom' && <button className="primary" disabled={busy || sel.size === 0} onClick={createEach}>Mỗi bản thu một giọng ({sel.size})</button>}
            <button className={engine === 'custom' ? 'ghost' : 'primary'} disabled={busy || sel.size === 0} onClick={create}>{busy ? 'Đang tạo…' : engine === 'custom' ? 'Gộp thành một giọng' : 'Tạo giọng'}</button>
          </div>
        </div>
      ))}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}

const BUSY: TrainStatus['state'][] = ['preparing', 'training', 'packaging'];
const STATE_LABEL: Record<TrainStatus['state'], string> = { idle: '', preparing: 'Đang chuẩn bị dữ liệu', training: 'Đang train', packaging: 'Đang đóng gói giọng', done: 'Đã train xong', error: 'Train bị lỗi' };
const TARGET_SEC = 20 * 60;

/** Train một model riêng trên giọng người dùng: gửi bản thu lên máy chủ, theo dõi tiến độ, rồi tạo "giọng đã train". */
function TrainCard({ kept }: { kept: Take[] }) {
  const { voices, cfg, refresh } = useStore();
  const url = cfg.customUrl;
  const [health, setHealth] = useState<ServerHealth>();
  const [status, setStatus] = useState<TrainStatus>();
  const [sent, setSent] = useState<{ done: number; total: number }>();
  const [epochs, setEpochs] = useState(3);
  const [error, setError] = useState('');
  const pending = useRef(false);   // phiên train do chính màn hình này khởi động (hoặc đang chạy dở khi mở lại)
  // Model chỉ học từ câu dài 3–15 giây, thu sạch và đọc đúng chữ.
  const usable = useMemo(() => kept.filter(t => t.metrics.duration >= 3 && t.metrics.duration <= 15 && t.metrics.score >= 55 && (t.match ?? 1) >= 0.8), [kept]);
  const seconds = usable.reduce((s, t) => s + t.metrics.duration, 0);
  const min = health?.min_clips ?? 20;
  const hasVoice = voices.some(v => v.finetuned);

  const adopt = useCallback(async (label: string) => {
    for (const v of voices.filter(v => v.finetuned)) await del('voices', v.id);   // máy chủ chỉ giữ một model, giọng cũ không còn đúng
    await put('voices', { id: uid(), name: label, engine: 'custom', takeIds: [], denoise: false, seconds: 0, createdAt: Date.now(), finetuned: true });
    await refresh();
  }, [voices, refresh]);

  useEffect(() => {
    let alive = true;
    serverHealth(url).then(h => { if (!alive) return; setHealth(h); setStatus(h.train); if (h.train && BUSY.includes(h.train.state)) pending.current = true; })
      .catch(() => { if (alive) setHealth(undefined); });
    return () => { alive = false; };
  }, [url]);

  const busy = !!status && BUSY.includes(status.state);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(async () => {
      try {
        const s = await trainStatus(url);
        setStatus(s);
        if (s.state === 'done' && pending.current) { pending.current = false; await adopt(`Model riêng · ${new Date().toLocaleDateString('vi')}`); }
      } catch { /* mất mạng tạm thời: thử lại ở nhịp sau */ }
    }, 4000);
    return () => clearInterval(t);
  }, [busy, url, adopt]);

  const run = async () => {
    setError('');
    try {
      await clearDataset(url);
      for (let i = 0; i < usable.length; i++) {
        setSent({ done: i, total: usable.length });
        await uploadClip(url, usable[i].itemId, plain(usable[i].text), usable[i].blob);
      }
      setSent(undefined);
      pending.current = true;
      setStatus(await startTrain(url, epochs));
    } catch (e) { setSent(undefined); setError(errMsg(e)); }
  };

  return (
    <section className="card">
      <h2>Train model riêng</h2>
      <p className="dim">Clone nhanh chỉ nghe vài giây mẫu. Train thì dạy hẳn model trên toàn bộ bản thu của bạn, nên giọng bám sát hơn và học luôn cách bạn đọc. Thu các bài ở mục “Luyện model” trong tab Thu âm để có đủ dữ liệu.</p>
      <div className="bar big"><span>{usable.length} câu dùng được · {fmtSec(seconds)}</span><i style={{ width: `${Math.min(100, (seconds / TARGET_SEC) * 100)}%` }} /><b>{Math.round((seconds / TARGET_SEC) * 100)}%</b><span className="dim">của 20 phút</span></div>
      <p className={usable.length < 100 ? 'warn' : 'dim'}>
        {usable.length < min ? `Cần ít nhất ${min} câu dài 3–15 giây mới train được.`
          : usable.length < 100 ? 'Train được rồi, nhưng dưới 100 câu thì model dễ học vẹt. Mốc nên đạt: 100–300 câu, 10–30 phút.'
          : 'Đủ dữ liệu để train tử tế.'}
      </p>
      {!health ? <p className="warnbox">Chưa nối được máy chủ riêng. Chạy lại Colab và cập nhật địa chỉ trong tab Dữ liệu.</p>
        : !health.can_train ? <p className="warnbox">Máy chủ này thiếu PyTorch nên chưa train được. Dùng đúng mấy dòng lệnh mới nhất trong tab Dữ liệu.</p>
        : (
          <div className="row wrap">
            <label className="row">Số vòng train
              <select value={epochs} onChange={e => setEpochs(Number(e.target.value))} disabled={busy || !!sent}>
                <option value={3}>3 — chuẩn</option><option value={6}>6 — bám giọng hơn</option><option value={10}>10 — bám nhất, dễ học vẹt</option>
              </select>
            </label>
            <button className="primary" disabled={busy || !!sent || usable.length < min} onClick={run}>
              {sent ? `Đang gửi ${sent.done}/${sent.total}…` : busy ? 'Đang train…' : `Gửi ${usable.length} câu và train`}
            </button>
            <span className="dim">{health.gpu ? 'Máy chủ có GPU' : 'Máy chủ chạy CPU — vẫn train được, chậm hơn'}</span>
          </div>
        )}
      {status && status.state !== 'idle' && (
        <div className={`train-status ${status.state}`} role="status">
          <b>{STATE_LABEL[status.state]}{status.state === 'training' && status.total ? ` · bước ${status.step}/${status.total}` : ''}</b>
          {status.eval_loss != null && <span className="dim"> · sai số kiểm tra {status.eval_loss.toFixed(3)} (càng thấp càng tốt; hết giảm là nên dừng)</span>}
          {status.state === 'training' && <div className="bar"><i style={{ width: `${status.total ? (status.step / status.total) * 100 : 3}%` }} /></div>}
          {status.state === 'error' && <pre className="code">{status.message}</pre>}
          {busy && status.log.length > 0 && <p className="dim mono">{status.log[status.log.length - 1]}</p>}
        </div>
      )}
      {health?.finetuned && !busy && !hasVoice && <div className="row"><button className="ghost" onClick={() => adopt('Model riêng')}>Dùng model đã train sẵn trên máy chủ</button></div>}
      {hasVoice && !busy && <p className="badge">✓ Giọng đã train nằm trong danh sách bên dưới — tạo mẫu thử để so với clone nhanh.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}

function Chips<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: Set<T>; onChange: (v: Set<T>) => void }) {
  return (
    <div className="chipset">
      {options.map(o => (
        <button key={o.id} type="button" aria-pressed={value.has(o.id)} className={value.has(o.id) ? 'on' : ''}
          onClick={() => { const n = new Set(value); if (n.has(o.id)) n.delete(o.id); else n.add(o.id); onChange(n); }}>{o.label}</button>
      ))}
    </div>
  );
}

function TrialMaker() {
  const { takes, voices, cfg, refresh } = useStore();
  const [vs, setVs] = useState<Set<string>>(new Set(voices.slice(-1).map(v => v.id)));
  const [models, setModels] = useState<Record<string, Model[]>>({});
  const [ms, setMs] = useState<Set<string>>(new Set());
  const [ps, setPs] = useState<Set<string>>(new Set(['thuyet-minh', 'podcast', 'thuong']));
  const [textId, setTextId] = useState(TEST_TEXTS[0].id);
  const [own, setOwn] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const chosen = voices.filter(v => vs.has(v.id));
  const engineIds = [...new Set(chosen.map(v => v.engine))].join(',');
  useEffect(() => {
    let alive = true;
    void (async () => {
      const out: Record<string, Model[]> = {};
      for (const id of engineIds.split(',').filter(Boolean) as EngineId[]) {
        try { out[id] = await getEngine(id, cfg).models(); } catch (e) { if (alive) setErrors([errMsg(e)]); }
      }
      if (!alive) return;
      setModels(out);
      setMs(prev => (prev.size ? prev : new Set(Object.entries(out).map(([e, l]) => `${e}:${(l.find(m => m.vi) ?? l[0])?.id}`))));
    })();
    return () => { alive = false; };
  }, [engineIds, cfg]);

  const text = textId === 'own' ? own.trim() : TEST_TEXTS.find(t => t.id === textId)!.text;
  const jobs = chosen.flatMap(v => (models[v.engine] ?? []).filter(m => ms.has(`${v.engine}:${m.id}`)).flatMap(m =>
    presetsFor(v.engine).filter(p => ps.has(p.id)).map(p => ({ v, m, p }))));

  const run = async () => {
    setErrors([]); setProgress({ done: 0, total: jobs.length });
    const errs: string[] = [];
    for (let i = 0; i < jobs.length; i++) {
      const { v, m, p } = jobs[i];
      try {
        const blob = await getEngine(v.engine, cfg).synthesize({ remoteId: v.remoteId, clips: clipsOf(v, takes), finetuned: v.finetuned, text, model: m.id, settings: p.settings });
        const t: Trial = { id: uid(), voiceId: v.id, voiceName: v.name, engine: v.engine, model: m.id, preset: p.id, settings: p.settings, textId, text, blob, createdAt: Date.now(), rating: 0, note: '' };
        await put('trials', t);
      } catch (e) { errs.push(`${v.name} · ${m.name} · ${p.label}: ${errMsg(e)}`); }
      setProgress({ done: i + 1, total: jobs.length });
      await refresh();
    }
    setErrors(errs); setProgress(null);
  };

  return (
    <section className="card">
      <h2>2 · Tạo mẫu thử</h2>
      <p className="dim">Mỗi tổ hợp giọng × model × kiểu đọc cho ra một mẫu, cùng đọc một đoạn văn để so cho công bằng.</p>
      <h4>Giọng</h4>
      <Chips options={voices.map(v => ({ id: v.id, label: v.name }))} value={vs} onChange={setVs} />
      <h4>Model</h4>
      <Chips options={Object.entries(models).flatMap(([e, l]) => l.map(m => ({ id: `${e}:${m.id}`, label: m.name + (m.vi ? '' : ' (không có tiếng Việt)') })))} value={ms} onChange={setMs} />
      <h4>Kiểu đọc</h4>
      <Chips options={[...new Set(chosen.map(v => v.engine))].flatMap(e => presetsFor(e)).map(p => ({ id: p.id, label: p.label }))} value={ps} onChange={setPs} />
      <h4>Đoạn thử</h4>
      <div className="chipset">
        {[...TEST_TEXTS.map(t => ({ id: t.id, label: t.label })), { id: 'own', label: 'Tự nhập' }].map(t => (
          <button key={t.id} aria-pressed={textId === t.id} className={textId === t.id ? 'on' : ''} onClick={() => setTextId(t.id)}>{t.label}</button>
        ))}
      </div>
      {textId === 'own' ? <textarea rows={3} value={own} onChange={e => setOwn(e.target.value)} placeholder="Dán đoạn văn bạn muốn nghe thử…" /> : <p className="sample">{text}</p>}
      <div className="row end">
        <span className="dim">{jobs.length} mẫu · khoảng {(jobs.length * text.length).toLocaleString('vi')} ký tự tính phí</span>
        <button className="primary" disabled={!jobs.length || !text || !!progress} onClick={run}>{progress ? `Đang tạo ${progress.done}/${progress.total}…` : `Tạo ${jobs.length} mẫu`}</button>
      </div>
      {errors.map((e, i) => <p key={i} className="error" role="alert">{e}</p>)}
    </section>
  );
}

const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

function Compare({ onUse }: { onUse: (t: Trial) => void }) {
  const { trials, refresh } = useStore();
  const texts = useMemo(() => [...new Map(trials.map(t => [t.text, t.textId])).keys()], [trials]);
  const [text, setText] = useState(texts[texts.length - 1]);
  const [blind, setBlind] = useState(false);
  const [byRating, setByRating] = useState(false);
  const cur = texts.includes(text) ? text : texts[texts.length - 1];
  const list = useMemo(() => {
    const l = trials.filter(t => t.text === cur);
    if (blind) return l.sort((a, b) => hash(a.id) - hash(b.id));
    return l.sort((a, b) => (byRating ? b.rating - a.rating : 0) || b.createdAt - a.createdAt);
  }, [trials, cur, blind, byRating]);

  const board = useMemo(() => {
    const agg = (key: (t: Trial) => string) => {
      const m = new Map<string, { sum: number; n: number }>();
      for (const t of trials.filter(t => t.rating > 0)) { const k = key(t), a = m.get(k) ?? { sum: 0, n: 0 }; a.sum += t.rating; a.n++; m.set(k, a); }
      return [...m.entries()].map(([k, a]) => ({ k, avg: a.sum / a.n, n: a.n })).sort((a, b) => b.avg - a.avg);
    };
    return [
      { title: 'Theo giọng', rows: agg(t => t.voiceName) },
      { title: 'Theo model', rows: agg(t => t.model) },
      { title: 'Theo kiểu đọc', rows: agg(t => presetLabel(t.preset)) },
    ];
  }, [trials]);
  const update = async (t: Trial, patch: Partial<Trial>) => { await put('trials', { ...t, ...patch }); await refresh(); };

  return (
    <section className="card">
      <div className="row between wrap">
        <h2>3 · Nghe & chấm</h2>
        <div className="row">
          <label className="row"><input type="checkbox" checked={blind} onChange={e => setBlind(e.target.checked)} /> Nghe mù</label>
          {!blind && <label className="row"><input type="checkbox" checked={byRating} onChange={e => setByRating(e.target.checked)} /> Xếp theo điểm</label>}
        </div>
      </div>
      <p className="dim">Bật “Nghe mù” để giấu tên và xáo thứ tự — chấm bằng tai, không bằng kỳ vọng. Nên nghe bằng tai nghe.</p>
      {texts.length > 1 && (
        <select value={cur} onChange={e => setText(e.target.value)}>{texts.map(t => <option key={t} value={t}>{t.slice(0, 70)}…</option>)}</select>
      )}
      <p className="sample">{cur}</p>
      <div className="trials">
        {list.map((t, i) => (
          <div key={t.id} className="trial">
            <div className="row between">
              <b>{blind ? `Mẫu ${String.fromCharCode(65 + (i % 26))}` : t.voiceName}</b>
              <Stars value={t.rating} onChange={rating => update(t, { rating })} />
            </div>
            {!blind && <span className="dim">{t.model} · {presetLabel(t.preset)}</span>}
            <Player blob={t.blob} />
            <input defaultValue={t.note} placeholder="Ghi chú: chỗ nào hay, chỗ nào gượng…" onBlur={e => { if (e.target.value !== t.note) void update(t, { note: e.target.value }); }} />
            {!blind && (
              <div className="row end">
                <button className="ghost danger" onClick={async () => { await del('trials', t.id); await refresh(); }}>Xoá</button>
                <button className="ghost" onClick={() => onUse(t)}>Dùng công thức này ›</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {!blind && board.some(b => b.rows.length) && (
        <div className="board">
          {board.map(b => (
            <div key={b.title}><h4>{b.title}</h4>
              {b.rows.map(r => <div key={r.k} className="bar"><span>{r.k}</span><i style={{ width: `${(r.avg / 5) * 100}%` }} /><b>{r.avg.toFixed(1)}</b><span className="dim">({r.n})</span></div>)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
