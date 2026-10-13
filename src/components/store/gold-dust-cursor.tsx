"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 1 → 0
  decay: number;
  size: number;
  color: string;
  star: boolean;
  spin: number;
  angle: number;
};

// Rich enough to show on the white pages, bright enough to glow on the purple ones.
const COLORS = ["#ffd86b", "#f2c14e", "#e3a827", "#c98e17", "#fff1b8"];
const MAX_PARTICLES = 160;

/**
 * Sparkly gold dust that trails the mouse. Mouse only (no touch), skipped for
 * reduced-motion users, and the animation loop sleeps when no dust is left.
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

    const spawn = (x: number, y: number, count: number) => {
      for (let i = 0; i < count; i++) {
        if (particles.length >= MAX_PARTICLES) particles.shift();
        const star = Math.random() < 0.3;
        particles.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2 - 0.3,
          life: 1,
          decay: 0.012 + Math.random() * 0.02,
          size: star ? 3 + Math.random() * 3 : 0.8 + Math.random() * 1.8,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          star,
          spin: (Math.random() - 0.5) * 0.2,
          angle: Math.random() * Math.PI,
        });
      }
    };

    const drawStar = (p: Particle) => {
      // Four-point twinkle.
      const s = p.size * (0.6 + 0.4 * Math.sin(p.life * 20));
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

    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= p.decay;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += 0.035; // dust drifts down
        p.vx *= 0.98;
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = "#f5c84c";
        ctx.shadowBlur = p.star ? 8 : 4;
        if (p.star) drawStar(p);
        else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      frame = particles.length ? requestAnimationFrame(tick) : 0;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || reduced.matches) return;
      const dist = last.set ? Math.hypot(e.clientX - last.x, e.clientY - last.y) : 0;
      last = { x: e.clientX, y: e.clientY, set: true };
      spawn(e.clientX, e.clientY, Math.min(1 + Math.floor(dist / 8), 5));
      if (!frame) frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[100] h-full w-full" />;
}
