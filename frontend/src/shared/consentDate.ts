const consentDate = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  // The cabinet is Ukrainian; a fixed zone keeps the date the same on every laptop.
  timeZone: "Europe/Kyiv",
});

/** ISO-8601 UTC timestamp of the API (consentGivenAt) → «23.11.2026». */
export function formatConsentDate(iso: string): string {
  return consentDate.format(new Date(iso));
}
