import { useEffect, useRef, useState } from "react";

/*
 * The hold, as an object: eight coins (an $80 authorization, $10 each) held
 * inside a metal ring — the leash. Every few seconds the top coins lift out
 * and fade (released back to you) while the rest stay put (captured).
 * Three.js is loaded lazily; reduced motion renders one still frame.
 */

const PALETTE = {
  light: { coin: 0xc9ccd3, coinEdge: 0x9aa0ab, ring: 0x3d49d6, released: 0x3d49d6, shadow: "rgba(14,16,20,0.16)", exposure: 1.05 },
  dark: { coin: 0x8a909b, coinEdge: 0x5d636d, ring: 0x8f98ff, released: 0x8f98ff, shadow: "rgba(0,0,0,0.55)", exposure: 1.15 },
};

const COINS = 8;
const RELEASED = 2; // top coins that float away: the unused part of the hold

function coinProfile(THREE) {
  // Lathe profile: flat faces with a softly rounded rim.
  const r = 1, t = 0.085, b = 0.03, pts = [];
  pts.push(new THREE.Vector2(0, -t));
  pts.push(new THREE.Vector2(r - b, -t));
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI;
    pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, Math.sin(a) * t));
  }
  pts.push(new THREE.Vector2(r - b, t));
  pts.push(new THREE.Vector2(0, t));
  return pts;
}

