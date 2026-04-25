// SiliconFlow Whisper / SenseVoice client. OpenAI-compatible endpoint at
// api.siliconflow.cn, reachable from mainland China without VPN. Default
// model is SenseVoiceSmall — Alibaba's fast zh-first ASR, sub-second on
// a 2-3s chunk and significantly stronger than Whisper on conversational
// Chinese. Set SILICONFLOW_MODEL to override (e.g. openai/whisper-large-v3).

const API_URL = "https://api.siliconflow.cn/v1/audio/transcriptions";
const DEFAULT_MODEL = "FunAudioLLM/SenseVoiceSmall";
const TIMEOUT_MS = 8_000;

export interface TranscribeResult {
  text: string;
  source: "ok" | "no_key" | "timeout" | "http_error" | "parse_error";
  latencyMs: number;
}

function extensionFor(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base.includes("webm")) return "webm";
  if (base.includes("ogg")) return "ogg";
  if (base.includes("mp4") || base.includes("m4a")) return "mp4";
  if (base.includes("wav")) return "wav";
  return "webm";
}

// SenseVoice prepends locale / emotion / event tags like "<|zh|><|NEUTRAL|>…".
// We want plain text; strip everything inside angle brackets of that shape.
function stripSenseVoiceTags(text: string): string {
  return text.replace(/<\|[^|<>]*\|>/g, "").trim();
}

export async function transcribe(
  audio: Buffer,
  mimeType: string,
): Promise<TranscribeResult> {
  const start = Date.now();
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return { text: "", source: "no_key", latencyMs: 0 };
  }
  const model = process.env.SILICONFLOW_MODEL ?? DEFAULT_MODEL;
  const ext = extensionFor(mimeType);
  const baseMime = mimeType.split(";")[0].trim() || "audio/webm";

  // Copy into a fresh ArrayBuffer — Node's Buffer has `buffer: ArrayBufferLike`
  // which TS refuses to pass to Blob's BlobPart (can't prove it's not shared).
  const bytes = new Uint8Array(audio.byteLength);
  bytes.set(audio);
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type: baseMime }), `audio.${ext}`);
  fd.append("model", model);
  // We don't ask for verbose_json — plain text is enough and cheaper to parse.

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        `[stt] SiliconFlow HTTP ${res.status} (${latencyMs}ms): ${body.slice(0, 200)}`,
      );
      return { text: "", source: "http_error", latencyMs };
    }

    const json = (await res.json()) as { text?: string };
    const raw = typeof json.text === "string" ? json.text : "";
    const text = stripSenseVoiceTags(raw);
    return { text, source: "ok", latencyMs };
  } catch (err) {
    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    const isAbort = (err as Error)?.name === "AbortError";
    console.warn(
      `[stt] SiliconFlow ${isAbort ? "timeout" : "error"} after ${latencyMs}ms:`,
      err,
    );
    return {
      text: "",
      source: isAbort ? "timeout" : "parse_error",
      latencyMs,
    };
  }
}
