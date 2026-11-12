import { useRef } from "react";

/**
 * A card that leans toward the pointer in 3D with a soft glare.
 * `max` is the lean in degrees. Touch devices and reduced motion get a flat card.
 */
export default function Tilt({ children, max = 7, className = "", radius = 28 }) {
  const ref = useRef(null);
  const frame = useRef(0);

  function move(e) {
    if (e.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.classList.add("is-live");
      el.style.setProperty("--ry", `${(x - 0.5) * 2 * max}deg`);
      el.style.setProperty("--rx", `${(0.5 - y) * 2 * max}deg`);
      el.style.setProperty("--gx", `${x * 100}%`);
      el.style.setProperty("--gy", `${y * 100}%`);
    });
  }

  function leave() {
    cancelAnimationFrame(frame.current);
    const el = ref.current;
    if (!el) return;
    el.classList.remove("is-live");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <div ref={ref} className={`tilt ${className}`} onPointerMove={move} onPointerLeave={leave}>
      <div className="tilt-inner" style={{ borderRadius: radius }}>
        {children}
        <div className="tilt-glare" aria-hidden="true" />
      </div>
    </div>
  );
}