export default function HoldObject({ theme = "light", className = "" }) {
  const hostRef = useRef(null);
  const apiRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const themeRef = useRef(theme);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      let THREE, RoomEnvironment;
      try {
        THREE = await import("three");
        ({ RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js"));
      } catch {
        setFailed(true);
        return;
      }
      const host = hostRef.current;
      if (disposed || !host) return;

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch {
        setFailed(true);
        return;
      }
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);
      renderer.domElement.style.display = "block";

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, 3.9, 8.1);
      camera.lookAt(0, 1.05, 0);

      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(3, 5, 4);
      scene.add(key);

      const rig = new THREE.Group();
      rig.position.y = 0.05;
      scene.add(rig);

      // Coins
      const coinGeo = new THREE.LatheGeometry(coinProfile(THREE), 96);
      const coinMat = new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 });
      const coins = [];
      for (let i = 0; i < COINS; i++) {
        const mat = coinMat.clone();
        if (i >= COINS - RELEASED) mat.transparent = true;
        const m = new THREE.Mesh(coinGeo, mat);
        m.position.y = i * 0.25;
        m.rotation.y = i * 0.37;
        rig.add(m);
        coins.push(m);
      }
      // Engraved ring on each face, a hint of minting.
      const groove = new THREE.TorusGeometry(0.78, 0.006, 8, 96);
      const grooveMat = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.5 });
      coins.forEach((c) => {
        const g = new THREE.Mesh(groove, grooveMat);
        g.rotation.x = Math.PI / 2;
        g.position.y = 0.086;
        c.add(g);
      });

      // The leash: one tilted ring circling the stack, plus a thinner companion.
      const ringMat = new THREE.MeshPhysicalMaterial({ metalness: 0.9, roughness: 0.18, clearcoat: 1 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.045, 32, 220), ringMat);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.86, 0.012, 16, 220), ringMat);
      const ringPivot = new THREE.Group();
      ringPivot.position.y = 0.85;
      ringPivot.add(ring, ring2);
      ring.rotation.x = Math.PI / 2 - 0.32;
      ring2.rotation.x = Math.PI / 2 - 0.26;
      ring2.rotation.y = 0.12;
      rig.add(ringPivot);

      // Soft contact shadow.
      const sc = document.createElement("canvas");
      sc.width = sc.height = 128;
      const sctx = sc.getContext("2d");
      const shadowTex = new THREE.CanvasTexture(sc);
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -0.1;
      scene.add(shadow);

      const applyTheme = (name) => {
        const p = PALETTE[name] || PALETTE.light;
        coins.forEach((c, i) => {
          c.material.color.setHex(i >= COINS - RELEASED ? p.coinEdge : p.coin);
        });
        grooveMat.color.setHex(p.coinEdge);
        ringMat.color.setHex(p.ring);
        renderer.toneMappingExposure = p.exposure;
        sctx.clearRect(0, 0, 128, 128);
        const grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 62);
        grad.addColorStop(0, p.shadow);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, 128, 128);
        shadowTex.needsUpdate = true;
        return { ...p, edgeColor: new THREE.Color(p.coinEdge), releasedColor: new THREE.Color(p.released) };
      };
      let palette = applyTheme(themeRef.current);
      apiRef.current = { setTheme: (name) => { palette = applyTheme(name); if (reduced) render(0); } };

      let w = 1, h = 1;
      const resize = () => {
        const r = host.getBoundingClientRect();
        w = Math.max(1, r.width); h = Math.max(1, r.height);
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = w + "px";
        renderer.domElement.style.height = h + "px";
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();

      let tx = 0, ty = 0, px = 0, py = 0;
      const onMove = (e) => {
        const r = host.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      };
      const onLeave = () => { tx = 0; ty = 0; };
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);

      const ease = (t) => 1 - Math.pow(1 - t, 3);
      const render = (t) => {
        // 7s cycle: rest, then the released coins lift out and fade, then return.
        const cycle = (t / 7000) % 1;
        const lift = cycle < 0.45 ? 0 : cycle < 0.8 ? ease((cycle - 0.45) / 0.35) : 1 - ease((cycle - 0.8) / 0.2);
        coins.forEach((c, i) => {
          const base = i * 0.25;
          if (i >= COINS - RELEASED) {
            const k = i - (COINS - RELEASED) + 1;
            c.position.y = base + lift * (0.45 + k * 0.28);
            c.position.x = lift * k * 0.18;
            c.rotation.z = lift * 0.35 * k;
            c.material.opacity = 1 - lift * 0.85;
            c.material.color.lerpColors(palette.edgeColor, palette.releasedColor, lift);
          }
        });
        px += (tx - px) * 0.06; py += (ty - py) * 0.06;
        rig.rotation.y = t * 0.00018 + px * 0.35;
        rig.rotation.x = py * 0.12;
        ringPivot.rotation.y = -t * 0.00032;
        ringPivot.rotation.z = Math.sin(t * 0.0006) * 0.05;
        renderer.render(scene, camera);
      };

      let raf = 0, visible = true;
      const loop = (t) => { raf = 0; if (!visible) return; render(t); raf = requestAnimationFrame(loop); };
      const io = new IntersectionObserver(([e]) => {
        visible = e ? e.isIntersecting : true;
        if (visible && !reduced && !raf) raf = requestAnimationFrame(loop);
      });
      io.observe(host);
      const ro = new ResizeObserver(() => { resize(); if (reduced) render(2000); });
      ro.observe(host);
      if (reduced) render(2000); else raf = requestAnimationFrame(loop);

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect(); ro.disconnect();
        host.removeEventListener("pointermove", onMove);
        host.removeEventListener("pointerleave", onLeave);
        scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose(); }); });
        pmrem.dispose(); renderer.dispose();
        renderer.domElement.remove();
        apiRef.current = null;
      };
    })();
    return () => { disposed = true; cleanup(); };
  }, []);

  useEffect(() => { themeRef.current = theme; apiRef.current?.setTheme(theme); }, [theme]);

  return (
    <div ref={hostRef} className={`relative ${className}`} role="img"
      aria-label="An $80 PayPal hold shown as a stack of eight coins inside a ring; the top two lift away as the released amount.">
      {failed && (
        <svg viewBox="0 0 200 200" className="absolute inset-0 m-auto size-2/3 text-accent" aria-hidden="true">
          <ellipse cx="100" cy="110" rx="70" ry="22" fill="none" stroke="currentColor" strokeWidth="3" />
          {Array.from({ length: 6 }, (_, i) => <ellipse key={i} cx="100" cy={130 - i * 8} rx="44" ry="13" fill="var(--surface-2)" stroke="var(--line-strong)" />)}
        </svg>
      )}
    </div>
  );
}
