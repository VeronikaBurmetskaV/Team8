/**
 * The only builder of outbound links to brand sites (US-32, CLAUDE.md §5.3).
 * Adds `utm_source=fulla` before any `#fragment`; keeps an existing `utm_source` unchanged.
 * Returns null for null, undefined, "" and anything that is not an http(s) URL, so the caller
 * renders no link.
 */
export function withUtm(productUrl: string | null | undefined): string | null {
  // An old or broken answer may have no URL at all: no link, never an exception.
  if (typeof productUrl !== "string") return null;
  const trimmed = productUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;

  const hashIndex = trimmed.indexOf("#");
  const base = hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? "" : trimmed.slice(hashIndex);

  const queryIndex = base.indexOf("?");
  const query = queryIndex === -1 ? "" : base.slice(queryIndex + 1);
  const hasUtmSource = query
    .split("&")
    .some((pair) => pair.split("=")[0] === "utm_source");
  if (hasUtmSource) return trimmed;

  let separator = "?";
  if (queryIndex !== -1) separator = query === "" ? "" : "&";
  return `${base}${separator}utm_source=fulla${fragment}`;
}
