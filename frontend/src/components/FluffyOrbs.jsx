// Soft, glowing pink spheres after the "fluffy elements" reference: each orb is
// a white-to-pink gradient, blurred at the edge, with a pink halo behind the cluster.

const ORB = "radial-gradient(circle at 50% 30%, #ffffff 0%, #fdf2f7 32%, #f9c6dd 58%, #f472b6 86%, #ec4899 100%)";

// Flower-like cluster: two behind, two at the sides, one in front (as in the reference).
const CLUSTER = [
  { x: 30, y: 6, z: 1, d: "0s" },
  { x: 62, y: 6, z: 1, d: "-1.4s" },
  { x: 14, y: 34, z: 2, d: "-2.8s" },
  { x: 78, y: 34, z: 2, d: "-4.2s" },
  { x: 46, y: 50, z: 3, d: "-5.6s" },
];

export function Orb({ size = 28, blur = 0.6, className = "" }) {
  return (
    <span aria-hidden="true" className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size, background: ORB, filter: `blur(${blur}px)`, boxShadow: `0 0 ${size * 0.6}px ${size * 0.08}px rgb(244 114 182 / 0.55)` }} />
  );
}

export default function FluffyOrbs({ size = 300, className = "" }) {
  const d = size * 0.42;
  return (
    <div aria-hidden="true" className={`pointer-events-none relative ${className}`} style={{ width: size, height: size * 0.95 }}>
      <div className="absolute inset-[8%] rounded-full" style={{ background: "radial-gradient(circle, rgb(244 114 182 / 0.55), rgb(236 72 153 / 0.18) 45%, transparent 70%)", filter: "blur(28px)" }} />
      {CLUSTER.map((o, i) => (
        <div key={i} className="absolute animate-float" style={{ left: `${o.x}%`, top: `${o.y}%`, width: d, height: d, marginLeft: -d / 2 + size * 0.12, zIndex: o.z, animationDelay: o.d }}>
          <div className="size-full rounded-full" style={{ background: ORB, filter: "blur(5px)", boxShadow: "0 0 50px 8px rgb(244 114 182 / 0.45)" }} />
        </div>
      ))}
    </div>
  );
}
