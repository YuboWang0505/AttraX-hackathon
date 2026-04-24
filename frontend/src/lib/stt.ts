// Web Speech API direct wrapper. Continuous zh-CN recognition with auto
// restart (Chrome stops after ~60s of silence by default), confidence
// surfaced to the caller, and a mute flag to drop results while user
// has muted their mic.

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  addEventListener: (
    type: "result" | "error" | "end" | "start",
    listener: (ev: unknown) => void,
  ) => void;
}

interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence: number };
  }>;
}

interface SpeechErrorEvent {
  error: string;
}

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSupported(): boolean {
  return getCtor() !== null;
}

export interface SttOpts {
  lang?: string; // default "zh-CN"
  /** Minimum confidence 0-1 to forward; below this the result is dropped. */
  minConfidence?: number;
  onFinalResult: (text: string, confidence: number) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export interface SttHandle {
  start(): void;
  stop(): void;
  isActive(): boolean;
  setMuted(m: boolean): void;
}

export function createSttSession(opts: SttOpts): SttHandle {
  const Ctor = getCtor();
  if (!Ctor) throw new Error("Web Speech API not supported in this browser");

  const rec = new Ctor();
  rec.lang = opts.lang ?? "zh-CN";
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  const minConfidence = opts.minConfidence ?? 0;
  let wantActive = false;
  let muted = false;

  rec.addEventListener("result", (ev: unknown) => {
    if (muted) return;
    const e = ev as SpeechResultEvent;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (!r.isFinal) continue;
      const alt = r[0];
      const text = (alt.transcript || "").trim();
      const confidence =
        typeof alt.confidence === "number" ? alt.confidence : 1;
      if (!text) continue;
      if (confidence < minConfidence) continue;
      opts.onFinalResult(text, confidence);
    }
  });

  rec.addEventListener("error", (ev: unknown) => {
    const e = ev as SpeechErrorEvent;
    // "no-speech" / "aborted" are routine and shouldn't kill the session
    if (e.error === "no-speech" || e.error === "aborted") return;
    opts.onError?.(e.error || "unknown");
  });

  rec.addEventListener("end", () => {
    // Chrome auto-stops after inactivity. If user still wants it on, restart.
    if (wantActive) {
      try {
        rec.start();
      } catch {
        // ignore — usually a benign "already started" race
      }
    } else {
      opts.onEnd?.();
    }
  });

  return {
    start() {
      if (wantActive) return;
      wantActive = true;
      try {
        rec.start();
      } catch {
        // ignore
      }
    },
    stop() {
      wantActive = false;
      try {
        rec.abort();
      } catch {
        // ignore
      }
    },
    isActive() {
      return wantActive;
    },
    setMuted(m: boolean) {
      muted = m;
    },
  };
}
