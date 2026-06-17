"use client";

import { useEffect, useRef } from "react";

// A full-screen orb-weaver web: straight radial spokes fan out from a hub past
// the corners, and concentric capture threads stretch between neighbouring
// spokes, sagging inward toward the hub the way real silk drapes.
//
// Interaction lives on the silk itself, not as glow: threads near the cursor
// take on the accent colour, and a click sends an impulse that races *along
// the threads* — propagated by graph distance from the clicked junction — so
// the light travels strand by strand through the web rather than as a circle.

const SPOKES = 18; // radial threads from the hub
const RING_FIRST = 48; // radius of the innermost ring
const RING_GAP = 82; // nominal distance between rings
const RING_BOW = 0.13; // how far each capture thread sags toward the hub
const ANGLE_JITTER = 0.38; // angular wobble per spoke (fraction of the step)
const RING_JITTER = 0.5; // ring-spacing wobble (fraction of the gap)
const NODE_RADIUS = 1.2;

const POINTER_RADIUS = 240;
const POINTER_RADIUS_SQ = POINTER_RADIUS * POINTER_RADIUS;
const POINTER_PUSH = 0.35; // how hard the silk sags away from the cursor

const STIFFNESS = 0.045; // spring pulling each anchor back to rest
const DAMP = 0.86; // velocity damping

// The impulse is measured in graph distance (pixels travelled along strands),
// not straight-line distance — that's what makes it follow the web.
const PULSE_SPEED = 1.5; // graph-distance px advanced per ms
const PULSE_BAND = 160; // width of the travelling light band (graph-distance px)
const PULSE_KICK = 0.4; // silk twang as the impulse passes a junction
const PULSE_LIMIT = 5;
const FLASH_DURATION_MS = 320;

type Palette = {
  node: [number, number, number];
  spoke: [number, number, number];
  thread: [number, number, number];
  accent: [number, number, number];
};

const LIGHT_PALETTE: Palette = {
  node: [71, 85, 105],
  spoke: [82, 96, 116],
  thread: [110, 124, 146],
  accent: [99, 102, 241],
};

const DARK_PALETTE: Palette = {
  node: [148, 163, 184],
  spoke: [156, 170, 190],
  thread: [138, 152, 174],
  accent: [129, 140, 248],
};

type Point = {
  rx: number; // rest position
  ry: number;
  x: number; // current position
  y: number;
  vx: number;
  vy: number;
  flashUntil: number;
  fixed: boolean;
};

type Edge = {
  a: number;
  b: number;
  ring: boolean; // capture thread (curved) vs. radial spoke (straight)
};

type Adj = { to: number; w: number }[][];

type Pulse = {
  srcX: number; // click point, used to orient the silk twang
  srcY: number;
  dist: Float64Array; // graph distance from the clicked junction per node
  maxDist: number;
  born: number;
};

function buildWeb(width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  // Reach past the farthest corner so the web bleeds off every edge.
  const maxRadius = Math.hypot(width, height) / 2 + RING_GAP;

  const step = (Math.PI * 2) / SPOKES;
  const angles = new Array<number>(SPOKES);
  for (let k = 0; k < SPOKES; k++) {
    angles[k] = k * step + (Math.random() - 0.5) * step * ANGLE_JITTER;
  }

  const radii: number[] = [];
  let r = RING_FIRST;
  while (r < maxRadius) {
    radii.push(r);
    r += RING_GAP * (0.7 + Math.random() * RING_JITTER);
  }
  radii.push(r); // one extra ring guarantees the corners are covered
  const numRings = radii.length;

  const points: Point[] = [];
  // Index 0 is the hub — kept fixed so the radials stay anchored.
  points.push({ rx: cx, ry: cy, x: cx, y: cy, vx: 0, vy: 0, flashUntil: 0, fixed: true });

  for (let k = 0; k < SPOKES; k++) {
    const ca = Math.cos(angles[k]);
    const sa = Math.sin(angles[k]);
    for (let j = 0; j < numRings; j++) {
      const rr = radii[j];
      const rx = cx + ca * rr;
      const ry = cy + sa * rr;
      points.push({ rx, ry, x: rx, y: ry, vx: 0, vy: 0, flashUntil: 0, fixed: false });
    }
  }

  const idx = (k: number, j: number) => 1 + k * numRings + j;
  const edges: Edge[] = [];
  for (let k = 0; k < SPOKES; k++) {
    // Spoke: hub → first ring, then ring to ring outward.
    edges.push({ a: 0, b: idx(k, 0), ring: false });
    for (let j = 0; j < numRings - 1; j++) {
      edges.push({ a: idx(k, j), b: idx(k, j + 1), ring: false });
    }
    // Capture threads: span to the next spoke at the same ring.
    for (let j = 0; j < numRings; j++) {
      edges.push({ a: idx(k, j), b: idx((k + 1) % SPOKES, j), ring: true });
    }
  }

  // Adjacency with rest-length weights — the graph the impulse travels along.
  const adj: Adj = points.map(() => []);
  for (const e of edges) {
    const a = points[e.a];
    const b = points[e.b];
    const w = Math.hypot(a.rx - b.rx, a.ry - b.ry);
    adj[e.a].push({ to: e.b, w });
    adj[e.b].push({ to: e.a, w });
  }

  return { points, edges, adj };
}

