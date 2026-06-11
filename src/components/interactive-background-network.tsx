"use client";

import { useEffect, useRef } from "react";

const DENSITY = 14000;
const MIN_NODES = 36;
const MAX_NODES = 110;
const CONNECT_DISTANCE = 150;
const CONNECT_DISTANCE_SQ = CONNECT_DISTANCE * CONNECT_DISTANCE;
const POINTER_RADIUS = 220;
const POINTER_RADIUS_SQ = POINTER_RADIUS * POINTER_RADIUS;
const POINTER_PULL = 0.012;
const NODE_RADIUS = 1.6;

const BASE_SPEED = 0.15;
const MAX_SPEED = 2.6;
const DRAG = 0.988;

const PULSE_DURATION_MS = 900;
const PULSE_MAX_RADIUS = 340;
const PULSE_RING_WIDTH = 70;
const PULSE_FORCE = 1.9;
const PULSE_LIMIT = 8;
const FLASH_DURATION_MS = 280;

type Palette = {
  node: [number, number, number];
  line: [number, number, number];
  accent: [number, number, number];
};

const LIGHT_PALETTE: Palette = {
  node: [71, 85, 105],
  line: [100, 116, 139],
  accent: [99, 102, 241],
};

const DARK_PALETTE: Palette = {
  node: [148, 163, 184],
  line: [148, 163, 184],
  accent: [129, 140, 248],
};

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  flashUntil: number;
};

type Pulse = {
  x: number;
  y: number;
  born: number;
};

function makeNodes(count: number, width: number, height: number): Node[] {
  const nodes: Node[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.05 + Math.random() * 0.2;
    nodes[i] = {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      flashUntil: 0,
    };
  }
  return nodes;
}

