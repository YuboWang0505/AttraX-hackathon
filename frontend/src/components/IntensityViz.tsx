import { motion } from "framer-motion";
import type { Intensity } from "@attrax/shared";

interface Props {
  intensity: Intensity;
  compact?: boolean;
}

// 4 tick positions evenly spread on a 140° arc (left→right).
// theta measured from positive x-axis, CCW.
const TICKS: Intensity[] = [0, 1, 2, 3];
const START_DEG = 160;
const END_DEG = 20;

function angleFor(level: Intensity): number {
  const t = level / 3; // 0..1
  return START_DEG + t * (END_DEG - START_DEG);
}

function pointOnArc(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const s = pointOnArc(cx, cy, r, startDeg);
  const e = pointOnArc(cx, cy, r, endDeg);
  // large-arc-flag = 0 (short arc), sweep-flag = 0 (CCW from start to end
  // because we're going left→right but angles decrease)
  const sweep = startDeg > endDeg ? 0 : 1;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 0 ${sweep} ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export function IntensityViz({ intensity, compact = false }: Props) {
  const width = compact ? 240 : 320;
  const height = compact ? 110 : 150;
  const cx = width / 2;
  const cy = height + 10; // arc center below the viz
  const r = compact ? 110 : 150;

  const needleAngle = angleFor(intensity);
  const needle = pointOnArc(cx, cy, r, needleAngle);
  const label = ["静止", "轻", "中", "强"][intensity];

  const orange = "#f07a3a";
  const muted = "rgba(0,0,0,0.12)";

  return (
    <div
      className={`flex flex-col items-center ${compact ? "gap-1" : "gap-3"}`}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="overflow-visible"
      >
        {/* base arc */}
        <path
          d={arcPath(cx, cy, r, START_DEG, END_DEG)}
          stroke={muted}
          strokeWidth={compact ? 2 : 3}
          fill="none"
          strokeLinecap="round"
        />
        {/* filled portion from 0 to current */}
        {intensity > 0 && (
          <motion.path
            d={arcPath(cx, cy, r, START_DEG, needleAngle)}
            stroke={orange}
            strokeWidth={compact ? 3 : 4}
            fill="none"
            strokeLinecap="round"
            initial={false}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        )}
        {/* tick dots */}
        {TICKS.map((t) => {
          const p = pointOnArc(cx, cy, r, angleFor(t));
          const active = t === intensity;
          return (
            <circle
              key={t}
              cx={p.x}
              cy={p.y}
              r={active ? (compact ? 5 : 7) : compact ? 2.5 : 3.5}
              fill={active ? orange : muted}
            />
          );
        })}
        {/* moving needle indicator (small red accent dot) */}
        <motion.circle
          cx={needle.x}
          cy={needle.y}
          r={compact ? 4 : 5}
          fill="#d14020"
          initial={false}
          animate={{ cx: needle.x, cy: needle.y }}
          transition={{ type: "spring", stiffness: 160, damping: 18 }}
        />
      </svg>

      <div
        className={`flex items-baseline gap-2 ${compact ? "text-[10px]" : "text-xs"}`}
      >
        <span className="text-attrax-chat-muted">档位</span>
        <span className="font-mono font-semibold text-attrax-chat-text">
          {intensity}
        </span>
        <span className="text-attrax-chat-muted">· {label}</span>
      </div>
    </div>
  );
}
