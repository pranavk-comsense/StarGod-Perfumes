"use client";

import { getImageProps } from "next/image";
import { Dialog } from "@base-ui/react/dialog";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpIcon, ChevronLeftIcon, MaximizeIcon, MinimizeIcon, MoveIcon, Rotate3dIcon, XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

type StopId = "outside" | "entrance" | "gift-wall" | "golden-arch" | "pouches";

type Hotspot = {
  to: StopId;
  /** Position on the photo, in % of its width / height (on the floor where possible). */
  x: number;
  y: number;
  label: string;
  /** Arrow direction in degrees, 0 = straight ahead. */
  turn?: number;
};

type Stop = {
  id: StopId;
  name: string;
  caption: string;
  src: string;
  width: number;
  height: number;
  /** Where the view starts, in % of the photo. */
  focus: [number, number];
  hotspots: Hotspot[];
};

/** Photos from the StarGod Premium Perfumes Google listing (copied 13 Oct 2026). */
const STOPS: Stop[] = [
  {
    id: "outside",
    name: "Tilak Road",
    caption: "Our storefront at Pinnacle Prestige, Sadashiv Peth",
    src: "/images/store/tour/outside.webp",
    width: 1849,
    height: 2000,
    focus: [55, 70],
    hotspots: [{ to: "entrance", x: 62, y: 86, label: "Step inside" }],
  },
  {
    id: "entrance",
    name: "Entrance",
    caption: "1500+ fragrances under the arches",
    src: "/images/store/tour/entrance.webp",
    width: 1080,
    height: 960,
    focus: [50, 50],
    hotspots: [
      { to: "gift-wall", x: 32, y: 74, label: "Gift corner", turn: -35 },
      { to: "golden-arch", x: 60, y: 76, label: "Signature shelves", turn: 35 },
    ],
  },
  {
    id: "gift-wall",
    name: "Gift corner",
    caption: "Gift boxes, hampers and satin pouches",
    src: "/images/store/tour/gift-wall.webp",
    width: 2000,
    height: 1500,
    focus: [40, 55],
    hotspots: [
      { to: "pouches", x: 17, y: 60, label: "Satin pouches", turn: -20 },
      { to: "golden-arch", x: 75, y: 86, label: "Signature shelves", turn: 30 },
    ],
  },
  {
    id: "golden-arch",
    name: "Signature shelves",
    caption: "Backlit arches of StarGod eau de parfum",
    src: "/images/store/tour/golden-arch.webp",
    width: 1500,
    height: 2000,
    focus: [55, 58],
    hotspots: [{ to: "entrance", x: 18, y: 80, label: "Back to entrance", turn: -150 }],
  },
  {
    id: "pouches",
    name: "Satin pouches",
    caption: "Every bottle can go home in a StarGod pouch",
    src: "/images/store/tour/pouches.webp",
    width: 2000,
    height: 586,
    focus: [50, 50],
    hotspots: [{ to: "gift-wall", x: 50, y: 88, label: "Back to gift corner", turn: 180 }],
  },
];

const byId = Object.fromEntries(STOPS.map((s) => [s.id, s])) as Record<StopId, Stop>;

/** Minimum room to look around: each photo is at least this much bigger than the viewer on one side. */
const OVERSCAN = 1.2;
const WALK_MS = 450;

type Box = { w: number; h: number };
type Pan = { x: number; y: number };

function layout(stop: Stop, box: Box) {
  let scale = Math.max(box.w / stop.width, box.h / stop.height);
  const slack = Math.max((stop.width * scale) / box.w, (stop.height * scale) / box.h);
  if (slack < OVERSCAN) scale *= OVERSCAN / slack;
  return { w: stop.width * scale, h: stop.height * scale };
}

function clampPan(p: Pan, size: Box, box: Box): Pan {
  return {
    x: Math.min(0, Math.max(box.w - size.w, p.x)),
    y: Math.min(0, Math.max(box.h - size.h, p.y)),
  };
}

