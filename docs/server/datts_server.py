#!/usr/bin/env python3
"""Máy chủ clone giọng mã nguồn mở cho Datts — VieNeu-TTS v3 Turbo (Apache-2.0), chạy được trên CPU.

Cài và chạy (Google Colab, máy Mac/PC/Linux có Python >= 3.10):

    pip install vieneu fastapi uvicorn python-multipart
    python datts_server.py --tunnel

`--tunnel` mở một đường hầm Cloudflare miễn phí và in ra địa chỉ https://….trycloudflare.com.
Dán địa chỉ đó vào Datts → Dữ liệu → Máy chủ riêng. Địa chỉ đổi mỗi lần chạy lại.

API:  GET /health
      POST /synthesize   multipart: text, ref_audio (1+ file WAV), speed, temperature, denoise  →  audio/wav 48 kHz
"""
import argparse, hashlib, io, os, platform, re, shutil, stat, subprocess, sys, tempfile, threading, time, urllib.request

import numpy as np
import soundfile as sf
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

MAX_REF_SEC = 8.0     # model chỉ dùng tối đa 8 giây mẫu
GAP_SEC = 0.25        # khoảng lặng khi ghép nhiều mẫu ngắn
MAX_TEXT = 5000

app = FastAPI(title="Datts voice server")
# Trình duyệt trên iPad gọi thẳng từ trang Datts, nên phải cho phép gọi chéo nguồn.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Speed-Applied", "X-Ref-Seconds"])

_tts = None
_lock = threading.Lock()
_ref_dir = tempfile.mkdtemp(prefix="datts-ref-")


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
    return {"ok": True, "engine": "VieNeu-TTS v3 Turbo", "ready": _tts is not None, "max_ref_seconds": MAX_REF_SEC}


@app.post("/synthesize")
async def synthesize(
    text: str = Form(...),
    ref_audio: list[UploadFile] = File(...),
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
    ref_path, ref_sec = build_reference([await f.read() for f in ref_audio])

    def run():
        with _lock:   # model không chạy song song an toàn; xếp hàng từng yêu cầu
            engine = tts()
            started = time.time()
            audio = np.asarray(engine.infer(text, ref_audio=ref_path, denoise=denoise, temperature=temperature), dtype="float32")
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
    args = ap.parse_args()
    tts()   # nạp model trước để yêu cầu đầu tiên không bị chờ
    if args.tunnel:
        start_tunnel(args.port)
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
