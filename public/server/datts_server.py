#!/usr/bin/env python3
"""Máy chủ clone giọng mã nguồn mở cho Datts — VieNeu-TTS v3 Turbo (Apache-2.0), chạy được trên CPU.

Cài và chạy (Google Colab, máy Mac/PC/Linux có Python >= 3.10):

    pip install vieneu fastapi uvicorn python-multipart
    python datts_server.py --tunnel

`--tunnel` mở một đường hầm Cloudflare miễn phí và in ra địa chỉ https://….trycloudflare.com.
Dán địa chỉ đó vào Datts → Dữ liệu → Máy chủ riêng. Địa chỉ đổi mỗi lần chạy lại.

Train giọng riêng (LoRA trên VieNeu-TTS v3 Turbo) cần thêm: pip install torch transformers peft accelerate pyarrow safetensors
(Colab có sẵn gần hết). Chạy được trên CPU; có GPU thì nhanh hơn. Thêm --data-dir để giữ dữ liệu và model
qua các lần chạy (trên Colab: một thư mục trong Google Drive).

API:  GET  /health
      POST /synthesize     multipart: text, voice (clone|finetuned), ref_audio (1+ WAV, khi clone), speed, temperature, denoise  →  audio/wav 48 kHz
      POST /dataset/clip   multipart: name, text, file (WAV)        — nạp một câu vào bộ dữ liệu train
      DELETE /dataset                                                — xoá bộ dữ liệu
      POST /train          form: epochs, rank                        — bắt đầu train nền
      GET  /train/status
"""
import argparse, hashlib, io, json, os, platform, re, shutil, stat, subprocess, sys, tempfile, threading, time, urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

MAX_REF_SEC = 8.0     # model chỉ dùng tối đa 8 giây mẫu
GAP_SEC = 0.25        # khoảng lặng khi ghép nhiều mẫu ngắn
MAX_TEXT = 5000
VIENEU_REPO = "https://github.com/pnnbao97/VieNeu-TTS"
VIENEU_COMMIT = "512de86"   # bản đã chạy thử với máy chủ này; mã train nằm trong repo chứ không có trong gói pip
VOICE_NAME = "Giọng của tôi"
MIN_CLIPS = 20
DATA = Path(tempfile.mkdtemp(prefix="datts-data-"))   # main() đổi sang --data-dir nếu có

app = FastAPI(title="Datts voice server")
# Trình duyệt trên iPad gọi thẳng từ trang Datts, nên phải cho phép gọi chéo nguồn.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Speed-Applied", "X-Ref-Seconds"])

_tts = None
_ft = None                 # model đã train trên giọng người dùng
_lock = threading.Lock()
_train = {"state": "idle", "step": 0, "total": 0, "eval_loss": None, "message": "", "log": []}
_train_lock = threading.Lock()
_ref_dir = tempfile.mkdtemp(prefix="datts-ref-")


def repo_dir() -> Path:
    """Mã nguồn VieNeu-TTS ở đúng bản đã thử (cần cho train và cho việc nạp model đã train)."""
    d = DATA / "VieNeu-TTS"
    if not (d / "finetune" / "train_lora.py").exists():
        print("Đang tải mã nguồn VieNeu-TTS…", flush=True)
        shutil.rmtree(d, ignore_errors=True)
        subprocess.run(["git", "clone", "-q", VIENEU_REPO, str(d)], check=True, env={**os.environ, "GIT_LFS_SKIP_SMUDGE": "1"})
        subprocess.run(["git", "-C", str(d), "checkout", "-q", VIENEU_COMMIT], check=True)
    return d


def has_torch() -> bool:
    try:
        import torch  # noqa: F401
        return True
    except Exception:
        return False


def has_gpu() -> bool:
    try:
        import torch
        return bool(torch.cuda.is_available())
    except Exception:
        return False


def merged_dir() -> Path:
    return DATA / "output" / "my_voice" / "merged"


def finetuned_ready() -> bool:
    return (merged_dir() / "voices_v3_turbo.json").is_file() and (merged_dir() / "update" / "model.safetensors").is_file()


