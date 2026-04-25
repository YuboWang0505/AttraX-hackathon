interface Props {
  dark?: boolean;
  className?: string;
}

/**
 * Figma signature background: colorful heavily-blurred orbs floating behind
 * a white (or black) stage. Fixed full-viewport, non-interactive.
 */
export function Aurora({ dark = false, className = "" }: Props) {
  return (
    <div className={`aurora ${dark ? "aurora-dark" : ""} ${className}`} aria-hidden>
      <div className="orb lilac" />
      <div className="orb peach" />
      <div className="orb sky" />
    </div>
  );
}
