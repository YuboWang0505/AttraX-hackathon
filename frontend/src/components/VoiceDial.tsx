import { useMemo } from "react";
import type { Intensity } from "@attrax/shared";

interface Props {
  intensity: Intensity;
  active?: boolean;
  /** px diameter — defaults to 560 for voice-screen hero, smaller values for panel use */
  size?: number;
  /** Show the rotating red recording indicator */
  recording?: boolean;
}

const TICK_COUNT = 60;

/**
 * Figma circular voice-recorder dial — 60 radial ticks + pulsing red indicator.
 * Intensity modulates tick opacity; `recording` makes the red dot rotate.
 */
export function VoiceDial({
  intensity,
  active = true,
  size = 560,
  recording = true,
}: Props) {
  const ticks = useMemo(
    () => Array.from({ length: TICK_COUNT }, (_, i) => i),
    [],
  );
  const level = intensity / 3;

  return (
    <div
      className="dial relative"
      style={{ width: size, height: size }}
      aria-label="voice intensity dial"
    >
      {ticks.map((i) => {
        const angle = (i / TICK_COUNT) * 360;
        const near =
          Math.min(
            Math.abs(i - TICK_COUNT / 4),
            Math.abs(i - (TICK_COUNT * 3) / 4),
          ) / (TICK_COUNT / 4);
        const baseOpacity = 0.25 + 0.55 * (1 - near);
        const glowOpacity = active ? baseOpacity + level * 0.2 : baseOpacity * 0.6;
        return (
          <div
            key={i}
            className="tick"
            style={{
              transform: `rotate(${angle}deg) translateY(10px)`,
              opacity: Math.min(1, glowOpacity),
              background:
                active && i % 10 === 0 ? "#FF8832" : "#787878",
              height: i % 15 === 0 ? 28 : 20,
            }}
          />
        );
      })}

      {/* Rotating red record indicator (spins once per 6s while active) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          animation: recording && active ? "halo-spin 6s linear infinite" : "none",
        }}
      >
        <div
          className="dial-record"
          style={{
            animation: recording && active ? "record-pulse 1.2s ease-in-out infinite" : "none",
            opacity: active ? 1 : 0.3,
          }}
        />
      </div>

      {/* Center plate */}
      <div className="absolute inset-8 rounded-full bg-white/90 backdrop-blur-sm shadow-inner" />
    </div>
  );
}
