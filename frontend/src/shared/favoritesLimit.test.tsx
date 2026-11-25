import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { FavoritesLimitDialogView } from "./FavoritesLimitDialog";
import {
  FAVORITES_LIMIT_ACCOUNT,
  FAVORITES_LIMIT_GUEST,
  hideFavoritesLimit,
  isNearLimit,
  useFavoritesLimit,
} from "./favoritesLimit";
import {
  addToFavorites,
  createProductList,
  favoriteAddResult,
  toggleFavorite,
  type SavedProduct,
} from "./productLists";
import { SavedProductsView } from "./SavedProducts/SavedProducts";
import { initialSavedProductsState } from "./SavedProducts/savedProductsState";
import { memoryStorage } from "./testStorage";
import { MemoryRouter } from "react-router";

const product = (id: string): SavedProduct => ({
  id,
  name: `Товар ${id}`,
  brandName: "Lileya",
  priceUah: 1000,
  photoUrl: "https://img.example/x.jpg",
  productUrl: "https://brand.example/x",
});

function fullList(count: number) {
  const storage = memoryStorage();
  const list = createProductList("test.favorites", () => storage);
  for (let i = 1; i <= count; i += 1) list.add(product(`p${i}`));
  return list;
}

afterEach(() => hideFavoritesLimit());

describe("favourites limit", () => {
  it("is 25 for a guest and 100 for an account; everyone is a guest until US-03", () => {
    expect(FAVORITES_LIMIT_GUEST).toBe(25);
    expect(FAVORITES_LIMIT_ACCOUNT).toBe(100);
    expect(useFavoritesLimit()).toEqual({ limit: 25, isAccount: false });
  });

  it("a guest can add 25; the 26th is not added", () => {
    const list = fullList(0);
    for (let i = 1; i <= 25; i += 1) {
      expect(
        addToFavorites(product(`p${i}`), list, FAVORITES_LIMIT_GUEST),
      ).toBe("added");
    }
    expect(addToFavorites(product("p26"), list, FAVORITES_LIMIT_GUEST)).toBe(
      "limit",
    );
    expect(list.read()).toHaveLength(25);
    expect(list.has("p26")).toBe(false);
  });

  it("adding a product that is already there is fine at the limit (no dialog)", () => {
    const list = fullList(25);
    expect(addToFavorites(product("p3"), list, FAVORITES_LIMIT_GUEST)).toBe(
      "already",
    );
    expect(favoriteAddResult(list.read(), "p3", 25)).toBe("already");
    expect(list.read()).toHaveLength(25);
  });

  it("the catalogue heart stays empty at the limit and can still remove", () => {
    const list = fullList(25);
    expect(toggleFavorite(product("new"), list, 25)).toBe("limit");
    expect(list.has("new")).toBe(false);
    expect(toggleFavorite(product("p1"), list, 25)).toBe("removed");
    expect(toggleFavorite(product("new"), list, 25)).toBe("added");
  });

  it("warns when 3 or fewer places are left", () => {
    expect(isNearLimit(21, 25)).toBe(false);
    expect(isNearLimit(22, 25)).toBe(true);
    expect(isNearLimit(25, 25)).toBe(true);
  });
});

type AnyProps = Record<string, unknown> & { children?: ReactNode };
function elements(node: ReactNode): ReactElement<AnyProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<AnyProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
const text = (node: ReactNode): string =>
  Array.isArray(node)
    ? node.map(text).join("")
    : typeof node === "string" || typeof node === "number"
      ? String(node)
      : isValidElement<AnyProps>(node)
        ? text(node.props.children)
        : "";

describe("«Вподобане заповнене» dialog", () => {
  const base = {
    open: true,
    titleId: "limit",
    reduceMotion: true,
    onRegister: () => {},
    onFavorites: () => {},
    onClose: () => {},
  };
  const buttons = (tree: ReactNode) =>
    elements(tree).filter((e) => e.type === "button");

  it("guest: «(25 з 25)» never breaks, the new text, ✕ and two actions — no «Скасувати»", () => {
    const tree = FavoritesLimitDialogView({
      ...base,
      limit: 25,
      isAccount: false,
    });
    const all = elements(tree);
    expect(text(all.find((e) => e.type === "h2"))).toBe(
      "Вподобане заповнене (25\u00A0з\u00A025)",
    );
    expect(text(all.find((e) => e.type === "p"))).toBe(
      "Щоб зберігати більше товарів, створіть акаунт. Або звільніть місце у вподобаному.",
    );
    const all_buttons = buttons(tree);
    expect(all_buttons[0]?.props["aria-label"]).toBe("Закрити");
    expect(all_buttons.slice(1).map(text)).toEqual([
      "Зареєструватися",
      "Перейти у вподобане",
    ]);
    expect(all_buttons.map(text)).not.toContain("Скасувати");
    expect(all[0]?.props.role).toBe("alertdialog");
  });

  it("account: the text as before and one full-width action", () => {
    const tree = FavoritesLimitDialogView({
      ...base,
      limit: 100,
      isAccount: true,
    });
    const all = elements(tree);
    expect(text(all.find((e) => e.type === "h2"))).toBe(
      "Вподобане заповнене (100\u00A0з\u00A0100)",
    );
    expect(text(all.find((e) => e.type === "p"))).toBe(
      "Видаліть кілька товарів, щоб додати нові.",
    );
    expect(buttons(tree).slice(1).map(text)).toEqual(["Перейти у вподобане"]);
  });

  it("✕, Esc and the backdrop close it, and nothing is added", () => {
    const list = fullList(25);
    // the like that opened the dialog was refused
    expect(addToFavorites(product("new"), list, 25)).toBe("limit");

    const onClose = vi.fn();
    const tree = FavoritesLimitDialogView({
      ...base,
      limit: 25,
      isAccount: false,
      onClose,
    });
    const dialog = elements(tree)[0];
    // ✕
    (buttons(tree)[0]?.props.onClick as () => void)();
    // Esc: the native <dialog> fires «cancel»
    (dialog?.props.onCancel as (event: { preventDefault(): void }) => void)({
      preventDefault: () => {},
    });
    // a click on the backdrop = on the <dialog> element itself
    const backdrop = { target: "dialog", currentTarget: "dialog" };
    (dialog?.props.onClick as (event: unknown) => void)(backdrop);
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(list.read()).toHaveLength(25);
    expect(list.has("new")).toBe(false);
  });
});

describe("the counter next to «Вподобане»", () => {
  function render(count: number) {
    return renderToString(
      <MemoryRouter>
        <SavedProductsView
          titleId="favorites-title"
          title="Вподобане"
          items={Array.from({ length: count }, (_, i) => product(`p${i}`))}
          emptyText="—"
          emptyLinks={[]}
          listLabel="Вподобані товари"
          removeLabel={(name) => name}
          onRemove={() => {}}
          limit={25}
          state={initialSavedProductsState}
          dispatch={() => {}}
          reduceMotion
          requestFocus={() => {}}
        />
      </MemoryRouter>,
    );
  }

  it("shows «N з 25», with the warning when ≤ 3 places are left", () => {
    const calm = render(18);
    expect(calm).toMatch(/<span[^>]*>18 з 25<\/span>/);
    expect(calm).not.toContain("data-warning");
    expect(render(22)).toMatch(
      /<span[^>]*data-warning="true"[^>]*>22 з 25<\/span>/,
    );
    expect(render(0)).toContain(">0 з 25<");
  });
});