/** Start at the stop's focus point, nudged so its arrows are on screen. */
function initialPan(stop: Stop, box: Box): Pan {
  const size = layout(stop, box);
  const pan = { x: box.w / 2 - (stop.focus[0] / 100) * size.w, y: box.h / 2 - (stop.focus[1] / 100) * size.h };
  const margin = Math.min(90, box.h / 4);
  // Each arrow allows a range of pan offsets; use the overlap of all of them,
  // or just the first arrow's range when they can't all fit.
  const fit = (value: number, pos: number[], viewport: number) => {
    const ranges = pos.map((p) => [viewport - margin - p, margin - p] as const);
    const lo = Math.max(...ranges.map((r) => r[0]));
    const hi = Math.min(...ranges.map((r) => r[1]));
    const [min, max] = lo <= hi ? [lo, hi] : ranges[0];
    return Math.min(max, Math.max(min, value));
  };
  if (stop.hotspots.length) {
    pan.x = fit(pan.x, stop.hotspots.map((h) => (h.x / 100) * size.w), box.w);
    pan.y = fit(pan.y, stop.hotspots.map((h) => (h.y / 100) * size.h), box.h);
  }
  return clampPan(pan, size, box);
}

/**
 * Click-through tour of the Pune store built from flat photos: drag to look
 * around, floor arrows "walk" to the next spot, the view tilts with the mouse.
 */
