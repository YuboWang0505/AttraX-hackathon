interface Props {
  /** Number of ghost echo layers */
  echoes?: number;
  /** When true, prepend a smaller "Hi!" */
  greeting?: boolean;
  className?: string;
}

/**
 * Figma "Hi! Synesthesia Lab" hero.
 * Uses CSS clamp() in `.synth-echo` for fluid sizing (38px → 108px) — fits
 * both 402px phones and 1440px desktops without per-breakpoint props.
 */
export function SynthHero({
  echoes = 6,
  greeting = true,
  className = "",
}: Props) {
  const label = (
    <>
      {greeting && (
        <span style={{ fontSize: "0.8em", display: "inline-block", marginRight: "0.2em" }}>
          Hi!
        </span>
      )}
      <br />
      Synesthesia
      <br />
      Lab
    </>
  );

  return (
    <div className={`synth-echo select-none ${className}`}>
      {label}
      {Array.from({ length: echoes }, (_, i) => (
        <span
          key={i}
          className="ghost"
          style={
            {
              "--tx": `${(i + 1) * 2}px`,
              "--ty": `${(i + 1) * 2}px`,
              opacity: 0.22 - i * 0.02,
            } as React.CSSProperties
          }
          aria-hidden
        >
          {label}
        </span>
      ))}
    </div>
  );
}
