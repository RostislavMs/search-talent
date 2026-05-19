"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#0f172a",
          color: "#f8fafc",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <p
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              opacity: 0.7,
              margin: 0,
            }}
          >
            Critical Error
          </p>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 600,
              marginTop: "1rem",
              marginBottom: 0,
            }}
          >
            The application could not start.
          </h1>
          <p
            style={{
              marginTop: "1rem",
              lineHeight: 1.6,
              opacity: 0.85,
            }}
          >
            Please reload the page. If the problem persists, contact support.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: "0.75rem",
                fontSize: "0.75rem",
                opacity: 0.6,
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "2rem",
              padding: "0.75rem 1.5rem",
              borderRadius: "9999px",
              border: "none",
              background: "#f8fafc",
              color: "#0f172a",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
