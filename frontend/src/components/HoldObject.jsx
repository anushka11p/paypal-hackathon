import { useEffect, useRef, useState } from "react";

/*
 * The hold, as an object: a stack of coins (the authorized amount) cinched by
 * an indigo bank strap — the leash. Released coins slide up out of the strap
 * and fade; the coins that stay inside it are the capture.
 *
 * mode="loop"   hero: the release plays on a slow loop.
 * mode="settle" receipt: plays once, then holds the settled state.
 * Three.js is loaded lazily; reduced motion renders one still frame.
 */

const PALETTE = {
  light: { coin: 0xb4b8c0, released: 0x2f8ef0, strap: 0x0070e0, shadow: "rgba(0,28,100,0.22)", key: 2.1, exposure: 1.0 },
  dark: { coin: 0xaab2c2, released: 0x6cc3ff, strap: 0x3d9bf5, shadow: "rgba(0,0,0,0.5)", key: 1.6, exposure: 1.1 },
};

const COINS = 8;
const T = 0.17; // coin thickness; coins touch, like a real stack

function rimProfile(THREE) {
  // Lathe profile: flat faces (covered by embossed discs) with a rounded rim.
  const r = 1, h = T / 2, b = 0.035, pts = [new THREE.Vector2(0, -h), new THREE.Vector2(r - b, -h)];
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI;
    pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, Math.sin(a) * h));
  }
  pts.push(new THREE.Vector2(r - b, h), new THREE.Vector2(0, h));
  return pts;
}

