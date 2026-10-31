"use client";

import { useEffect, useRef } from "react";

type Kind = "mist" | "spark" | "star";

type Particle = {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 1 → 0
  decay: number;
  size: number;
  grow: number; // mist spreads out as it fades
  color: string;
  spin: number;
  angle: number;
  phase: number; // twinkle / sway offset
};

// Rich enough to show on the white pages, bright enough to glow on the purple ones.
const COLORS = ["#ffd86b", "#f2c14e", "#e3a827", "#c98e17", "#fff1b8"];
const MIST_RGB = ["245, 200, 76", "255, 225, 150", "232, 190, 120"];
const MAX_PARTICLES = 240;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(list: T[]) => list[(Math.random() * list.length) | 0];

/**
 * A perfume-spray trail for the mouse: a soft golden mist that rises and diffuses,
 * with twinkling droplets and star glints. Clicking gives a little "spritz".
 * Mouse only (no touch), skipped for reduced-motion users, and the animation
 * loop sleeps when nothing is left on screen.
 */
export function GoldDustCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles: Particle[] = [];
    let frame = 0;
    let last = { x: 0, y: 0, set: false };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const add = (p: Omit<Particle, "life" | "angle" | "phase">) => {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      particles.push({ ...p, life: 1, angle: Math.random() * Math.PI, phase: Math.random() * Math.PI * 2 });
    };

    const mist = (x: number, y: number, vx: number, vy: number) =>
      add({
        kind: "mist",
        x: x + rand(-4, 4),
        y: y + rand(-4, 4),
        vx,
        vy,
        decay: rand(0.008, 0.014),
        size: rand(6, 12),
        grow: rand(0.25, 0.5),
        color: pick(MIST_RGB),
        spin: 0,
      });

    const droplet = (x: number, y: number, vx: number, vy: number) => {
      const star = Math.random() < 0.22;
      add({
        kind: star ? "star" : "spark",
        x: x + rand(-5, 5),
        y: y + rand(-5, 5),
        vx,
        vy,
        decay: rand(0.01, 0.022),
        size: star ? rand(3, 6) : rand(0.7, 1.9),
        grow: 0,
        color: pick(COLORS),
        spin: rand(-0.1, 0.1),
      });
    };

    // Trail: droplets float up like scent leaving the bottle, with a little mist.
    const trail = (x: number, y: number, count: number) => {
      for (let i = 0; i < count; i++) droplet(x, y, rand(-0.6, 0.6), rand(-1.1, -0.2));
      if (Math.random() < 0.55) mist(x, y, rand(-0.3, 0.3), rand(-0.6, -0.2));
    };

    // Spritz: a fan of droplets and mist bursting out from the nozzle (the cursor).
    const spritz = (x: number, y: number) => {
      const dir = -Math.PI / 2 + rand(-0.4, 0.4);
      for (let i = 0; i < 26; i++) {
        const a = dir + rand(-0.75, 0.75);
        const speed = rand(1.5, 4.5);
        droplet(x, y, Math.cos(a) * speed, Math.sin(a) * speed);
      }
      for (let i = 0; i < 8; i++) {
        const a = dir + rand(-0.6, 0.6);
        const speed = rand(0.6, 1.8);
        mist(x, y, Math.cos(a) * speed, Math.sin(a) * speed);
      }
    };

    const drawStar = (p: Particle, twinkle: number) => {
      // Four-point glint.
      const s = p.size * (0.5 + 0.5 * twinkle);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(s * 0.15, s * 0.15, 0, s);
        ctx.quadraticCurveTo(-s * 0.15, s * 0.15, 0, 0);
      }
      ctx.fill();
      ctx.restore();
    };

    const tick = (now: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const t = now / 1000;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= p.decay;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        // Scent drifts: slows down, rises gently and sways side to side.
        p.vx = p.vx * 0.96 + Math.sin(t * 2 + p.phase) * 0.03;
        p.vy = p.vy * 0.96 - 0.012;
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;

        if (p.kind === "mist") {
          p.size += p.grow;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          const a = 0.22 * p.life;
          g.addColorStop(0, `rgba(${p.color}, ${a})`);
          g.addColorStop(1, `rgba(${p.color}, 0)`);
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        const twinkle = 0.5 + 0.5 * Math.sin(t * 14 + p.phase * 3);
        ctx.globalAlpha = p.life * (0.45 + 0.55 * twinkle);
        ctx.fillStyle = p.color;
        ctx.shadowColor = "#f5c84c";
        ctx.shadowBlur = p.kind === "star" ? 10 : 5;
        if (p.kind === "star") drawStar(p, twinkle);
        else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      frame = particles.length ? requestAnimationFrame(tick) : 0;
    };

    const start = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || reduced.matches) return;
      const dist = last.set ? Math.hypot(e.clientX - last.x, e.clientY - last.y) : 0;
      last = { x: e.clientX, y: e.clientY, set: true };
      trail(e.clientX, e.clientY, Math.min(1 + Math.floor(dist / 7), 6));
      start();
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || reduced.matches) return;
      spritz(e.clientX, e.clientY);
      start();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[100] h-full w-full" />;
}
