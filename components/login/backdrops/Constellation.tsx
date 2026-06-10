"use client";

import { useEffect, useMemo, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import Tile from "../Tile";
import type { LoginTile } from "../faces-shared";

interface Props {
  pool: LoginTile[];
  /** Multiplies the node count. 1.0 ≈ 7..48 nodes scaled to viewport. */
  density?: number;
  /** Multiplies linear & angular speeds. */
  speed?: number;
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
  density = 1,
  speed = 1,
}: Props) {
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tiles = useMemo(() => pool, [pool]);

  useEffect(() => {
    const field = fieldRef.current;
    const canvas = canvasRef.current;
    if (!field || !canvas || tiles.length === 0) return;
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

    const base = Math.round((W * H) / 60000);
    const COUNT = Math.max(7, Math.min(48, Math.round(base * density)));

    const nodes: Node[] = [];
    for (let i = 0; i < COUNT; i++) {
      const depth = 0.5 + Math.random();
      let d = Math.round(54 * depth + Math.random() * 44);
      if (Math.random() < 0.2) d = Math.round(d * 1.7);
      d = Math.min(d, 200);
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
        angle: Math.random() * 360,
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
        e.style.fontSize = (19 + Math.random() * 15).toFixed(0) + "px";
        const a = Math.random() * Math.PI * 2;
        const dist = 55 + Math.random() * 145;
        e.style.setProperty("--tx", (Math.cos(a) * dist).toFixed(0) + "px");
        e.style.setProperty(
          "--ty",
          (Math.sin(a) * dist - (26 + Math.random() * 60)).toFixed(0) + "px",
        );
        e.style.setProperty(
          "--rot",
          ((Math.random() - 0.5) * 90).toFixed(0) + "deg",
        );
        e.style.animationDelay = (k * 20 + Math.random() * 26).toFixed(0) + "ms";
        field.appendChild(e);
        setTimeout(() => e.remove(), 1800 + k * 50);
      }
    };

    const frame = () => {
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
        n.el.style.transform = `translate(${n.x - n.d / 2}px, ${n.y - n.d / 2}px) rotate(${n.angle}deg)`;
      }

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
              const ov = (minDist - dist) / 2;
              a.x -= nx * ov;
              a.y -= ny * ov;
              b.x += nx * ov;
              b.y += ny * ov;
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

      raf = requestAnimationFrame(frame);
    };

    if (!reduce) raf = requestAnimationFrame(frame);
    const onResize = () => size();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      for (const n of nodes) {
        n.root.unmount();
        n.el.remove();
      }
    };
  }, [tiles, density, speed]);

  return (
    <>
      <div ref={fieldRef} className="absolute inset-0 z-0 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 z-0" />
      </div>
      {/* Radial veil so the center card stays legible */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background:
            "radial-gradient(46% 52% at 50% 50%, rgba(6,32,63,.84) 24%, rgba(6,32,63,.5) 52%, rgba(6,32,63,0) 78%)",
        }}
      />
      <style jsx global>{`
        .cn-emoji {
          position: absolute;
          z-index: 3;
          pointer-events: none;
          line-height: 1;
          transform: translate(-50%, -50%);
          will-change: transform, opacity;
          animation: cn-pop 1.5s cubic-bezier(.15,.75,.3,1) both;
          text-shadow: 0 4px 10px rgba(0,0,0,.35);
        }
        @keyframes cn-pop {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(.2) rotate(0deg); }
          18%  { opacity: 1; transform: translate(calc(-50% + var(--tx, 0px) * 0.42), calc(-50% + var(--ty, 0px) * 0.42)) scale(1.16) rotate(var(--rot, 0deg)); }
          100% { opacity: 0; transform: translate(calc(-50% + var(--tx, 0px)), calc(-50% + var(--ty, 0px) - 28px)) scale(.92) rotate(var(--rot, 0deg)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cn-emoji { display: none; }
        }
      `}</style>
    </>
  );
}
