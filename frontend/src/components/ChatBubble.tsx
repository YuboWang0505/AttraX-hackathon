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
          className={`relative px-5 py-3 rounded-[22px] text-sm leading-relaxed break-words shadow-sm ${
            mine
              ? "bg-attrax-black text-white bubble-tail-right"
              : "bg-attrax-bubble text-attrax-chat-text border border-attrax-bubble-border bubble-tail-left"
          }`}
        >
          {message.text}
        </div>
        <div
          className={`mt-1 px-2 text-[10px] text-attrax-chat-muted flex gap-2 ${mine ? "justify-end" : "justify-start"}`}
        >
          <span>{formatTime(message.timestamp)}</span>
          {message.from === "s" && message.intensity > 0 && (
            <span className="text-attrax-accent font-medium">
              → {message.intensity} 档
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
