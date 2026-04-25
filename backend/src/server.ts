import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { parse as parseUrl } from "node:url";
import { WebSocketServer } from "ws";
import type { Role } from "@attrax/shared";
import { handleConnection, isValidCode, precreateRoom } from "./rooms.js";

const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Body shape: { safeWord?: string }
// The Room is materialized server-side immediately so that a joiner using
// this code never accidentally creates a separate empty room while the
// creator is still on BtGate. The safe word ships into the room here so
// the creator's WS connect doesn't have to bring it again.
app.post("/api/room", (req, res) => {
  const safeWord =
    typeof req.body?.safeWord === "string" ? req.body.safeWord : undefined;
  const code = precreateRoom(safeWord);
  res.json({ code });
});

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
});
