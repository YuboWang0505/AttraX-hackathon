import { motion } from "framer-motion";
import type { Intensity } from "@attrax/shared";

interface Props {
  intensity: Intensity;
  compact?: boolean;
}

const LABELS: Record<Intensity, string> = {
  0: "静止",
  1: "轻",
  2: "中",
  3: "强",
};

// Breathing period per PRD §4.2
const DURATIONS: Record<Intensity, number> = {
  0: 0,
  1: 2.0,
  2: 1.0,
  3: 0.3,
};

export function IntensityViz({ intensity, compact = false }: Props) {
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
                borderColor: "rgba(184, 76, 255, 0.6)",
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
        className={`flex items-center gap-2 text-attrax-muted ${compact ? "text-xs" : "text-sm"}`}
      >
        <span>档位</span>
        <span className="font-mono text-attrax-text">
          {intensity} / 3 · {LABELS[intensity]}
        </span>
      </div>
    </div>
  );
}
