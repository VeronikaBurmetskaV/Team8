import { useEffect, useRef, useState } from "react";

/**
 * Follows the height of an element, so a motion container around it can animate to that
 * height (the /login card between tabs, «Усі бренди» on the home page).
 */
export function useContentHeight<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.target.getBoundingClientRect().height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, height };
}
