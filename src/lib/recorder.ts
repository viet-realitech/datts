import { concatFloat32 } from './wav';

/** Giữ micro mở giữa các lần thu để bấm là thu ngay; chỉ gom PCM khi đang thu. */
export class Recorder {
  private ctx?: AudioContext;
  private stream?: MediaStream;
  private node?: AudioWorkletNode;
  private chunks: Float32Array[] = [];
  private recording = false;
  onLevel?: (peak: number) => void;
  label = '';

  get sampleRate() { return this.ctx?.sampleRate ?? 48000; }
  get open() { return !!this.stream; }

  async start(deviceId?: string): Promise<void> {
    await this.close();
    // Tắt mọi xử lý của trình duyệt: cần tín hiệu thô từ mic để clone giọng.
    const audio: MediaTrackConstraints = {
      echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    };
    try { this.stream = await navigator.mediaDevices.getUserMedia({ audio }); }
    catch (e) {
      if (!deviceId) throw e;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { ...audio, deviceId: undefined } });
    }
    this.label = this.stream.getAudioTracks()[0]?.label ?? '';
    const Ctx: typeof AudioContext = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    try { this.ctx = new Ctx({ sampleRate: 48000, latencyHint: 'interactive' }); } catch { this.ctx = new Ctx(); }
    await this.ctx.audioWorklet.addModule(import.meta.env.BASE_URL + 'recorder-worklet.js');
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
    this.node.port.onmessage = (ev: MessageEvent<Float32Array>) => {
      const c = ev.data;
      if (this.recording) this.chunks.push(c);
      if (this.onLevel) { let m = 0; for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > m) m = a; } this.onLevel(m); }
    };
    const mute = this.ctx.createGain(); mute.gain.value = 0;   // kéo đồ thị chạy mà không phát ra loa
    src.connect(this.node).connect(mute).connect(this.ctx.destination);
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  begin() { this.chunks = []; this.recording = true; }
  end(): Float32Array { this.recording = false; const out = concatFloat32(this.chunks); this.chunks = []; return out; }

  async close(): Promise<void> {
    this.recording = false;
    this.stream?.getTracks().forEach(t => t.stop());
    this.node?.disconnect();
    if (this.ctx && this.ctx.state !== 'closed') await this.ctx.close().catch(() => {});
    this.stream = undefined; this.ctx = undefined; this.node = undefined;
  }
}

export async function listMics(): Promise<MediaDeviceInfo[]> {
  return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
}

export async function decodeToMono(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const Ctx: typeof AudioContext = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const out = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels; }
    return { samples: out, sampleRate: buf.sampleRate };
  } finally { void ctx.close(); }
}