// Dijkstra from a single source — n is small (a few hundred junctions), so the
// plain O(n²) scan is cheap and runs only once per click.
function computeDistances(adj: Adj, source: number): Float64Array {
  const n = adj.length;
  const dist = new Float64Array(n).fill(Infinity);
  dist[source] = 0;
  const visited = new Uint8Array(n);
  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
    }
    if (u === -1) break;
    visited[u] = 1;
    const list = adj[u];
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      const nd = dist[u] + e.w;
      if (nd < dist[e.to]) dist[e.to] = nd;
    }
  }
  return dist;
}

export default function InteractiveBackgroundWeb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // The web is cursor-reactive, so it's pure overhead on touch devices (no
    // pointer to react to) and on small viewports. Running its
    // requestAnimationFrame loop there only taxes the main thread — poor INP
    // and battery drain on mobile. Skip it entirely.
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (reduceMotion || !finePointer || window.innerWidth < 1024) {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const pointer = { x: -9999, y: -9999, active: false };
    const smooth = { x: -9999, y: -9999 };
    const pulses: Pulse[] = [];

    let palette: Palette =
      document.documentElement.dataset.theme === "dark"
        ? DARK_PALETTE
        : LIGHT_PALETTE;

    let points: Point[] = [];
    let edges: Edge[] = [];
    let adj: Adj = [];

    const resize = () => {
      const { innerWidth: w, innerHeight: h } = window;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const web = buildWeb(w, h);
      points = web.points;
      edges = web.edges;
      adj = web.adj;
      // Stale distance maps point into the old graph; clear them.
      pulses.length = 0;
    };

    const updateTheme = () => {
      palette =
        document.documentElement.dataset.theme === "dark"
          ? DARK_PALETTE
          : LIGHT_PALETTE;
    };

    const onMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (!pointer.active) {
        smooth.x = pointer.x;
        smooth.y = pointer.y;
      }
      pointer.active = true;
    };

    const onPointerDown = (event: PointerEvent) => {
      onMove(event);
      if (!points.length) return;

      // Fire the impulse from the junction nearest the click.
      const px = event.clientX;
      const py = event.clientY;
      let nearest = 0;
      let bestSq = Infinity;
      for (let i = 0; i < points.length; i++) {
        const dx = points[i].x - px;
        const dy = points[i].y - py;
        const dSq = dx * dx + dy * dy;
        if (dSq < bestSq) {
          bestSq = dSq;
          nearest = i;
        }
      }

      const dist = computeDistances(adj, nearest);
      let maxDist = 0;
      for (let i = 0; i < dist.length; i++) {
        const d = dist[i];
        if (d !== Infinity && d > maxDist) maxDist = d;
      }

      pulses.push({ srcX: px, srcY: py, dist, maxDist, born: performance.now() });
      if (pulses.length > PULSE_LIMIT) pulses.shift();
    };

    const onLeave = () => {
      pointer.active = false;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("blur", onLeave);

    const themeObserver = new MutationObserver(updateTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    let rafId = 0;

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const now = performance.now();
      ctx.clearRect(0, 0, w, h);

      smooth.x += (pointer.x - smooth.x) * 0.18;
      smooth.y += (pointer.y - smooth.y) * 0.18;

      const active = pointer.active;
      const [nr, ng, nb] = palette.node;
      const [sr, sg, sb] = palette.spoke;
      const [tr, tg, tb] = palette.thread;
      const [ar, ag, ab] = palette.accent;

      // Retire impulses once their front has run off the end of the web.
      while (
        pulses.length &&
        (now - pulses[0].born) * PULSE_SPEED > pulses[0].maxDist + PULSE_BAND
      ) {
        pulses.shift();
      }

      // ── Step anchors: spring back to rest, sag away from the cursor, and get
      // a brief twang as an impulse front passes their junction. Hub stays put.
      for (let i = 0; i < points.length; i++) {
        const n = points[i];
        if (n.fixed) continue;

        // Spring toward rest position
        n.vx += (n.rx - n.x) * STIFFNESS;
        n.vy += (n.ry - n.y) * STIFFNESS;

        // Pointer "sag": the silk gives way around the cursor
        if (active) {
          const dx = n.x - smooth.x;
          const dy = n.y - smooth.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < POINTER_RADIUS_SQ && distSq > 1) {
            const dist = Math.sqrt(distSq);
            const t = 1 - dist / POINTER_RADIUS;
            n.vx += (dx / dist) * t * t * POINTER_PUSH;
            n.vy += (dy / dist) * t * t * POINTER_PUSH;
          }
        }

        // Impulse: when the travelling band reaches this node's graph distance,
        // shiver the strand (perpendicular to its line from the click) + flash.
        for (const p of pulses) {
          const front = (now - p.born) * PULSE_SPEED;
          const delta = front - p.dist[i];
          if (delta >= 0 && delta < PULSE_BAND) {
            const prox = 1 - delta / PULSE_BAND;
            const energy = Math.max(0, 1 - front / (p.maxDist + PULSE_BAND));
            const dx = n.x - p.srcX;
            const dy = n.y - p.srcY;
            const len = Math.hypot(dx, dy) || 1;
            const sign = i & 1 ? 1 : -1;
            const kick = prox * energy * PULSE_KICK * sign;
            n.vx += (-dy / len) * kick;
            n.vy += (dx / len) * kick;
            if (prox > 0.6) n.flashUntil = now + FLASH_DURATION_MS;
          }
        }

        n.vx *= DAMP;
        n.vy *= DAMP;
        n.x += n.vx;
        n.y += n.vy;
      }

      const cx = points[0].x;
      const cy = points[0].y;

      // ── Threads. Base colour is the silk; the cursor tints nearby strands
      // toward the accent, and impulses light strands as their front arrives.
      for (let e = 0; e < edges.length; e++) {
        const edge = edges[e];
        const a = points[edge.a];
        const b = points[edge.b];
        const mx = (a.x + b.x) * 0.5;
        const my = (a.y + b.y) * 0.5;

        const ring = edge.ring;
        let alpha = ring ? 0.1 : 0.15;
        let r = ring ? tr : sr;
        let g = ring ? tg : sg;
        let bl = ring ? tb : sb;

        // Cursor proximity → accent tint
        if (active) {
          const pdx = mx - smooth.x;
          const pdy = my - smooth.y;
          const pdistSq = pdx * pdx + pdy * pdy;
          if (pdistSq < POINTER_RADIUS_SQ) {
            const pt = 1 - Math.sqrt(pdistSq) / POINTER_RADIUS;
            alpha = Math.min(0.72, alpha + pt * 0.5);
            r = r + (ar - r) * pt;
            g = g + (ag - g) * pt;
            bl = bl + (ab - bl) * pt;
          }
        }

        // Impulse travelling along the strands → accent flare on the front
        for (const p of pulses) {
          const front = (now - p.born) * PULSE_SPEED;
          const edgeDist = Math.min(p.dist[edge.a], p.dist[edge.b]);
          const delta = front - edgeDist;
          if (delta >= 0 && delta < PULSE_BAND) {
            const prox = 1 - delta / PULSE_BAND;
            const energy = Math.max(0, 1 - front / (p.maxDist + PULSE_BAND));
            const boost = prox * energy;
            alpha = Math.min(0.85, alpha + boost * 0.7);
            r = r + (ar - r) * boost;
            g = g + (ag - g) * boost;
            bl = bl + (ab - bl) * boost;
          }
        }

        ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, ${alpha})`;
        if (ring) {
          // Capture thread sags toward the hub between two spokes.
          const ctrlX = mx + (cx - mx) * RING_BOW;
          const ctrlY = my + (cy - my) * RING_BOW;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(ctrlX, ctrlY, b.x, b.y);
          ctx.stroke();
        } else {
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // ── Anchor dots at the thread junctions (skip the hub itself).
      for (let i = 1; i < points.length; i++) {
        const n = points[i];
        let radius = NODE_RADIUS;
        let nodeAlpha = 0.24;
        let useAccent = false;

        if (now < n.flashUntil) {
          const flashT = (n.flashUntil - now) / FLASH_DURATION_MS;
          radius = NODE_RADIUS + flashT * 2.2;
          nodeAlpha = 0.24 + flashT * 0.6;
          useAccent = true;
        }

        if (active) {
          const dx = n.x - smooth.x;
          const dy = n.y - smooth.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < POINTER_RADIUS_SQ) {
            const t = 1 - Math.sqrt(distSq) / POINTER_RADIUS;
            const hoverAlpha = 0.24 + t * 0.64;
            if (hoverAlpha > nodeAlpha) nodeAlpha = hoverAlpha;
            if (t > 0.25) useAccent = true;
          }
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = useAccent
          ? `rgba(${ar}, ${ag}, ${ab}, ${nodeAlpha})`
          : `rgba(${nr}, ${ng}, ${nb}, ${nodeAlpha})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    };

    // Defer the first frame until the browser is idle so the decorative
    // animation doesn't compete with hydration and the LCP paint during the
    // critical loading window.
    let idleId = 0;
    const start = () => {
      if (!document.hidden && !rafId) {
        rafId = requestAnimationFrame(draw);
      }
    };
    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
      idleId = ric(start, { timeout: 2000 });
    } else {
      idleId = window.setTimeout(start, 1200);
    }

    // Pause the loop while the tab is hidden — no point burning frames the
    // user can't see.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!rafId) {
        rafId = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(rafId);
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-screen w-screen"
    />
  );
}
