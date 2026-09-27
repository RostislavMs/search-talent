"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  allowsCookieCategory,
  cookieConsentUpdatedEvent,
  type CookieConsent,
} from "@/lib/cookie-consent";
import {
  buildFirstTouch,
  FIRST_TOUCH_STORAGE_KEY,
  parseFirstTouch,
  serializeFirstTouch,
  toSignupSourcePayload,
} from "@/lib/first-touch";

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(FIRST_TOUCH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: string | null) {
  try {
    if (value === null) {
      window.localStorage.removeItem(FIRST_TOUCH_STORAGE_KEY);
    } else {
      window.localStorage.setItem(FIRST_TOUCH_STORAGE_KEY, value);
    }
  } catch {
    // Private mode or blocked storage: no sign-up source, nothing else lost.
  }
}

function getLandingUrl(): string {
  const [entry] = performance.getEntriesByType?.("navigation") ?? [];
  return entry?.name || window.location.href;
}

/**
 * Remembers where a guest's first visit came from and reports it once after
 * they sign up (see lib/first-touch). Renders nothing.
 *
 * Only runs with analytics consent. Withdrawing consent deletes the stored
 * value; an account that already exists never starts a new record, because its
 * sign-up happened before anything we could see.
 */
export default function FirstTouchTracker({
  initialAllowed,
  isSignedIn,
}: {
  initialAllowed: boolean;
  isSignedIn: boolean;
}) {
  const [allowed, setAllowed] = useState(initialAllowed);

  useEffect(() => {
    const handleConsentUpdate = (event: Event) => {
      const consent = (event as CustomEvent<CookieConsent>).detail;
      setAllowed(allowsCookieCategory(consent, "analytics"));
    };

    window.addEventListener(cookieConsentUpdatedEvent, handleConsentUpdate);
    return () => {
      window.removeEventListener(cookieConsentUpdatedEvent, handleConsentUpdate);
    };
  }, []);

  useEffect(() => {
    if (!allowed) {
      writeStorage(null);
      return;
    }

    const stored = parseFirstTouch(readStorage());

    if (!stored) {
      if (isSignedIn) {
        return;
      }
      const touch = buildFirstTouch({
        landingUrl: getLandingUrl(),
        documentReferrer: document.referrer,
        now: Date.now(),
      });
      if (touch) {
        writeStorage(serializeFirstTouch(touch));
      }
      return;
    }

    if (!isSignedIn || stored.sent) {
      return;
    }

    void apiFetch<{ recorded: boolean }>("/api/metrics/signup-source", {
      method: "POST",
      body: toSignupSourcePayload(stored, Date.now()),
    }).then((result) => {
      // A 4xx will not succeed on retry either; only a network or server
      // failure leaves the record for the next page load.
      if (result.ok || (result.status >= 400 && result.status < 500)) {
        writeStorage(serializeFirstTouch({ ...stored, sent: true }));
      }
    });
  }, [allowed, isSignedIn]);

  return null;
}
