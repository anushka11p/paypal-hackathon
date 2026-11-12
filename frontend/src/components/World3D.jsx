import { useEffect, useRef } from "react";

/*
 * The world behind the page: the things Leash is about, floating in 3D.
 * Coins (your money), a blue ring (the leash), a payment card, a padlock, a shield and a shopping bag
 * drift slowly and slide past as you scroll, so the page has real objects behind and between the clay cards.
 *
 * It fills its nearest positioned ancestor and pins one viewport-tall canvas inside it (CSS sticky),
 * so it never sits behind the tunnel or the footer. Pauses when off screen; holds still under reduced motion.
 */

const THEME = {
  light: { silver: 0xbcc2cc, brand: 0x0070e0, gold: 0xffc439, body: 0x001c64, paper: 0xffffff, glass: 0x6cc3ff, key: 2.2, exposure: 1.0, opacity: 0.95 },
  dark: { silver: 0xb4bccb, brand: 0x6cc3ff, gold: 0xffc439, body: 0x1249b8, paper: 0xf2f5fa, glass: 0x6cc3ff, key: 1.7, exposure: 1.1, opacity: 0.9 },
};

// Small deterministic random, so the layout is the same on every load.
function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export default function World3D({ theme = "light" }) {
  const hostRef = useRef(null);
  const apiRef = useRef(null);
  const themeRef = useRef(theme);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      let THREE, RoomEnvironment, RoundedBoxGeometry;
      try {
        THREE = await import("three");
        ({ RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js"));
        ({ RoundedBoxGeometry } = await import("three/examples/jsm/geometries/RoundedBoxGeometry.js"));
      } catch { return; }
      const host = hostRef.current;
      if (disposed || !host) return;
      const track = host.parentElement.parentElement; // the tall wrapper the canvas is pinned inside

      let renderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
      catch { return; }
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const small = window.innerWidth < 768;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.75));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);
      renderer.domElement.style.display = "block";

      const scene = new THREE.Scene();
      scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 0, 10);
      const key = new THREE.DirectionalLight(0xffffff, 2);
      key.position.set(-4, 6, 6);
      scene.add(key);

      // Shared materials, recoloured by theme.
      const M = {
        silver: new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.28, clearcoat: 0.5 }),
        goldMetal: new THREE.MeshPhysicalMaterial({ metalness: 0.85, roughness: 0.3, clearcoat: 0.6 }),
        brand: new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.2 }),
        body: new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 }),
        paper: new THREE.MeshPhysicalMaterial({ roughness: 0.6, sheen: 0.4 }),
        glass: new THREE.MeshPhysicalMaterial({ roughness: 0.08, transparent: true, opacity: 0.42, clearcoat: 1, side: THREE.DoubleSide }),
      };

      const makers = {
        coin(tinted) {
          const g = new THREE.Group();
          const m = tinted ? M.goldMetal : M.silver;
          g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 64), m));
          const ringGeo = new THREE.TorusGeometry(0.5, 0.025, 8, 64);
          for (const y of [0.052, -0.052]) { const r = new THREE.Mesh(ringGeo, m); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
          g.rotation.x = Math.PI / 2;
          const wrap = new THREE.Group(); wrap.add(g); return wrap;
        },
        ring() { return new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.13, 24, 96), M.brand); },
        card() {
          const g = new THREE.Group();
          g.add(new THREE.Mesh(new RoundedBoxGeometry(1.9, 1.2, 0.07, 6, 0.09), M.body));
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 0.075), M.brand); stripe.position.y = 0.28; g.add(stripe);
          const chip = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.24, 0.085, 3, 0.04), M.silver); chip.position.set(-0.6, -0.12, 0); g.add(chip);
          return g;
        },
        lock() {
          const g = new THREE.Group();
          g.add(new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.9, 0.42, 6, 0.14), M.body));
          const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.085, 16, 48, Math.PI), M.silver); shackle.position.y = 0.45; g.add(shackle);
          for (const x of [-0.34, 0.34]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.22, 16), M.silver); leg.position.set(x, 0.4, 0); g.add(leg); }
          const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.44, 24), M.brand); hole.rotation.x = Math.PI / 2; hole.position.y = 0.02; g.add(hole);
          return g;
        },
        shield() {
          const s = new THREE.Shape();
          s.moveTo(0, 0.95); s.bezierCurveTo(0.35, 0.8, 0.6, 0.72, 0.78, 0.7);
          s.bezierCurveTo(0.82, 0.1, 0.55, -0.6, 0, -0.95);
          s.bezierCurveTo(-0.55, -0.6, -0.82, 0.1, -0.78, 0.7);
          s.bezierCurveTo(-0.6, 0.72, -0.35, 0.8, 0, 0.95);
          const geo = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 4, curveSegments: 24 });
          geo.center();
          return new THREE.Mesh(geo, M.glass);
        },
        bag() {
          const g = new THREE.Group();
          g.add(new THREE.Mesh(new RoundedBoxGeometry(1.05, 1.15, 0.5, 4, 0.06), M.paper));
          for (const z of [0.14, -0.14]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 10, 32, Math.PI), M.brand); h.position.set(0, 0.57, z); g.add(h); }
          return g;
        },
      };

      // Lay the objects down a tall column; the camera slides down it as the page scrolls.
      const ORDER = ["coin", "ring", "card", "coinGold", "lock", "shield", "bag", "coin"];
      const SPACING = 2.6;
      const count = small ? 9 : 16;
      const rand = rng(20261112);
      const items = [];
      for (let i = 0; i < count; i++) {
        const kind = ORDER[i % ORDER.length];
        const obj = kind === "coinGold" ? makers.coin(true) : makers[kind]();
        const side = i % 2 === 0 ? -1 : 1;
        const z = -5 + rand() * 6.5;                         // some near, some far
        const reach = small ? 1.6 + rand() * 1.4 : 3.6 + rand() * 3.2;
        const home = new THREE.Vector3(side * reach * (1 + -z * 0.06), 2.2 - i * SPACING + (rand() - 0.5) * 1.2, z);
        obj.position.copy(home);
        obj.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * 0.6);
        const scale = 0.85 + rand() * 0.55;
        obj.scale.setScalar(scale);
        obj.userData = { home, spin: new THREE.Vector3((rand() - 0.5) * 0.25, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.15), phase: rand() * 6.28 };
        scene.add(obj);
        items.push(obj);
      }
      const depth = (count - 1) * SPACING;

      const applyTheme = (name) => {
        const p = THEME[name] || THEME.light;
        M.silver.color.setHex(p.silver); M.goldMetal.color.setHex(p.gold); M.brand.color.setHex(p.brand);
        M.body.color.setHex(p.body); M.paper.color.setHex(p.paper); M.glass.color.setHex(p.glass);
        key.intensity = p.key; renderer.toneMappingExposure = p.exposure;
        renderer.domElement.style.opacity = String(p.opacity);
      };
      applyTheme(themeRef.current);

      let w = 0, h = 0;
      const resize = () => {
        w = host.clientWidth; h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%";
        camera.aspect = w / h; camera.updateProjectionMatrix();
      };
      resize();

      let px = 0, py = 0, tx = 0, ty = 0;
      const onPointer = (e) => { tx = (e.clientX / window.innerWidth - 0.5); ty = (e.clientY / window.innerHeight - 0.5); };
      const progress = () => {
        const r = track.getBoundingClientRect();
        const span = Math.max(1, r.height - window.innerHeight);
        return Math.min(1, Math.max(0, -r.top / span));
      };

      let raf = 0, visible = true, last = performance.now(), t = 0;
      const draw = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (!reduced) t += dt;
        px += (tx - px) * 0.05; py += (ty - py) * 0.05;
        camera.position.set(px * 0.6, -progress() * depth * 0.92 - py * 0.4, 10);
        camera.lookAt(px * 0.2, camera.position.y, 0);
        for (const o of items) {
          const u = o.userData;
          o.position.y = u.home.y + Math.sin(t * 0.5 + u.phase) * 0.18;
          if (!reduced) { o.rotation.x += u.spin.x * dt; o.rotation.y += u.spin.y * dt; o.rotation.z += u.spin.z * dt; }
        }
        renderer.render(scene, camera);
      };
      const loop = (now) => { draw(now); raf = visible && !document.hidden && !reduced ? requestAnimationFrame(loop) : 0; };
      const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };

      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); });
      io.observe(host);
      const ro = new ResizeObserver(() => { resize(); kick(); });
      ro.observe(host);
      const onScroll = () => { if (reduced) kick(); };
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      document.addEventListener("visibilitychange", kick);
      kick();

      apiRef.current = { applyTheme: (n) => { applyTheme(n); kick(); } };
      cleanup = () => {
        cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("scroll", onScroll);
        document.removeEventListener("visibilitychange", kick);
        scene.traverse((o) => { o.geometry?.dispose?.(); });
        Object.values(M).forEach((m) => m.dispose());
        renderer.dispose(); renderer.domElement.remove();
        apiRef.current = null;
      };
    })();
    return () => { disposed = true; cleanup(); };
  }, []);

  useEffect(() => { themeRef.current = theme; apiRef.current?.applyTheme(theme); }, [theme]);

  return (
    <div aria-hidden="true" className="world pointer-events-none absolute inset-y-0 z-0">
      <div ref={hostRef} className="sticky top-0 h-[100svh] w-full" />
    </div>
  );
}
