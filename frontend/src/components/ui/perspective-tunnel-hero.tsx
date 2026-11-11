"use client";

// Adapted for Leash from the "perspective tunnel hero" component:
// - progress follows normal page scroll through a pinned section (useScroll) instead of
//   capturing every wheel event, which trapped the page and never moved on touch devices
// - cards can be text listings (no image) with an optional flag, as well as images
// - title/eyebrow/hint are props; colours use the app's tokens; no gradient text
// - full-width container (w-full) instead of w-screen, which caused horizontal overflow

import {
  motion, useTransform, useReducedMotion, useMotionValue, useSpring, useScroll, MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface TunnelItem {
  title: string;
  src?: string;
  subtitle?: string;
  body?: string;
  meta?: string;
  flagged?: boolean;
  flagLabel?: string;
}

const DEFAULT_ITEMS: TunnelItem[] = [
  { src: "https://cdn.21st.dev/assets/mirror/c3/c3fbd2afa140223999a441b32ed986f61d473930002708df805a81532a326aac.jpg", title: "Chroma I" },
  { src: "https://cdn.21st.dev/assets/mirror/9d/9d8b2f675a5814476ada3736ce439bcda23c5c389e0ebf9b25d8a0c09f3bbcfe.jpg", title: "Prism III" },
  { src: "https://cdn.21st.dev/assets/mirror/8b/8bb738bf2f00d7f7ed3c3ec034adb9938ad38f4be4ac191d632a6a11ad525574.jpg", title: "Ether IV" },
  { src: "https://cdn.21st.dev/assets/mirror/ac/ac5ac700b188d7ef16ee9dab868098b59f15c440db3f71d4e8c03262a3287577.jpg", title: "Quantum V" },
  { src: "https://cdn.21st.dev/assets/mirror/ef/ef25eff6ce655fba459b3b7e7711524dc92499aa18f6c7dbea9a0fcc56a8f908.jpg", title: "Nebula VI" },
  { src: "https://cdn.21st.dev/assets/mirror/f2/f28b370a5dcbf76240f1504579c4b05fc0ff0bb990a42aff8dc2f73a5dc46072.jpg", title: "Cyber VII" },
];

interface TunnelCardData {
  item: TunnelItem;
  angleCos: number;
  angleSin: number;
  radiusFactorX: number;
  radiusFactorY: number;
  rotationZ: number;
  index: number;
}

function layout(items: TunnelItem[]): TunnelCardData[] {
  return items.map((item, i) => {
    const goldenAngle = i * 137.5 * (Math.PI / 180);
    return {
      item,
      angleCos: Math.cos(goldenAngle),
      angleSin: Math.sin(goldenAngle),
      radiusFactorX: 0.28 + (i % 3) * 0.08,
      radiusFactorY: 0.26 + (i % 2) * 0.09,
      rotationZ: (i % 2 === 0 ? 1 : -1) * (3 + (i % 5) * 2),
      index: i,
    };
  });
}

const SPRING_CONFIG = { stiffness: 60, damping: 25, mass: 0.5 };

interface StageDimensions { width: number; height: number; isMobile: boolean }

function useCameraParallax(enabled: boolean) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, SPRING_CONFIG);
  const y = useSpring(rawY, SPRING_CONFIG);
  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      rawX.set((e.clientX / window.innerWidth - 0.5) * 2);
      rawY.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, rawX, rawY]);
  return { x, y };
}

interface TunnelCardProps {
  card: TunnelCardData;
  progress: MotionValue<number>;
  pointer: { x: MotionValue<number>; y: MotionValue<number> };
  total: number;
  stage: StageDimensions;
}

