import type { PublicCard } from "../../api/types";
import {
  browserStorage,
  safeGet,
  safeSet,
  type KeyValueStorage,
} from "../../shared/storage";

/**
 * «Одразу в кошик»: a list of products kept only in this browser (localStorage).
 * There is no cart on the server; buying still happens on the brand's site (INV-06).
 */
export const CART_STORAGE_KEY = "fulla.cart.v1";

export type CartItem = Pick<
  PublicCard,
  "id" | "name" | "brandName" | "priceUah" | "photoUrl" | "productUrl"
>;

interface StoredCart {
  version: 1;
  items: CartItem[];
}

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.brandName === "string" &&
    typeof item.priceUah === "number" &&
    typeof item.photoUrl === "string" &&
    typeof item.productUrl === "string"
  );
}

/** The saved items, oldest first. Broken or foreign data reads as an empty cart. */
export function readCart(storage = browserStorage()): CartItem[] {
  const raw = safeGet(storage, CART_STORAGE_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as { version?: unknown }).version !== 1
    ) {
      return [];
    }
    const items = (parsed as { items?: unknown }).items;
    return Array.isArray(items) ? items.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[], storage: KeyValueStorage | undefined) {
  const value: StoredCart = { version: 1, items };
  safeSet(storage, CART_STORAGE_KEY, JSON.stringify(value));
}

/** Adds a product once; adding the same ID again changes nothing. Returns the new list. */
export function addToCart(
  product: CartItem,
  storage = browserStorage(),
): CartItem[] {
  const items = readCart(storage);
  if (items.some((item) => item.id === product.id)) return items;
  const item: CartItem = {
    id: product.id,
    name: product.name,
    brandName: product.brandName,
    priceUah: product.priceUah,
    photoUrl: product.photoUrl,
    productUrl: product.productUrl,
  };
  const next = [...items, item];
  writeCart(next, storage);
  return next;
}

/** Removes a product by ID. Returns the new list. */
export function removeFromCart(
  id: string,
  storage = browserStorage(),
): CartItem[] {
  const next = readCart(storage).filter((item) => item.id !== id);
  writeCart(next, storage);
  return next;
}
