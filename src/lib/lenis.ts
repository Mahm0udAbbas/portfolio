import type Lenis from "lenis";

/** Shared handle so the preloader / mobile menu can pause smooth scrolling. */
let instance: Lenis | null = null;

export const setLenis = (l: Lenis | null) => {
  instance = l;
};
export const getLenis = () => instance;

/** Fired on window when the preloader finishes and the page is interactive. */
export const PRELOADER_DONE = "preloader:done";

export const isPreloading = () =>
  typeof document !== "undefined" && document.documentElement.hasAttribute("data-preloading");
