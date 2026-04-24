import type { ChatMessage } from "../store.js";
import type { Role } from "@attrax/shared";

interface Props {
  message: ChatMessage;
  self: Role;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function ChatBubble({ message, self }: Props) {
  const mine = message.from === self;
  return (
    <div
      className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}
    >
      <div className="max-w-[78%]">
        <div
          className={`px-4 py-2 rounded-bubble text-sm leading-relaxed break-words ${
            mine
              ? "bg-attrax-grad text-white"
              : "bg-attrax-panel text-attrax-text border border-white/5"
          }`}
        >
          {message.text}
        </div>
        <div
          className={`mt-1 text-[10px] text-attrax-muted flex gap-2 ${mine ? "justify-end" : "justify-start"}`}
        >
          <span>{formatTime(message.timestamp)}</span>
          {message.from === "s" && message.intensity > 0 && (
            <span className="text-attrax-accent">→ {message.intensity} 档</span>
          )}
        </div>
      </div>
    </div>
  );
}
