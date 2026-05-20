"use client";

import { useEffect, useRef } from "react";

const GRID_SIZE = 56;
const BASE_SQUARE = 5;
const INFLUENCE_RADIUS = 200;

type Palette = {
  base: string;
  accent: [number, number, number];
};

const LIGHT_PALETTE: Palette = {
  base: "rgba(82, 98, 119, 0.14)",
  accent: [99, 102, 241],
};

const DARK_PALETTE: Palette = {
  base: "rgba(147, 164, 186, 0.16)",
  accent: [129, 140, 248],
};

export default function InteractiveBackgroundGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999, active: false };
    const smooth = { x: -9999, y: -9999 };
    let palette: Palette =
      document.documentElement.dataset.theme === "dark"
        ? DARK_PALETTE
        : LIGHT_PALETTE;

    const resize = () => {
      const { innerWidth: w, innerHeight: h } = window;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const updateTheme = () => {
      palette =
        document.documentElement.dataset.theme === "dark"
          ? DARK_PALETTE
          : LIGHT_PALETTE;
    };

    const onMove = (event: PointerEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      if (!mouse.active) {
        smooth.x = mouse.x;
        smooth.y = mouse.y;
      }
      mouse.active = true;
    };

    const onLeave = () => {
      mouse.active = false;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
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
      ctx.clearRect(0, 0, w, h);

      smooth.x += (mouse.x - smooth.x) * 0.18;
      smooth.y += (mouse.y - smooth.y) * 0.18;

      const cols = Math.ceil(w / GRID_SIZE) + 1;
      const rows = Math.ceil(h / GRID_SIZE) + 1;
      const offsetX = ((w % GRID_SIZE) - GRID_SIZE) / 2;
      const offsetY = ((h % GRID_SIZE) - GRID_SIZE) / 2;
      const active = mouse.active && !reduceMotion;
      const [ar, ag, ab] = palette.accent;
      const radiusSq = INFLUENCE_RADIUS * INFLUENCE_RADIUS;

      for (let r = 0; r < rows; r++) {
        const y = r * GRID_SIZE + offsetY + GRID_SIZE / 2;
        for (let c = 0; c < cols; c++) {
          const x = c * GRID_SIZE + offsetX + GRID_SIZE / 2;

          let size = BASE_SQUARE;
          let rotation = 0;
          let fill = palette.base;

          if (active) {
            const dx = x - smooth.x;
            const dy = y - smooth.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < radiusSq) {
              const t = 1 - Math.sqrt(distSq) / INFLUENCE_RADIUS;
              const eased = t * t * (3 - 2 * t);
              size = BASE_SQUARE + eased * 14;
              rotation = eased * (Math.PI / 4);
              const alpha = 0.22 + eased * 0.6;
              fill = `rgba(${ar}, ${ag}, ${ab}, ${alpha})`;
            }
          }

          ctx.save();
          ctx.translate(x, y);
          if (rotation) ctx.rotate(rotation);
          ctx.fillStyle = fill;
          ctx.fillRect(-size / 2, -size / 2, size, size);
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onLeave);
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