def ft():
    """Model đã train. Dùng mã trong repo (bản pip có thể chưa nạp được model local)."""
    global _ft
    if _ft is None:
        if not finetuned_ready():
            raise HTTPException(409, "Chưa có model đã train. Hãy train trước trong tab Thử mẫu.")
        if not has_torch():
            raise HTTPException(409, "Thiếu PyTorch để chạy model đã train: pip install torch transformers safetensors")
        from vieneu import Vieneu
        print("Đang nạp model đã train…", flush=True)
        rel = os.path.relpath(merged_dir(), os.getcwd())
        _ft = Vieneu(mode="v3turbo", backbone_repo=rel, backend="pytorch", device="cuda" if has_gpu() else "cpu")
    return _ft


def tts():
    global _tts
    if _tts is None:
        from vieneu import Vieneu
        print("Đang nạp model VieNeu-TTS (lần đầu sẽ tải khoảng vài trăm MB)…", flush=True)
        _tts = Vieneu()
        print("Model đã sẵn sàng.", flush=True)
    return _tts


def build_reference(blobs: list[bytes]) -> tuple[str, float]:
    """Ghép các mẫu thành một file mono ≤ 8 giây; trả về đường dẫn (ổn định theo nội dung) và độ dài."""
    key = hashlib.sha1(b"".join(hashlib.sha1(b).digest() for b in blobs)).hexdigest()[:16]
    path = os.path.join(_ref_dir, key + ".wav")
    if os.path.exists(path):
        return path, sf.info(path).duration
    parts, rate, total = [], None, 0.0
    for blob in blobs:
        try:
            audio, sr = sf.read(io.BytesIO(blob), dtype="float32", always_2d=True)
        except Exception as e:
            raise HTTPException(400, f"Không đọc được file mẫu: {e}")
        mono = audio.mean(axis=1)
        if rate is None:
            rate = sr
        elif sr != rate:
            continue  # bỏ mẫu khác tần số thay vì ghép sai tốc độ
        room = MAX_REF_SEC - total
        if parts and len(mono) / rate > room:
            break     # mẫu kế tiếp không vừa nữa: dừng, không cắt giữa câu
        mono = mono[: int(MAX_REF_SEC * rate)]
        if parts:
            parts.append(np.zeros(int(GAP_SEC * rate), dtype="float32"))
            total += GAP_SEC
        parts.append(mono)
        total += len(mono) / rate
    if not parts or total < 1.0:
        raise HTTPException(400, "Mẫu giọng quá ngắn — cần ít nhất 1 giây, tốt nhất 4–8 giây.")
    sf.write(path, np.concatenate(parts), rate, subtype="PCM_16")
    return path, total


def change_speed(audio: np.ndarray, rate: int, speed: float) -> tuple[np.ndarray, bool]:
    """Đổi tốc độ mà giữ cao độ bằng ffmpeg; không có ffmpeg thì giữ nguyên."""
    if abs(speed - 1) < 0.01 or not shutil.which("ffmpeg"):
        return audio, abs(speed - 1) < 0.01
    with tempfile.TemporaryDirectory() as d:
        src, dst = os.path.join(d, "in.wav"), os.path.join(d, "out.wav")
        sf.write(src, audio, rate, subtype="FLOAT")
        r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter:a", f"atempo={speed:.3f}", "-c:a", "pcm_f32le", dst], capture_output=True)
        if r.returncode != 0:
            return audio, False
        out, _ = sf.read(dst, dtype="float32")
        return out, True


@app.get("/health")
def health():
    clips = load_index()
    return {
        "ok": True, "engine": "VieNeu-TTS v3 Turbo", "ready": _tts is not None, "max_ref_seconds": MAX_REF_SEC,
        "gpu": has_gpu(), "can_train": has_torch(), "finetuned": finetuned_ready(),
        "dataset": {"clips": len(clips), "seconds": round(sum(c["sec"] for c in clips.values()), 1)},
        "train": train_status(),
    }


# ───────────────────────── Bộ dữ liệu và train ─────────────────────────

def dataset_dir() -> Path:
    d = DATA / "dataset"
    (d / "raw_audio").mkdir(parents=True, exist_ok=True)
    return d


def load_index() -> dict:
    p = dataset_dir() / "index.json"
    try:
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    except Exception:
        return {}


