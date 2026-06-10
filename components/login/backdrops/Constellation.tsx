"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import Tile from "../Tile";
import type { LoginTile } from "../faces-shared";

interface Props {
  pool: LoginTile[];
  /** Multiplies the node count. Default 1.15 lands at ~30 nodes on
   * a 1440x900 viewport — enough to feel populated without the
   * field reading as packed. */
  density?: number;
  /** Multiplies linear & angular speeds. */
  speed?: number;
  /** When false, the rAF physics loop is paused — used by the
   * parent to suspend off-screen Constellation instances without
   * unmounting them (keeps the decoded image bitmaps warm). */
  active?: boolean;
}

const HAPPY = [
  "😊", "🎉", "✨", "🥳", "🤝", "👋", "☕", "🍻", "🥂", "🍷", "💬", "🗨️", "😄", "🙌",
];

type Node = {
  el: HTMLDivElement;
  root: Root;
  d: number;
  r: number;
  depth: number;
  base: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  va: number;
  baseVa: number;
};

/**
 * "Constellation" backdrop — drifting field of round tiles that bounce
 * off the walls, collide elastically, draw faint network lines on a
 * canvas, and emit a small emoji burst at every collision point.
 *
 * The physics + DOM positioning run in a requestAnimationFrame loop
 * outside React's render cycle. Each tile is rendered via a tiny
 * React root so we still get the Tile component's image-fail
 * fallback behavior.
 */
