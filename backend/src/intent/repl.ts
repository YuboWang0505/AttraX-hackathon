import "dotenv/config";
import * as readline from "node:readline";
import { runPipeline } from "./pipeline.js";

const SAFE_WORD = "安全词";

console.log("AttraX intent pipeline REPL");
console.log(`Safe word: "${SAFE_WORD}"`);
console.log(
  `OpenRouter key: ${process.env.OPENROUTER_API_KEY ? "present" : "absent (fallback mode)"}`,
);
console.log("Type a message, press enter. Ctrl-C to quit.\n");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

rl.prompt();

rl.on("line", async (line) => {
  const text = line.trim();
  if (!text) {
    rl.prompt();
    return;
  }
  try {
    const r = await runPipeline(text, SAFE_WORD);
    const intensityStr = r.intensity === null ? "HOLD" : String(r.intensity);
    const label = r.safeWordTriggered
      ? "SAFE_WORD_TRIGGERED"
      : `intensity=${intensityStr} (${r.layer})${r.reason ? ` · ${r.reason}` : ""}`;
    console.log(`  → ${label}`);
  } catch (err) {
    console.error("  ! pipeline error:", err);
  }
  rl.prompt();
});

rl.on("close", () => {
  process.exit(0);
});