@app.post("/dataset/clip")
async def add_clip(name: str = Form(...), text: str = Form(...), file: UploadFile = File(...)):
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", name)[:80]
    text = " ".join(text.replace("|", " ").split())
    if not safe or not text:
        raise HTTPException(400, "Thiếu tên hoặc lời của bản thu.")
    blob = await file.read()
    try:
        info = sf.info(io.BytesIO(blob))
    except Exception as e:
        raise HTTPException(400, f"Không đọc được bản thu: {e}")
    with _train_lock:
        (dataset_dir() / "raw_audio" / f"{safe}.wav").write_bytes(blob)
        index = load_index()
        index[safe] = {"text": text, "sec": round(info.duration, 2)}
        (dataset_dir() / "index.json").write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
    return {"clips": len(index), "seconds": round(sum(c["sec"] for c in index.values()), 1)}


@app.delete("/dataset")
def clear_dataset():
    if _train["state"] in ("preparing", "training", "packaging"):
        raise HTTPException(409, "Đang train, chưa xoá được.")
    shutil.rmtree(DATA / "dataset", ignore_errors=True)
    return {"clips": 0, "seconds": 0}


def train_status() -> dict:
    return {**{k: v for k, v in _train.items() if k != "log"}, "log": _train["log"][-12:]}


def _run(cmd: list[str], state: str) -> None:
    """Chạy một bước train, đọc log để cập nhật tiến độ; lỗi thì ném ra kèm vài dòng cuối."""
    _train.update(state=state)
    proc = subprocess.Popen(cmd, cwd=str(DATA), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env={**os.environ, "PYTHONUNBUFFERED": "1"})
    for line in proc.stdout:
        line = line.rstrip()
        if not line or "Warning" in line:
            continue
        print("  [train]", line, flush=True)
        _train["log"].append(line[-300:])
        del _train["log"][:-200]
        m = re.search(r"step (\d+)/(\d+)\s+loss ([\d.]+)", line)
        if m:
            _train.update(step=int(m.group(1)), total=int(m.group(2)), loss=float(m.group(3)))
        m = re.search(r"\[eval\] (?:step \d+|final)\s+loss ([\d.]+)", line)
        if m:
            _train.update(eval_loss=float(m.group(1)))
    if proc.wait() != 0:
        raise RuntimeError("\n".join(_train["log"][-6:]) or f"lệnh thoát với mã {proc.returncode}")


def trim_tail(path: Path, keep_sec: float = 0.08) -> None:
    """Cắt phần im lặng cuối file, chừa lại `keep_sec` giây sau âm cuối cùng."""
    audio, sr = sf.read(str(path), dtype="float32", always_2d=True)
    mono = np.abs(audio.mean(axis=1))
    win = max(1, int(0.02 * sr))
    n = len(mono) // win
    if n < 5:
        return
    level = mono[: n * win].reshape(n, win).max(axis=1)
    loud = np.nonzero(level > max(level.max() * 0.03, 1e-4))[0]
    if len(loud) == 0:
        return
    end = min(len(audio), (loud[-1] + 1) * win + int(keep_sec * sr))
    if end < len(audio):
        sf.write(str(path), audio[:end], sr, subtype="PCM_16")


def _cpu_trainer(repo: Path) -> Path:
    """Mã train gốc chỉ nhận GPU; bản sao này đổi ba chỗ để chạy trên CPU (đã thử ở đúng VIENEU_COMMIT)."""
    src = (repo / "finetune" / "train_lora.py").read_text(encoding="utf-8")
    swaps = [
        ("if not torch.cuda.is_available():", "if False:"),
        ('torch.device("cuda")', 'torch.device("cpu")'),
        ('torch.autocast("cuda", dtype=torch.bfloat16, enabled=use_bf16)', 'torch.autocast("cpu", enabled=False)'),
    ]
    for old, new in swaps:
        if old not in src:
            raise RuntimeError("Mã train của VieNeu đã đổi, chưa chạy được trên CPU. Hãy bật GPU trong Colab (Runtime → Change runtime type → T4).")
        src = src.replace(old, new)
    out = repo / "finetune" / "train_lora_cpu.py"
    out.write_text(src, encoding="utf-8")
    return out


