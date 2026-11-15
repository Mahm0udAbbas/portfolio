"use client";

/**
 * Tiny registry of "things the preloader should wait for".
 * Anything heavy (3D models, textures, hero video) calls `trackAsset(promise)` as it starts loading;
 * the preloader reads `assetProgress()` for its bar and awaits `assetsSettled()` before the outro.
 */

let total = 0;
let done = 0;
const pending = new Set<Promise<unknown>>();

export function trackAsset<T>(promise: Promise<T>): Promise<T> {
  total++;
  pending.add(promise);
  promise.finally(() => {
    done++;
    pending.delete(promise);
  });
  return promise;
}

/** 0 → 1. With nothing tracked yet, reports 1 so the bar isn't blocked. */
export function assetProgress(): number {
  return total === 0 ? 1 : done / total;
}

/** Resolves when every tracked asset has settled, or after `timeoutMs` — never blocks forever. */
export function assetsSettled(timeoutMs = 8000): Promise<void> {
  const all = Promise.allSettled([...pending]).then(() => undefined);
  const timeout = new Promise<void>((r) => setTimeout(r, timeoutMs));
  return Promise.race([all, timeout]);
}

/** Built-in waits every page has: web fonts + window load. Call once, early. */
let builtinsTracked = false;
export function trackPageBasics() {
  if (builtinsTracked || typeof window === "undefined") return;
  builtinsTracked = true;
  trackAsset(document.fonts.ready);
  if (document.readyState !== "complete") {
    trackAsset(new Promise<void>((r) => window.addEventListener("load", () => r(), { once: true })));
  }
}