export function StoreTour() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const panRefs = useRef(new Map<StopId, HTMLDivElement>());
  const pans = useRef(new Map<StopId, Pan>());
  const drag = useRef<{ id: number; x: number; y: number; start: Pan } | null>(null);

  const [box, setBox] = useState<Box | null>(null);
  const [current, setCurrent] = useState<StopId>("outside");
  const [history, setHistory] = useState<StopId[]>([]);
  const [walking, setWalking] = useState(false);
  const [moved, setMoved] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = viewerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    const onFs = () => setFullscreen(document.fullscreenElement === el);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      ro.disconnect();
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  const applyPan = useCallback(
    (id: StopId, p: Pan) => {
      if (!box) return;
      const next = clampPan(p, layout(byId[id], box), box);
      pans.current.set(id, next);
      const el = panRefs.current.get(id);
      if (el) el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
    },
    [box],
  );

  // Re-fit every stop when the viewer size changes (keeps each stop's own view).
  useLayoutEffect(() => {
    if (!box) return;
    for (const s of STOPS) applyPan(s.id, pans.current.get(s.id) ?? initialPan(s, box));
  }, [box, applyPan]);

  const go = (to: StopId, from?: Hotspot, { back = false } = {}) => {
    if (walking || !box) return;
    const arrive = () => {
      applyPan(to, initialPan(byId[to], box));
      setHistory((h) => (back ? h.slice(0, -1) : [...h, current]));
      setCurrent(to);
      setWalking(false);
    };
    const zoom = zoomRef.current;
    if (reduced.current || !zoom) return arrive();
    // Zoom toward the arrow that was clicked, as if walking to it.
    const size = layout(byId[current], box);
    const pan = pans.current.get(current) ?? { x: 0, y: 0 };
    const ox = from ? pan.x + (from.x / 100) * size.w : box.w / 2;
    const oy = from ? pan.y + (from.y / 100) * size.h : box.h / 2;
    zoom.style.transformOrigin = `${ox}px ${oy}px`;
    setWalking(true);
    window.setTimeout(arrive, WALK_MS);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (walking) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: pans.current.get(current) ?? { x: 0, y: 0 } };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      applyPan(current, { x: d.start.x + (e.clientX - d.x), y: d.start.y + (e.clientY - d.y) });
      if (!moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) setMoved(true);
      return;
    }
    // Gentle tilt toward the mouse.
    const tilt = tiltRef.current;
    const el = viewerRef.current;
    if (!tilt || !el || reduced.current || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    tilt.style.transform = `rotateY(${px * 5}deg) rotateX(${-py * 4}deg)`;
  };

  const endDrag = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  const resetTilt = () => {
    if (tiltRef.current) tiltRef.current.style.transform = "";
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 60;
    const delta: Partial<Record<string, Pan>> = {
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const p = pans.current.get(current) ?? { x: 0, y: 0 };
    applyPan(current, { x: p.x + d.x, y: p.y + d.y });
    setMoved(true);
  };

  const toggleFullscreen = () => {
    const el = viewerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const stop = byId[current];
  const index = STOPS.findIndex((s) => s.id === current);

  return (
    <div>
      <div
        ref={viewerRef}
        role="region"
        aria-roledescription="virtual tour"
        aria-label={`Store tour: ${stop.name}. Drag or use the arrow keys to look around.`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={resetTilt}
        onKeyDown={onKeyDown}
        className={cn(
          "relative aspect-[4/5] cursor-grab touch-none select-none overflow-hidden bg-neutral-950 [perspective:1200px] active:cursor-grabbing sm:aspect-video",
          fullscreen ? "aspect-auto h-full" : "max-h-[80vh] rounded-md",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      >
        <div ref={tiltRef} className="absolute inset-0 scale-[1.05] transition-transform duration-300 ease-out">
          <div
            ref={zoomRef}
            className={cn("absolute inset-0", walking && "scale-[1.7] opacity-0 transition-[scale,opacity] ease-in")}
            style={{ transitionDuration: walking ? `${WALK_MS}ms` : undefined }}
          >
            {box &&
              STOPS.map((s) => {
                const size = layout(s, box);
                const active = s.id === current;
                const { props: img } = getImageProps({
                  src: s.src,
                  alt: active ? s.caption : "",
                  width: s.width,
                  height: s.height,
                  sizes: `${Math.round(size.w)}px`,
                });
                return (
                  <div key={s.id} aria-hidden={!active} className={cn("absolute inset-0", active ? "animate-tour-enter" : "invisible")}>
                    <div
                      ref={(el) => {
                        if (el) panRefs.current.set(s.id, el);
                      }}
                      className="absolute left-0 top-0 will-change-transform"
                      style={{ width: size.w, height: size.h }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- props come from getImageProps */}
                      <img {...img} loading="lazy" draggable={false} className="h-full w-full object-cover" />
                      {s.hotspots.map((h) => (
                        <button
                          key={h.to}
                          type="button"
                          tabIndex={active ? 0 : -1}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => go(h.to, h)}
                          className="group absolute -translate-x-1/2 -translate-y-1/2 outline-none"
                          style={{ left: `${h.x}%`, top: `${h.y}%` }}
                        >
                          <span className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white opacity-90 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-white">
                            {h.label}
                          </span>
                          {/* Arrow lying on the floor */}
                          <span className="relative block size-16 [transform:rotateX(55deg)] sm:size-20">
                            <span className="absolute inset-0 rounded-full border-2 border-white/80 motion-safe:animate-tour-pulse" />
                            <span className="absolute inset-0 grid place-items-center rounded-full bg-white/25 shadow-[0_0_30px_rgba(255,255,255,0.45)] backdrop-blur-sm transition-colors group-hover:bg-white/45">
                              <ArrowUpIcon className="size-8 text-white drop-shadow sm:size-10" strokeWidth={2.5} style={{ rotate: `${h.turn ?? 0}deg` }} />
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Overlay controls (not tilted) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/55 to-transparent p-4 sm:p-5">
          <div className="text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">
              {index + 1} / {STOPS.length}
            </p>
            <p className="font-heading text-2xl sm:text-3xl">{stop.name}</p>
            <p className="mt-0.5 text-sm text-white/75">{stop.caption}</p>
          </div>
          <div className="pointer-events-auto flex gap-2">
            {history.length > 0 && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => go(history[history.length - 1], undefined, { back: true })}
                className="flex h-9 items-center gap-1 rounded-full bg-black/50 pl-2 pr-3 text-sm text-white backdrop-blur hover:bg-black/70"
              >
                <ChevronLeftIcon className="size-4" /> Back
              </button>
            )}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
              className="grid size-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"
            >
              {fullscreen ? <MinimizeIcon className="size-4" /> : <MaximizeIcon className="size-4" />}
            </button>
          </div>
        </div>

        <p
          className={cn(
            "pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 sm:flex items-center gap-2 whitespace-nowrap rounded-full bg-black/55 px-4 py-2 text-xs text-white backdrop-blur transition-opacity duration-500",
            moved && "opacity-0",
          )}
        >
          <MoveIcon className="size-4" /> Drag to look around · tap the arrows to walk
        </p>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground sm:hidden">Drag to look around · tap the arrows to walk</p>
      <ol className="mt-4 flex flex-wrap justify-center gap-2">
        {STOPS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => s.id !== current && go(s.id)}
              aria-current={s.id === current ? "step" : undefined}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                s.id === current ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground",
              )}
            >
              <span className="mr-1.5 text-xs opacity-60">{i + 1}</span>
              {s.name}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** "Virtual tour" button that opens the store tour in a dialog. */
export function StoreTourButton({ className }: { className?: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={cn(buttonVariants({ variant: "outline" }), className)}>
        <Rotate3dIcon /> Virtual tour
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md bg-background p-4 shadow-2xl transition duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-gold">Virtual store tour</p>
              <Dialog.Title className="mt-1 font-heading text-2xl sm:text-3xl">Step inside our Pune store</Dialog.Title>
            </div>
            <Dialog.Close aria-label="Close tour" className={buttonVariants({ variant: "ghost", size: "icon" })}>
              <XIcon />
            </Dialog.Close>
          </div>
          <StoreTour />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
