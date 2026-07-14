"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ButtonLink } from "@/components/ui/Button";
import { buttonStyles, type ButtonSize } from "@/components/ui/button-styles";

type RadialAction = {
  href: string;
  label: string;
};

// Desktop: the pills fan out on a circle around the trigger (0° points
// right, negative angles point up). Mobile: a circle either overflows the
// narrow viewport (the page does not clip overflow-x) or lands the pills on
// the page title, so they stack straight down from the trigger instead — a
// compact speed dial that avoids covering the page heading above.
const DESKTOP_ARC: [number, number] = [-50, 50];
const DESKTOP_RADIUS = 110;
const MOBILE_LIFT = 52;
const MOBILE_STEP = 44;

function arcOffset(
  index: number,
  count: number,
  [from, to]: [number, number],
  radius: number,
) {
  const angle =
    count === 1 ? (from + to) / 2 : from + (index * (to - from)) / (count - 1);
  const radians = (angle * Math.PI) / 180;
  return {
    x: Math.round(Math.cos(radians) * radius),
    y: Math.round(Math.sin(radians) * radius),
  };
}

function stackOffset(index: number) {
  return { x: 0, y: MOBILE_LIFT + MOBILE_STEP * index };
}

// A trigger pill that fans its action links out in a circle around itself.
// Opens on mouse hover (with a grace period so the pointer can cross the
// gap to a pill), toggles on click/Enter for touch and keyboard, closes on
// Escape, focus leaving the cluster, or a tap outside.
export default function RadialActions({
  label,
  actions,
  size = "sm",
}: {
  label: string;
  actions: RadialAction[];
  size?: ButtonSize;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);
  const panelId = useId();

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative inline-flex"
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        cancelClose();
        setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        cancelClose();
        closeTimer.current = window.setTimeout(() => setOpen(false), 300);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={buttonStyles({
          variant: "secondary",
          size,
          className: "gap-1.5",
        })}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className={`h-3.5 w-3.5 transition-transform duration-200 ${
            open ? "rotate-45" : ""
          }`}
          aria-hidden="true"
        >
          <path d="M8 3v10M3 8h10" />
        </svg>
        {label}
      </button>
      <div id={panelId} className="contents">
        {actions.map((action, index) => {
          const mobile = stackOffset(index);
          const desktop = arcOffset(index, actions.length, DESKTOP_ARC, DESKTOP_RADIUS);

          return (
            <span
              key={action.href}
              className={`absolute left-1/2 top-1/2 z-20 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ${
                open
                  ? "opacity-100 transform-[translate(calc(var(--tx-m)-50%),calc(var(--ty-m)-50%))_scale(1)] sm:transform-[translate(calc(var(--tx)-50%),calc(var(--ty)-50%))_scale(1)]"
                  : "pointer-events-none opacity-0 transform-[translate(-50%,-50%)_scale(0.5)]"
              }`}
              style={
                {
                  "--tx-m": `${mobile.x}px`,
                  "--ty-m": `${mobile.y}px`,
                  "--tx": `${desktop.x}px`,
                  "--ty": `${desktop.y}px`,
                  transitionDelay: open ? `${40 * index}ms` : "0ms",
                } as CSSProperties
              }
            >
              <ButtonLink
                href={action.href}
                variant="secondary"
                size={size}
                tabIndex={open ? 0 : -1}
                aria-hidden={!open}
                className="whitespace-nowrap shadow-[0_10px_30px_rgba(2,6,23,0.16)]"
              >
                {action.label}
              </ButtonLink>
            </span>
          );
        })}
      </div>
    </div>
  );
}
