"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "info" | "success" | "error";

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  show: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((current) => [...current, { id, message, variant }]);
    },
    [],
  );

  const value: ToastContextValue = {
    show,
    success: useCallback((message) => show(message, "success"), [show]),
    error: useCallback((message) => show(message, "error"), [show]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6"
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

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(
      () => onDismiss(toast.id),
      TOAST_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const variantClass =
    toast.variant === "error"
      ? "border-rose-500/40 bg-rose-500/15 text-rose-50"
      : toast.variant === "success"
        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-50"
        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)]";

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      className={`pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-3 text-sm shadow-[0_20px_60px_rgba(2,6,23,0.35)] backdrop-blur ${variantClass}`}
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 leading-6">{toast.message}</p>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="cursor-pointer opacity-70 transition hover:opacity-100"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}
