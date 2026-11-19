import { useEffect, useState } from 'react';
import { clearAll } from '../lib/db';
import { checkServer } from '../lib/engines/custom';
import { buildDataset, download } from '../lib/export';
import { useStore } from '../store';
import { errMsg, fmtSec } from '../ui';

export default function SettingsView() {
  const { takes, lessons, voices, trials, cfg, setCfg, refresh } = useStore();
  const [usage, setUsage] = useState('');
  const [persisted, setPersisted] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [server, setServer] = useState<{ ok: boolean; text: string }>();
  const [copied, setCopied] = useState(false);
  const colab = `from google.colab import drive; drive.mount('/content/drive')\n!pip -q install vieneu peft fastapi uvicorn python-multipart\n!wget -q -O datts_server.py ${new URL('server/datts_server.py', location.href).href}\n!python datts_server.py --tunnel --data-dir /content/drive/MyDrive/datts`;
  const kept = takes.filter(t => t.kept);
  const sec = (l: typeof takes) => l.reduce((s, t) => s + t.metrics.duration, 0);
  const total = lessons.reduce((n, l) => n + l.items.length, 0);

  useEffect(() => {
    void navigator.storage?.estimate?.().then(e => setUsage(`${((e.usage ?? 0) / 1e6).toFixed(0)} MB / ${((e.quota ?? 0) / 1e9).toFixed(1)} GB`));
    void navigator.storage?.persisted?.().then(setPersisted);
  }, [takes.length, trials.length]);

  const exportZip = async (onlyKept: boolean) => {
    setBusy(true); setMsg('');
    try { download(await buildDataset(onlyKept ? kept : takes), `datts-dataset-${new Date().toISOString().slice(0, 10)}.zip`); }
    catch (e) { setMsg(errMsg(e)); }
    setBusy(false);
  };

  return (
    <main className="pad lab">
      <section className="card">
        <h2>Tiến độ</h2>
        <div className="stats">
          <div><b>{kept.length}/{total}</b><span>câu đã có bản chính</span></div>
          <div><b>{fmtSec(sec(kept))}</b><span>thời lượng bản chính</span></div>
          <div><b>{takes.length}</b><span>tổng số bản thu</span></div>
          <div><b>{voices.length} · {trials.length}</b><span>giọng · mẫu thử</span></div>
        </div>
        <p className="dim">Mốc tham khảo: 1–3 phút đủ cho clone nhanh; 30 phút trở lên để fine-tune một model riêng.</p>
      </section>

      <section className="card">
        <h2>Engine mã nguồn mở (miễn phí)</h2>
        <p className="dim">Chạy model VieNeu-TTS trên Google Colab hoặc máy của bạn, rồi dán địa chỉ nó in ra vào đây.</p>
        <ol className="guide">
          <li>Mở <a href="https://colab.research.google.com/#create=true" target="_blank" rel="noreferrer">colab.research.google.com</a>, tạo sổ tay mới.</li>
          <li>Dán bốn dòng dưới vào ô đầu tiên rồi bấm ▶, cho phép nối Google Drive khi được hỏi (để giữ model đã train). Lần đầu mất vài phút. Muốn train nhanh hơn: Runtime → Change runtime type → T4 GPU trước khi chạy.</li>
          <li>Khi hiện khung “DÁN ĐỊA CHỈ NÀY…”, chép địa chỉ <code>https://….trycloudflare.com</code> vào ô bên dưới. Giữ tab Colab mở trong lúc dùng.</li>
        </ol>
        <pre className="code">{colab}</pre>
        <div className="row">
          <button className="ghost" onClick={async () => { try { await navigator.clipboard.writeText(colab); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setMsg('Không chép tự động được — hãy bôi đen bốn dòng rồi chép tay.'); } }}>{copied ? '✓ Đã chép' : 'Chép bốn dòng'}</button>
        </div>
        <label>Địa chỉ máy chủ riêng
          <input type="url" value={cfg.customUrl} onChange={e => { setServer(undefined); setCfg({ ...cfg, customUrl: e.target.value.trim() }); }} placeholder="https://….trycloudflare.com" />
        </label>
        <div className="row wrap">
          <button className="primary" disabled={!cfg.customUrl} onClick={async () => {
            setServer({ ok: true, text: 'Đang gọi…' });
            try { setServer({ ok: true, text: `✓ Đã nối với ${await checkServer(cfg.customUrl)}` }); }
            catch { setServer({ ok: false, text: 'Không nối được. Kiểm tra Colab còn chạy và địa chỉ chép đủ, bắt đầu bằng https://' }); }
          }}>Kiểm tra kết nối</button>
          {server && <span className={server.ok ? 'badge' : 'warn'} role="status">{server.text}</span>}
        </div>
      </section>

      <section className="card">
        <h2>AI viết kịch bản (Claude)</h2>
        <label>Khoá API Claude
          <input type="password" autoComplete="off" value={cfg.claudeKey} onChange={e => setCfg({ ...cfg, claudeKey: e.target.value.trim() })} placeholder="sk-ant-…" />
        </label>
        <p className="dim">Dùng cho tab Podcast: Claude soạn kịch bản từ chủ đề hoặc tư liệu của bạn. Lấy khoá ở <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">platform.claude.com</a>; tính phí theo lượng dùng. Khoá chỉ lưu trên thiết bị này và gửi thẳng tới Anthropic. Không có khoá vẫn dựng được tập từ kịch bản dán sẵn.</p>
      </section>

      <section className="card">
        <h2>ElevenLabs (trả phí)</h2>
        <label>Khoá API ElevenLabs
          <input type="password" autoComplete="off" value={cfg.elevenKey} onChange={e => setCfg({ ...cfg, elevenKey: e.target.value.trim() })} placeholder="sk_…" />
        </label>
        <p className="dim">Clone giọng cần gói Starter trở lên; gói miễn phí vẫn dùng được để kiểm tra lời đọc. Khoá chỉ lưu trên thiết bị này.</p>
      </section>

      <section className="card">
        <h2>Bộ dữ liệu</h2>
        <p className="dim">Xuất file zip kiểu LJSpeech (wavs/ + metadata.csv) để fine-tune model riêng hoặc sao lưu. Đang dùng {usage || '—'}.</p>
        <div className="row wrap">
          <button className="primary" disabled={busy || !kept.length} onClick={() => exportZip(true)}>Xuất bản chính ({kept.length})</button>
          <button className="ghost" disabled={busy || !takes.length} onClick={() => exportZip(false)}>Xuất tất cả ({takes.length})</button>
          {persisted === false && <button className="ghost" onClick={async () => { const ok = await navigator.storage.persist(); setPersisted(ok); setMsg(ok ? '' : 'Trình duyệt chưa cho giữ dữ liệu vĩnh viễn. Trên iPad, hãy “Thêm vào Màn hình chính” rồi mở từ đó, và xuất zip thường xuyên.'); }}>Giữ dữ liệu không bị dọn</button>}
          {persisted && <span className="badge">✓ Dữ liệu được giữ lâu dài</span>}
        </div>
        {msg && <p className="error" role="alert">{msg}</p>}
      </section>

      <section className="card">
        <h2>Thu với DJI Mic Mini</h2>
        <ol className="guide">
          <li>Cắm bộ thu (receiver) vào cổng USB-C của iPad, bật bộ phát, chờ đèn liên kết sáng đều.</li>
          <li>Kẹp mic cách miệng khoảng một gang tay, lệch sang bên để tránh hơi thở phả vào.</li>
          <li>Tắt khử ồn trên mic nếu phòng yên — tín hiệu thô clone tốt hơn tín hiệu đã xử lý.</li>
          <li>Đọc to câu thử: vạch mức nên nhảy quanh 2/3 thanh, không chạm vùng đỏ. Chỉnh gain trên bộ thu.</li>
          <li>Thu cùng một phòng, cùng vị trí mic, cùng thời điểm trong ngày cho cả bộ — giọng đồng đều thì clone ổn định.</li>
        </ol>
      </section>

      <section className="card">
        <h2>Xoá dữ liệu</h2>
        <button className="ghost danger" onClick={async () => {
          if (!confirm('Xoá toàn bộ bản thu, bài tự soạn, giọng và mẫu thử trên thiết bị này? Không khôi phục được.')) return;
          await clearAll(); setCfg({ ...cfg, recipe: undefined }); await refresh();
        }}>Xoá tất cả trên thiết bị này</button>
      </section>
    </main>
  );
}
