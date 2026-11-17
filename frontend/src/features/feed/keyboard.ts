export type FeedCommand = "like" | "skip" | "flip";

/** What a key press means on the feed page, or null to let the browser handle it. */
export function feedCommandForKey(event: {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  /** Tag name of the focused element, e.g. "BUTTON". */
  targetTag?: string;
  targetEditable?: boolean;
}): FeedCommand | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
    return null;
  const tag = event.targetTag?.toUpperCase() ?? "";
  // Never steal typing from a form field.
  if (event.targetEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
    return null;
  }
  if (event.key === "ArrowRight") return "like";
  if (event.key === "ArrowLeft") return "skip";
  // Space on a focused button or link must press that button, not flip the card.
  if (event.key === " " && !["BUTTON", "A", "SUMMARY"].includes(tag)) {
    return "flip";
  }
  return null;
}
