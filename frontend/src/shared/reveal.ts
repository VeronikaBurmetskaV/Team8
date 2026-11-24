import { useCallback } from "react";

/*
 * Entrance animation: an element gently rises into place (translateY + opacity, see
 * `[data-reveal]` in index.css) when it enters the viewport — once per element.
 *
 *   const ref = useReveal(revealDelay.banner);           // order on page load
 *   <section ref={ref}>…</section>
 *
 * - On page load everything already in view starts in reading order: each element has its
 *   own delay on one shared timeline that begins with the first reveal of the page.
 * - Later (scrolling, «Показати ще», new data) elements reveal in small batches with a short
 *   stagger, and nothing that was already shown animates again.
 * - Safe by default: the hidden state is set by JS only. Without IntersectionObserver, with
 *   prefers-reduced-motion or before this code runs, elements are simply visible.
 */

/** Delays (ms) of the page-load timeline, in reading order: groups ~100 ms apart. */
export const revealDelay = {
  headerLogo: 0,
  headerPrefs: 100,
  headerIcons: 200,
  banner: 300,
  bannerTitle: 400,
  bannerSubtitle: 500,
  bannerCta: 600,
  toolbar: 700,
  cards: 800,
} as const;

/** Stagger between product cards and the latest start of anything visible on load. */
export const CARD_STAGGER_MS = 70;
export const LOAD_DELAY_CAP_MS = 1100;
/** After the load phase: stagger inside one batch of newly visible elements, and its cap. */
export const BATCH_STAGGER_MS = 70;
export const BATCH_DELAY_CAP_MS = 350;
/** How long after the first reveal the page-load timeline is used. */
export const LOAD_PHASE_MS = 1200;
const THRESHOLD = 0.15;

/** Page-load delay of the card at `index` in the grid (reading order), capped. */
export function cardRevealDelay(index: number): number {
  return Math.min(
    revealDelay.cards + index * CARD_STAGGER_MS,
    LOAD_DELAY_CAP_MS,
  );
}

/**
 * Delay of one element that has just become visible.
 * `elapsed` = ms since the page's first reveal; `batchIndex` = its place among the elements
 * that became visible together.
 */
export function effectiveRevealDelay(
  ownDelay: number,
  elapsed: number,
  batchIndex: number,
): number {
  if (elapsed < LOAD_PHASE_MS) {
    // Same timeline for elements that mount a little later (e.g. cards after the fetch).
    return Math.max(0, ownDelay - elapsed);
  }
  return Math.min(batchIndex * BATCH_STAGGER_MS, BATCH_DELAY_CAP_MS);
}

const ownDelays = new WeakMap<Element, number>();
let observer: IntersectionObserver | null = null;
let firstRevealAt: number | null = null;

function canAnimate(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof IntersectionObserver !== "undefined" &&
    typeof window.matchMedia === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function show(element: HTMLElement, delay: number) {
  element.style.setProperty("--reveal-delay", `${delay}ms`);
  element.dataset.reveal = "shown";
  // When the rise is over, drop the animation: no lasting transform / stacking context.
  const done = (event: AnimationEvent) => {
    if (event.target !== element) return; // ignore animations of children
    element.dataset.reveal = "done";
    element.style.removeProperty("--reveal-delay");
    element.removeEventListener("animationend", done);
  };
  element.addEventListener("animationend", done);
}

function onIntersect(entries: IntersectionObserverEntry[]) {
  const visible = entries.filter((entry) => entry.isIntersecting);
  if (visible.length === 0) return;
  const now = performance.now();
  firstRevealAt ??= now;
  const elapsed = now - firstRevealAt;
  visible.forEach((entry, batchIndex) => {
    const element = entry.target as HTMLElement;
    observer?.unobserve(element);
    const own = ownDelays.get(element) ?? 0;
    show(element, effectiveRevealDelay(own, elapsed, batchIndex));
  });
}

/**
 * Ref callback that reveals the element when it scrolls into view.
 * `delay` = its place on the page-load timeline (see `revealDelay`); `scale` adds a subtle
 * 0.98 → 1 for large blocks.
 */
export function useReveal<T extends HTMLElement>(
  delay = 0,
  scale = false,
): (element: T | null) => (() => void) | undefined {
  return useCallback(
    (element: T | null) => {
      if (element === null || !canAnimate()) return undefined;
      const state = element.dataset.reveal;
      if (state === "shown" || state === "done") return undefined;
      if (state === undefined) {
        // Set in the commit phase, before the browser paints: no flash of the final state.
        element.dataset.reveal = "hidden";
        if (scale) element.dataset.revealScale = "";
      }
      ownDelays.set(element, delay);
      observer ??= new IntersectionObserver(onIntersect, {
        threshold: THRESHOLD,
      });
      const current = observer;
      current.observe(element);
      return () => current.unobserve(element);
    },
    [delay, scale],
  );
}
