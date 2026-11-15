import type Lenis from "lenis";

/** Shared handle so overlays / menus can pause smooth scrolling. */
let instance: Lenis | null = null;

export const setLenis = (l: Lenis | null) => {
  instance = l;
};
export const getLenis = () => instance;

/** Fired on window when the preloader finishes and the page is interactive. */
export const PRELOADER_DONE = "preloader:done";

/** Fire on window to open the command terminal (e.g. from a header button). */
export const OPEN_TERMINAL = "terminal:open";

export const isPreloading = () =>
  typeof document !== "undefined" && document.documentElement.hasAttribute("data-preloading");

/**
 * Ref-counted page scroll lock — the mobile menu, project overlay and terminal can stack
 * without one of them unlocking the page underneath another. Returns the unlock function.
 */
let locks = 0;
export function lockScroll() {
  if (++locks === 1) {
    instance?.stop();
    document.documentElement.style.overflow = "hidden";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) {
      instance?.start();
      document.documentElement.style.overflow = "";
    }
  };
}

/** Smooth-scroll to a section on the current page (after any lock has been released). */
export function scrollToSection(id: string) {
  requestAnimationFrame(() => {
    if (instance) instance.scrollTo(`#${id}`);
    else document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  });
}