function TunnelCard({ card, progress, pointer, total, stage }: TunnelCardProps) {
  const staggerSpan = 0.55;
  const start = (card.index / total) * (1 - staggerSpan);
  const end = start + staggerSpan;
  const localProgress = useTransform(progress, [start, end], [0, 1]);
  const z = useTransform(localProgress, [0, 1], [stage.isMobile ? -1200 : -1700, stage.isMobile ? 350 : 500]);
  const opacity = useTransform(localProgress, [0, 0.18, 0.82, 0.98], [0, 1, 1, 0]);

  const cardWidth = stage.isMobile
    ? Math.max(150, Math.min(200, stage.width * 0.46))
    : Math.max(200, Math.min(280, stage.width * 0.19));
  const baseX = card.angleCos * (stage.width * card.radiusFactorX);
  const baseY = card.angleSin * (stage.height * card.radiusFactorY);
  const panStrength = stage.isMobile ? 20 : 45;

  const transform = useTransform([z, pointer.x, pointer.y], ([currZ, px, py]: number[]) => {
    const offsetX = baseX - px * panStrength;
    const offsetY = baseY - py * panStrength;
    return `translate3d(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px), ${currZ}px) rotateZ(${card.rotationZ}deg)`;
  });

  const { item } = card;
  return (
    <motion.div
      style={{ width: cardWidth, transform, opacity, zIndex: card.index + 1 }}
      className="absolute left-1/2 top-1/2 aspect-[4/5] will-change-transform select-none"
    >
      {item.src ? (
        <div className="relative h-full w-full overflow-hidden rounded-xl border border-line bg-surface-2">
          <img src={item.src} alt={item.title} draggable={false} className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <span className="text-sm font-medium text-white">{item.title}</span>
          </div>
        </div>
      ) : (
        <article className={`flex h-full w-full flex-col rounded-xl border bg-surface p-4 sm:p-5 ${item.flagged ? "border-warn/60" : "border-line"}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[13px] font-medium leading-snug text-ink">{item.title}</h3>
            {item.meta && <span className="num shrink-0 text-[13px] text-ink">{item.meta}</span>}
          </div>
          {item.subtitle && <p className="mt-1 text-[11px] text-ink-3">{item.subtitle}</p>}
          {item.body && (
            <p className={`mt-auto pt-3 font-mono text-[11px] leading-relaxed ${item.flagged ? "text-warn" : "text-ink-2"}`}>
              {item.body.length > 170 ? item.body.slice(0, 170) + "…" : item.body}
            </p>
          )}
          {item.flagged && <span className="badge-warn mt-3">{item.flagLabel || "Hidden instruction"}</span>}
        </article>
      )}
    </motion.div>
  );
}

export interface PerspectiveTunnelHeroProps {
  items?: TunnelItem[];
  eyebrow?: string;
  title?: ReactNode;
  hint?: string;
  prompt?: string;
  /** Scroll length of the pinned section, in viewport heights. */
  length?: number;
  /** Where the flight starts (0-1). Above 0, cards are already in flight and the title is sharp on load. */
  startAt?: number;
  className?: string;
}

export default function PerspectiveTunnelHero({
  items = DEFAULT_ITEMS,
  eyebrow,
  title = <>Into the<br />ether.</>,
  hint = "Scroll to fly through the corridor.",
  prompt = "Scroll",
  length = 3,
  startAt = 0,
  className = "",
}: PerspectiveTunnelHeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<StageDimensions>({ width: 1440, height: 900, isMobile: false });

  useEffect(() => {
    const update = () => setStage({ width: window.innerWidth, height: window.innerHeight, isMobile: window.innerWidth < 768 });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Progress is the page's own scroll through this tall section; nothing is hijacked.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const offsetProgress = useTransform(scrollYProgress, [0, 1], [startAt, 1]);
  const smoothProgress = useSpring(offsetProgress, { stiffness: 80, damping: 30, restDelta: 0.0001 });

  const pointer = useCameraParallax(!reduce);
  const cards = layout(items);

  const titleScale = useTransform(smoothProgress, [0, 0.5, 1], [startAt ? 1 : 0.85, 1, 1.15]);
  const titleOpacity = useTransform(smoothProgress, [0, 0.1, 0.85, 1], [startAt ? 1 : 0.35, 1, 1, 0]);
  const promptOpacity = useTransform(smoothProgress, [startAt, startAt + 0.08], [1, 0]);

  return (
    <section ref={sectionRef} className={`relative w-full ${className}`} style={{ height: `${Math.max(1.5, length) * 100}svh` }}>
      <div
        className="sticky top-0 flex h-[100svh] w-full items-center justify-center overflow-hidden"
        style={{ perspective: stage.isMobile ? "900px" : "1200px", transformStyle: "preserve-3d" }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--line-strong)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_55%,transparent_100%)] opacity-70" />
        <div className="pointer-events-none absolute h-[48vmin] w-[48vmin] rounded-full border border-accent/20" />
        <div className="pointer-events-none absolute h-[76vmin] w-[76vmin] rounded-full border border-dashed border-line-strong" />

        <motion.div style={{ scale: titleScale, opacity: titleOpacity }}
          className="pointer-events-none z-0 flex max-w-xl flex-col items-center px-6 text-center">
          {eyebrow && <p className="mb-4 text-sm text-accent">{eyebrow}</p>}
          <h2 className="text-5xl font-medium leading-[0.95] tracking-[-0.04em] text-ink sm:text-7xl">{title}</h2>
          <p className="mt-5 max-w-[38ch] text-sm text-ink-2 sm:text-base">{hint}</p>
        </motion.div>

        <motion.div style={{ opacity: promptOpacity }}
          className="pointer-events-none absolute bottom-8 z-20 flex flex-col items-center gap-2 text-xs text-ink-3">
          <span>{prompt}</span>
          <div className="h-6 w-px bg-line-strong" />
        </motion.div>

        <div className="pointer-events-none absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          {cards.map((card) => (
            <TunnelCard key={card.index} card={card} progress={smoothProgress} pointer={pointer} total={cards.length} stage={stage} />
          ))}
        </div>
      </div>
    </section>
  );
}
