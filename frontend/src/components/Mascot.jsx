/*
 * Leash, the mascot: a small ink circle with two eyes, a smile and an indigo
 * collar (the leash). It is the guardian watching the agent, not the agent.
 *
 * state: "idle" | "intro" | "working" | "alert" | "checking" | "done" | "error"
 * All motion is CSS (see .lm-* in index.css) and stops under reduced motion.
 */
export default function Mascot({ state = "idle", size = 44, className = "" }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`lm ${className}`} data-state={state} aria-hidden="true">
      <ellipse className="lm-shadow" cx="32" cy="58" rx="13" ry="2.4" />
      <g className="lm-legs">
        <rect className="lm-leg lm-leg-l" x="24.5" y="48" width="5" height="8" rx="2.5" />
        <rect className="lm-leg lm-leg-r" x="34.5" y="48" width="5" height="8" rx="2.5" />
      </g>
      <g className="lm-body">
        <circle className="lm-fill" cx="32" cy="30" r="20" />
        {/* the leash: a thin indigo collar with a small tag */}
        <path className="lm-collar" d="M15.2 39.5 Q32 47.5 48.8 39.5" />
        <circle className="lm-tag" cx="32" cy="44.2" r="1.9" />
        <g className="lm-face">
          <g className="lm-eyes">
            <ellipse className="lm-eye" cx="25" cy="27" rx="2.6" ry="3.3" />
            <ellipse className="lm-eye" cx="39" cy="27" rx="2.6" ry="3.3" />
          </g>
          <g className="lm-eyes-happy">
            <path d="M22.4 28 Q25 24.6 27.6 28" />
            <path d="M36.4 28 Q39 24.6 41.6 28" />
          </g>
          <path className="lm-mouth lm-smile" d="M27.5 34 Q32 37.6 36.5 34" />
          <path className="lm-mouth lm-flat" d="M28 35 L36 35" />
          <ellipse className="lm-mouth-o" cx="32" cy="35.4" rx="1.9" ry="2.2" />
        </g>
      </g>
    </svg>
  );
}
