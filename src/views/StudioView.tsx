import { useState } from 'react';
import { getEngine } from '../lib/engines';
import { presetLabel, type SynthSettings } from '../lib/engines/types';
import { download } from '../lib/export';
import { decodeToMono } from '../lib/recorder';
import { chunkText } from '../lib/text';
import { concatFloat32, encodeWav } from '../lib/wav';
import { useStore } from '../store';
import { errMsg, Player } from '../ui';
import { clipsOf } from './LabView';

const SLIDERS: { key: keyof SynthSettings; label: string; min: number; max: number; tip: string }[] = [
  { key: 'stability', label: 'Ổn định', min: 0, max: 1, tip: 'Thấp: biểu cảm, dễ thất thường. Cao: đều, dễ đơn điệu.' },
  { key: 'similarity', label: 'Giống giọng gốc', min: 0, max: 1, tip: 'Cao quá có thể bê cả tạp âm của bản thu.' },
  { key: 'style', label: 'Cường điệu', min: 0, max: 1, tip: 'Tăng để nhấn nhá mạnh hơn; để 0 cho thuyết minh.' },
  { key: 'speed', label: 'Tốc độ', min: 0.7, max: 1.2, tip: 'Thuyết minh 0,9–1,0; quảng cáo 1,05–1,1.' },
];

export default function StudioView({ goLab }: { goLab: () => void }) {
  const { takes, voices, cfg, setCfg } = useStore();
  const [text, setText] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [out, setOut] = useState<Blob>();
  const recipe = cfg.recipe;
  const voice = voices.find(v => v.id === recipe?.voiceId);

  if (!recipe || !voice) return (
    <main className="pad narrow">
      <h2>Studio</h2>
      <p>Chưa có công thức giọng. Vào tab Thử mẫu, chấm điểm các mẫu rồi bấm “Dùng công thức này” ở mẫu bạn ưng nhất.</p>
      <button className="primary" onClick={goLab}>Sang Thử mẫu</button>
    </main>
  );
  const set = (settings: SynthSettings) => setCfg({ ...cfg, recipe: { ...recipe, settings } });
  const chunks = chunkText(text);

  const run = async () => {
    setError(''); setOut(undefined);
    try {
      const eng = getEngine(voice.engine, cfg);
      const clips = clipsOf(voice, takes);
      const parts: Float32Array[] = [];
      let rate = 44100;
      for (let i = 0; i < chunks.length; i++) {
        setProgress(`Đang đọc đoạn ${i + 1}/${chunks.length}…`);
        const blob = await eng.synthesize({ remoteId: voice.remoteId, clips, text: chunks[i], model: recipe.model, settings: recipe.settings, previousText: chunks[i - 1], nextText: chunks[i + 1] });
        const { samples, sampleRate } = await decodeToMono(blob);
        rate = sampleRate;
        if (i) parts.push(new Float32Array(Math.round(rate * 0.45)));   // nghỉ giữa các đoạn
        parts.push(samples);
      }
      setOut(encodeWav(concatFloat32(parts), rate));
    } catch (e) { setError(errMsg(e)); }
    setProgress('');
  };

  return (
    <main className="pad lab">
      <section className="card">
        <h2>Công thức đang dùng</h2>
        <p><b>{voice.name}</b> <span className="dim">· {recipe.model} · bắt đầu từ kiểu “{presetLabel(recipe.preset)}”</span></p>
        {(
          <div className="sliders">
            {SLIDERS.filter(s => voice.engine === 'elevenlabs' || s.key === 'speed').map(s => (
              <label key={s.key} title={s.tip}>
                <span>{s.label} <b>{recipe.settings[s.key].toFixed(2)}</b></span>
                <input type="range" min={s.min} max={s.max} step={0.05} value={recipe.settings[s.key]} onChange={e => set({ ...recipe.settings, [s.key]: Number(e.target.value) })} />
                <small className="dim">{s.tip}</small>
              </label>
            ))}
          </div>
        )}
      </section>
      <section className="card">
        <h2>Đọc cả bài</h2>
        <textarea rows={12} value={text} onChange={e => setText(e.target.value)} placeholder="Dán kịch bản thuyết minh hoặc podcast. Mỗi đoạn xuống dòng sẽ được nghỉ một nhịp." />
        <div className="row end">
          <span className="dim">{text.length.toLocaleString('vi')} ký tự · {chunks.length} đoạn</span>
          <button className="primary" disabled={!chunks.length || !!progress} onClick={run}>{progress || 'Tạo bản đọc'}</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {out && (
          <div className="result">
            <Player blob={out} />
            <button className="ghost" onClick={() => download(out, `datts-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.wav`)}>Tải WAV</button>
          </div>
        )}
      </section>
    </main>
  );
}