function easeOutCubic(t: number) {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

export default function InteractiveBackgroundNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // The network is cursor-reactive, so it's pure overhead on touch devices
    // (no pointer to react to) and on small viewports. Running its
    // requestAnimationFrame loop there only taxes the main thread — which
    // shows up as poor INP and battery drain on mobile. Skip it entirely.
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

    let nodes: Node[] = [];

    const computeNodeCount = (w: number, h: number) =>
      Math.min(MAX_NODES, Math.max(MIN_NODES, Math.round((w * h) / DENSITY)));

    const resize = () => {
      const { innerWidth: w, innerHeight: h } = window;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = computeNodeCount(w, h);
      if (nodes.length === 0) {
        nodes = makeNodes(target, w, h);
      } else if (nodes.length < target) {
        nodes = nodes.concat(makeNodes(target - nodes.length, w, h));
      } else if (nodes.length > target) {
        nodes = nodes.slice(0, target);
      }
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
      if (reduceMotion) return;
      pulses.push({
        x: event.clientX,
        y: event.clientY,
        born: performance.now(),
      });
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

      const active = pointer.active && !reduceMotion;
      const [nr, ng, nb] = palette.node;
      const [lr, lg, lb] = palette.line;
      const [ar, ag, ab] = palette.accent;

      // Drop expired pulses
      while (pulses.length && now - pulses[0].born > PULSE_DURATION_MS) {
        pulses.shift();
      }

      // ── Pulse rings (drawn under nodes so the front "lights up" passing dots)
      if (!reduceMotion) {
        for (const p of pulses) {
          const age = now - p.born;
          const t = age / PULSE_DURATION_MS;
          const eased = easeOutCubic(t);
          const radius = PULSE_MAX_RADIUS * eased;
          const fade = (1 - t) * (1 - t);

          ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${fade * 0.55})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.stroke();

          if (t > 0.18) {
            const innerT = Math.min(1, t - 0.18);
            const innerRadius = PULSE_MAX_RADIUS * easeOutCubic(innerT);
            ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${(1 - t) * 0.28})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, innerRadius, 0, Math.PI * 2);
            ctx.stroke();
          }

          if (t < 0.32) {
            const coreAlpha = (0.32 - t) * 0.7;
            const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 50);
            grd.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, ${coreAlpha})`);
            grd.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0)`);
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 50, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // ── Step + render nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];

        if (!reduceMotion) {
          // Pointer attraction
          if (active) {
            const dx = smooth.x - n.x;
            const dy = smooth.y - n.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < POINTER_RADIUS_SQ && distSq > 1) {
              const dist = Math.sqrt(distSq);
              const t = 1 - dist / POINTER_RADIUS;
              n.vx += (dx / dist) * t * POINTER_PULL;
              n.vy += (dy / dist) * t * POINTER_PULL;
            }
          }

          // Pulse shockwave: nodes near the expanding ring front get pushed out
          for (const p of pulses) {
            const age = now - p.born;
            if (age > PULSE_DURATION_MS) continue;
            const t = age / PULSE_DURATION_MS;
            const eased = easeOutCubic(t);
            const radius = PULSE_MAX_RADIUS * eased;
            const dx = n.x - p.x;
            const dy = n.y - p.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 0.5) continue;
            const delta = dist - radius;
            if (Math.abs(delta) < PULSE_RING_WIDTH) {
              const proximity = 1 - Math.abs(delta) / PULSE_RING_WIDTH;
              const strength = proximity * (1 - t) * PULSE_FORCE;
              n.vx += (dx / dist) * strength;
              n.vy += (dy / dist) * strength;
              if (proximity > 0.65) {
                n.flashUntil = now + FLASH_DURATION_MS;
              }
            }
          }

          // Drag toward rest
          n.vx *= DRAG;
          n.vy *= DRAG;

          const speed = Math.hypot(n.vx, n.vy);
          if (speed > MAX_SPEED) {
            n.vx = (n.vx / speed) * MAX_SPEED;
            n.vy = (n.vy / speed) * MAX_SPEED;
          } else if (speed < BASE_SPEED * 0.25) {
            const a = Math.random() * Math.PI * 2;
            n.vx += Math.cos(a) * 0.03;
            n.vy += Math.sin(a) * 0.03;
          }

          n.x += n.vx;
          n.y += n.vy;

          // Wrap
          if (n.x < -10) n.x = w + 10;
          else if (n.x > w + 10) n.x = -10;
          if (n.y < -10) n.y = h + 10;
          else if (n.y > h + 10) n.y = -10;
        }

        // Visual state
        let radius = NODE_RADIUS;
        let nodeAlpha = 0.32;
        let useAccent = false;

        if (now < n.flashUntil) {
          const flashT = (n.flashUntil - now) / FLASH_DURATION_MS;
          radius = NODE_RADIUS + flashT * 2.6;
          nodeAlpha = 0.32 + flashT * 0.6;
          useAccent = true;
        }

        if (active) {
          const dx = n.x - smooth.x;
          const dy = n.y - smooth.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < POINTER_RADIUS_SQ) {
            const t = 1 - Math.sqrt(distSq) / POINTER_RADIUS;
            const hoverAlpha = 0.32 + t * 0.6;
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

      // ── Connections between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < CONNECT_DISTANCE_SQ) {
            const t = 1 - Math.sqrt(distSq) / CONNECT_DISTANCE;
            let alpha = t * 0.18;
            let r = lr;
            let g = lg;
            let bl = lb;

            if (active) {
              const mx = (a.x + b.x) * 0.5;
              const my = (a.y + b.y) * 0.5;
              const pdx = mx - smooth.x;
              const pdy = my - smooth.y;
              const pdistSq = pdx * pdx + pdy * pdy;
              if (pdistSq < POINTER_RADIUS_SQ) {
                const pt = 1 - Math.sqrt(pdistSq) / POINTER_RADIUS;
                alpha = Math.min(0.55, alpha + pt * 0.45);
                r = lr + (ar - lr) * pt;
                g = lg + (ag - lg) * pt;
                bl = lb + (ab - lb) * pt;
              }
            }

            // Pulse ring also brightens nearby connections
            if (!reduceMotion && pulses.length) {
              const mx = (a.x + b.x) * 0.5;
              const my = (a.y + b.y) * 0.5;
              for (const p of pulses) {
                const age = now - p.born;
                if (age > PULSE_DURATION_MS) continue;
                const tt = age / PULSE_DURATION_MS;
                const ringR = PULSE_MAX_RADIUS * easeOutCubic(tt);
                const pdx = mx - p.x;
                const pdy = my - p.y;
                const pdist = Math.hypot(pdx, pdy);
                const delta = Math.abs(pdist - ringR);
                if (delta < PULSE_RING_WIDTH) {
                  const prox = 1 - delta / PULSE_RING_WIDTH;
                  const boost = prox * (1 - tt) * 0.6;
                  alpha = Math.min(0.7, alpha + boost);
                  r = r + (ar - r) * prox;
                  g = g + (ag - g) * prox;
                  bl = bl + (ab - bl) * prox;
                }
              }
            }

            ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // ── Pointer "tether" lines to nearby nodes
      if (active) {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const dx = n.x - smooth.x;
          const dy = n.y - smooth.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < POINTER_RADIUS_SQ) {
            const t = 1 - Math.sqrt(distSq) / POINTER_RADIUS;
            ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${t * 0.45})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(smooth.x, smooth.y);
            ctx.lineTo(n.x, n.y);
            ctx.stroke();
          }
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

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
