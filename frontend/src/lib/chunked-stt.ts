// Chunked server-side STT. Chrome's Web Speech API is unusable inside the
// GFW (Google cloud dependency), so we do our own lightweight capture:
//   1. start a MediaRecorder on the call's local audio track
//   2. stop it every N ms, flushing a self-contained webm/opus blob
//   3. immediately restart a fresh recorder so we never stop listening
//   4. POST the blob to /api/stt → backend → SiliconFlow → text
//   5. hand the transcript back via onText, which the caller fires into
//      the existing WS `chat` pipeline (same safe-word + keyword + LLM
//      treatment as typed text)
//
// We intentionally DON'T try to stream a single MediaRecorder with
// timeslice chunks, because mid-stream chunks are not self-contained
// playable files (only the first slice has the webm container header).
// The stop/start cycle costs ~10-30ms of audio at each boundary, which
// is fine for speech that naturally has pauses.

export interface ChunkedSttOpts {
  /** Live audio stream from the WebRTC call (rtc.getLocalStream()). */
  stream: MediaStream;
  /** Chunk length; shorter → lower latency but more API calls. Default 2500ms. */
  chunkMs?: number;
  /** Drop chunks smaller than this — usually pure silence / artefacts. */
  minBytes?: number;
  /** Transcribed text (may be empty string — caller should filter). */
  onText: (text: string) => void;
  /** Toggles true when a chunk is flushed & uploading, false when idle. */
  onListening?: (active: boolean) => void;
  /** Surfaced to UI for user feedback. */
  onError?: (err: string) => void;
}

export interface ChunkedSttHandle {
  stop(): void;
  setMuted(m: boolean): void;
  isActive(): boolean;
}

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export function startChunkedStt(opts: ChunkedSttOpts): ChunkedSttHandle {
  const chunkMs = opts.chunkMs ?? 2500;
  const minBytes = opts.minBytes ?? 3000;
  const mimeType = pickMimeType();

  if (!mimeType) {
    opts.onError?.("浏览器不支持 MediaRecorder 音频录制");
    return { stop() {}, setMuted() {}, isActive: () => false };
  }

  let stopped = false;
  let muted = false;
  let currentRecorder: MediaRecorder | null = null;
  let segmentTimer: number | null = null;
  let inFlight = 0;

  function bumpListening(delta: number) {
    inFlight += delta;
    opts.onListening?.(inFlight > 0);
  }

  async function uploadChunk(blob: Blob): Promise<void> {
    bumpListening(+1);
    try {
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": blob.type || mimeType },
        body: blob,
      });
      if (!res.ok) {
        console.warn("[stt] /api/stt HTTP", res.status);
        opts.onError?.(`STT 后端 ${res.status}`);
        return;
      }
      const json = (await res.json()) as {
        text?: string;
        source?: string;
        latencyMs?: number;
      };
      const text = (json.text || "").trim();
      console.log(
        `[stt] ← "${text}" (source=${json.source}, ${json.latencyMs}ms)`,
      );
      if (json.source === "no_key") {
        opts.onError?.("后端缺 SILICONFLOW_API_KEY");
        return;
      }
      if (text) opts.onText(text);
    } catch (err) {
      console.warn("[stt] upload failed:", err);
      opts.onError?.("STT 上传失败");
    } finally {
      bumpListening(-1);
    }
  }

  function startOne(): void {
    if (stopped) return;
    const chunks: Blob[] = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(opts.stream, { mimeType });
    } catch (err) {
      console.error("[stt] MediaRecorder ctor failed:", err);
      opts.onError?.("MediaRecorder 启动失败");
      stopped = true;
      return;
    }
    currentRecorder = rec;
    rec.addEventListener("dataavailable", (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    });
    rec.addEventListener("stop", () => {
      currentRecorder = null;
      // Chain the next segment first — keeps the mic "live" with no gap
      // between timers, independent of how long the network upload takes.
      if (!stopped) startOne();

      if (muted) return;
      if (chunks.length === 0) return;
      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size < minBytes) return;
      void uploadChunk(blob);
    });
    rec.addEventListener("error", (e) => {
      console.warn("[stt] MediaRecorder error:", e);
    });
    try {
      rec.start();
    } catch (err) {
      console.error("[stt] rec.start failed:", err);
      opts.onError?.("录音启动失败");
      return;
    }
    segmentTimer = window.setTimeout(() => {
      segmentTimer = null;
      if (rec.state === "recording") {
        try {
          rec.stop();
        } catch {
          // ignore — race where the recorder already ended
        }
      }
    }, chunkMs);
  }

  startOne();

  return {
    stop() {
      stopped = true;
      if (segmentTimer !== null) {
        window.clearTimeout(segmentTimer);
        segmentTimer = null;
      }
      if (currentRecorder && currentRecorder.state === "recording") {
        try {
          currentRecorder.stop();
        } catch {
          // ignore
        }
      }
    },
    setMuted(m: boolean) {
      muted = m;
    },
    isActive() {
      return !stopped;
    },
  };
}
