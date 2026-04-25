import { motion } from "framer-motion";
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

const BRAND = "#FF8A3D";

export function ChatBubble({ message, self }: Props) {
  const mine = message.from === self;
  return (
    <div className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%]">
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={`relative bg-white px-7 py-5 text-base font-bold text-black/80 leading-relaxed tracking-tight break-words shadow-[0_30px_60px_-12px_rgba(0,0,0,0.05),0_18px_36px_-18px_rgba(0,0,0,0.05)] ${
            mine
              ? "rounded-[2rem] rounded-tr-md"
              : "rounded-[2rem] rounded-tl-md"
          }`}
        >
          {message.text}
          {/* Tiny corner notch matching the reference design */}
          <div
            className={`absolute top-0 w-7 h-7 bg-white ${
              mine ? "-right-1" : "-left-1"
            }`}
            style={{
              clipPath: mine
                ? "polygon(100% 0, 0 0, 0 100%)"
                : "polygon(100% 0, 0 0, 100% 100%)",
            }}
          />
        </motion.div>
        <div
          className={`mt-2 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-black/30 flex gap-3 ${
            mine ? "justify-end" : "justify-start"
          }`}
        >
          <span>{formatTime(message.timestamp)}</span>
          {message.from === "s" && message.intensity > 0 && (
            <span style={{ color: BRAND }}>· Lv {message.intensity}</span>
          )}
        </div>
      </div>
    </div>
  );
}
