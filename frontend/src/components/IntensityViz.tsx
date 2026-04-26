import { motion } from "framer-motion";
import type { Intensity } from "@attrax/shared";
import { useT } from "../i18n/index.js";
import type { StringKey } from "../i18n/strings.js";

interface Props {
  intensity: Intensity;
  compact?: boolean;
}

const LABEL_KEYS: Record<Intensity, StringKey> = {
  0: "chat.intensity.0",
  1: "chat.intensity.1",
  2: "chat.intensity.2",
  3: "chat.intensity.3",
};

// Breathing period per PRD §4.2
const DURATIONS: Record<Intensity, number> = {
  0: 0,
  1: 2.0,
  2: 1.0,
  3: 0.3,
};

export function IntensityViz({ intensity, compact = false }: Props) {
  const t = useT();
  const duration = DURATIONS[intensity];
  const active = intensity > 0;

  const ringSize = compact ? 80 : 220;
  const coreSize = ringSize * 0.45;

  return (
    <div
      className={`flex flex-col items-center justify-center ${compact ? "gap-1" : "gap-4"}`}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: ringSize, height: ringSize }}
      >
        {active &&
          [0, 1, 2].map((i) => (
            <motion.div
              key={`${intensity}-${i}`}
              className="absolute rounded-full border"
              style={{
                width: ringSize,
                height: ringSize,
                borderColor: "rgba(240, 122, 58, 0.6)",
              }}
              initial={{ scale: 0.45, opacity: 0.8 }}
              animate={{ scale: 1.05, opacity: 0 }}
              transition={{
                duration,
                repeat: Infinity,
                delay: (duration / 3) * i,
                ease: "easeOut",
              }}
            />
          ))}
        <motion.div
          className="rounded-full bg-attrax-grad"
          style={{ width: coreSize, height: coreSize }}
          animate={
            active
              ? {
                  scale: [0.9, 1.08, 0.9],
                  opacity: [0.85, 1, 0.85],
                }
              : { scale: 1, opacity: 0.25 }
          }
          transition={
            active
              ? { duration, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.3 }
          }
        />
      </div>
      <div
        className={`flex items-center gap-2 text-ink-500 ${compact ? "text-xs" : "text-sm"}`}
      >
        <span>{t("chat.intensity.label")}</span>
        <span className="font-mono text-ink-900">
          {intensity} / 3 · {t(LABEL_KEYS[intensity])}
        </span>
      </div>
    </div>
  );
}