export default function Constellation({
  pool,
  density = 1.15,
  speed = 1,
  active = true,
}: Props) {
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Nodes survive pool changes — we re-render each node's <Tile>
  // with the new pool data instead of tearing the whole field down.
  const nodesRef = useRef<Node[] | null>(null);
  // Latest pool, accessible from the init effect (which only runs
  // once) and from the swap effect.
  const poolRef = useRef(pool);
  poolRef.current = pool;
  // Active flag accessible from the rAF loop closure. When false,
  // the loop short-circuits and skips physics + paint — keeping
  // decoded bitmaps in memory but not spending CPU on invisible
  // drift.
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const field = fieldRef.current;
    const canvas = canvasRef.current;
    if (!field || !canvas || poolRef.current.length === 0) return;
    const tiles = poolRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let W = 0;
    let H = 0;
    const size = () => {
      const r = field.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    // Density tuned for ~70% empty space (~30 nodes on a 1440x900
    // viewport). The previous 1 / 38000 + cap 65 produced ~49 nodes
    // which Manolo flagged as visually packed.
    const base = Math.round((W * H) / 50000);
    const COUNT = Math.max(12, Math.min(45, Math.round(base * density)));

    // Scale tile sizes by viewport width so mobile (≤640px) gets
    // smaller bubbles with room to drift and collide; desktop keeps
    // the original 54-200px range.
    const sizeScale = Math.min(1, Math.max(0.55, W / 900));

    const nodes: Node[] = [];
    for (let i = 0; i < COUNT; i++) {
      const depth = 0.5 + Math.random();
      // +10% over the previous range per Manolo's last note.
      let d = Math.round((59.4 * depth + Math.random() * 48.4) * sizeScale);
      if (Math.random() < 0.2) d = Math.round(d * 1.7);
      d = Math.min(d, Math.round(220 * sizeScale));
      const tile = tiles[(i * 5) % tiles.length];
      const el = document.createElement("div");
      el.className = "absolute top-0 left-0 will-change-transform";
      el.style.width = d + "px";
      el.style.height = d + "px";
      el.style.opacity = (0.62 + depth * 0.25).toFixed(2);
      const root = createRoot(el);
      root.render(
        <Tile
          tile={tile}
          imgWidth={384}
          style={{
            width: "100%",
            height: "100%",
            boxShadow:
              "0 0 0 2px rgba(255,255,255,.85), 0 14px 30px -10px rgba(0,0,0,.55)",
          }}
          noTitle
        />,
      );
      field.appendChild(el);
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.7 + Math.random() * 0.7) * depth;
      const baseVa = (Math.random() - 0.5) * 0.5;
      nodes.push({
        el,
        root,
        d,
        r: d / 2,
        depth,
        base: spd,
        x: Math.random() * W,
        y: Math.random() * H,
        vx: Math.cos(ang) * spd * speed,
        vy: Math.sin(ang) * spd * speed,
        // Start near-upright (±25°) so the field reads as "people"
        // not "tumbling tiles." Random 0–360 made the bulk show up
        // sideways or upside down on arrival. Collision physics
        // still adds rotation freely after that — only the INITIAL
        // pose is constrained.
        angle: (Math.random() - 0.5) * 50,
        va: baseVa,
        baseVa,
      });
    }

    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    const touch = new Set<number>();
    let lastBurst = 0;

    const spawnEmoji = (x: number, y: number) => {
      if (reduce) return;
      const now = performance.now();
      if (now - lastBurst < 230) return;
      lastBurst = now;
      const n = 3 + ((Math.random() * 5) | 0);
      for (let k = 0; k < n; k++) {
        const e = document.createElement("span");
        e.className = "cn-emoji";
        e.textContent = HAPPY[(Math.random() * HAPPY.length) | 0];
        e.style.left = x + "px";
        e.style.top = y + "px";
        // Larger sizes + bigger travel distances + longer hang time
        // so the burst reads as deliberate celebration rather than a
        // flicker. Per user feedback after the first deploy.
        // Emoji size also scales with viewport — at mobile widths
        // the original 26-44px glyphs felt comically large relative
        // to the smaller bubbles.
        e.style.fontSize =
          ((26 + Math.random() * 18) * sizeScale).toFixed(0) + "px";
        // Spread particles evenly around the burst origin instead
        // of fully random angles — partition the circle into n
        // sectors, give each particle one sector with a small
        // jitter, so they fly out in different directions and don't
        // pile on top of each other.
        const baseAngle = ((k + Math.random() * 0.4) / n) * Math.PI * 2;
        const a = baseAngle;
        // +10% travel distance per Manolo's feedback so the burst
        // breathes more rather than stacking.
        const dist = (105 + Math.random() * 220) * sizeScale;
        e.style.setProperty("--tx", (Math.cos(a) * dist).toFixed(0) + "px");
        e.style.setProperty(
          "--ty",
          (
            Math.sin(a) * dist -
            (42 + Math.random() * 100) * sizeScale
          ).toFixed(0) + "px",
        );
        e.style.setProperty(
          "--rot",
          ((Math.random() - 0.5) * 90).toFixed(0) + "deg",
        );
        e.style.animationDelay = (k * 60 + Math.random() * 50).toFixed(0) + "ms";
        field.appendChild(e);
        setTimeout(() => e.remove(), 3600 + k * 80);
      }
    };

    const frame = () => {
      // Skip physics + paint when the backdrop isn't visible. Keeps
      // the rAF loop alive (instant resume) at near-zero CPU cost.
      if (!activeRef.current) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const MAX_SPD = 2.4 * speed;
      const MIN_SPD = 0.3 * speed;
      ctx.clearRect(0, 0, W, H);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        const r = n.r;
        if (n.x < r) {
          n.x = r;
          n.vx = Math.abs(n.vx);
        } else if (n.x > W - r) {
          n.x = W - r;
          n.vx = -Math.abs(n.vx);
        }
        if (n.y < r) {
          n.y = r;
          n.vy = Math.abs(n.vy);
        } else if (n.y > H - r) {
          n.y = H - r;
          n.vy = -Math.abs(n.vy);
        }
        const sp = Math.hypot(n.vx, n.vy);
        if (sp > MAX_SPD) {
          n.vx *= MAX_SPD / sp;
          n.vy *= MAX_SPD / sp;
        } else if (sp < MIN_SPD && sp > 0) {
          n.vx *= MIN_SPD / sp;
          n.vy *= MIN_SPD / sp;
        }
        n.angle += n.va;
        n.va += (n.baseVa - n.va) * 0.02;
        if (n.va > 3) n.va = 3;
        else if (n.va < -3) n.va = -3;
        // Position only — visual transform is applied AFTER the
        // iterative separation pass below.
      }

      // Pass 1 — physics + emoji bursts + line drawing. Velocity
      // change happens here so collisions feel elastic.
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          if (dist < 200) {
            const alpha = (1 - dist / 200) * 0.24;
            ctx.strokeStyle = `rgba(150,190,225,${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
          const minDist = a.r + b.r;
          const key = i * 1000 + j;
          if (dist < minDist) {
            if (!touch.has(key)) {
              touch.add(key);
              const nx = dx / dist;
              const ny = dy / dist;
              const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
              if (rel < 0) {
                a.vx += rel * nx;
                a.vy += rel * ny;
                b.vx -= rel * nx;
                b.vy -= rel * ny;
              }
              const tx = -ny;
              const ty = nx;
              const relT = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
              const spin = relT * 1.6;
              a.va -= spin;
              b.va += spin;
              spawnEmoji((a.x + b.x) / 2, (a.y + b.y) / 2 - minDist * 0.35);
            }
          } else if (touch.has(key)) {
            touch.delete(key);
          }
        }
      }
      // Pass 2-4 — iterative position separation so NO two bubbles
      // visibly overlap by the time we paint this frame. One-pass
      // separation in the physics loop sometimes left residual
      // overlap when three+ bubbles met simultaneously. Three more
      // passes resolves the chain.
      for (let pass = 0; pass < 3; pass++) {
        let movedAny = false;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy) || 0.001;
            const minDist = a.r + b.r + 0.5;
            if (dist < minDist) {
              const nx = dx / dist;
              const ny = dy / dist;
              const ov = (minDist - dist) / 2;
              a.x -= nx * ov;
              a.y -= ny * ov;
              b.x += nx * ov;
              b.y += ny * ov;
              movedAny = true;
            }
          }
        }
        // Re-clamp to walls after each separation pass.
        for (const n of nodes) {
          const r = n.r;
          if (n.x < r) n.x = r;
          else if (n.x > W - r) n.x = W - r;
          if (n.y < r) n.y = r;
          else if (n.y > H - r) n.y = H - r;
        }
        if (!movedAny) break;
      }
      // Apply the resolved positions to the DOM.
      for (const n of nodes) {
        n.el.style.transform = `translate(${n.x - n.d / 2}px, ${n.y - n.d / 2}px) rotate(${n.angle}deg)`;
      }

      raf = requestAnimationFrame(frame);
    };

    if (!reduce) raf = requestAnimationFrame(frame);
    const onResize = () => size();
    window.addEventListener("resize", onResize);

    nodesRef.current = nodes;

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      for (const n of nodes) {
        n.root.unmount();
        n.el.remove();
      }
      nodesRef.current = null;
    };
    // density / speed changes still require a full re-init; pool
    // changes are handled by the swap effect below.
  }, [density, speed]);

  // Pool swap: when fresh tiles arrive (the parent polled
  // /api/directory/login-pool and got a new batch), re-render each
  // node's <Tile> with a new tile from the pool. Node positions,
  // velocities, and rotations are preserved — only the image
  // changes. Browser keeps the old <img> visible until the new src
  // loads, so the transition reads as a smooth swap rather than a
  // pop.
  useEffect(() => {
    const nodes = nodesRef.current;
    if (!nodes || pool.length === 0) return;
    for (let i = 0; i < nodes.length; i++) {
      const tile = pool[(i * 5) % pool.length];
      nodes[i].root.render(
        <Tile
          tile={tile}
          imgWidth={384}
          style={{
            width: "100%",
            height: "100%",
            boxShadow:
              "0 0 0 2px rgba(255,255,255,.85), 0 14px 30px -10px rgba(0,0,0,.55)",
          }}
          noTitle
        />,
      );
    }
  }, [pool]);

  return (
    <>
      <div ref={fieldRef} className="absolute inset-0 z-0 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 z-0" />
      </div>
      {/* Radial veil removed — the small-pill design doesn't need
          a dim center, and the user wants the whole drift field
          visible. */}
      <style jsx global>{`
        .cn-emoji {
          position: absolute;
          z-index: 3;
          pointer-events: none;
          line-height: 1;
          transform: translate(-50%, -50%);
          will-change: transform, opacity;
          animation: cn-pop 2.8s cubic-bezier(.15,.75,.3,1) both;
          text-shadow: 0 4px 10px rgba(0,0,0,.35);
        }
        @keyframes cn-pop {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(.2) rotate(0deg); }
          14%  { opacity: 1; transform: translate(calc(-50% + var(--tx, 0px) * 0.28), calc(-50% + var(--ty, 0px) * 0.28)) scale(1.18) rotate(var(--rot, 0deg)); }
          70%  { opacity: 1; transform: translate(calc(-50% + var(--tx, 0px) * .85), calc(-50% + var(--ty, 0px) * .85 - 14px)) scale(1) rotate(var(--rot, 0deg)); }
          100% { opacity: 0; transform: translate(calc(-50% + var(--tx, 0px)), calc(-50% + var(--ty, 0px) - 38px)) scale(.88) rotate(var(--rot, 0deg)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cn-emoji { display: none; }
        }
      `}</style>
    </>
  );
}