function reedTexture(THREE) {
  // Bump map for the reeded edge: fine vertical ridges on the rim band only.
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#808080"; g.fillRect(0, 0, 1024, 64);
  for (let x = 0; x < 1024; x += 1024 / 160) {
    g.fillStyle = "#d8d8d8"; g.fillRect(x, 8, 3, 48);
    g.fillStyle = "#3a3a3a"; g.fillRect(x + 3, 8, 2.4, 48);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function faceTexture(THREE) {
  // Bump map for the face: a raised border, a groove, and the Leash mark struck in the middle.
  const s = 512, c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d"), m = s / 2;
  g.fillStyle = "#7a7a7a"; g.fillRect(0, 0, s, s);
  const ring = (r, w, color) => { g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.lineWidth = w; g.strokeStyle = color; g.stroke(); };
  ring(s * 0.47, s * 0.05, "#d0d0d0");
  ring(s * 0.4, s * 0.012, "#404040");
  ring(s * 0.17, s * 0.045, "#e6e6e6");
  g.beginPath(); g.arc(m, m, s * 0.055, 0, Math.PI * 2); g.fillStyle = "#e6e6e6"; g.fill();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    g.save(); g.translate(m + Math.cos(a) * s * 0.33, m + Math.sin(a) * s * 0.33); g.rotate(a);
    g.fillStyle = "#a8a8a8"; g.fillRect(-s * 0.004, -s * 0.018, s * 0.008, s * 0.036); g.restore();
  }
  return new THREE.CanvasTexture(c);
}

export default function HoldObject({ theme = "light", mode = "loop", releasedCoins = 2, className = "", label }) {
  const hostRef = useRef(null);
  const apiRef = useRef(null);
  const themeRef = useRef(theme);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      let THREE, RoomEnvironment;
      try {
        THREE = await import("three");
        ({ RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js"));
      } catch { setFailed(true); return; }
      const host = hostRef.current;
      if (disposed || !host) return;

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch { setFailed(true); return; }
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);
      renderer.domElement.style.display = "block";

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
      camera.position.set(0, 4.1, 7.6);
      camera.lookAt(0, 0.95, 0);

      const key = new THREE.DirectionalLight(0xffffff, 2);
      key.position.set(-3, 6, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xffffff, 0.8);
      rim.position.set(4, 2, -3);
      scene.add(rim);

      const rig = new THREE.Group();
      scene.add(rig);

      const reeds = reedTexture(THREE);
      const face = faceTexture(THREE);
      const rimGeo = new THREE.LatheGeometry(rimProfile(THREE), 128);
      const faceGeo = new THREE.CircleGeometry(0.965, 96);
      const released = Math.max(0, Math.min(COINS - 1, releasedCoins));

      const coins = [];
      for (let i = 0; i < COINS; i++) {
        const isReleased = i >= COINS - released;
        const mat = new THREE.MeshPhysicalMaterial({
          metalness: 1, roughness: 0.34, clearcoat: 0.4, clearcoatRoughness: 0.3,
          bumpMap: reeds, bumpScale: 1.4, transparent: isReleased,
        });
        const faceMat = new THREE.MeshPhysicalMaterial({
          metalness: 1, roughness: 0.3, bumpMap: face, bumpScale: 2.2, transparent: isReleased,
        });
        const coin = new THREE.Group();
        coin.add(new THREE.Mesh(rimGeo, mat));
        const top = new THREE.Mesh(faceGeo, faceMat);
        top.rotation.x = -Math.PI / 2; top.position.y = T / 2 + 0.0008;
        const bottom = new THREE.Mesh(faceGeo, faceMat);
        bottom.rotation.x = Math.PI / 2; bottom.position.y = -T / 2 - 0.0008;
        coin.add(top, bottom);
        // A real stack is never perfectly aligned.
        const jx = Math.sin(i * 12.9898) * 0.035, jz = Math.cos(i * 78.233) * 0.035;
        coin.position.set(jx, i * T, jz);
        coin.rotation.y = i * 0.9;
        coin.userData = { home: coin.position.clone(), released: isReleased, k: i - (COINS - released) + 1, mats: [mat, faceMat] };
        rig.add(coin);
        coins.push(coin);
      }

      // The leash: an indigo bank strap cinched around the coins that stay.
      const kept = COINS - released;
      const strapH = Math.min(0.42, kept * T * 0.55);
      const strapMat = new THREE.MeshPhysicalMaterial({ roughness: 0.55, sheen: 0.6, sheenRoughness: 0.5, side: THREE.DoubleSide });
      const strap = new THREE.Mesh(new THREE.CylinderGeometry(1.055, 1.055, strapH, 128, 1, true), strapMat);
      strap.position.y = (kept - 1) * T / 2;
      const edgeMat = new THREE.MeshPhysicalMaterial({ roughness: 0.4 });
      const edgeTop = new THREE.Mesh(new THREE.TorusGeometry(1.056, 0.007, 8, 128), edgeMat);
      edgeTop.rotation.x = Math.PI / 2; edgeTop.position.y = strap.position.y + strapH / 2;
      const edgeBottom = edgeTop.clone(); edgeBottom.position.y = strap.position.y - strapH / 2;
      rig.add(strap, edgeTop, edgeBottom);

      // Soft contact shadow.
      const sc = document.createElement("canvas");
      sc.width = sc.height = 128;
      const sctx = sc.getContext("2d");
      const shadowTex = new THREE.CanvasTexture(sc);
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = -T / 2 - 0.01;
      scene.add(shadow);

      let palette;
      const applyTheme = (name) => {
        const p = PALETTE[name] || PALETTE.light;
        coins.forEach((c) => c.userData.mats.forEach((m) => m.color.setHex(p.coin)));
        strapMat.color.setHex(p.strap);
        edgeMat.color.setHex(p.strap).multiplyScalar(0.7);
        key.intensity = p.key;
        renderer.toneMappingExposure = p.exposure;
        sctx.clearRect(0, 0, 128, 128);
        const grad = sctx.createRadialGradient(64, 64, 6, 64, 64, 62);
        grad.addColorStop(0, p.shadow); grad.addColorStop(1, "rgba(0,0,0,0)");
        sctx.fillStyle = grad; sctx.fillRect(0, 0, 128, 128);
        shadowTex.needsUpdate = true;
        palette = { coin: new THREE.Color(p.coin), released: new THREE.Color(p.released) };
      };
      applyTheme(themeRef.current);

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

      const ease = (t) => 1 - Math.pow(1 - t, 4);
      const start = performance.now();
      const liftAt = (t) => {
        if (mode === "settle") return ease(Math.min(1, Math.max(0, (t - start - 300) / 1600)));
        // 6s loop: a short rest, a long held release, then settle back in.
        const c = ((t - start) / 6000) % 1;
        return c < 0.15 ? 0 : c < 0.45 ? ease((c - 0.15) / 0.3) : c < 0.85 ? 1 : 1 - ease((c - 0.85) / 0.15);
      };
      const render = (t) => {
        const lift = reduced ? 1 : liftAt(t);
        coins.forEach((c) => {
          const { home, released: isReleased, k } = c.userData;
          if (!isReleased) return;
          c.position.y = home.y + lift * (0.32 + k * 0.2);
          c.position.x = home.x + lift * k * 0.12;
          c.rotation.z = lift * 0.16 * k;
          c.userData.mats.forEach((m) => {
            m.opacity = 1 - lift * 0.55;
            m.color.lerpColors(palette.coin, palette.released, lift * 0.85);
          });
        });
        px += (tx - px) * 0.06; py += (ty - py) * 0.06;
        rig.rotation.y = (reduced ? 0.6 : t * 0.00012) + px * 0.3;
        rig.rotation.x = py * 0.08;
        renderer.render(scene, camera);
      };
      apiRef.current = { setTheme: (name) => { applyTheme(name); render(performance.now()); } };

      let raf = 0, visible = true;
      const loop = (t) => { raf = 0; if (!visible) return; render(t); raf = requestAnimationFrame(loop); };
      const io = new IntersectionObserver(([e]) => {
        visible = e ? e.isIntersecting : true;
        if (visible && !reduced && !raf) raf = requestAnimationFrame(loop);
      });
      io.observe(host);
      const ro = new ResizeObserver(() => { resize(); render(performance.now()); });
      ro.observe(host);
      if (reduced) render(performance.now()); else raf = requestAnimationFrame(loop);

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect(); ro.disconnect();
        host.removeEventListener("pointermove", onMove);
        host.removeEventListener("pointerleave", onLeave);
        scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose(); }); });
        reeds.dispose(); face.dispose(); pmrem.dispose(); renderer.dispose();
        renderer.domElement.remove();
        apiRef.current = null;
      };
    })();
    return () => { disposed = true; cleanup(); };
  }, [mode, releasedCoins]);

  useEffect(() => { themeRef.current = theme; apiRef.current?.setTheme(theme); }, [theme]);

  return (
    <div ref={hostRef} className={`relative ${className}`} role="img"
      aria-label={label || "A stack of coins held by an indigo strap; the top coins slide out, released back to you."}>
      {failed && (
        <svg viewBox="0 0 200 200" className="absolute inset-0 m-auto size-2/3" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <ellipse key={i} cx="100" cy={150 - i * 11} rx="56" ry="16" fill="var(--surface-2)" stroke="var(--line-strong)" />)}
          <rect x="44" y="118" width="112" height="16" fill="var(--accent)" opacity="0.85" />
        </svg>
      )}
    </div>
  );
}
