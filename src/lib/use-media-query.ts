"use client";

import { useSyncExternalStore } from "react";

/**
 * Live media query. Returns `null` during SSR/hydration ("unknown"), so callers can render
 * nothing until the real answer is known — e.g. to avoid starting a WebGL download on phones.
 */
export function useMediaQuery(query: string): boolean | null {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => null,
  );
}
