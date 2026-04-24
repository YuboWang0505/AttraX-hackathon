import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { parse as parseUrl } from "node:url";
import { WebSocketServer } from "ws";
import type { Role } from "@attrax/shared";
import { generateCode, handleConnection, isValidCode } from "./rooms.js";
import { transcribe } from "./stt/siliconflow.js";

const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/room", (_req, res) => {
  const code = generateCode();
  res.json({ code });
});

// Chunked voice STT from the caller's live mic. The frontend records
// ~2-3s audio segments via MediaRecorder and POSTs each one here as a
// raw binary body (Content-Type carries the codec). We forward to
// SiliconFlow and return plain transcript; the frontend then sends that
// transcript as a normal `chat` WS message, so voice inherits the full
// safe-word + keyword-table + LLM pipeline unchanged.
app.post(
  "/api/stt",
  express.raw({ type: "*/*", limit: "5mb" }),
  async (req, res) => {
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      res.status(400).json({ error: "missing audio body" });
      return;
    }
    const mime = String(req.headers["content-type"] || "audio/webm");
    const result = await transcribe(buf, mime);
    res.json({
      text: result.text,
      source: result.source,
      latencyMs: result.latencyMs,
    });
  },
);

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const { pathname, query } = parseUrl(req.url ?? "", true);
  if (pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const code = typeof query.code === "string" ? query.code : "";
  const roleRaw = typeof query.role === "string" ? query.role : "";
  const safeWord =
    typeof query.safeWord === "string" ? query.safeWord : undefined;

  if (!isValidCode(code) || (roleRaw !== "s" && roleRaw !== "m")) {
    socket.destroy();
    return;
  }
  const role: Role = roleRaw;

  wss.handleUpgrade(req, socket, head, (ws) => {
    handleConnection(ws, { code, role, safeWord });
  });
});

server.listen(PORT, () => {
  console.log(`[attrax] backend listening on http://localhost:${PORT}`);
  console.log(
    `[attrax] openrouter key: ${process.env.OPENROUTER_API_KEY ? "present" : "absent (fallback mode)"}`,
  );
  console.log(
    `[attrax] siliconflow key: ${process.env.SILICONFLOW_API_KEY ? "present" : "absent (voice STT disabled)"}`,
  );
});