def _train_job(epochs: float, rank: int) -> None:
    global _ft
    try:
        repo = repo_dir()
        ds = dataset_dir()
        index = load_index()
        with open(ds / "metadata.csv", "w", encoding="utf-8") as f:
            for name, c in sorted(index.items()):
                f.write(f"{name}.wav|{c['text']}\n")
        py = sys.executable
        prep = [py, str(repo / "finetune" / "prepare_dataset.py"), "--dataset-dir", "dataset"]
        try:
            _run(prep, "preparing")
        except RuntimeError as e:
            if "issue #198" not in str(e):
                raise
            # Bộ kiểm tra của VieNeu từ chối khi đa số câu kết thúc bằng cùng một khung im lặng.
            # Cắt bớt đuôi im lặng của từng bản thu rồi thử lại một lần.
            _train["log"].append("Đuôi im lặng quá giống nhau — đang cắt gọn đuôi rồi chuẩn bị lại…")
            for wav in (ds / "raw_audio").glob("*.wav"):
                trim_tail(wav)
            _run(prep, "preparing")
        gpu = has_gpu()
        trainer = repo / "finetune" / "train_lora.py" if gpu else _cpu_trainer(repo)
        cmd = [py, str(trainer), "--data", "dataset/train.parquet", "--run", "my_voice", "--output-dir", "output",
               "--epochs", str(epochs), "--r", str(rank), "--alpha", str(rank * 2), "--log-every", "2", "--eval-every", "20", "--merge"]
        if gpu:
            import torch
            if not torch.cuda.is_bf16_supported():
                cmd += ["--no-bf16", "--grad-checkpoint"]   # ví dụ Colab T4
        else:
            cmd += ["--batch-size", "2", "--grad-accum", "8", "--num-workers", "0"]
        shutil.rmtree(DATA / "output" / "my_voice", ignore_errors=True)
        with _lock:   # không đọc và train cùng lúc trên một máy nhỏ
            _ft = None
            _run(cmd, "training")
            # Giọng mặc định lấy từ bản thu dài gần 6 giây nhất (model cần 3–8 giây).
            ref = min((n for n, c in index.items() if 3 <= c["sec"] <= 8), key=lambda n: abs(index[n]["sec"] - 6), default=None)
            if ref is None:
                raise RuntimeError("Không có bản thu nào dài 3–8 giây để đóng gói giọng.")
            _run([py, str(repo / "finetune" / "make_voice.py"), "--audio", f"dataset/raw_audio/{ref}.wav", "--name", VOICE_NAME,
                  "--out", "output/my_voice/merged", "--no-denoise", "--default"], "packaging")
        _train.update(state="done", message=f"Đã train xong trên {len(index)} câu.", finished=time.time())
    except Exception as e:
        _train.update(state="error", message=str(e)[-800:])
        print("  [train] LỖI:", e, flush=True)


@app.post("/train")
def start_train(epochs: float = Form(3.0), rank: int = Form(16)):
    if not has_torch():
        raise HTTPException(409, "Máy chủ thiếu PyTorch để train: pip install torch transformers peft accelerate pyarrow safetensors")
    index = load_index()
    usable = [c for c in index.values() if 3 <= c["sec"] <= 15]
    if len(usable) < MIN_CLIPS:
        raise HTTPException(400, f"Mới có {len(usable)} bản thu dài 3–15 giây; cần ít nhất {MIN_CLIPS}, nên có 100–300.")
    with _train_lock:
        if _train["state"] in ("preparing", "training", "packaging"):
            raise HTTPException(409, "Đang train rồi.")
        _train.update(state="preparing", step=0, total=0, eval_loss=None, message="", log=[], started=time.time(), gpu=has_gpu(), clips=len(usable))
    threading.Thread(target=_train_job, args=(min(10.0, max(0.5, epochs)), min(64, max(4, rank))), daemon=True).start()
    return train_status()


@app.get("/train/status")
def get_train_status():
    return train_status()


