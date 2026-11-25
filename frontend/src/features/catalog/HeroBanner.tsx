import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { preload } from "react-dom";
import { Link, useLocation } from "react-router";
import cardPng from "../../assets/hero/fulla-hero-layer-card.png";
import cardWebp from "../../assets/hero/fulla-hero-layer-card.webp";
import bgWebp from "../../assets/hero/fulla-hero-layer-bg.webp";
import { withFilterParams } from "../../shared/filterLinks";
import { catalogTexts as t } from "../../shared/messages.uk";
import { revealDelay, useReveal } from "../../shared/reveal";
import styles from "./CatalogPage.module.css";

/**
 * Hero banner of the home page: the whole block is a link to /feed. Behind the text a
 * blurred product card "swipes" left and right over a light background (CSS animation,
 * transform only). The card is decorative. With prefers-reduced-motion the CSS shows one
 * static picture instead; off screen the animation is paused.
 */
export function HeroBanner() {
  // The background layer is the first thing the banner paints: fetch it early.
  preload(bgWebp, { as: "image", type: "image/webp", fetchPriority: "high" });

  const ref = useRef<HTMLAnchorElement>(null);
  const onScreen = useOnScreen(ref);

  // Entrance: the banner block rises first, then heading, subtitle and button. Only the
  // container and the text move — the swiping card layer keeps its own animation.
  const revealBanner = useReveal<HTMLAnchorElement>(revealDelay.banner, true);
  const bannerRef = useCallback(
    (element: HTMLAnchorElement | null) => {
      ref.current = element;
      return revealBanner(element);
    },
    [revealBanner],
  );
  const titleRef = useReveal<HTMLHeadingElement>(revealDelay.bannerTitle);
  const subtitleRef = useReveal<HTMLParagraphElement>(
    revealDelay.bannerSubtitle,
  );
  const ctaRef = useReveal<HTMLSpanElement>(revealDelay.bannerCta);
  // The swipe feed opens with the catalogue's current filters (shared through the URL).
  const { search } = useLocation();

  return (
    <Link
      ref={bannerRef}
      to={withFilterParams("/feed", search)}
      className={styles.banner}
      data-animation={onScreen ? "running" : "paused"}
    >
      <div className={styles.bannerCard} aria-hidden="true">
        <picture>
          <source srcSet={cardWebp} type="image/webp" />
          <img
            className={styles.bannerCardImage}
            src={cardPng}
            alt=""
            decoding="async"
          />
        </picture>
      </div>
      <div className={styles.bannerVeil} aria-hidden="true" />
      <h1 ref={titleRef} className={styles.bannerTitle}>
        {t.bannerTitle}
      </h1>
      <p ref={subtitleRef} className={styles.bannerSubtitle}>
        {t.bannerSubtitle}
      </p>
      <span ref={ctaRef} className={styles.bannerCta}>
        {t.bannerCta}
      </span>
    </Link>
  );
}

/** True while the element is (partly) in the viewport; true where IntersectionObserver is missing. */
function useOnScreen(ref: RefObject<Element | null>): boolean {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry !== undefined) setOnScreen(entry.isIntersecting);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return onScreen;
}
