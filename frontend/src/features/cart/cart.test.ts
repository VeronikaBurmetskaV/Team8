import { describe, expect, it } from "vitest";
import { brokenStorage, memoryStorage } from "../../shared/testStorage";
import {
  addToCart,
  CART_STORAGE_KEY,
  readCart,
  removeFromCart,
  type CartItem,
} from "./cart";

function item(id: string): CartItem {
  return {
    id,
    name: `Сукня ${id}`,
    brandName: "Бренд",
    priceUah: 2400,
    photoUrl: `https://img.example/${id}.jpg`,
    productUrl: `https://brand.example/${id}`,
  };
}

describe("cart in localStorage", () => {
  it("is empty when nothing is stored", () => {
    expect(readCart(memoryStorage())).toEqual([]);
  });

  it("saves added items in order and reads them back", () => {
    const storage = memoryStorage();
    addToCart(item("a"), storage);
    addToCart(item("b"), storage);
    expect(readCart(storage).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("stores only the cart fields, not the whole feed card", () => {
    const storage = memoryStorage();
    addToCart(
      { ...item("a"), description: "довгий опис" } as CartItem,
      storage,
    );
    expect(readCart(storage)[0]).toEqual(item("a"));
  });

  it("does not add the same product twice", () => {
    const storage = memoryStorage();
    addToCart(item("a"), storage);
    const result = addToCart(item("a"), storage);
    expect(result).toHaveLength(1);
    expect(readCart(storage)).toHaveLength(1);
  });

  it("removes an item by id", () => {
    const storage = memoryStorage();
    addToCart(item("a"), storage);
    addToCart(item("b"), storage);
    expect(removeFromCart("a", storage).map((i) => i.id)).toEqual(["b"]);
    expect(readCart(storage).map((i) => i.id)).toEqual(["b"]);
  });

  it("reads broken JSON or another version as an empty cart", () => {
    const storage = memoryStorage();
    storage.setItem(CART_STORAGE_KEY, "{not json");
    expect(readCart(storage)).toEqual([]);
    storage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ version: 2, items: [item("a")] }),
    );
    expect(readCart(storage)).toEqual([]);
  });

  it("drops malformed items", () => {
    const storage = memoryStorage();
    storage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ version: 1, items: [item("a"), { id: 5 }] }),
    );
    expect(readCart(storage).map((i) => i.id)).toEqual(["a"]);
  });

  it("survives a storage that throws", () => {
    const storage = brokenStorage();
    expect(readCart(storage)).toEqual([]);
    expect(() => addToCart(item("a"), storage)).not.toThrow();
    expect(() => removeFromCart("a", storage)).not.toThrow();
  });
});
