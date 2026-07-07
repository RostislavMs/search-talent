"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "info" | "success" | "warning" | "error";

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  show: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 5000;
// Must match the CSS transition duration used for the enter/leave slide.
const TOAST_EXIT_MS = 300;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      if (!message) return;
      idRef.current += 1;
      const id = idRef.current;
      setToasts((current) => [...current, { id, message, variant }]);
    },
    [],
  );

  // Memoized so consumers get a stable value — components can safely list the
  // toast helpers in effect/callback dependency arrays without churn.
  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message) => show(message, "success"),
      warning: (message) => show(message, "warning"),
      error: (message) => show(message, "error"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        // overflow-hidden clips the slide-out to the right so an off-screen
        // toast never adds a horizontal scrollbar; the vertical padding keeps
        // the soft shadow from being cut.
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 overflow-hidden px-4 py-2 sm:items-end sm:px-6"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const VARIANT_STYLES: Record<
  ToastVariant,
  { accent: string; icon: string; ring: string; iconPath: ReactNode }
> = {
  success: {
    accent: "border-l-emerald-500",
    icon: "bg-emerald-500/15 text-emerald-600",
    ring: "text-emerald-500",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 10 3.5 3.5 7.5-7.5"
      />
    ),
  },
  warning: {
    accent: "border-l-amber-500",
    icon: "bg-amber-500/15 text-amber-600",
    ring: "text-amber-500",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 6.5v4m0 3h.01"
      />
    ),
  },
  error: {
    accent: "border-l-rose-500",
    icon: "bg-rose-500/15 text-rose-600",
    ring: "text-rose-500",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m6.5 6.5 7 7m0-7-7 7"
      />
    ),
  },
  info: {
    accent: "border-l-[color:var(--accent)]",
    icon: "bg-[color:var(--surface-muted)] text-[color:var(--foreground)]",
    ring: "text-[color:var(--accent)]",
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 9v4.5m0-7h.01"
      />
    ),
  },
};

// Countdown ring geometry (viewBox 0 0 24 24).
const RING_RADIUS = 10;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  // `visible` drives the slide-in; `leaving` drives the slide-out. Both
  // out-states park the toast off to the right so it hides rightward.
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const closedRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);

  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    setLeaving(true);
    exitTimerRef.current = window.setTimeout(
      () => onDismiss(toast.id),
      TOAST_EXIT_MS,
    );
  }, [onDismiss, toast.id]);

  useEffect(() => {
    // Slide in on the next frame so the transition (and the ring countdown)
    // animate from their initial state.
    const raf = requestAnimationFrame(() => setVisible(true));
    const autoTimer = window.setTimeout(close, TOAST_DURATION_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(autoTimer);
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, [close]);

  const styles = VARIANT_STYLES[toast.variant];
  const shown = visible && !leaving;

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      className={`pointer-events-auto w-full max-w-xs rounded-2xl border border-l-4 app-border bg-[color:var(--surface)] px-3.5 py-2.5 text-sm shadow-[0_20px_60px_rgba(2,6,23,0.35)] backdrop-blur transition-all duration-300 ease-out ${styles.accent} ${
        shown ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${styles.icon}`}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-3.5 w-3.5"
          >
            {styles.iconPath}
          </svg>
        </span>
        <p className="flex-1 leading-6 text-[color:var(--foreground)]">
          {toast.message}
        </p>
        <button
          type="button"
          onClick={close}
          className={`relative -mr-1 -mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full app-muted transition hover:text-[color:var(--foreground)] ${styles.ring}`}
          aria-label="Dismiss notification"
        >
          {/* Circular countdown: the ring empties over the toast's lifetime. */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="absolute inset-0 h-full w-full -rotate-90"
            aria-hidden
          >
            <circle
              cx="12"
              cy="12"
              r={RING_RADIUS}
              stroke="currentColor"
              strokeWidth={2}
              className="opacity-20"
            />
            <circle
              cx="12"
              cy="12"
              r={RING_RADIUS}
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={visible ? RING_CIRCUMFERENCE : 0}
              style={{
                transition: `stroke-dashoffset ${TOAST_DURATION_MS}ms linear`,
              }}
            />
          </svg>
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="relative h-3 w-3 text-[color:var(--foreground)]"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m6 6 8 8m0-8-8 8"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Stable no-op used when no provider is reachable. Toasts are interaction-only
// feedback, so a consumer that renders without the provider in a given pass
// (e.g. an isolated server/dynamic SSR render where the context isn't wired up)
// should degrade silently rather than crash the whole render. In the normal
// tree the real provider value is returned, so behaviour is unchanged.
const NOOP_TOAST: ToastContextValue = {
  show: () => {},
  success: () => {},
  warning: () => {},
  error: () => {},
};

export function useToast() {
  return useContext(ToastContext) ?? NOOP_TOAST;
}