@app.post("/synthesize")
async def synthesize(
    text: str = Form(...),
    ref_audio: list[UploadFile] = File(default=[]),
    voice: str = Form("clone"),
    speed: float = Form(1.0),
    temperature: float = Form(0.8),
    denoise: bool = Form(False),
):
    text = text.strip()
    if not text:
        raise HTTPException(400, "Thiếu văn bản cần đọc.")
    if len(text) > MAX_TEXT:
        raise HTTPException(400, f"Văn bản dài quá {MAX_TEXT} ký tự — hãy chia nhỏ.")
    speed = min(1.5, max(0.6, speed))
    temperature = min(1.3, max(0.2, temperature))
    finetuned = voice == "finetuned"
    if _train["state"] in ("preparing", "training", "packaging"):
        raise HTTPException(409, "Máy chủ đang train, chờ xong rồi đọc tiếp.")
    if finetuned:
        ref_path, ref_sec = None, 0.0
    else:
        if not ref_audio:
            raise HTTPException(400, "Thiếu bản thu mẫu (ref_audio).")
        ref_path, ref_sec = build_reference([await f.read() for f in ref_audio])

    def run():
        with _lock:   # model không chạy song song an toàn; xếp hàng từng yêu cầu
            engine = ft() if finetuned else tts()
            started = time.time()
            kw = {"voice": VOICE_NAME} if finetuned else {"ref_audio": ref_path, "denoise": denoise}
            audio = np.asarray(engine.infer(text, temperature=temperature, **kw), dtype="float32")
            rate = int(engine.sample_rate)
            print(f"  {len(text)} ký tự → {len(audio) / rate:.1f}s âm thanh trong {time.time() - started:.1f}s", flush=True)
            return audio, rate

    try:
        import anyio
        audio, rate = await anyio.to_thread.run_sync(run)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Model báo lỗi: {e}")
    audio, applied = change_speed(audio, rate, speed)
    buf = io.BytesIO()
    sf.write(buf, np.clip(audio, -1, 1), rate, format="WAV", subtype="PCM_16")
    return Response(buf.getvalue(), media_type="audio/wav", headers={"X-Speed-Applied": str(applied).lower(), "X-Ref-Seconds": f"{ref_sec:.1f}"})


def cloudflared_path() -> str:
    found = shutil.which("cloudflared")
    if found:
        return found
    arch = {"x86_64": "amd64", "amd64": "amd64", "aarch64": "arm64", "arm64": "arm64"}.get(platform.machine().lower())
    if platform.system() != "Linux" or not arch:
        sys.exit("Chưa có cloudflared. Cài nó (macOS: brew install cloudflared) rồi chạy lại với --tunnel.")
    dest = os.path.join(tempfile.gettempdir(), "cloudflared")
    if not os.path.exists(dest):
        print("Đang tải cloudflared…", flush=True)
        urllib.request.urlretrieve(f"https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-{arch}", dest)
        os.chmod(dest, os.stat(dest).st_mode | stat.S_IEXEC)
    return dest


def start_tunnel(port: int) -> None:
    proc = subprocess.Popen([cloudflared_path(), "tunnel", "--no-autoupdate", "--url", f"http://127.0.0.1:{port}"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    def watch():
        shown = False
        for line in proc.stdout:
            m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", line)
            if m and not shown:
                shown = True
                bar = "=" * 72
                print(f"\n{bar}\n  DÁN ĐỊA CHỈ NÀY VÀO DATTS → Dữ liệu → Máy chủ riêng:\n\n      {m.group(0)}\n\n  Giữ cửa sổ này mở trong lúc dùng.\n{bar}\n", flush=True)
        if not shown:
            print("Không mở được đường hầm Cloudflare. Kiểm tra mạng rồi chạy lại.", flush=True)

    threading.Thread(target=watch, daemon=True).start()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Máy chủ clone giọng cho Datts")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--host", default="127.0.0.1", help="đặt 0.0.0.0 để máy khác trong mạng LAN gọi được (khi không dùng --tunnel)")
    ap.add_argument("--tunnel", action="store_true", help="mở địa chỉ HTTPS công khai qua Cloudflare để iPad gọi được")
    ap.add_argument("--data-dir", default=None, help="nơi giữ bộ dữ liệu và model đã train qua các lần chạy (mặc định: thư mục tạm, mất khi tắt)")
    args = ap.parse_args()
    if args.data_dir:
        DATA = Path(args.data_dir).resolve()
        DATA.mkdir(parents=True, exist_ok=True)
    os.chdir(DATA)   # mã train của VieNeu chỉ nhận đường dẫn nằm trong thư mục làm việc
    print(f"Dữ liệu và model lưu ở: {DATA}" + ("" if args.data_dir else "  (tạm thời — thêm --data-dir để giữ lại)"), flush=True)
    if has_torch():
        # Có PyTorch thì dùng mã VieNeu trong repo cho cả hai model, để nạp được model đã train.
        try:
            sys.path.insert(0, str(repo_dir() / "src"))
        except Exception as e:
            print(f"Không tải được mã nguồn VieNeu ({e}); vẫn clone giọng được nhưng chưa train được.", flush=True)
    tts()   # nạp model trước để yêu cầu đầu tiên không bị chờ
    if args.tunnel:
        start_tunnel(args.port)
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
