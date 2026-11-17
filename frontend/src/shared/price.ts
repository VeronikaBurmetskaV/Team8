/**
 * Price as the buyer sees it everywhere: «2400 грн» — no thousands separator (US-08.2 CL).
 * The API sends whole hryvnias (`priceUah`), so there are no kopiyky to show.
 */
export function formatPrice(priceUah: number): string {
  return `${Math.round(priceUah)} грн`;
}
